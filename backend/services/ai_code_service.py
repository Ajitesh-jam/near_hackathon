from langchain_google_genai import ChatGoogleGenerativeAI   
from dotenv import load_dotenv
import os
import ast
from typing import List, Dict, Any
from utils.prompts import TOOL_GENERATION, LOGIC_GENERATION
load_dotenv()

class AICodeService:
    """
    Combined service for AI code generation:
    - Generates custom tool code
    - Generates logic.py code
    """
    def __init__(self):
        api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GOOGLE_API_KEY or GEMINI_API_KEY environment variable is required")
        self.llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash", temperature=0)
    
    def _clean_code_blocks(self, code: str) -> str:
        """Removes markdown code block markers from generated code"""
        code = code.strip()
        
        # Remove opening ```python or ```
        if code.startswith("```"):
            lines = code.split("\n")
            if lines[0].startswith("```"):
                lines = lines[1:]
            code = "\n".join(lines)
        
        # Remove closing ```
        if code.endswith("```"):
            code = code[:-3].rstrip()
        
        return code.strip()
    
    def generate_tool(self, requirements: str, existing_tools: List[Dict]) -> List[Dict[str, Any]]:
        """
        Generates custom tool code based on user requirements.
        Tools are stored temporarily in Temp/{user_id}/tools/
        """
        prompt = TOOL_GENERATION.format(
            requirements=requirements,
            existing_tools=[t.get("name", "") for t in existing_tools],
        )
        
        response = self.llm.invoke(prompt)
        tool_code = response.content
        # Clean markdown code blocks
        tool_code = self._clean_code_blocks(str(tool_code))
        
        # Parse and validate generated code
        tools = self._parse_tool_code(tool_code)
        return tools
    
    def generate_logic(self, selected_tools: List[Dict], user_intent: str, agent_config: Dict) -> str:
        """
        Generates logic.py code that connects tools based on user intent.
        """
        # Infer tool type from description or code
        active_tools = []
        reactive_tools = []
        for tool in selected_tools:
            desc = tool.get("description", "").upper()
            code = tool.get("code", "").upper()
            if "ACTIVE" in desc or "ToolType.ACTIVE" in code or "return ToolType.ACTIVE" in code:
                active_tools.append(tool)
            else:
                reactive_tools.append(tool)
        
        prompt = LOGIC_GENERATION.format(
            user_intent=user_intent,
            active_tools=[t.get("name", "") for t in active_tools],
            reactive_tools=[t.get("name", "") for t in reactive_tools],
        )
        
        response = self.llm.invoke(prompt)
        # Clean markdown code blocks
        logic_code = self._clean_code_blocks(str(response.content))
        return logic_code
    
    def _parse_tool_code(self, code: str) -> List[Dict[str, Any]]:
        """Parses generated code and extracts tool classes"""
        try:
            tree = ast.parse(code)
            tools = []
            for node in ast.walk(tree):
                if isinstance(node, ast.ClassDef):
                    # Check if inherits from Tool
                    for base in node.bases:
                        if isinstance(base, ast.Name) and base.id == 'Tool':
                            tool_code = ast.get_source_segment(code, node)
                            tools.append({
                                "name": node.name,
                                "code": tool_code or code,
                                "type": self._infer_tool_type(node, code)
                            })
            return tools if tools else [{"name": "CustomTool", "code": code, "type": "reactive"}]
        except Exception as e:
            return [{"name": "CustomTool", "code": code, "type": "reactive", "error": str(e)}]
    
    def _infer_tool_type(self, class_node, code: str) -> str:
        """Infers if tool is ACTIVE or REACTIVE from code"""
        # Check for run_loop method -> ACTIVE
        for item in class_node.body:
            if isinstance(item, ast.FunctionDef) and item.name == "run_loop":
                return "active"
        # Check for execute method -> REACTIVE
        for item in class_node.body:
            if isinstance(item, ast.FunctionDef) and item.name == "execute":
                return "reactive"
        # Default to reactive
        return "reactive"
