from pathlib import Path
from typing import List, Dict, Any
import re
import logging

logger = logging.getLogger(__name__)

class ToolRegistry:
    def __init__(self):
        self.platform_tools_dir = Path(__file__).parent / "tools_storage"
        self.temp_tools: Dict[str, List[Dict]] = {}  # Temporary AI-generated tools

    def list_tools(self, user_id: str = "") -> Dict[str, List[Dict]]:
        """Returns all tools: platform (TypeScript) + temporary (if user_id provided)"""
        tools = []

        # Load all platform tools from utils/tools_storage as TypeScript
        if self.platform_tools_dir.exists():
            for tool_file in self.platform_tools_dir.glob("*.ts"):
                if tool_file.name != "base.ts":
                    tool_type = self._infer_tool_type_from_file_ts(tool_file)
                    tools.append(self._load_tool_metadata_ts(tool_file, tool_type))
        else:
            logger.warning(f"Platform tools directory not found: {self.platform_tools_dir}")

        # Add temporary tools if user_id provided
        if user_id and user_id in self.temp_tools:
            for tool in self.temp_tools[user_id]:
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

    def get_tool_code(self, tool_name: str, tool_type: str = "") -> str:
        """Returns the TypeScript code for a tool"""
        # Search in platform tools (.ts)
        for tool_file in self.platform_tools_dir.glob("*.ts"):
            if tool_file.stem == tool_name:
                return tool_file.read_text(encoding="utf-8")

        # Search in temp tools
        for user_tools in self.temp_tools.values():
            for tool in user_tools:
                if tool.get("name") == tool_name:
                    return tool.get("code", "")

        raise ValueError(f"Tool {tool_name} not found")

    def _load_tool_metadata_ts(self, tool_file: Path, tool_type: str) -> Dict[str, Any]:
        """Loads tool metadata from TypeScript file"""
        code = tool_file.read_text(encoding="utf-8")
        return {
            "name": tool_file.stem,
            "description": self._extract_docstring_ts(code),
            "code": code
        }

    def _infer_tool_type_from_file_ts(self, tool_file: Path) -> str:
        """Infers tool type from TypeScript file content"""
        code = tool_file.read_text(encoding="utf-8")
        # ACTIVE: has runLoop, run_loop, or check (and not only execute)
        if re.search(r"\brunLoop\b|\brun_loop\b", code) or (
            re.search(r"\bcheck\s*\(", code) and "export async function check" in code
        ):
            return "active"
        return "reactive"

    def _extract_docstring_ts(self, code: str) -> str:
        """Extracts JSDoc description from TypeScript code"""
        # Match /** ... */ at start of file (first block comment)
        match = re.search(r"/\*\*\s*(.*?)\s*\*/", code, re.DOTALL)
        if match:
            doc = match.group(1).strip()
            # Take first line or first sentence
            lines = [l.strip().strip("*").strip() for l in doc.split("\n")]
            return " ".join(lines).strip() or ""
        return ""
