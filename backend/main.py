from fastapi import FastAPI, Response, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
from dotenv import load_dotenv
import os
import time
import uvicorn

# Load environment variables first
load_dotenv()

import services.agent_service as chat_agent_service
from utils.schemas import (
    AgentChatRequestSchema,
    AgentChatResponseSchema,
    ToolInfoSchema,
    AgentGenerationRequestSchema,
    AgentGenerationResponseSchema,
    ForgeProcessRequestSchema,
    ForgeProcessResponseSchema,
    ToolGenerationRequestSchema,
    LogicGenerationRequestSchema,
    ForgeSessionStartRequestSchema,
    ForgeSessionStatusResponseSchema,
    ToolSelectionRequestSchema,
    CustomToolRequestSchema,
    PromptSubmissionRequestSchema,
    ClarificationResponseSchema,
    ToolReviewRequestSchema,
    CodeUpdateRequestSchema,
)
from services.forge_service import ForgeService
from services.tool_registry import ToolRegistry
from services.ai_code_service import AICodeService
from services.agent_service import AgentService
from services.session_service import SessionService

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

COMMON_HEADERS = {
    "X-Service-Name": "agent-api",
    "X-Service-Status": "ok",
}

# Initialize services lazily on startup
forge_service = None
tool_registry = None
ai_code_service = None
agent_service = None
session_service = None

@app.on_event("startup")
async def startup_event():
    """Initialize services on startup after env vars are loaded"""
    global forge_service, tool_registry, ai_code_service, agent_service, session_service
    
    # Check for API key
    api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("WARNING: GOOGLE_API_KEY or GEMINI_API_KEY not found in environment variables.")
        print("AI features will not work. Please set GOOGLE_API_KEY in your .env file.")
    
    tool_registry = ToolRegistry()
    agent_service = AgentService()
    session_service = SessionService()
    
    # Only initialize AI services if API key is available
    if api_key:
        forge_service = ForgeService()
        ai_code_service = AICodeService()
    else:
        print("Skipping AI service initialization due to missing API key.")

@app.get("/")
def health_check(response: Response):
    response.headers.update(COMMON_HEADERS)
    response.headers["X-Timestamp"] = str(time.time())
    return {"status": "healthy", "time": time.time()}

@app.post("/agent/chat")
async def agent_chat(request: AgentChatRequestSchema) -> AgentChatResponseSchema:
    response_data = chat_agent_service.run_agent(request.message)
    return AgentChatResponseSchema(text=response_data["text"], auto_fill=response_data["auto_fill"])

@app.get("/tools/list")
async def list_tools(user_id: Optional[str] = None):
    """Returns available tools (platform + temporary if user_id provided)"""
    if tool_registry is None:
        raise HTTPException(status_code=503, detail="Services not initialized.")
    tools = tool_registry.list_tools(user_id)
    return tools

@app.post("/forge/process")
async def forge_process(request: ForgeProcessRequestSchema) -> ForgeProcessResponseSchema:
    """Main LangGraph workflow entry point"""
    if forge_service is None:
        raise HTTPException(status_code=503, detail="AI services not initialized. Please set GOOGLE_API_KEY.")
    result = await forge_service.process(request.user_message, request.user_id)
    return ForgeProcessResponseSchema(
        agent_id=result.get("agent_id", ""),
        selected_tools=result.get("selected_tools", []),
        generated_tools=result.get("generated_tools", []),
        logic_code=result.get("logic_code", ""),
        current_step=result.get("current_step", "completed")
    )

@app.post("/tools/generate")
async def generate_tool(request: ToolGenerationRequestSchema):
    """AI generates custom tool"""
    if ai_code_service is None:
        raise HTTPException(status_code=503, detail="AI services not initialized. Please set GOOGLE_API_KEY.")
    tools = ai_code_service.generate_tool(request.requirements, request.existing_tools)
    return {"tools": tools}

@app.post("/logic/generate")
async def generate_logic(request: LogicGenerationRequestSchema):
    """AI generates logic.py code"""
    if ai_code_service is None:
        raise HTTPException(status_code=503, detail="AI services not initialized. Please set GOOGLE_API_KEY.")
    logic_code = ai_code_service.generate_logic(
        request.selected_tools,
        request.user_intent,
        request.agent_config
    )
    return {"logic_code": logic_code}

@app.get("/agents/list")
async def list_agents(user_id: str):
    """List user's agents"""
    if agent_service is None:
        raise HTTPException(status_code=503, detail="Services not initialized.")
    agents = agent_service.list_agents(user_id)
    return {"agents": agents}

@app.delete("/agents/{agent_id}")
async def remove_agent(agent_id: str, user_id: str):
    """Remove agent"""
    if agent_service is None:
        raise HTTPException(status_code=503, detail="Services not initialized.")
    success = agent_service.remove_agent(user_id, agent_id)
    if success:
        return {"status": "deleted", "agent_id": agent_id}
    raise HTTPException(status_code=404, detail="Agent not found")

