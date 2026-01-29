from langchain_google_genai import ChatGoogleGenerativeAI
from template.tools.base import Tool, ToolType
from dotenv import load_dotenv
import os
import ast
import json
from pathlib import Path
from typing import List, Dict, Any

# Load environment variables
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
        self.prompts_file = Path(__file__).parent.parent / "template" / "prompts.json"
        self._load_prompts()
    
    def _load_prompts(self):
        """Loads prompts from template/prompts.json"""
        if self.prompts_file.exists():
            with open(self.prompts_file) as f:
                prompts_data = json.load(f)
                # Handle both list and dict formats
                if isinstance(prompts_data, list):
                    self.prompts = {item.get("name", "default"): item for item in prompts_data}
                else:
                    self.prompts = prompts_data
        else:
            self.prompts = {}
    
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
        prompt_template = self.prompts.get("tool_generation", """
        User requirements: {requirements}
        Existing tools: {existing_tools}
        
        Generate Python tool class(es) following this pattern:
        1. Inherit from Tool base class
        2. Implement _determine_type() returning ToolType.ACTIVE or ToolType.REACTIVE
        3. For ACTIVE: implement check() and run_loop()
        4. For REACTIVE: implement execute()
        5. Implement _get_config_schema()
        
        Return ONLY valid Python code, no explanations.
        """)
        
        prompt = prompt_template.format(
            requirements=requirements,
            existing_tools=[t.get('name', '') for t in existing_tools]
        )
        
        response = self.llm.invoke(prompt)
        tool_code = response.content
        # Clean markdown code blocks
        tool_code = self._clean_code_blocks(tool_code)
        
        # Parse and validate generated code
        tools = self._parse_tool_code(tool_code)
        return tools
    
    def generate_logic(self, selected_tools: List[Dict], user_intent: str, agent_config: Dict) -> str:
        """
        Generates logic.py code that connects tools based on user intent.
        """
        active_tools = [t for t in selected_tools if t.get("type") == "active"]
        reactive_tools = [t for t in selected_tools if t.get("type") == "reactive"]
        
        prompt_template = self.prompts.get("logic_generation", """
        Generate AgentLogic class for a NEAR agent.
        
        User Intent: {user_intent}
        Active Tools: {active_tools}
        Reactive Tools: {reactive_tools}
        
        The logic should:
        1. Handle triggers from ACTIVE tools in on_trigger()
        2. Execute REACTIVE tools based on conditions
        3. Manage state between tool calls
        4. Implement user's specific requirements
        
        Return complete Python code for AgentLogic class.
        """)
        
        prompt = prompt_template.format(
            user_intent=user_intent,
            active_tools=[t.get('name', '') for t in active_tools],
            reactive_tools=[t.get('name', '') for t in reactive_tools]
        )
        
        response = self.llm.invoke(prompt)
        # Clean markdown code blocks
        logic_code = self._clean_code_blocks(response.content)
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
