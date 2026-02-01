"""
Agent code templates as importable strings.
Used by forge_service and agent_service for generated agent codebases.
"""
from typing import List, Dict, Any
from config import Config
config = Config()

port_to_start_agent = config.port_to_start_agent

# --- Static template strings (forge minimal agent) ---

MAIN_PY_BASE = '''import asyncio
import os
import logging
from typing import Dict, List, Any
from logic import AgentLogic

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

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
        logger.info("Starting Agent")
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
'''

LOGIC_PY_DEFAULT = '''from typing import Dict, Any
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
'''

DOCKERFILE = '''FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["python", "main.py"]
'''

REQUIREMENTS_TXT = "asyncio\npython-dotenv\n"

TOOLS_INIT_PY = ""

# --- Template for dynamic main.py (agent_service with imports and config) ---

MAIN_PY_TEMPLATE = '''import asyncio
import os
import logging
from typing import Dict, List, Any
{active_imports}
{reactive_imports}
{port}
from logic import AgentLogic

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

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
        return {{
            "user_id": os.getenv("USER_ID", ""),
            "agent_id": os.getenv("AGENT_ID", ""),
            "selected_tools": {config_tools}
        }}
    
    def _init_active_tools(self) -> Dict[str, Any]:
        tools = {{}}
        # Initialize selected active tools
        return tools
    
    def _init_reactive_tools(self) -> Dict[str, Any]:
        tools = {{}}
        # Initialize selected reactive tools
        return tools
    
    async def _handle_active_trigger(self, tool_name: str, result: Dict[str, Any]):
        decision = await self.logic.on_trigger(tool_name, result)
        if decision.get("action") == "execute":
            reactive_tool = self.reactive_tools[decision["tool"]]
            reactive_result = reactive_tool.execute(**decision["params"])
            await self.logic.on_execution(decision, reactive_result)
    
    async def start(self):
        logger.info("Starting Agent")
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
'''


def get_main_py_content(
    active_imports: List[str],
    reactive_imports: List[str],
    tools: List[Dict[str, Any]],
) -> str:
    """Build main.py content with given import lines and tools list for config."""
    active_block = "\n".join(active_imports) if active_imports else ""
    reactive_block = "\n".join(reactive_imports) if reactive_imports else ""
    port = str(config.port_to_start_agent)
    config.port_to_start_agent+=1
    config_tools = repr(tools)
    return MAIN_PY_TEMPLATE.format(
        active_imports=active_block,
        reactive_imports=reactive_block,
        config_tools=config_tools,
        port=port,
    )
