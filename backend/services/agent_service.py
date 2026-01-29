from typing import List, Dict, Any
from pathlib import Path
import json
import shutil
from services.ai_code_service import AICodeService
from services.tool_registry import ToolRegistry

class AgentService:
    """
    Combined service for:
    - Agent CRUD operations (create/remove/list)
    - Template generation (codebase structure)
    """
    def __init__(self):
        self.agents_db = Path(__file__).parent.parent / "data" / "agents.json"
        self.agents_db.parent.mkdir(exist_ok=True)
        self.temp_dir = Path(__file__).parent.parent / "Temp"
        self.temp_dir.mkdir(exist_ok=True)
        self.ai_code = AICodeService()
        self.tool_registry = ToolRegistry()
    
    # Agent CRUD Operations
    def create_agent(self, user_id: str, tools: List[Dict], logic_code: str, config: Dict) -> str:
        """Creates new agent and generates codebase"""
        agent_id = config.get("agent_id") or f"agent_{len(self.list_agents(user_id)) + 1}"
        
        # Generate codebase
        agent_dir = self._generate_codebase(user_id, agent_id, tools, logic_code, config)
        
        # Save metadata
        agent_data = {
            "agent_id": agent_id,
            "user_id": user_id,
            "tools": tools,
            "config": config,
            "path": str(agent_dir),
            "created_at": str(Path().cwd())
        }
        
        agents = self._load_agents()
        agents.append(agent_data)
        self._save_agents(agents)
        
        return agent_id
    
    def remove_agent(self, user_id: str, agent_id: str) -> bool:
        """Removes agent and its codebase"""
        agents = self._load_agents()
        agent = next((a for a in agents if a["user_id"] == user_id and a["agent_id"] == agent_id), None)
        
        if agent:
            # Delete codebase
            agent_path = Path(agent.get("path", ""))
            if agent_path.exists():
                shutil.rmtree(agent_path)
            
            # Remove from registry
            agents = [a for a in agents if not (a["user_id"] == user_id and a["agent_id"] == agent_id)]
            self._save_agents(agents)
            return True
        return False
    
    def list_agents(self, user_id: str) -> List[Dict[str, Any]]:
        """Lists all agents for a user"""
        agents = self._load_agents()
        return [a for a in agents if a["user_id"] == user_id]
    
    # Template Generation
    def _generate_codebase(self, user_id: str, agent_id: str, tools: List[Dict], logic_code: str, config: Dict) -> Path:
        """Generates complete agent codebase structure"""
        agent_dir = self.temp_dir / user_id / agent_id
        agent_dir.mkdir(parents=True, exist_ok=True)
        
        # Generate main.py, logic.py, tools/, requirements.txt, Dockerfile, .env.example
        self._generate_main_py(agent_dir, tools)
        self._generate_logic_py(agent_dir, logic_code)
        self._copy_tools(agent_dir, tools)
        self._generate_requirements(agent_dir)
        self._generate_dockerfile(agent_dir)
        self._generate_env_example(agent_dir, tools, config)
        
        return agent_dir
    
    def _generate_main_py(self, agent_dir: Path, tools: List[Dict]):
        """Generates main.py"""
        active_imports = []
        reactive_imports = []
        
        for tool in tools:
            tool_name = tool.get("name", "").lower()
            tool_type = tool.get("type", "reactive")
            class_name = "".join(word.capitalize() for word in tool_name.split("_"))
            
            if tool_type == "active":
                active_imports.append(f"from tools.{tool_name} import {class_name}")
            else:
                reactive_imports.append(f"from tools.{tool_name} import {class_name}")
        
        main_py_content = f'''import asyncio
import os
from typing import Dict, List, Any
{chr(10).join(active_imports) if active_imports else ""}
{chr(10).join(reactive_imports) if reactive_imports else ""}
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
        return {{
            "user_id": os.getenv("USER_ID", ""),
            "agent_id": os.getenv("AGENT_ID", ""),
            "selected_tools": {tools}
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
'''
        (agent_dir / "main.py").write_text(main_py_content)
    
    def _generate_logic_py(self, agent_dir: Path, logic_code: str):
        """Writes AI-generated logic.py"""
        if not logic_code.strip():
            # Default logic if AI didn't generate
            logic_code = '''from typing import Dict, Any
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
        (agent_dir / "logic.py").write_text(logic_code)
    
    def _copy_tools(self, agent_dir: Path, tools: List[Dict]):
        """Copies selected tools to agent directory"""
        tools_dir = agent_dir / "tools"
        tools_dir.mkdir(exist_ok=True)
        (tools_dir / "__init__.py").write_text("")
        
        for tool in tools:
            tool_name = tool.get("name", "")
            tool_code = tool.get("code", "")
            
            if tool_code:
                # AI-generated tool
                (tools_dir / f"{tool_name.lower()}.py").write_text(tool_code)
            else:
                # Platform tool - copy from registry
                try:
                    platform_code = self.tool_registry.get_tool_code(tool_name)
                    (tools_dir / f"{tool_name.lower()}.py").write_text(platform_code)
                except:
                    pass
    
    def _generate_requirements(self, agent_dir: Path):
        """Generates requirements.txt"""
        requirements = [
            "asyncio",
            "python-dotenv",
        ]
        (agent_dir / "requirements.txt").write_text("\n".join(requirements))
    
    def _generate_dockerfile(self, agent_dir: Path):
        """Generates Dockerfile"""
        dockerfile_content = '''FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["python", "main.py"]
'''
        (agent_dir / "Dockerfile").write_text(dockerfile_content)
    
    def _generate_env_example(self, agent_dir: Path, tools: List[Dict], config: Dict):
        """Generates .env.example"""
        env_lines = [
            "USER_ID=your_user_id",
            "AGENT_ID=your_agent_id",
            "",
            "# User's secrets (fill these in TEE)",
        ]
        
        # Add tool-specific env vars
        for tool in tools:
            tool_name = tool.get("name", "").lower()
            if "trade" in tool_name:
                env_lines.extend([
                    "EXCHANGE_API_KEY=your_api_key",
                    "EXCHANGE_SECRET=your_secret",
                ])
            if "price" in tool_name or "crypto" in tool_name:
                env_lines.extend([
                    "PRICE_THRESHOLD=50000",
                    "CHECK_INTERVAL=60",
                ])
        
        (agent_dir / ".env.example").write_text("\n".join(env_lines))
    
    def _load_agents(self) -> List[Dict]:
        if self.agents_db.exists():
            return json.loads(self.agents_db.read_text())
        return []
    
    def _save_agents(self, agents: List[Dict]):
        self.agents_db.write_text(json.dumps(agents, indent=2))
