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
)
from services.forge_service import ForgeService
from services.tool_registry import ToolRegistry
from services.ai_code_service import AICodeService
from services.agent_service import AgentService

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

@app.on_event("startup")
async def startup_event():
    """Initialize services on startup after env vars are loaded"""
    global forge_service, tool_registry, ai_code_service, agent_service
    
    # Check for API key
    api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
    if not api_key:
        print("WARNING: GOOGLE_API_KEY or GEMINI_API_KEY not found in environment variables.")
        print("AI features will not work. Please set GOOGLE_API_KEY in your .env file.")
    
    tool_registry = ToolRegistry()
    agent_service = AgentService()
    
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

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8080, reload=True)
