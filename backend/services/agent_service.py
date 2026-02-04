from typing import List, Dict, Any
from pathlib import Path
import json
import shutil
import uuid
from services.ai_code_service import AICodeService
from utils.tool_registry import ToolRegistry
# from template.agent_templates import (
#     get_main_py_content,
#     LOGIC_PY_DEFAULT,
#     DOCKERFILE,
#     REQUIREMENTS_TXT,
# )
from utils.helper_functions import _copy_template_to_agent
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
        self.template_dir = Path(__file__).parent.parent / "template"
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
    
    def get_agent_code(self, user_id: str, agent_id: str) -> Dict[str, Any]:
        """Returns the complete file structure of an agent as a tree"""
        agents = self._load_agents()
        agent = next((a for a in agents if a["user_id"] == user_id and a["agent_id"] == agent_id), None)
        
        if not agent:
            raise ValueError(f"Agent {agent_id} not found for user {user_id}")
        
        agent_dir = Path(agent.get("path", ""))
        if not agent_dir.exists():
            raise ValueError(f"Agent directory not found: {agent_dir}")
        
        def build_file_tree(path: Path) -> List[Dict]:
            """Recursively build file tree structure"""
            files = []
            
            for item in sorted(path.iterdir()):
                # Skip hidden files and __pycache__
                if item.name.startswith('.') or item.name == '__pycache__':
                    continue
                
                item_id = str(uuid.uuid4())
                node: Dict[str, Any] = {
                    "id": item_id,
                    "name": item.name,
                    "type": "folder" if item.is_dir() else "file",
                }
                
                if item.is_file():
                    # Read file content
                    try:
                        content = item.read_text(encoding='utf-8')
                        node["content"] = content
                        
                        # Determine language from extension
                        ext = item.suffix.lower()
                        lang_map = {
                            '.py': 'python',
                            '.txt': 'plaintext',
                            '.json': 'json',
                            '.yaml': 'yaml',
                            '.yml': 'yaml',
                            '.toml': 'toml',
                            '.env': 'plaintext',
                            '.md': 'markdown',
                        }
                        
                        # Special case for Dockerfile
                        if item.name.lower() == 'dockerfile':
                            node["language"] = "dockerfile"
                        else:
                            node["language"] = lang_map.get(ext, 'plaintext')
                    except UnicodeDecodeError:
                        # Binary file or encoding issue
                        node["content"] = "# Binary file or encoding issue - cannot display"
                        node["language"] = "plaintext"
                    except Exception as e:
                        node["content"] = f"# Error reading file: {str(e)}"
                        node["language"] = "plaintext"
                else:
                    # It's a directory, recurse
                    children = build_file_tree(item)
                    if children:  # Only add folder if it has children
                        node["children"] = children
                    else:
                        continue  # Skip empty directories
                
                files.append(node)
            
            return files
        
        file_tree = build_file_tree(agent_dir)
        return {"files": file_tree}
    
    
    # Template Generation
    def _generate_codebase(self, user_id: str, agent_id: str, tools: List[Dict], logic_code: str, config: Dict) -> Path:
        """Generates complete agent codebase structure"""
        agent_dir = self.temp_dir / user_id / agent_id
        agent_dir.mkdir(parents=True, exist_ok=True)
        
        # Generate main.py, logic.py, tools/, requirements.txt, Dockerfile, .env.example
        # self._generate_main_py(agent_dir, tools)
        # self._generate_logic_py(agent_dir, logic_code)
        # self._generate_requirements(agent_dir)
        # self._generate_dockerfile(agent_dir)
        # self._generate_env_example(agent_dir, tools, config)
        # # Copy contract/, LICENSE, .env.development.local from template
        # self._copy_tools(agent_dir, tools)
        # self._copy_template_extras(agent_dir)
        template_code = _copy_template_to_agent(self.template_dir, agent_dir)

        return agent_dir
    
    # def _generate_main_py(self, agent_dir: Path, tools: List[Dict]):
    #     """Generates main.py"""
    #     active_imports = []
    #     reactive_imports = []
        
    #     for tool in tools:
    #         tool_name = tool.get("name", "").lower()
    #         # Infer tool type from description or code
    #         desc = tool.get("description", "").upper()
    #         code = tool.get("code", "").upper()
    #         is_active = "ACTIVE" in desc or "ToolType.ACTIVE" in code or "return ToolType.ACTIVE" in code
    #         class_name = "".join(word.capitalize() for word in tool_name.split("_"))
            
    #         if is_active:
    #             active_imports.append(f"from tools.{tool_name} import {class_name}")
    #         else:
    #             reactive_imports.append(f"from tools.{tool_name} import {class_name}")
        
    #     main_py_content = get_main_py_content(active_imports, reactive_imports, tools)
    #     (agent_dir / "main.py").write_text(main_py_content)
    
    # def _generate_logic_py(self, agent_dir: Path, logic_code: str):
    #     """Writes AI-generated logic.py"""
    #     if not logic_code.strip():
    #         logic_code = LOGIC_PY_DEFAULT
    #     (agent_dir / "logic.py").write_text(logic_code)
    
    # def _copy_tools(self, agent_dir: Path, tools: List[Dict]):
    #     """Copies selected tools to agent directory"""
    #     tools_dir = agent_dir / "tools"
        
    #     for tool in tools:
    #         tool_name = tool.get("name", "")
    #         tool_code = tool.get("code", "")
            
    #         if tool_code:
    #             # AI-generated tool
    #             (tools_dir / f"{tool_name.lower()}.py").write_text(tool_code)
    #         else:
    #             # Platform tool - copy from registry
    #             try:
    #                 platform_code = self.tool_registry.get_tool_code(tool_name)
    #                 (tools_dir / f"{tool_name.lower()}.py").write_text(platform_code)
    #             except:
    #                 pass
    # def _generate_requirements(self, agent_dir: Path):
    #     """Generates requirements.txt"""
    #     (agent_dir / "requirements.txt").write_text(REQUIREMENTS_TXT)
    
    # def _generate_dockerfile(self, agent_dir: Path):
    #     """Generates Dockerfile"""
    #     (agent_dir / "Dockerfile").write_text(DOCKERFILE)
    
    
    # # Names to skip when copying template to agent (backend-only)
    # _TEMPLATE_SKIP = frozenset({"agent_templates.py", "__pycache__"})

    # def _copy_template_extras(self, agent_dir: Path):
    #     """Copies all template contents to agent dir: contract/, LICENSE, .gitignore, docker-compose.yaml, sbom.cyclonedx.json, .env.development.local, etc."""
    #     if not self.template_dir.exists():
    #         return
    #     for item in self.template_dir.iterdir():
    #         if item.name in self._TEMPLATE_SKIP or item.name.endswith(".pyc"):
    #             continue
    #         dst = agent_dir / item.name
    #         if item.is_file():
    #             shutil.copy2(item, dst)
    #         elif item.is_dir():
    #             shutil.copytree(item, dst, dirs_exist_ok=True)

    
    def _load_agents(self) -> List[Dict]:
        if self.agents_db.exists():
            return json.loads(self.agents_db.read_text())
        return []
    # def _generate_env_example(self, agent_dir: Path, tools: List[Dict], config: Dict):
    #     """Generates .env.example"""
    #     env_lines = [
    #         "USER_ID=your_user_id",
    #         "AGENT_ID=your_agent_id",
    #         "",
    #         "# User's secrets (fill these in TEE)",
    #     ]
        
    #     # Add tool-specific env vars
    #     for tool in tools:
    #         tool_name = tool.get("name", "").lower()
    #         if "trade" in tool_name:
    #             env_lines.extend([
    #                 "EXCHANGE_API_KEY=your_api_key",
    #                 "EXCHANGE_SECRET=your_secret",
    #             ])
    #         if "price" in tool_name or "crypto" in tool_name:
    #             env_lines.extend([
    #                 "PRICE_THRESHOLD=50000",
    #                 "CHECK_INTERVAL=60",
    #             ])
        
    #     (agent_dir / ".env.example").write_text("\n".join(env_lines))
    
    def _save_agents(self, agents: List[Dict]):
        self.agents_db.write_text(json.dumps(agents, indent=2))