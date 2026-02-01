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

# HITL Workflow Schemas
class ForgeSessionStartRequestSchema(BaseModel):
    user_id: str

class ForgeSessionStartResponseSchema(BaseModel):
    session_id: str
    status: str

class ForgeSessionStatusResponseSchema(BaseModel):
    session_id: str
    waiting_for_input: bool
    waiting_stage: str
    current_step: str
    template_code: Optional[Dict[str, str]] = None
    code_errors: Optional[List[Dict[str, Any]]] = None
    user_clarifications: Optional[List[Dict[str, Any]]] = None
    tool_changes: Optional[Dict[str, Any]] = None
    selected_tools: Optional[List[Dict[str, Any]]] = None
    agent_id: Optional[str] = None

class ToolSelectionRequestSchema(BaseModel):
    tools: List[Dict[str, Any]]

class CustomToolRequestSchema(BaseModel):
    requirements: str

class PromptSubmissionRequestSchema(BaseModel):
    prompt: str

class ClarificationResponseSchema(BaseModel):
    answers: List[Dict[str, Any]]  # [{"question": str, "answer": str}]

class ToolReviewRequestSchema(BaseModel):
    changes: Dict[str, Any]  # {"add": [str], "remove": [str], "confirmed": bool}

class CodeUpdateRequestSchema(BaseModel):
    file_path: str
    content: str

class CodeValidationResponseSchema(BaseModel):
    errors: List[Dict[str, Any]]

class EnvVariablesRequestSchema(BaseModel):
    env_variables: Dict[str, str]