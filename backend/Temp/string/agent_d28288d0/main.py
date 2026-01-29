import asyncio
import os
from typing import Dict, List, Any
from logic import AgentLogic

class AgentManager:
    def __init__(self):
        self.config = self._load_config()
        self.active_tools = self._init_active_tools()
        self.reactive_tools = self._init_reactive_tools()
        self.logic = AgentLogic(
            active_tools=self.active_tools,
            reactive_tools=self.reactive_tools
        )
        self.active_tasks: List[asyncio.Task] = []
    
    def _load_config(self) -> Dict[str, Any]:
        return {
            "user_id": os.getenv("USER_ID", ""),
            "agent_id": os.getenv("AGENT_ID", ""),
        }
    
    def _init_active_tools(self) -> Dict[str, Any]:
        tools = {}
        # Initialize selected active tools
        return tools
    
    def _init_reactive_tools(self) -> Dict[str, Any]:
        tools = {}
        # Initialize selected reactive tools
        return tools
    
    async def _handle_active_trigger(self, tool_name: str, result: Dict[str, Any]):
        decision = await self.logic.on_trigger(tool_name, result)
        if decision.get("action") == "execute":
            reactive_tool = self.reactive_tools[decision["tool"]]
            reactive_result = reactive_tool.execute(**decision["params"])
            await self.logic.on_execution(decision, reactive_result)
    
    async def start(self):
        print(f"Starting Agent")
        for tool_name, tool in self.active_tools.items():
            task = asyncio.create_task(
                tool.run_loop(
                    callback=lambda result, name=tool_name: self._handle_active_trigger(name, result)
                )
            )
            self.active_tasks.append(task)
        await asyncio.gather(*self.active_tasks)
    
    async def stop(self):
        for tool in self.active_tools.values():
            tool.is_running = False

if __name__ == "__main__":
    manager = AgentManager()
    asyncio.run(manager.start())
