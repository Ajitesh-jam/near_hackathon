from pydantic import BaseModel
from typing import Optional, List, Dict, Any

class AgentChatResponseSchema(BaseModel):
    text: str
    auto_fill: Optional[dict] = None
    
class AgentChatRequestSchema(BaseModel):
    message: str

class ToolInfoSchema(BaseModel):
    name: str
    type: str
    description: str
    config_schema: Dict[str, Any]

class AgentGenerationRequestSchema(BaseModel):
    user_id: str
    agent_id: Optional[str] = None
    selected_tools: List[Dict[str, Any]]
    config: Dict[str, Any]

class AgentGenerationResponseSchema(BaseModel):
    status: str
    agent_id: str
    path: str

class ForgeProcessRequestSchema(BaseModel):
    user_message: str
    user_id: str

class ForgeProcessResponseSchema(BaseModel):
    agent_id: str
    selected_tools: List[Dict[str, Any]]
    generated_tools: List[Dict[str, Any]]
    logic_code: str
    current_step: str

class ToolGenerationRequestSchema(BaseModel):
    requirements: str
    existing_tools: List[Dict[str, Any]]

class LogicGenerationRequestSchema(BaseModel):
    selected_tools: List[Dict[str, Any]]
    user_intent: str
    agent_config: Dict[str, Any]
