from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver
from typing import TypedDict, List, Dict, Any, Optional
from langchain_google_genai import ChatGoogleGenerativeAI
from dotenv import load_dotenv
import os
from pathlib import Path
from services.tool_registry import ToolRegistry
from services.ai_code_service import AICodeService
from services.agent_service import AgentService
from services.code_validator import CodeValidator

# Load environment variables
load_dotenv()

class ForgeState(TypedDict):
    session_id: str  # Unique session identifier (thread_id for LangGraph)
    user_message: str
    chat_history: List[Dict[str, str]]
    selected_tools: List[Dict[str, Any]]
    agent_config: Dict[str, Any]
    generated_tools: List[Dict[str, Any]]  # AI-generated tools
    logic_code: str
    agent_id: str
    current_step: str
    # HITL fields
    waiting_for_input: bool
    waiting_stage: str  # Current HITL stage name
    template_code: Dict[str, str]  # Dict of file paths to content
    code_errors: List[Dict[str, Any]]  # List of validation errors
    user_clarifications: List[Dict[str, Any]]  # Clarification questions/answers
    tool_changes: Dict[str, Any]  # Proposed tool additions/removals
    agent_dir_path: str  # Path to agent directory
    custom_tool_requirements: str  # Requirements for custom tools
    finalize: bool  # Flag to finalize agent