@app.post("/agents")
async def create_agent(request: AgentGenerationRequestSchema) -> AgentGenerationResponseSchema:
    """Create agent (via LangGraph or direct)"""
    if agent_service is None:
        raise HTTPException(status_code=503, detail="Services not initialized.")
    agent_id = agent_service.create_agent(
        user_id=request.user_id,
        tools=request.selected_tools,
        logic_code="",  # Would be generated or provided
        config=request.config
    )
    return AgentGenerationResponseSchema(
        status="created",
        agent_id=agent_id,
        path=f"Temp/{request.user_id}/{agent_id}"
    )

@app.get("/agents/{agent_id}/code")
async def get_agent_code(agent_id: str, user_id: str):
    """Get the complete code structure for an agent"""
    if agent_service is None:
        raise HTTPException(status_code=503, detail="Services not initialized.")
    try:
        code_structure = agent_service.get_agent_code(user_id, agent_id)
        return code_structure
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading agent code: {str(e)}")

# HITL Workflow Endpoints

@app.post("/forge/start", response_model=ForgeSessionStatusResponseSchema)
async def start_forge_session(request: ForgeSessionStartRequestSchema):
    """Initialize new agent building session"""
    if session_service is None or forge_service is None:
        raise HTTPException(status_code=503, detail="Services not initialized.")
    
    # Create or get existing session
    session_id = session_service.create_session(request.user_id)
    
    # Start the workflow
    await forge_service.start_session(session_id, request.user_id)
    
    # Get the complete state and return it
    state = await forge_service.get_state(session_id)
    if not state:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return ForgeSessionStatusResponseSchema(
        session_id=session_id,
        waiting_for_input=state.get("waiting_for_input", False),
        waiting_stage=state.get("waiting_stage", ""),
        current_step=state.get("current_step", ""),
        template_code=state.get("template_code"),
        code_errors=state.get("code_errors"),
        user_clarifications=state.get("user_clarifications"),
        tool_changes=state.get("tool_changes"),
        selected_tools=state.get("selected_tools"),
        agent_id=state.get("agent_id")
    )

@app.get("/forge/session/{session_id}/status", response_model=ForgeSessionStatusResponseSchema)
async def get_session_status(session_id: str):
    """Get current session state"""
    if forge_service is None:
        raise HTTPException(status_code=503, detail="Services not initialized.")
    
    state = await forge_service.get_state(session_id)
    if not state:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return ForgeSessionStatusResponseSchema(
        session_id=session_id,
        waiting_for_input=state.get("waiting_for_input", False),
        waiting_stage=state.get("waiting_stage", ""),
        current_step=state.get("current_step", ""),
        template_code=state.get("template_code"),
        code_errors=state.get("code_errors"),
        user_clarifications=state.get("user_clarifications"),
        tool_changes=state.get("tool_changes"),
        selected_tools=state.get("selected_tools"),
        agent_id=state.get("agent_id")
    )

@app.post("/forge/session/{session_id}/tools")
async def submit_tools(session_id: str, request: ToolSelectionRequestSchema):
    """Submit selected tools"""
    if forge_service is None:
        raise HTTPException(status_code=503, detail="Services not initialized.")
    
    # Get current state
    config = {"configurable": {"thread_id": session_id}}
    current_state = forge_service.graph.get_state(config)
    if not current_state:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Update state with tools
    state_values = current_state.values.copy()
    state_values["selected_tools"] = request.tools
    state_values["waiting_for_input"] = False
    
    # Manually invoke the chain: update_tools_state → add_platform_tools → check custom tools → wait_for_prompt
    updated_state = forge_service._update_tools_state(state_values)
    updated_state = forge_service._add_platform_tools(updated_state)
    
    # Check if we need custom tools
    if forge_service._should_wait_for_custom_tools(updated_state) == "no":
        # Skip custom tools, go directly to prompt
        updated_state = forge_service._wait_for_prompt(updated_state)
    else:
        # Need custom tools
        updated_state = forge_service._wait_for_custom_tools(updated_state)
    
    # Update checkpoint
    forge_service.graph.update_state(config, updated_state)
    
    return await get_session_status(session_id)

@app.post("/forge/session/{session_id}/custom-tools")
async def submit_custom_tools(session_id: str, request: CustomToolRequestSchema):
    """Submit custom tool requirements"""
    if forge_service is None:
        raise HTTPException(status_code=503, detail="Services not initialized.")
    
    config = {"configurable": {"thread_id": session_id}}
    current_state = forge_service.graph.get_state(config)
    if not current_state:
        raise HTTPException(status_code=404, detail="Session not found")
    
    state_values = current_state.values.copy()
    state_values["custom_tool_requirements"] = request.requirements
    state_values["waiting_for_input"] = False
    
    # Manually invoke update_custom_tools_state since we're at END
    updated_state = forge_service._update_custom_tools_state(state_values)
    
    # Update checkpoint
    forge_service.graph.update_state(config, updated_state)
    
    result = await forge_service.resume_workflow(session_id)
    return await get_session_status(session_id)

