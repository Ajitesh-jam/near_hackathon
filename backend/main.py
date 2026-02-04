from fastapi import FastAPI, Response, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
from dotenv import load_dotenv
import os
import time
import uvicorn
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Load environment variables first
load_dotenv()

import services.agent_service as chat_agent_service
from utils.schemas import (
    EnvVariablesRequestSchema,
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
from services.ai_code_service import AICodeService
from services.agent_service import AgentService
from services.session_service import SessionService
from utils.tool_registry import ToolRegistry

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
        logger.warning("GOOGLE_API_KEY or GEMINI_API_KEY not found in environment variables.")
        logger.warning("AI features will not work. Please set GOOGLE_API_KEY in your .env file.")
    
    tool_registry = ToolRegistry()
    agent_service = AgentService()
    session_service = SessionService()
    
    # Initialize Forge and AI services on startup if API key is available
    if api_key:
        forge_service = ForgeService()
        ai_code_service = AICodeService()
        logger.info("AI services initialized successfully")
    else:
        logger.warning("Skipping AI service initialization due to missing API key.")

@app.get("/")
def health_check(response: Response):
    response.headers.update(COMMON_HEADERS)
    response.headers["X-Timestamp"] = str(time.time())
    return {"status": "healthy", "time": time.time()}

@app.get("/tools/list")
async def list_tools(user_id: str = "default_user"):
    """Returns available tools (platform + temporary if user_id provided)"""
    logger.info(f"Listing tools for user {user_id}")
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

@app.get("/agents/{agent_id}/files")
async def get_agent_files(agent_id: str, user_id: str):
    """Get all agent files as flat path -> content (includes contract/, .env.development.local, docker-compose, etc.)"""
    logger.info(f"Getting agent files for agent {agent_id} and user {user_id}")
    if agent_service is None:
        raise HTTPException(status_code=503, detail="Services not initialized.")
    try:
        files = agent_service.get_agent_files_flat(user_id, agent_id)
        return {"template_code": files}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading agent files: {str(e)}")

@app.get("/forge/session/{session_id}/agent-files")
async def get_session_agent_files_handler(session_id: str):
    """Get all files from the session's agent directory (for in-progress forge sessions)"""
    if forge_service is None:
        raise HTTPException(status_code=503, detail="Services not initialized.")
    files = forge_service.get_session_agent_files(session_id)
    if files is None:
        raise HTTPException(status_code=404, detail="Session not found or agent directory not initialized")
    return {"template_code": files}


# HITL Workflow Endpoints
@app.post("/forge/start", response_model=ForgeSessionStatusResponseSchema)
async def start_forge_session(request: ForgeSessionStartRequestSchema):
    """Initialize new agent building session"""
    if session_service is None or forge_service is None:
        raise HTTPException(status_code=503, detail="Services not initialized.")
    
    session_id = session_service.create_session(request.user_id)
    await forge_service.start_session(session_id, request.user_id)
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
    state = await forge_service.handle_submit_tools(session_id, request.tools)
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

@app.post("/forge/session/{session_id}/custom-tools")
async def submit_custom_tools(session_id: str, request: CustomToolRequestSchema):
    """Submit custom tool requirements"""
    if forge_service is None:
        raise HTTPException(status_code=503, detail="Services not initialized.")
    state = await forge_service.handle_submit_custom_tools(session_id, request.requirements)
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

@app.post("/forge/session/{session_id}/prompt")
async def submit_prompt(session_id: str, request: PromptSubmissionRequestSchema):
    """Submit user prompt"""
    if forge_service is None:
        raise HTTPException(status_code=503, detail="Services not initialized.")
    state = await forge_service.handle_submit_prompt(session_id, request.prompt)
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

@app.post("/forge/session/{session_id}/clarification")
async def submit_clarification(session_id: str, request: ClarificationResponseSchema):
    """Submit clarification answers"""
    if forge_service is None:
        raise HTTPException(status_code=503, detail="Services not initialized.")
    state = await forge_service.handle_submit_clarification(session_id, request.answers)
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

@app.post("/forge/session/{session_id}/tool-review")
async def submit_tool_review(session_id: str, request: ToolReviewRequestSchema):
    """Confirm/reject tool changes"""
    if forge_service is None:
        raise HTTPException(status_code=503, detail="Services not initialized.")
    state = await forge_service.handle_submit_tool_review(session_id, request.changes)
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

@app.post("/forge/session/{session_id}/code-update")
async def update_code(session_id: str, request: CodeUpdateRequestSchema):
    """Submit code edits"""
    logger.info(f"Updating code for session {session_id} with file path {request.file_path}")
    if forge_service is None:
        raise HTTPException(status_code=503, detail="Services not initialized.")
    state = await forge_service.handle_update_code(session_id, request.file_path, request.content)
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

@app.post("/forge/session/{session_id}/finalize")
async def finalize_agent(session_id: str):
    """Finalize agent creation"""
    if forge_service is None:
        raise HTTPException(status_code=503, detail="Services not initialized.")
    state = await forge_service.handle_finalize_agent(session_id)
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
    
@app.post("/forge/session/{session_id}/env-variables")
async def submit_env_variables(session_id: str, request: EnvVariablesRequestSchema):
    """Submit environment variables"""
    if forge_service is None:
        raise HTTPException(status_code=503, detail="Services not initialized.")
    
    # check if user has passed all the required env variables
    if not request.env_variables:
        raise HTTPException(status_code=400, detail="Env variables are required")
    if not request.env_variables.get("NEAR_ACCOUNT_ID"):
        raise HTTPException(status_code=400, detail="NEAR_ACCOUNT_ID is required")
    if not request.env_variables.get("NEAR_SEED_PHRASE"):
        raise HTTPException(status_code=400, detail="NEAR_SEED_PHRASE is required")
    if not request.env_variables.get("PHALA_API_KEY"):
        raise HTTPException(status_code=400, detail="PHALA_API_KEY is required")

            
    state = await forge_service.handle_env_variables(session_id, request.env_variables)
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

@app.get("/forge/session/{session_id}/agent-files")
async def get_session_agent_files(session_id: str):
    """Get all files from the session's agent directory (for in-progress forge sessions)"""
    if forge_service is None:
        raise HTTPException(status_code=503, detail="Services not initialized.")
    files = forge_service.get_session_agent_files(session_id)
    if files is None:
        raise HTTPException(status_code=404, detail="Session not found or agent directory not initialized")
    return {"template_code": files}

@app.post("/forge/session/{session_id}/compile-contract")
async def compile_contract(session_id: str):
    """Compile contract"""
    if forge_service is None:
        raise HTTPException(status_code=503, detail="Services not initialized.")
    result = await forge_service.handle_compile_contract(session_id)
    if not result:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"status": "compiled"}

@app.post("/forge/session/{session_id}/build-docker-image")
async def build_docker_image(session_id: str):
    """Build docker image"""
    if forge_service is None:
        raise HTTPException(status_code=503, detail="Services not initialized.")
    result = await forge_service.handle_build_docker_image(session_id)
    if not result:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"status": "built"}

@app.post("/forge/session/{session_id}/deploy-agent")
async def deploy_agent(session_id: str):
    """Deploy agent"""
    if forge_service is None:
        raise HTTPException(status_code=503, detail="Services not initialized.")
    result = await forge_service.handle_deploy_agent(session_id)
    if not result:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"status": "deployed"}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8080, reload=True)