class ForgeService:
    def __init__(self):
        api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GOOGLE_API_KEY or GEMINI_API_KEY environment variable is required")
        self.llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash")
        self.tool_registry = ToolRegistry()
        self.ai_code = AICodeService()
        self.agent_service = AgentService()
        self.code_validator = CodeValidator()
        self.checkpointer = MemorySaver()
        self.graph = self._build_graph()
    
    def _build_graph(self) -> StateGraph:
        workflow = StateGraph(ForgeState)
        
        # HITL workflow nodes
        workflow.add_node("initialize_template", self._initialize_template)
        workflow.add_node("wait_for_tools", self._wait_for_tools)
        workflow.add_node("update_tools_state", self._update_tools_state)
        workflow.add_node("add_platform_tools", self._add_platform_tools)
        workflow.add_node("wait_for_custom_tools", self._wait_for_custom_tools)
        workflow.add_node("update_custom_tools_state", self._update_custom_tools_state)
        workflow.add_node("add_custom_tools", self._add_custom_tools)
        workflow.add_node("wait_for_prompt", self._wait_for_prompt)
        workflow.add_node("update_prompt_state", self._update_prompt_state)
        workflow.add_node("clarify_intent", self._clarify_intent)
        workflow.add_node("wait_for_clarification", self._wait_for_clarification)
        workflow.add_node("update_clarification_state", self._update_clarification_state)
        workflow.add_node("review_tools", self._review_tools)
        workflow.add_node("wait_for_tool_review", self._wait_for_tool_review)
        workflow.add_node("update_tool_review_state", self._update_tool_review_state)
        workflow.add_node("apply_tool_changes", self._apply_tool_changes)
        workflow.add_node("generate_logic", self._generate_logic)
        workflow.add_node("validate_code", self._validate_code)
        workflow.add_node("wait_for_code_review", self._wait_for_code_review)
        workflow.add_node("update_code_state", self._update_code_state)
        workflow.add_node("finalize_agent", self._finalize_agent)
        
        # Entry point
        workflow.set_entry_point("initialize_template")
        
        # Edges from initialize_template
        workflow.add_edge("initialize_template", "wait_for_tools")
        
        # Edges from wait_for_tools (HITL - routes to END)
        # External endpoint will call update_tools_state then resume
        
        # Edges from update_tools_state
        workflow.add_edge("update_tools_state", "add_platform_tools")
        
        # Edges from add_platform_tools
        workflow.add_conditional_edges(
            "add_platform_tools",
            self._should_wait_for_custom_tools,
            {
                "yes": "wait_for_custom_tools",
                "no": "wait_for_prompt"
            }
        )
        
        # Edges from wait_for_custom_tools (HITL - routes to END)
        workflow.add_edge("wait_for_custom_tools", END)
        
        # Edges from update_custom_tools_state
        workflow.add_edge("update_custom_tools_state", "add_custom_tools")
        
        # Edges from add_custom_tools
        workflow.add_edge("add_custom_tools", "wait_for_prompt")
        
        # Edges from wait_for_prompt (HITL - routes to END)
        workflow.add_edge("wait_for_prompt", END)
        
        # Edges from update_prompt_state
        workflow.add_edge("update_prompt_state", "clarify_intent")
        
        # Edges from clarify_intent
        workflow.add_conditional_edges(
            "clarify_intent",
            self._needs_clarification,
            {
                "yes": "wait_for_clarification",
                "no": "review_tools"
            }
        )
        
        # Edges from wait_for_clarification (HITL - routes to END)
        workflow.add_edge("wait_for_clarification", END)
        
        # Edges from update_clarification_state
        workflow.add_edge("update_clarification_state", "review_tools")
        
        # Edges from review_tools
        workflow.add_edge("review_tools", "wait_for_tool_review")
        
        # Edges from wait_for_tool_review (HITL - routes to END)
        workflow.add_edge("wait_for_tool_review", END)
        
        # Edges from update_tool_review_state
        workflow.add_conditional_edges(
            "update_tool_review_state",
            self._has_tool_changes,
            {
                "yes": "apply_tool_changes",
                "no": "generate_logic"
            }
        )
        
        # Edges from apply_tool_changes
        workflow.add_edge("apply_tool_changes", "generate_logic")
        
        # Edges from generate_logic
        workflow.add_edge("generate_logic", "validate_code")
        
        # Edges from validate_code
        workflow.add_conditional_edges(
            "validate_code",
            self._has_code_errors,
            {
                "yes": "wait_for_code_review",
                "no": "finalize_agent"
            }
        )
        
        # Edges from wait_for_code_review (HITL - routes to END)
        workflow.add_edge("wait_for_code_review", END)
        
        # Edges from update_code_state
        workflow.add_edge("update_code_state", "validate_code")
        
        # Edges from finalize_agent
        workflow.add_edge("finalize_agent", END)
        
        return workflow.compile(checkpointer=self.checkpointer)
    
    # HITL Node Implementations
    
    def _initialize_template(self, state: ForgeState) -> ForgeState:
        """Creates initial template codebase structure"""
        user_id = state["agent_config"].get("user_id", "default")
        agent_id = state["agent_config"].get("agent_id") or f"agent_{state['session_id'][:8]}"
        
        # Create agent directory
        agent_dir = self.agent_service.temp_dir / user_id / agent_id
        agent_dir.mkdir(parents=True, exist_ok=True)
        state["agent_dir_path"] = str(agent_dir)
        
        # Initialize template_code with basic structure
        template_code = {}
        
        # Generate basic main.py
        main_py = '''import asyncio
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
'''
        template_code["main.py"] = main_py
        
        # Generate basic logic.py
        logic_py = '''from typing import Dict, Any
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
        template_code["logic.py"] = logic_py
        
        # Generate requirements.txt
        requirements = "asyncio\npython-dotenv\n"
        template_code["requirements.txt"] = requirements
        
        # Generate Dockerfile
        dockerfile = '''FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["python", "main.py"]
