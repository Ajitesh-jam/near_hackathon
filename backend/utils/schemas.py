from pydantic import BaseModel
from typing import Optional
    
class AgentChatResponseSchema(BaseModel):
    text: str
    auto_fill: Optional[dict] = None
    
class AgentChatRequestSchema(BaseModel):
    message: str
    