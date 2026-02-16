import subprocess
from typing import List, Dict, Any, Optional
from langchain_google_genai import ChatGoogleGenerativeAI
from dotenv import load_dotenv
import os
import shutil
from pathlib import Path
from utils.tool_registry import ToolRegistry
from services.ai_code_service import AICodeService
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

# Path to tools storage - TypeScript tools for generated agent
BASE_TOOLS_DIR = Path(__file__).resolve().parent.parent / "utils" / "tools_storage"
TOOLS_BASE_TS_PATH = BASE_TOOLS_DIR / "base.ts"
# Personal AI assistant stored tools and API paths
PERSONAL_AI_TOOLS_DIR = BASE_TOOLS_DIR / "personal_ai_assistant"
APIS_STORAGE_DIR = Path(__file__).resolve().parent.parent / "utils" / "apis_storage"
PERSONAL_AI_API_PATH = APIS_STORAGE_DIR / "personal_ai.ts"
WILL_EXECUTOR_API_PATH = APIS_STORAGE_DIR / "will_executor.ts"
# Template dir for contract, LICENSE, .gitignore, docker-compose, sbom, etc.
TEMPLATE_DIR = Path(__file__).resolve().parent.parent / "template"
# TypeScript agent paths
SRC_TOOLS_DIR = "src/tools"
LOGIC_TS_PATH = "src/logic.ts"
CONTANTS_TS_PATH = "src/contants.ts"

DOCKER_HOST = config.docker_host


