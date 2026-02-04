from typing import Dict, Any
import asyncio

class AgentLogic:
    def __init__(self, active_tools: Dict, reactive_tools: Dict):
        self.active_tools = active_tools
        self.reactive_tools = reactive_tools
        self.state = {}
    
    async def on_trigger(self, tool_name: str, result: Dict[str, Any]) -> Dict[str, Any]:
        """Called when an ACTIVE tool triggers"""
        return {"action": "wait"}
    
    async def on_execution(self, decision: Dict, result: Dict):
        """Called after reactive tool executes"""
        self.state["last_action"] = {"decision": decision, "result": result}