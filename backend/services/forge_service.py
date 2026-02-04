import subprocess
from langgraph.graph import StateGraph, END
from langgraph.graph.state import CompiledStateGraph
from langgraph.checkpoint.memory import MemorySaver
from typing import List, Dict, Any, Optional, cast
from langchain_google_genai import ChatGoogleGenerativeAI
from dotenv import load_dotenv
import os
import shutil
from pathlib import Path
from utils.tool_registry import ToolRegistry
from services.ai_code_service import AICodeService
from services.agent_service import AgentService
from utils.code_validator import CodeValidator
from utils.prompts import CLARIFY_INTENT, REVIEW_TOOLS
from utils.schemas import ForgeState
from utils.helper_functions import _copy_template_to_agent, _read_all_files_from_dir
# Load environment variables
load_dotenv()
import logging
logger = logging.getLogger(__name__)
from config import Config
config = Config()

# Path to tools base.py (Tool, ToolType) - used by all generated/platform tools
BASE_TOOLS_DIR = Path(__file__).resolve().parent.parent / "utils" / "tools_storage"
TOOLS_BASE_PY_PATH = BASE_TOOLS_DIR / "base.py"
# Template dir for contract, LICENSE, .gitignore, docker-compose, sbom, etc.
TEMPLATE_DIR = Path(__file__).resolve().parent.parent / "template"

DOCKER_HOST = config.docker_host


