from pydantic import BaseModel
from typing import Optional, List, Dict, Any, TypedDict


class ForgeState(TypedDict):
    session_id: str  # Unique session identifier (thread_id for LangGraph)
    user_message: str
    chat_history: List[Dict[str, str]]
    selected_tools: List[Dict[str, Any]]
    agent_config: Dict[str, Any]
    generated_tools: List[Dict[str, Any]]  # AI-generated tools
    logic_code: str
    agent_id: str
    current_step: str
    # HITL fields
    waiting_for_input: bool
    waiting_stage: str  # Current HITL stage name
    template_code: Dict[str, str]  # Dict of file paths to content
    code_errors: List[Dict[str, Any]]  # List of validation errors
    user_clarifications: List[Dict[str, Any]]  # Clarification questions/answers
    tool_changes: Dict[str, Any]  # Proposed tool additions/removals
    agent_dir_path: str  # Path to agent directory
    custom_tool_requirements: str  # Requirements for custom tools
    finalize: bool  # Flag to finalize agent    
    docker_tag: str  # Docker tag for agent
    
    # we Can store these varibales also it runs on a Shade-agent , 
    # but for enhanced privacy reasons we are not storing them here and will just add them directly to .env
    
    
    # near_account_id: str  # Near account id for agent
    # near_seed_phrase: str  # Near seed phrase for agent
    # near_rpc_json: str  # Near RPC JSON for agent
    # near_contract_id: str  # Near contract id for agent
    # near_contract_codehash: str  # Near contract codehash for agent
    # near_contract_app_codehash: str  # Near contract app codehash for agent
    # phala_api_key: str  # Phala API key for agent
    # near_ai_api_key: str  # Near AI API key for agent
    
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
    
    
    
    