class ForgeService:
    
    def __init__(self):
        api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GOOGLE_API_KEY or GEMINI_API_KEY environment variable is required")
        self.llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash")
        self.tool_registry = ToolRegistry()
        self.ai_code = AICodeService()
        self.code_validator = CodeValidator()
        self.sessions: Dict[str, ForgeState] = {}

    def _get_session(self, session_id: str) -> Optional[ForgeState]:
        return self.sessions.get(session_id)

    def _require_session(self, session_id: str) -> ForgeState:
        state = self.sessions.get(session_id)
        if state is None:
            raise ValueError(f"Session {session_id} not found")
        return state

    def _save_session(self, state: ForgeState) -> ForgeState:
        """Persist and return the given session state."""
        self.sessions[state["session_id"]] = state
        return state
        
    # HITL Node Implementations
    def _initialize_template(self, state: ForgeState) -> ForgeState:
        """Creates initial template codebase structure"""
        user_id = state["agent_config"].get("user_id", "default")
        agent_id = f"agent_{state['session_id'][:8]}"
        
        logger.info(f"Initializing template for agent {agent_id}")
        logger.info(f"directory: {Path(__file__).parent.parent / 'Temp' / user_id / agent_id}")
        agent_dir = Path(__file__).parent.parent / "Temp" / user_id / agent_id
        agent_dir.mkdir(parents=True, exist_ok=True)
        state["agent_dir_path"] = str(agent_dir)
        state["agent_id"] = agent_id
        
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
        """Adds selected TypeScript tools to agent directory (src/tools/)"""
        tools_dir_path = Path(state["agent_dir_path"]) / "src" / "tools"
        tools_dir_path.mkdir(parents=True, exist_ok=True)

        for tool in state.get("selected_tools", []):
            tool_name = tool.get("name", "")
            tool_code = tool.get("code", "")
            key = f"{SRC_TOOLS_DIR}/{tool_name.lower()}.ts"

            if tool_code:
                state["template_code"][key] = tool_code
                (tools_dir_path / f"{tool_name.lower()}.ts").write_text(tool_code, encoding="utf-8")
            else:
                try:
                    platform_code = self.tool_registry.get_tool_code(tool_name)
                    state["template_code"][key] = platform_code
                    (tools_dir_path / f"{tool_name.lower()}.ts").write_text(platform_code, encoding="utf-8")
                except Exception:
                    pass

        state["current_step"] = "tools_added"
        logger.info(f"Added {len(state['selected_tools'])} tools to agent {state['agent_id']}")
        return state
    
    def _add_personal_ai_assets(self, state: ForgeState) -> ForgeState:
        """Copies stored personal_ai assistant tools and API into the agent directory."""
        agent_dir_path = state.get("agent_dir_path")
        if not agent_dir_path:
            logger.warning("Agent directory path not found in state while adding personal_ai assets.")
            return state

        agent_dir = Path(agent_dir_path)
        src_dir = agent_dir / "src"
        tools_dir = src_dir / "tools"
        src_dir.mkdir(parents=True, exist_ok=True)
        tools_dir.mkdir(parents=True, exist_ok=True)

        # Ensure template_code exists
        if "template_code" not in state or state["template_code"] is None:
            state["template_code"] = {}

        # Copy personal_ai assistant tools
        if PERSONAL_AI_TOOLS_DIR.exists():
            copied_tools = 0
            for ts_file in PERSONAL_AI_TOOLS_DIR.glob("*.ts"):
                try:
                    content = ts_file.read_text(encoding="utf-8")
                    target_path = tools_dir / ts_file.name
                    target_path.write_text(content, encoding="utf-8")
                    key = f"{SRC_TOOLS_DIR}/{ts_file.name}"
                    state["template_code"][key] = content
                    copied_tools += 1
                except Exception as e:
                    logger.exception(f"Failed to copy personal_ai tool {ts_file}: {e}")
            logger.info(f"Copied {copied_tools} personal_ai assistant tools for agent {state.get('agent_id')}")
        else:
            logger.warning(f"Personal AI tools directory not found: {PERSONAL_AI_TOOLS_DIR}")

        # Copy personal_ai API file as src/api.ts
        if PERSONAL_AI_API_PATH.exists():
            try:
                api_content = PERSONAL_AI_API_PATH.read_text(encoding="utf-8")
                api_target = src_dir / "api.ts"
                api_target.write_text(api_content, encoding="utf-8")
                state["template_code"]["src/api.ts"] = api_content
                logger.info(f"Copied personal_ai API to {api_target} for agent {state.get('agent_id')}")
            except Exception as e:
                logger.exception(f"Failed to copy personal_ai API file: {e}")
        else:
            logger.warning(f"Personal AI API file not found: {PERSONAL_AI_API_PATH}")

        return state
    
    def _add_will_executor_assets(self, state: ForgeState) -> ForgeState:
        """Copies stored will_executor tools and API into the agent directory."""
        agent_dir_path = state.get("agent_dir_path")
        if not agent_dir_path:
            logger.warning("Agent directory path not found in state while adding will_executor assets.")
            return state
        agent_dir = Path(agent_dir_path)
        src_dir = agent_dir / "src"
        tools_dir = src_dir / "tools"
        tools_dir.mkdir(parents=True, exist_ok=True)


        # Copy will_executor API file as src/api.ts
        if WILL_EXECUTOR_API_PATH.exists():
            try:
                api_content = WILL_EXECUTOR_API_PATH.read_text(encoding="utf-8")
                api_target = src_dir / "api.ts"
                api_target.write_text(api_content, encoding="utf-8")
                state["template_code"]["src/api.ts"] = api_content
                logger.info(f"Copied will_executor API to {api_target} for agent {state.get('agent_id')}")
            except Exception as e:
                logger.exception(f"Failed to copy will_executor API file: {e}")
        else:
            logger.warning(f"Will executor API file not found: {WILL_EXECUTOR_API_PATH}")

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
        """Generates and adds custom TypeScript tools to src/tools/"""
        requirements = state.get("custom_tool_requirements", "")
        if not requirements:
            return state

        generated = self.ai_code.generate_tool_ts(
            requirements=requirements,
            existing_tools=state["selected_tools"]
        )
        state["generated_tools"] = generated

        user_id = state["agent_config"].get("user_id", "default")
        tools_dir_path = Path(state["agent_dir_path"]) / "src" / "tools"
        tools_dir_path.mkdir(parents=True, exist_ok=True)

        if TOOLS_BASE_TS_PATH.exists() and f"{SRC_TOOLS_DIR}/base.ts" not in state.get("template_code", {}):
            base_content = TOOLS_BASE_TS_PATH.read_text(encoding="utf-8")
            state["template_code"][f"{SRC_TOOLS_DIR}/base.ts"] = base_content
            (tools_dir_path / "base.ts").write_text(base_content, encoding="utf-8")

        for tool in generated:
            self.tool_registry.add_temp_tool(user_id, tool)
            tool_name = tool.get("name", "").lower()
            tool_code = tool.get("code", "")
            if tool_code:
                state["template_code"][f"{SRC_TOOLS_DIR}/{tool_name}.ts"] = tool_code
                (tools_dir_path / f"{tool_name}.ts").write_text(tool_code, encoding="utf-8")
                logger.info(f'Added custom tool at {tools_dir_path / f"{tool_name}.ts"}')

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
        
        # # If no questions extracted, add default ones
        # if not questions:
        #     questions = [
        #         "Can you confirm the beneficiary details for the will?",
        #         "What should happen if you become inactive?",
        #         confirmation
        #     ]
        
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
            for tool_name in remove_tools:
                key = f"{SRC_TOOLS_DIR}/{tool_name.lower()}.ts"
                if key in state["template_code"]:
                    del state["template_code"][key]
                agent_tool_path = Path(state["agent_dir_path"]) / key
                if agent_tool_path.exists():
                    agent_tool_path.unlink()

        # Add tools from registry
        if add_tools:
            available_tools = self.tool_registry.list_tools()
            tools_list = available_tools.get("tools", [])
            tools_dir_path = Path(state["agent_dir_path"]) / "src" / "tools"
            tools_dir_path.mkdir(parents=True, exist_ok=True)
            for tool_name in add_tools:
                tool = next((t for t in tools_list if t.get("name", "").lower() == tool_name.lower()), None)
                if tool:
                    state["selected_tools"].append(tool)
                    code = tool.get("code", "")
                    if code:
                        key = f"{SRC_TOOLS_DIR}/{tool_name.lower()}.ts"
                        state["template_code"][key] = code
                        (tools_dir_path / f"{tool_name.lower()}.ts").write_text(code, encoding="utf-8")
        
        state["current_step"] = "tool_changes_applied"
        return state
    
    def _generate_logic(self, state: ForgeState) -> ForgeState:
        """Generates TypeScript logic (src/logic.ts) and constants (src/contants.ts)."""
        all_tools = state["selected_tools"] + state.get("generated_tools", [])
        generated = self.ai_code.generate_logic_ts(
            selected_tools=all_tools,
            user_intent=state["user_message"],
            agent_config=state["agent_config"]
        )
        logic_code = generated.get("logic_ts", "")
        constants_code = generated.get("constants_ts", "")
        state["logic_code"] = logic_code
        state["template_code"][LOGIC_TS_PATH] = logic_code
        if constants_code:
            state["template_code"][CONTANTS_TS_PATH] = constants_code
        src_dir = Path(state["agent_dir_path"]) / "src"
        src_dir.mkdir(parents=True, exist_ok=True)
        (src_dir / "logic.ts").write_text(logic_code, encoding="utf-8")
        if constants_code:
            (src_dir / "contants.ts").write_text(constants_code, encoding="utf-8")
        state["current_step"] = "logic_generated"
        return state
    
    def _validate_code(self, state: ForgeState) -> ForgeState:
        """Runs TypeScript code validation (tsc --noEmit)"""
        errors = self.code_validator.validate_template_ts(state["template_code"])
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
    
    def correct_code(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Correct code"""
        state = self._get_session(session_id)
        if not state:
            return None
        pass
        return dict(state)
    
    def _update_code_state(self, state: ForgeState) -> ForgeState:
        """Updates state with code edits"""
        state["waiting_for_input"] = False
        state["waiting_stage"] = ""
        state["current_step"] = "code_updated"
        return state
    
    def _finalize_agent(self, state: ForgeState) -> ForgeState:
        """Creates final agent codebase"""

        agent_id = state.get("agent_id")
        
        # state["agent_id"] = agent_id
        state["current_step"] = "finalized"
        state["waiting_for_input"] = False
        logger.info(f"Finalized agent {agent_id}  tools and logic code")
        return state
    
    def execute_command(self, session_id: str, command: str) -> Optional[Dict[str, Any]]:
        """Execute command in the agent directory; logs stream to server terminal."""
        state = self._get_session(session_id)
        if not state:
            return None
        agent_dir = state.get("agent_dir_path", "")
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
        state = self._get_session(session_id)
        if not state:
            return None
        agent_dir = state.get("agent_dir_path", "")
        if not agent_dir:
            return None
        agent_path = Path(agent_dir)
        if not agent_path.exists():
            logger.error(f"Agent dir not found: {agent_dir}")
            return None
        return self.execute_command(session_id, "bash deploy.sh --compile-only")
    
    async def build_docker_image(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Compile contract, then build and push Docker image; logs stream to server terminal."""
        state = self._get_session(session_id)
        if not state:
            return None
        agent_dir = state.get("agent_dir_path", "")
        if not agent_dir:
            return None
        agent_path = Path(agent_dir)
        if not agent_path.exists():
            logger.error(f"Agent dir not found: {agent_dir}")
            return None

        return self.execute_command(session_id, "bash deploy.sh --image")
    
    def get_session_agent_files(self, session_id: str) -> Optional[Dict[str, str]]:
        """Returns all files from the session's agent directory (contract/, .env, docker-compose, etc.)"""
        state = self._get_session(session_id)
        if not state:
            return None
        agent_dir = state.get("agent_dir_path", "")
        if not agent_dir:
            return None
        return _read_all_files_from_dir(Path(agent_dir))
    
    def generate_draft_code(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Generate logic code"""
        state = self._get_session(session_id)
        if not state:
            return None
         # Generate logic
        state = self._generate_logic(state)
        # Validate code
        state = self._validate_code(state)
        # Check if there are errors - if yes, wait for code review, if no, finalize
        if self._has_code_errors(state) == "yes":
            logger.info(f"Code errors found: {state['code_errors']}")
            state = self._wait_for_code_review(state)
            logger.info(f"Code corrected")
            
        return dict(state)
    
    # Legacy method for backward compatibility
    async def process(self, user_message: str, user_id: str) -> Dict[str, Any]:
        """Legacy entry point - runs a single-pass workflow without HITL."""
        session_id = "legacy"
        state: ForgeState = ForgeState(
            session_id=session_id,
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
            docker_tag="",
        )
        # Minimal flow: init template and validate empty logic/template
        state = self._initialize_template(state)
        state = self._validate_code(state)
        self._save_session(state)
        return dict(state)
    
    async def start_session(self, session_id: str, user_id: str) -> Dict[str, Any]:
        """Starts a new HITL session"""
        state: ForgeState = ForgeState(
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
            docker_tag="",
        )
        # Initialize template and then wait for tools selection
        state = self._initialize_template(state)
        state = self._wait_for_tools(state)
        self._save_session(state)
        return dict(state)
    
    async def get_state(self, session_id: str) -> Dict[str, Any]:
        """Gets current state from in-memory session storage"""
        state = self._get_session(session_id)
        return dict(state) if state is not None else {}
    
    async def handle_submit_tools(self, session_id: str, tools: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """Handle tool submission endpoint logic"""
        state = self._require_session(session_id)
        state["selected_tools"] = tools
        state["waiting_for_input"] = False
        
        state = self._update_tools_state(state)
        state = self._add_platform_tools(state)
        
        # If personal_ai_assistant tool is selected, copy its stored tools and API into the agent
        selected_names = {t.get("name", "").lower() for t in state.get("selected_tools", [])}
        if "personal ai assistant" in selected_names:
            state = self._add_personal_ai_assets(state)
            
        if "will_executor" in selected_names:
            state = self._add_will_executor_assets(state)
        # Check if we need custom tools
        if self._should_wait_for_custom_tools(state) == "no":
            state = self._wait_for_prompt(state)
        else:
            state = self._wait_for_custom_tools(state)
        
        self._save_session(state)
        return dict(state)
    
    async def handle_submit_custom_tools(self, session_id: str, requirements: str) -> Optional[Dict[str, Any]]:
        """Handle custom tool requirements submission"""
        state = self._require_session(session_id)
        state["custom_tool_requirements"] = requirements
        state["waiting_for_input"] = False
        
        state = self._update_custom_tools_state(state)
        state = self._add_custom_tools(state)
        state = self._wait_for_prompt(state)
        
        self._save_session(state)
        return dict(state)
    
    async def handle_submit_prompt(self, session_id: str, prompt: str, want_clarification: bool = False) -> Optional[Dict[str, Any]]:
        """Handle user prompt submission"""
        state = self._require_session(session_id)
        state["user_message"] = prompt
        state["waiting_for_input"] = False

        logger.info(f"User prompt submitted: {prompt}\n\n ")
        
        # update_prompt_state → clarify_intent → wait_for_clarification
        state = self._update_prompt_state(state)
        if want_clarification:
            state = self._clarify_intent(state)
            state = self._wait_for_clarification(state)
        else:
            self.generate_draft_code(session_id)
        
        self._save_session(state)
        return dict(state)
    
    async def handle_submit_clarification(self, session_id: str, answers: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """Handle clarification answers submission"""
        state = self._require_session(session_id)
        state["user_clarifications"] = answers
        state["waiting_for_input"] = False
        
        # update_clarification_state → review_tools → apply changes → generate_logic → validate_code → wait_for_code_review/finalize
        state = self._update_clarification_state(state)
        state = self._review_tools(state)
        
        # Apply tool changes if needed
        if self._has_tool_changes(state) == "yes":
            state = self._apply_tool_changes(state)
        self.generate_draft_code(session_id)
        
        self._save_session(state)
        return dict(state)
    
    async def handle_submit_tool_review(self, session_id: str, changes: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Handle tool review confirmation/rejection"""
        state = self._require_session(session_id)
        state["tool_changes"] = changes
        state["waiting_for_input"] = False
        
        # update_tool_review_state → apply changes → generate_logic → validate_code → wait_for_code_review/finalize
        state = self._update_tool_review_state(state)
        if self._has_tool_changes(state) == "yes":
            state = self._apply_tool_changes(state)
        state = self._generate_logic(state)
        state = self._validate_code(state)
        if self._has_code_errors(state) == "yes":
            state = self._wait_for_code_review(state)
        else:
            state = self._finalize_agent(state)
        
        self._save_session(state)
        return dict(state)

    async def handle_env_variables(self, session_id: str, env_variables: Dict[str, str]) -> Optional[Dict[str, Any]]:
        """Handle environment variables submission"""
        state = self._require_session(session_id)
        
        # add env variables directly to agent_dir/.env.development.local
        agent_dir = Path(state.get("agent_dir_path", ""))
        if not agent_dir:
            raise ValueError(f"Agent directory not found for session {session_id}")
        env_file = agent_dir / ".env.development.local"
        if not env_file.exists():
            raise ValueError(f"Env file not found for session {session_id}")
        
        env_content = {}
        # read the env file (skip comments and empty lines; only parse KEY=VALUE)
        with open(env_file, "r") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue
                if "=" in line:
                    key, _, value = line.partition("=")
                    env_content[key.strip()] = value.strip()
        
        logger.info(f"Updating env variables in {env_file}")
        logger.info(f"config.docker_host: {config}")
        
        next_account_id = env_variables.get('NEAR_ACCOUNT_ID', 'ajitesh-1.testnet')
        with open(env_file, "w") as f:
            for key, value in env_content.items():
                f.write(f"{key}={value}\n")
            f.write(f"NEAR_ACCOUNT_ID={env_variables.get('NEAR_ACCOUNT_ID', '')}\n")
            f.write(f"NEAR_SEED_PHRASE={env_variables.get('NEAR_SEED_PHRASE', '')}\n")
            f.write(f"NEXT_PUBLIC_contractId={env_variables.get('NEXT_PUBLIC_contractId', f'ac-sandbox.{next_account_id}')}\n")
            f.write(f"NEAR_CONTRACT_CODEHASH={env_variables.get('NEAR_CONTRACT_CODEHASH', '')}\n")
            f.write(f"PHALA_API_KEY={env_variables.get('PHALA_API_KEY', '')}\n")
            f.write(f"NEAR_AI_API_KEY={env_variables.get('NEAR_AI_API_KEY', '')}\n")
            f.write(f"DOCKER_TAG={DOCKER_HOST}/{state.get('agent_dir_path', 'client-shade-agent')[-8:]} \n")
            
        self._save_session(state)
        return dict(state)
         
    async def handle_update_code(self, session_id: str, file_path: str, content: str) -> Optional[Dict[str, Any]]:
        """Handle code update submission"""
        state = self._require_session(session_id)
        # Update template_code
        if "template_code" not in state:
            state["template_code"] = {}
        state["template_code"][file_path] = content
        
        # update the code in the agent directory
        agent_dir = Path(state.get("agent_dir_path", ""))
        if not agent_dir:
            raise ValueError(f"Agent directory not found for session {session_id}")
        file_path_path = agent_dir / file_path
        if not file_path_path.exists():
            return None
        file_path_path.write_text(content)
        logger.info(f"Updated code in {file_path_path}")
        
        self._save_session(state)
        return dict(state)
    
    async def handle_finalize_agent(self, session_id: str) -> Optional[Dict[str, Any]]:
        """Handle agent finalization"""
        state = self._require_session(session_id)
        state["finalize"] = True
        state["waiting_for_input"] = False
        state["current_step"] = "finalized"
        agent_id = state.get("agent_id")
        logger.info(f"Finalized agent {agent_id}  tools and logic code")
        self._save_session(state)
        return dict(state)
  
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
        state = self._get_session(session_id)
        if not state:
            return None
        agent_dir = state.get("agent_dir_path", "")
        if not agent_dir:
            return None
        agent_path = Path(agent_dir)
        if not agent_path.exists():
            logger.error(f"Agent dir not found: {agent_dir}")
            return None
       
        return self.execute_command(session_id, "bash deply.sh --compile")     