@app.post("/forge/session/{session_id}/prompt")
async def submit_prompt(session_id: str, request: PromptSubmissionRequestSchema):
    """Submit user prompt"""
    if forge_service is None:
        raise HTTPException(status_code=503, detail="Services not initialized.")
    
    config = {"configurable": {"thread_id": session_id}}
    current_state = forge_service.graph.get_state(config)
    if not current_state:
        raise HTTPException(status_code=404, detail="Session not found")
    
    state_values = current_state.values.copy()
    state_values["user_message"] = request.prompt
    state_values["waiting_for_input"] = False
    
    # Manually invoke the chain: update_prompt_state → clarify_intent → wait_for_clarification
    updated_state = forge_service._update_prompt_state(state_values)
    updated_state = forge_service._clarify_intent(updated_state)
    updated_state = forge_service._wait_for_clarification(updated_state)
    
    # Update checkpoint
    forge_service.graph.update_state(config, updated_state)
    
    return await get_session_status(session_id)

@app.post("/forge/session/{session_id}/clarification")
async def submit_clarification(session_id: str, request: ClarificationResponseSchema):
    """Submit clarification answers"""
    if forge_service is None:
        raise HTTPException(status_code=503, detail="Services not initialized.")
    
    config = {"configurable": {"thread_id": session_id}}
    current_state = forge_service.graph.get_state(config)
    if not current_state:
        raise HTTPException(status_code=404, detail="Session not found")
    
    state_values = current_state.values.copy()
    state_values["user_clarifications"] = request.answers
    state_values["waiting_for_input"] = False
    
    # Manually invoke the chain: update_clarification_state → review_tools → apply changes → generate_logic → validate_code → wait_for_code_review/finalize
    updated_state = forge_service._update_clarification_state(state_values)
    
    # Continue automatically: review_tools → apply changes → generate_logic → validate_code
    updated_state = forge_service._review_tools(updated_state)
    
    # Apply tool changes if needed
    if forge_service._has_tool_changes(updated_state) == "yes":
        updated_state = forge_service._apply_tool_changes(updated_state)
    
    # Generate logic
    updated_state = forge_service._generate_logic(updated_state)
    
    # Validate code
    updated_state = forge_service._validate_code(updated_state)
    
    # Check if there are errors - if yes, wait for code review, if no, finalize
    if forge_service._has_code_errors(updated_state) == "yes":
        updated_state = forge_service._wait_for_code_review(updated_state)
    else:
        updated_state = forge_service._finalize_agent(updated_state)
    
    # Update checkpoint
    forge_service.graph.update_state(config, updated_state)
    
    return await get_session_status(session_id)

@app.post("/forge/session/{session_id}/tool-review")
async def submit_tool_review(session_id: str, request: ToolReviewRequestSchema):
    """Confirm/reject tool changes"""
    if forge_service is None:
        raise HTTPException(status_code=503, detail="Services not initialized.")
    
    config = {"configurable": {"thread_id": session_id}}
    current_state = forge_service.graph.get_state(config)
    if not current_state:
        raise HTTPException(status_code=404, detail="Session not found")
    
    state_values = current_state.values.copy()
    state_values["tool_changes"] = request.changes
    state_values["waiting_for_input"] = False
    
    # Manually invoke update_tool_review_state since we're at END
    updated_state = forge_service._update_tool_review_state(state_values)
    
    # Update checkpoint
    forge_service.graph.update_state(config, updated_state)
    
    result = await forge_service.resume_workflow(session_id)
    return await get_session_status(session_id)

@app.post("/forge/session/{session_id}/code-update")
async def update_code(session_id: str, request: CodeUpdateRequestSchema):
    """Submit code edits"""
    if forge_service is None:
        raise HTTPException(status_code=503, detail="Services not initialized.")
    
    config = {"configurable": {"thread_id": session_id}}
    current_state = forge_service.graph.get_state(config)
    if not current_state:
        raise HTTPException(status_code=404, detail="Session not found")
    
    state_values = current_state.values.copy()
    # Update template_code
    if "template_code" not in state_values:
        state_values["template_code"] = {}
    state_values["template_code"][request.file_path] = request.content
    state_values["waiting_for_input"] = False
    
    # Manually invoke update_code_state since we're at END
    updated_state = forge_service._update_code_state(state_values)
    
    # Update checkpoint
    forge_service.graph.update_state(config, updated_state)
    
    result = await forge_service.resume_workflow(session_id)
    return await get_session_status(session_id)

@app.post("/forge/session/{session_id}/finalize")
async def finalize_agent(session_id: str):
    """Finalize agent creation"""
    if forge_service is None:
        raise HTTPException(status_code=503, detail="Services not initialized.")
    
    config = {"configurable": {"thread_id": session_id}}
    current_state = forge_service.graph.get_state(config)
    if not current_state:
        raise HTTPException(status_code=404, detail="Session not found")
    
    state_values = current_state.values.copy()
    state_values["finalize"] = True
    state_values["waiting_for_input"] = False
    
    # Manually invoke finalize_agent since we're at END
    updated_state = forge_service._finalize_agent(state_values)
    
    # Update checkpoint
    forge_service.graph.update_state(config, updated_state)
    
    return await get_session_status(session_id)

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8080, reload=True)