class ForgeService:
    
    def __init__(self):
        api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GOOGLE_API_KEY or GEMINI_API_KEY environment variable is required")
        self.llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash")
        self.tool_registry = ToolRegistry()
        self.ai_code = AICodeService()
        # self.agent_service = AgentService()
        self.code_validator = CodeValidator()
        self.checkpointer = MemorySaver()
        self.graph = self._build_graph()

    def _build_graph(self) -> CompiledStateGraph[ForgeState, None, ForgeState, ForgeState]:
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
        
        # Edges from clarify_intent - always go to clarification (compulsory step)
        workflow.add_edge("clarify_intent", "wait_for_clarification")
        
        # Edges from wait_for_clarification (HITL - routes to END)
        workflow.add_edge("wait_for_clarification", END)
        
        # Edges from update_clarification_state
        workflow.add_edge("update_clarification_state", "review_tools")
        
        # Edges from review_tools - automatically apply changes and continue (no HITL)
        workflow.add_conditional_edges(
            "review_tools",
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
        # agent_dir = self.agent_service.temp_dir / user_id / agent_id
        # agent_dir.mkdir(parents=True, exist_ok=True)
        # state["agent_dir_path"] = str(agent_dir)
        agent_dir = Path(__file__).parent.parent / "Temp" / user_id / agent_id
        
        # Initialize template_code with basic structure
        template_code: Dict[str, str] = _copy_template_to_agent(TEMPLATE_DIR, agent_dir)        
        state["template_code"] = template_code
        state["docker_tag"] = f"{DOCKER_HOST}/client-shade-agent:{agent_id}"
        state["current_step"] = "initialized"
        logger.info(f"Initialized template for agent {agent_id}")
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
        state["waiting_stage"] = ""  # Clear waiting stage
        state["current_step"] = "tools_selected"
        return state
    
    def _add_platform_tools(self, state: ForgeState) -> ForgeState:
        """Adds selected tools to agent directory"""
        tools_dir_path = Path(state["agent_dir_path"]) / "tools"
        tools_dir_path.mkdir(exist_ok=True)
        
        # Ensure base.py is present (Tool, ToolType) so tool imports work
        if TOOLS_BASE_PY_PATH.exists() and "tools/base.py" not in state.get("template_code", {}):
            base_content = TOOLS_BASE_PY_PATH.read_text()
            state["template_code"]["tools/base.py"] = base_content
            (tools_dir_path / "base.py").write_text(base_content)
        
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
        logger.info(f"Added {len(state['selected_tools'])} tools to agent {state['agent_id']}")
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
        state["waiting_stage"] = "" 
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
        tools_dir_path.mkdir(parents=True, exist_ok=True)
        
        # Ensure base.py is present so custom tools can import from .base
        if TOOLS_BASE_PY_PATH.exists() and "tools/base.py" not in state.get("template_code", {}):
            base_content = TOOLS_BASE_PY_PATH.read_text()
            state["template_code"]["tools/base.py"] = base_content
            (tools_dir_path / "base.py").write_text(base_content)
        
        for tool in generated:
            self.tool_registry.add_temp_tool(user_id, tool)
            tool_name = tool.get("name", "").lower()
            tool_code = tool.get("code", "")
            if tool_code:
                state["template_code"][f"tools/{tool_name}.py"] = tool_code
                (tools_dir_path / f"{tool_name}.py").write_text(tool_code)
                
                logger.info(f'Added custom tool at path {tools_dir_path / f"{tool_name}.py"} with code\n\n {tool_code}')
        
        state["current_step"] = "custom_tools_added"
        logger.info(f'Added {len(generated)} custom tools')
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
        state["waiting_stage"] = ""  # Clear waiting stage
        state["current_step"] = "prompt_received"
        return state
    
    def _clarify_intent(self, state: ForgeState) -> ForgeState:
        """LLM analyzes prompt and asks for clarification (compulsory step)"""
        user_message = state.get("user_message", "")
        selected_tools = [t.get("name", "") for t in state.get("selected_tools", [])]
        
        prompt = CLARIFY_INTENT.format(
            user_message=user_message,
            selected_tools=selected_tools,
        )
        response = self.llm.invoke(prompt)
        content = response.content
        
        # Handle content type - can be str or list
        if isinstance(content, list):
            content = " ".join(str(item) for item in content)
        else:
            content = str(content)
        
        # Extract questions and summary
        questions = []
        summary = ""
        
        # Try to extract questions
        if "questions" in content.lower():
            lines = content.split("\n")
            for line in lines:
                if "?" in line and len(line) > 10:
                    questions.append(line.strip())
        
        # Extract summary
        if "summary" in content.lower():
            # Try to extract summary
            lines = content.split("\n")
            for i, line in enumerate(lines):
                if "summary" in line.lower() and i + 1 < len(lines):
                    summary = lines[i + 1].strip()
                    break
        
        # Always add confirmation question
        confirmation = "Is everything in order to continue?"
        if confirmation not in " ".join(questions):
            questions.append(confirmation)
        
        # If no questions extracted, add default ones
        if not questions:
            questions = [
                "Can you confirm the beneficiary details for the will?",
                "What should happen if you become inactive?",
                confirmation
            ]
        
        # Store summary and questions
        state["user_clarifications"] = [
            {"question": q, "answer": ""} for q in questions
        ]
        if summary:
            state["agent_config"]["summary"] = summary
        
        state["current_step"] = "intent_clarified"
        return state
    
    def _needs_clarification(self, want_clarification:bool=True) -> str:
        """Checks if clarification is needed"""
        return "yes" if want_clarification else "no"
    
    def _wait_for_clarification(self, state: ForgeState) -> ForgeState:
        """Sets HITL flag for clarification"""
        state["waiting_for_input"] = True
        state["waiting_stage"] = "clarification"
        state["current_step"] = "waiting_for_clarification"
        return state
    
    def _update_clarification_state(self, state: ForgeState) -> ForgeState:
        """Updates state with clarification answers"""
        state["waiting_for_input"] = False
        state["waiting_stage"] = ""  # Clear waiting stage
        state["current_step"] = "clarification_received"
        return state
    
    def _review_tools(self, state: ForgeState) -> ForgeState:
        """LLM analyzes tools vs requirements and suggests changes"""
        all_tools = state["selected_tools"] + state.get("generated_tools", [])
        user_message = state.get("user_message", "")
        tools_list = [t.get("name", "") for t in all_tools]
        
        prompt = REVIEW_TOOLS.format(
            user_message=user_message,
            tools_list=tools_list,
        )
        response = self.llm.invoke(prompt)
        content = response.content
        
        # Handle content type - can be str or list
        if isinstance(content, list):
            content = " ".join(str(item) for item in content)
        else:
            content = str(content)
        
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
        state["waiting_stage"] = ""  # Clear waiting stage
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
        state["waiting_stage"] = ""
        state["current_step"] = "code_updated"
        return state
    
    def _finalize_agent(self, state: ForgeState) -> ForgeState:
        """Creates final agent codebase"""
        
        # # Ensure agent_dir_path exists, recreate if missing
        # if "agent_dir_path" not in state or not state["agent_dir_path"]:
        #     user_id = state.get("agent_config", {}).get("user_id", "default")
        #     session_id = state.get("session_id", "unknown")
        #     agent_id = state.get("agent_config", {}).get("agent_id") or f"agent_{session_id[:8]}"
        #     agent_dir = self.agent_service.temp_dir / user_id / agent_id
        #     agent_dir.mkdir(parents=True, exist_ok=True)
        #     state["agent_dir_path"] = str(agent_dir)
        
        # Write all template_code to files
        # agent_dir = Path(state["agent_dir_path"])
        # template_code = state.get("template_code", {})
        # for file_path, content in template_code.items():
        #     file_full_path = agent_dir / file_path
        #     file_full_path.parent.mkdir(parents=True, exist_ok=True)
        #     file_full_path.write_text(content)
        
        # all_tools = state.get("selected_tools", []) + state.get("generated_tools", [])
        # logic_code = state.get("logic_code") or template_code.get("logic.py", "")
        # user_id = state.get("agent_config", {}).get("user_id", "default")
        # agent_config = state.get("agent_config", {})
        agent_id = state.get("agent_id")
        
        # state["agent_id"] = agent_id
        state["current_step"] = "finalized"
        state["waiting_for_input"] = False
        logger.info(f"Finalized agent {agent_id}  tools and final state\n\n {state}")
        return state
    
    def execute_command(self, session_id: str, command: str) -> Optional[Dict[str, Any]]:
        """Execute command in the agent directory; logs stream to server terminal."""
        config: Any = {"configurable": {"thread_id": session_id}}
        current_state = self.graph.get_state(config)
        if not current_state:
            return None
        agent_dir = current_state.values.get("agent_dir_path", "")
        if not agent_dir:
            return None
        agent_path = Path(agent_dir)
        if not agent_path.exists():
            logger.error(f"Agent dir not found: {agent_dir}")
            return None
        try:
            result = subprocess.run(
                command,
                shell=True,
                cwd=str(agent_path),
                stdout=None,
                stderr=None,
            )
            return {"success": result.returncode == 0, "returncode": result.returncode}
        except Exception as e:
            logger.exception("execute_command failed: %s", e)
            return {"success": False, "error": str(e)}

    async def compile_contract(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Compile contract"""
        config: Any = {"configurable": {"thread_id": session_id}}
        current_state = self.graph.get_state(config)
        if not current_state:
            return None
        agent_dir = current_state.values.get("agent_dir_path", "")
        if not agent_dir:
            return None
        agent_path = Path(agent_dir)
        if not agent_path.exists():
            logger.error(f"Agent dir not found: {agent_dir}")
            return None
        return self.execute_command(session_id, "bash deply.sh --compile-only")
    
    async def build_docker_image(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Compile contract, then build and push Docker image; logs stream to server terminal."""
        config: Any = {"configurable": {"thread_id": session_id}}
        current_state = self.graph.get_state(config)
        if not current_state:
            return None
        agent_dir = current_state.values.get("agent_dir_path", "")
        if not agent_dir:
            return None
        agent_path = Path(agent_dir)
        if not agent_path.exists():
            logger.error(f"Agent dir not found: {agent_dir}")
            return None

        return self.execute_command(session_id, "bash deply.sh --image")
    
    def get_session_agent_files(self, session_id: str) -> Optional[Dict[str, str]]:
        """Returns all files from the session's agent directory (contract/, .env, docker-compose, etc.)"""
        config: Any = {"configurable": {"thread_id": session_id}}
        current_state = self.graph.get_state(config)
        if not current_state:
            return None
        agent_dir = current_state.values.get("agent_dir_path", "")
        if not agent_dir:
            return None
        return _read_all_files_from_dir(agent_dir)
    
    
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
            finalize=False,
            docker_tag=""
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
            finalize=False,
            docker_tag=""
        )
        
        config: Any = {"configurable": {"thread_id": session_id}}
        
        async for event in self.graph.astream(initial_state, config=config):
            if "waiting_for_input" in event and event.get("waiting_for_input"):
                break
        
        return await self.get_state(session_id)
    
    async def get_state(self, session_id: str) -> Dict[str, Any]:
        """Gets current state from checkpoint"""
        config: Any = {"configurable": {"thread_id": session_id}}
        state = self.graph.get_state(config)
        if state:
            return state.values
        return {}
    
    async def resume_workflow(self, session_id: str) -> Dict[str, Any]:
        """Resumes workflow from checkpoint by routing to the appropriate update node if needed"""
        config: Any = {"configurable": {"thread_id": session_id}}
        
        # Get current state to determine if we need to route to an update node
        current_state = self.graph.get_state(config)
        if not current_state:
            raise ValueError(f"Session {session_id} not found")
        
        waiting_stage = current_state.values.get("waiting_stage")
        state_values = cast(ForgeState, current_state.values.copy())
        
        # Map waiting_stage to the corresponding update node function
        # Only invoke if we're at END and waiting_for_input was just set to False
        update_node_map = {
            "tools": self._update_tools_state,
            "custom_tools": self._update_custom_tools_state,
            "prompt": self._update_prompt_state,
            "clarification": self._update_clarification_state,
            "tool_review": self._update_tool_review_state,
            "code_review": self._update_code_state,
        }
        
        # If we have a waiting_stage but waiting_for_input is False, we need to invoke the update node
        if waiting_stage in update_node_map and not state_values.get("waiting_for_input", True):
            # Manually invoke the update node since we're at END
            node_func = update_node_map[waiting_stage]
            updated_state = node_func(state_values)
            
            # Update the checkpoint with the new state
            self.graph.update_state(config, updated_state)
        
        # Now stream from the updated checkpoint
        async for event in self.graph.astream(None, config=config):
            # Check if we've reached a HITL node or completed
            if isinstance(event, dict):
                # Check each node's output
                for node_name, node_state in event.items():
                    if isinstance(node_state, dict) and node_state.get("waiting_for_input"):
                        break
            # Also check if workflow completed (empty event)
            if not event:
                break
        
        return await self.get_state(session_id)
    
    async def handle_submit_tools(self, session_id: str, tools: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """Handle tool submission endpoint logic"""
        config: Any = {"configurable": {"thread_id": session_id}}
        current_state = self.graph.get_state(config)
        if not current_state:
            return None
        
        state_values = cast(ForgeState, current_state.values.copy())
        state_values["selected_tools"] = tools
        state_values["waiting_for_input"] = False
        
        updated_state = self._update_tools_state(state_values)
        updated_state = self._add_platform_tools(updated_state)
        
        # Check if we need custom tools
        if self._should_wait_for_custom_tools(updated_state) == "no":
            updated_state = self._wait_for_prompt(updated_state)
        else:
            updated_state = self._wait_for_custom_tools(updated_state)
        
        # Update checkpoint
        self.graph.update_state(config, updated_state)
        
        return await self.get_state(session_id)
    
    async def handle_submit_custom_tools(self, session_id: str, requirements: str) -> Optional[Dict[str, Any]]:
        """Handle custom tool requirements submission"""
        config: Any = {"configurable": {"thread_id": session_id}}
        current_state = self.graph.get_state(config)
        if not current_state:
            return None
        
        state_values = cast(ForgeState, current_state.values.copy())
        state_values["custom_tool_requirements"] = requirements
        state_values["waiting_for_input"] = False
        
        updated_state = self._update_custom_tools_state(state_values)
        self.graph.update_state(config, updated_state)
        
        await self.resume_workflow(session_id)
        return await self.get_state(session_id)
    
    async def handle_submit_prompt(self, session_id: str, prompt: str) -> Optional[Dict[str, Any]]:
        """Handle user prompt submission"""
        config: Any = {"configurable": {"thread_id": session_id}}
        current_state = self.graph.get_state(config)
        if not current_state:
            return None
        
        state_values = cast(ForgeState, current_state.values.copy())
        state_values["user_message"] = prompt
        state_values["waiting_for_input"] = False
        
        # Manually invoke the chain: update_prompt_state → clarify_intent → wait_for_clarification
        updated_state = self._update_prompt_state(state_values)
        updated_state = self._clarify_intent(updated_state)
        updated_state = self._wait_for_clarification(updated_state)
        
        # Update checkpoint
        self.graph.update_state(config, updated_state)
        
        return await self.get_state(session_id)
    
    async def handle_submit_clarification(self, session_id: str, answers: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """Handle clarification answers submission"""
        config: Any = {"configurable": {"thread_id": session_id}}
        current_state = self.graph.get_state(config)
        if not current_state:
            return None
        
        state_values = cast(ForgeState, current_state.values.copy())
        state_values["user_clarifications"] = answers
        state_values["waiting_for_input"] = False
        
        # Manually invoke the chain: update_clarification_state → review_tools → apply changes → generate_logic → validate_code → wait_for_code_review/finalize
        updated_state = self._update_clarification_state(state_values)
        
        # Continue automatically: review_tools → apply changes → generate_logic → validate_code
        updated_state = self._review_tools(updated_state)
        
        # Apply tool changes if needed
        if self._has_tool_changes(updated_state) == "yes":
            updated_state = self._apply_tool_changes(updated_state)
        
        # Generate logic
        updated_state = self._generate_logic(updated_state)
        
        # Validate code
        updated_state = self._validate_code(updated_state)
        
        # Check if there are errors - if yes, wait for code review, if no, finalize
        if self._has_code_errors(updated_state) == "yes":
            updated_state = self._wait_for_code_review(updated_state)
        else:
            updated_state = self._finalize_agent(updated_state)
        
        # Update checkpoint
        self.graph.update_state(config, updated_state)
        
        return await self.get_state(session_id)
    
    async def handle_submit_tool_review(self, session_id: str, changes: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Handle tool review confirmation/rejection"""
        config: Any = {"configurable": {"thread_id": session_id}}
        current_state = self.graph.get_state(config)
        if not current_state:
            return None
        
        state_values = cast(ForgeState, current_state.values.copy())
        state_values["tool_changes"] = changes
        state_values["waiting_for_input"] = False
        
        # Manually invoke update_tool_review_state since we're at END
        updated_state = self._update_tool_review_state(state_values)
        
        # Update checkpoint
        self.graph.update_state(config, updated_state)
        
        await self.resume_workflow(session_id)
        return await self.get_state(session_id)
    
    async def handle_update_code(self, session_id: str, file_path: str, content: str) -> Optional[Dict[str, Any]]:
        """Handle code update submission"""
        config: Any = {"configurable": {"thread_id": session_id}}
        current_state = self.graph.get_state(config)
        if not current_state:
            return None
        
        state_values = cast(ForgeState, current_state.values.copy())
        # Update template_code
        if "template_code" not in state_values:
            state_values["template_code"] = {}
        state_values["template_code"][file_path] = content
        state_values["waiting_for_input"] = False
        
        # Manually invoke update_code_state since we're at END
        updated_state = self._update_code_state(state_values)
        
        # Update checkpoint
        self.graph.update_state(config, updated_state)
        
        await self.resume_workflow(session_id)
        return await self.get_state(session_id)
    
    async def handle_finalize_agent(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Handle agent finalization"""
        config: Any = {"configurable": {"thread_id": session_id}}
        current_state = self.graph.get_state(config)
        if not current_state:
            return None
        
        state_values = cast(ForgeState, current_state.values.copy())
        state_values["finalize"] = True
        state_values["waiting_for_input"] = False
        
        # Manually invoke finalize_agent since we're at END
        updated_state = self._finalize_agent(state_values)
        
        # Update checkpoint
        self.graph.update_state(config, updated_state)
        
        return await self.get_state(session_id)
    
    async def handle_env_variables(self, session_id: str, env_variables: Dict[str, str]) -> Optional[Dict[str, Any]]:
        """Handle environment variables submission"""
        config: Any = {"configurable": {"thread_id": session_id}}
        current_state = self.graph.get_state(config)
        if not current_state:
            return None
        
        # add env varibales directly to agent_dir/.env.development.local
        agent_dir = Path(current_state.values.get("agent_dir_path", ""))
        if not agent_dir:
            raise ValueError(f"Agent directory not found for session {session_id}")
        env_file = agent_dir / ".env.development.local"
        if not env_file.exists():
            return None
        
        logger.info(f"Adding env variables to {env_file}")
        logger.info(f"config.docker_host: {config}")
        
        next_account_id = env_variables.get('NEAR_ACCOUNT_ID', 'ajitesh-1.testnet')
        with open(env_file, "a") as f:
            
            f.write(f"  NEAR_ACCOUNT_ID={env_variables.get('NEAR_ACCOUNT_ID', '')}\n")
            f.write(f"  NEAR_SEED_PHRASE={env_variables.get('NEAR_SEED_PHRASE', '')}\n")
            f.write(f"  NEXT_PUBLIC_contractId={env_variables.get('NEXT_PUBLIC_contractId', f'ac-sandbox.{next_account_id}')}\n")
            f.write(f"  NEAR_CONTRACT_CODEHASH={env_variables.get('NEAR_CONTRACT_CODEHASH', '')}\n")
            f.write(f"  PHALA_API_KEY={env_variables.get('PHALA_API_KEY', '')}\n")
            f.write(f"  NEAR_AI_API_KEY={env_variables.get('NEAR_AI_API_KEY', '')}\n")
            f.write(f"  DOCKER_TAG={DOCKER_HOST}/{current_state.values.get('agent_dir_path', 'client-shade-agent')[-8:]} \n")
            
        return await self.get_state(session_id)
        
    async def handle_compile_contract(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Compile contract"""
        result = await self.compile_contract(session_id)
        if not result:
            return None
        return result

    async def handle_build_docker_image(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Build docker image"""
        result = await self.build_docker_image(session_id)
        if not result:
            return None
        return result

    async def handle_deploy_agent(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Compile contract, build Docker image, deploy agent via deply.sh --compile; logs stream to server terminal."""
        config: Any = {"configurable": {"thread_id": session_id}}
        current_state = self.graph.get_state(config)
        if not current_state:
            return None
        agent_dir = current_state.values.get("agent_dir_path", "")
        if not agent_dir:
            return None
        agent_path = Path(agent_dir)
        if not agent_path.exists():
            logger.error(f"Agent dir not found: {agent_dir}")
            return None
       
        return self.execute_command(session_id, "bash deply.sh --compile")     