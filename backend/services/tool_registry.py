from pathlib import Path
from typing import List, Dict, Any
import ast
import importlib.util

class ToolRegistry:
    def __init__(self):
        self.platform_tools_dir = Path(__file__).parent.parent / "template" / "tools"
        self.temp_tools: Dict[str, List[Dict]] = {}  # Temporary AI-generated tools
    
    def list_tools(self, user_id: str = None) -> Dict[str, List[Dict]]:
        """Returns all tools: platform + temporary (if user_id provided)"""
        tools = []
        
        # Load platform tools
        active_dir = self.platform_tools_dir / "active"
        reactive_dir = self.platform_tools_dir / "reactive"
        
        # Check if active/reactive directories exist, otherwise load from tools directory
        if active_dir.exists():
            for tool_file in active_dir.glob("*.py"):
                if tool_file.name != "__init__.py" and tool_file.name != "base.py":
                    tools.append(self._load_tool_metadata(tool_file, "active"))
        else:
            # Load from main tools directory, check if ACTIVE
            for tool_file in self.platform_tools_dir.glob("*.py"):
                if tool_file.name not in ["__init__.py", "base.py"]:
                    tool_type = self._infer_tool_type_from_file(tool_file)
                    tools.append(self._load_tool_metadata(tool_file, tool_type))
        
        if reactive_dir.exists():
            for tool_file in reactive_dir.glob("*.py"):
                if tool_file.name != "__init__.py" and tool_file.name != "base.py":
                    tools.append(self._load_tool_metadata(tool_file, "reactive"))
        
        # Add temporary tools if user_id provided
        if user_id and user_id in self.temp_tools:
            for tool in self.temp_tools[user_id]:
                # Ensure temp tools have the right format
                temp_tool = {
                    "name": tool.get("name", ""),
                    "description": tool.get("description", ""),
                    "code": tool.get("code", "")
                }
                tools.append(temp_tool)
        
        return {"tools": tools}
    
    def add_temp_tool(self, user_id: str, tool: Dict[str, Any]):
        """Adds temporary AI-generated tool"""
        if user_id not in self.temp_tools:
            self.temp_tools[user_id] = []
        self.temp_tools[user_id].append(tool)
    
    def get_tool_code(self, tool_name: str, tool_type: str = None) -> str:
        """Returns the Python code for a tool"""
        # Search in platform tools
        for tool_file in self.platform_tools_dir.rglob("*.py"):
            if tool_file.stem == tool_name and tool_file.name != "__init__.py":
                return tool_file.read_text()
        
        # Search in temp tools
        for user_tools in self.temp_tools.values():
            for tool in user_tools:
                if tool.get("name") == tool_name:
                    return tool.get("code", "")
        
        raise ValueError(f"Tool {tool_name} not found")
    
    def _load_tool_metadata(self, tool_file: Path, tool_type: str) -> Dict[str, Any]:
        """Loads tool metadata without importing"""
        code = tool_file.read_text()
        return {
            "name": tool_file.stem,
            "description": self._extract_docstring(code),
            "code": code
        }
    
    def _infer_tool_type_from_file(self, tool_file: Path) -> str:
        """Infers tool type from file content"""
        code = tool_file.read_text()
        if "ToolType.ACTIVE" in code or "return ToolType.ACTIVE" in code:
            return "active"
        return "reactive"
    
    def _extract_docstring(self, code: str) -> str:
        """Extracts docstring from code"""
        try:
            tree = ast.parse(code)
            for node in ast.walk(tree):
                if isinstance(node, ast.ClassDef):
                    if node.body and isinstance(node.body[0], ast.Expr):
                        if isinstance(node.body[0].value, ast.Str):
                            return node.body[0].value.s
                        elif isinstance(node.body[0].value, ast.Constant):
                            return node.body[0].value.value
        except:
            pass
        return ""