'''
        template_code["Dockerfile"] = dockerfile
        
        # Create tools directory structure
        template_code["tools/__init__.py"] = ""
        
        state["template_code"] = template_code
        state["current_step"] = "initialized"
        return state
    
    def _wait_for_tools(self, state: ForgeState) -> ForgeState:
        """Sets HITL flag for tool selection"""
        state["waiting_for_input"] = True
        state["waiting_stage"] = "tools"
        state["current_step"] = "waiting_for_tools"
        return state
    
    def _update_tools_state(self, state: ForgeState) -> ForgeState:
        """Updates state with selected tools from user input"""
        # Tools should already be in state["selected_tools"] from endpoint
        state["waiting_for_input"] = False
        state["current_step"] = "tools_selected"
        return state
    
    def _add_platform_tools(self, state: ForgeState) -> ForgeState:
        """Adds selected tools to agent directory"""
        tools_dir_path = Path(state["agent_dir_path"]) / "tools"
        tools_dir_path.mkdir(exist_ok=True)
        
        # Copy base.py first
        base_file = Path(__file__).parent.parent / "template" / "tools" / "base.py"
        if base_file.exists():
            base_content = base_file.read_text()
            state["template_code"]["tools/base.py"] = base_content
            (tools_dir_path / "base.py").write_text(base_content)
        
        # Copy selected tools
        for tool in state.get("selected_tools", []):
            tool_name = tool.get("name", "")
            tool_code = tool.get("code", "")
            
            if tool_code:
                # AI-generated tool
                state["template_code"][f"tools/{tool_name.lower()}.py"] = tool_code
                (tools_dir_path / f"{tool_name.lower()}.py").write_text(tool_code)
            else:
                # Platform tool - copy from registry
                try:
                    platform_code = self.tool_registry.get_tool_code(tool_name)
                    state["template_code"][f"tools/{tool_name.lower()}.py"] = platform_code
                    (tools_dir_path / f"{tool_name.lower()}.py").write_text(platform_code)
                except:
                    pass
        
        state["current_step"] = "tools_added"
        return state
    
    def _should_wait_for_custom_tools(self, state: ForgeState) -> str:
        """Decides if we should wait for custom tools"""
        # Check if user wants to add custom tools (could be set in agent_config)
        wants_custom = state.get("agent_config", {}).get("wants_custom_tools", False)
        return "yes" if wants_custom else "no"
    
    def _wait_for_custom_tools(self, state: ForgeState) -> ForgeState:
        """Sets HITL flag for custom tool addition"""
        state["waiting_for_input"] = True
        state["waiting_stage"] = "custom_tools"
        state["current_step"] = "waiting_for_custom_tools"
        return state
    
    def _update_custom_tools_state(self, state: ForgeState) -> ForgeState:
        """Updates state with custom tool requirements"""
        state["waiting_for_input"] = False
        state["current_step"] = "custom_tools_requirements_received"
        return state
    
    def _add_custom_tools(self, state: ForgeState) -> ForgeState:
        """Generates and adds custom tools"""
        requirements = state.get("custom_tool_requirements", "")
        if not requirements:
            return state
        
        generated = self.ai_code.generate_tool(
            requirements=requirements,
            existing_tools=state["selected_tools"]
        )
        state["generated_tools"] = generated
        
        # Add to temp registry and template_code
        user_id = state["agent_config"].get("user_id", "default")
        tools_dir_path = Path(state["agent_dir_path"]) / "tools"
        
        for tool in generated:
            self.tool_registry.add_temp_tool(user_id, tool)
            tool_name = tool.get("name", "").lower()
            tool_code = tool.get("code", "")
            if tool_code:
                state["template_code"][f"tools/{tool_name}.py"] = tool_code
                (tools_dir_path / f"{tool_name}.py").write_text(tool_code)
        
        state["current_step"] = "custom_tools_added"
        return state
    
    def _wait_for_prompt(self, state: ForgeState) -> ForgeState:
        """Sets HITL flag for user prompt"""
        state["waiting_for_input"] = True
        state["waiting_stage"] = "prompt"
        state["current_step"] = "waiting_for_prompt"
        return state
    
    def _update_prompt_state(self, state: ForgeState) -> ForgeState:
        """Updates state with user prompt"""
        state["waiting_for_input"] = False
        state["current_step"] = "prompt_received"
        return state
    
    def _clarify_intent(self, state: ForgeState) -> ForgeState:
        """LLM analyzes prompt and asks for clarification if needed"""
        user_message = state.get("user_message", "")
        
        prompt = f"""Analyze this user request for building an agent:
{user_message}

Determine if clarification is needed. If yes, provide 1-3 specific questions.
Return JSON: {{"needs_clarification": bool, "questions": [str]}}"""
        
        response = self.llm.invoke(prompt)
        # Parse response (simplified - in production, use proper JSON parsing)
        content = response.content
        
        # Simple parsing - check if clarification needed
        needs_clarification = "needs_clarification" in content.lower() and "true" in content.lower()
        
        if needs_clarification:
            # Extract questions (simplified)
            questions = []
            if "questions" in content.lower():
                # Try to extract questions from response
                lines = content.split("\n")
                for line in lines:
                    if "?" in line and len(line) > 10:
                        questions.append(line.strip())
            
            if not questions:
                questions = ["Can you provide more details about your requirements?"]
            
            state["user_clarifications"] = [{"question": q, "answer": ""} for q in questions]
        else:
            state["user_clarifications"] = []
        
        state["current_step"] = "intent_clarified"
        return state
    
    def _needs_clarification(self, state: ForgeState) -> str:
        """Checks if clarification is needed"""
        clarifications = state.get("user_clarifications", [])
        return "yes" if clarifications else "no"
    
    def _wait_for_clarification(self, state: ForgeState) -> ForgeState:
        """Sets HITL flag for clarification"""
        state["waiting_for_input"] = True
        state["waiting_stage"] = "clarification"
        state["current_step"] = "waiting_for_clarification"
        return state
    
    def _update_clarification_state(self, state: ForgeState) -> ForgeState:
        """Updates state with clarification answers"""
        state["waiting_for_input"] = False
        state["current_step"] = "clarification_received"
        return state
    
    def _review_tools(self, state: ForgeState) -> ForgeState:
        """LLM analyzes tools vs requirements and suggests changes"""
        all_tools = state["selected_tools"] + state.get("generated_tools", [])
        user_message = state.get("user_message", "")
        
        prompt = f"""Review the selected tools for this agent:
User requirements: {user_message}
Selected tools: {[t.get('name', '') for t in all_tools]}

Suggest tool additions or removals if needed.
Return JSON: {{"add": [tool_names], "remove": [tool_names], "reason": str}}"""
        
        response = self.llm.invoke(prompt)
        content = response.content
        
        # Parse suggestions (simplified)
        tool_changes = {
            "add": [],
            "remove": [],
            "reason": "Tool review completed"
        }
        
        # Simple parsing - in production, use proper JSON parsing
        if "add" in content.lower():
            # Extract tool names to add
            pass
        if "remove" in content.lower():
            # Extract tool names to remove
            pass
        
        state["tool_changes"] = tool_changes
        state["current_step"] = "tools_reviewed"
        return state
    
    def _wait_for_tool_review(self, state: ForgeState) -> ForgeState:
        """Sets HITL flag for tool review"""
        state["waiting_for_input"] = True
        state["waiting_stage"] = "tool_review"
        state["current_step"] = "waiting_for_tool_review"
        return state
    
    def _update_tool_review_state(self, state: ForgeState) -> ForgeState:
        """Updates state with tool review decisions"""
        state["waiting_for_input"] = False
        state["current_step"] = "tool_review_completed"
        return state
    
    def _has_tool_changes(self, state: ForgeState) -> str:
        """Checks if tool changes need to be applied"""
        changes = state.get("tool_changes", {})
        add_tools = changes.get("add", [])
        remove_tools = changes.get("remove", [])
        return "yes" if (add_tools or remove_tools) else "no"
    
    def _apply_tool_changes(self, state: ForgeState) -> ForgeState:
        """Applies confirmed tool changes"""
        changes = state.get("tool_changes", {})
        add_tools = changes.get("add", [])
        remove_tools = changes.get("remove", [])
        
        # Remove tools
        if remove_tools:
            state["selected_tools"] = [
                t for t in state["selected_tools"]
                if t.get("name", "") not in remove_tools
            ]
            # Remove from template_code
            for tool_name in remove_tools:
                key = f"tools/{tool_name.lower()}.py"
                if key in state["template_code"]:
                    del state["template_code"][key]
        
        # Add tools (would need to fetch from registry)
        if add_tools:
            available_tools = self.tool_registry.list_tools()
            tools_list = available_tools.get("tools", [])
            for tool_name in add_tools:
                tool = next((t for t in tools_list if t.get("name", "").lower() == tool_name.lower()), None)
                if tool:
                    state["selected_tools"].append(tool)
        
        state["current_step"] = "tool_changes_applied"
        return state
    
    def _generate_logic(self, state: ForgeState) -> ForgeState:
        """Generates logic.py code"""
        all_tools = state["selected_tools"] + state.get("generated_tools", [])
        logic_code = self.ai_code.generate_logic(
            selected_tools=all_tools,
            user_intent=state["user_message"],
            agent_config=state["agent_config"]
        )
        state["logic_code"] = logic_code
        state["template_code"]["logic.py"] = logic_code
        state["current_step"] = "logic_generated"
        return state
    
    def _validate_code(self, state: ForgeState) -> ForgeState:
        """Runs code validation"""
        errors = self.code_validator.validate_template(state["template_code"])
        state["code_errors"] = [e.to_dict() for e in errors]
        state["current_step"] = "code_validated"
        return state
    
    def _has_code_errors(self, state: ForgeState) -> str:
        """Checks if there are code errors"""
        errors = state.get("code_errors", [])
        return "yes" if errors else "no"
    
    def _wait_for_code_review(self, state: ForgeState) -> ForgeState:
        """Sets HITL flag for code review"""
        state["waiting_for_input"] = True
        state["waiting_stage"] = "code_review"
        state["current_step"] = "waiting_for_code_review"
        return state
    
    def _update_code_state(self, state: ForgeState) -> ForgeState:
        """Updates state with code edits"""
        state["waiting_for_input"] = False
        state["current_step"] = "code_updated"
        return state
    
    def _finalize_agent(self, state: ForgeState) -> ForgeState:
        """Creates final agent codebase"""
        # Write all template_code to files
        agent_dir = Path(state["agent_dir_path"])
        for file_path, content in state["template_code"].items():
            file_full_path = agent_dir / file_path
            file_full_path.parent.mkdir(parents=True, exist_ok=True)
            file_full_path.write_text(content)
        
        # Create agent using agent service
        all_tools = state["selected_tools"] + state.get("generated_tools", [])
        agent_id = self.agent_service.create_agent(
            user_id=state["agent_config"]["user_id"],
            tools=all_tools,
            logic_code=state["logic_code"],
            config=state["agent_config"]
        )
        state["agent_id"] = agent_id
        state["current_step"] = "finalized"
        state["waiting_for_input"] = False
        return state
    
    # Legacy method for backward compatibility
    async def process(self, user_message: str, user_id: str) -> Dict[str, Any]:
        """Legacy entry point - use start_session instead"""
        # This method is kept for backward compatibility
        # New HITL workflow should use start_session
        initial_state = ForgeState(
            session_id="",
            user_message=user_message,
            chat_history=[],
            selected_tools=[],
            agent_config={"user_id": user_id},
            generated_tools=[],
            logic_code="",
            agent_id="",
            current_step="start",
            waiting_for_input=False,
            waiting_stage="",
            template_code={},
            code_errors=[],
            user_clarifications=[],
            tool_changes={},
            agent_dir_path="",
            custom_tool_requirements="",
            finalize=False
        )
        final_state = await self.graph.ainvoke(initial_state)
        return final_state
    
    async def start_session(self, session_id: str, user_id: str) -> Dict[str, Any]:
        """Starts a new HITL session"""
        initial_state = ForgeState(
            session_id=session_id,
            user_message="",
            chat_history=[],
            selected_tools=[],
            agent_config={"user_id": user_id},
            generated_tools=[],
            logic_code="",
            agent_id="",
            current_step="starting",
            waiting_for_input=False,
            waiting_stage="",
            template_code={},
            code_errors=[],
            user_clarifications=[],
            tool_changes={},
            agent_dir_path="",
            custom_tool_requirements="",
            finalize=False
        )
        
        config = {"configurable": {"thread_id": session_id}}
        
        # Stream until first HITL pause
        async for event in self.graph.astream(initial_state, config=config):
            # Check if we've reached a HITL node
            if "waiting_for_input" in event and event.get("waiting_for_input"):
                break
        
        return await self.get_state(session_id)
    
    async def get_state(self, session_id: str) -> Dict[str, Any]:
        """Gets current state from checkpoint"""
        config = {"configurable": {"thread_id": session_id}}
        state = self.graph.get_state(config)
        if state:
            return state.values
        return {}
    
    async def resume_workflow(self, session_id: str) -> Dict[str, Any]:
        """Resumes workflow from checkpoint"""
        config = {"configurable": {"thread_id": session_id}}
        
        # Stream until next HITL pause or completion
        async for event in self.graph.astream(None, config=config):
            # Check if we've reached a HITL node or completed
            if isinstance(event, dict):
                if event.get("waiting_for_input"):
                    break
        
        return await self.get_state(session_id)