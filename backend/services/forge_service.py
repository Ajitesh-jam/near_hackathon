from langgraph.graph import StateGraph, END
from typing import TypedDict, List, Dict, Any
from langchain_google_genai import ChatGoogleGenerativeAI
from dotenv import load_dotenv
import os
from services.tool_registry import ToolRegistry
from services.ai_code_service import AICodeService
from services.agent_service import AgentService

# Load environment variables
load_dotenv()

class ForgeState(TypedDict):
    user_message: str
    chat_history: List[Dict[str, str]]
    selected_tools: List[Dict[str, Any]]
    agent_config: Dict[str, Any]
    generated_tools: List[Dict[str, Any]]  # AI-generated tools
    logic_code: str
    agent_id: str
    current_step: str

class ForgeService:
    def __init__(self):
        api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise ValueError("GOOGLE_API_KEY or GEMINI_API_KEY environment variable is required")
        self.llm = ChatGoogleGenerativeAI(model="gemini-2.5-flash")
        self.tool_registry = ToolRegistry()
        self.ai_code = AICodeService()
        self.agent_service = AgentService()
        self.graph = self._build_graph()
    
    def _build_graph(self) -> StateGraph:
        workflow = StateGraph(ForgeState)
        
        # Nodes
        workflow.add_node("understand_intent", self._understand_intent)
        workflow.add_node("suggest_tools", self._suggest_tools)
        workflow.add_node("generate_custom_tools", self._generate_custom_tools)
        workflow.add_node("generate_logic", self._generate_logic)
        workflow.add_node("create_agent", self._create_agent)
        
        # Edges
        workflow.set_entry_point("understand_intent")
        workflow.add_edge("understand_intent", "suggest_tools")
        workflow.add_conditional_edges(
            "suggest_tools",
            self._should_generate_tools,
            {
                "yes": "generate_custom_tools",
                "no": "generate_logic"
            }
        )
        workflow.add_edge("generate_custom_tools", "generate_logic")
        workflow.add_edge("generate_logic", "create_agent")
        workflow.add_edge("create_agent", END)
        
        return workflow.compile()
    
    def _understand_intent(self, state: ForgeState) -> ForgeState:
        """Analyzes user message to understand agent requirements"""
        prompt = f"""Analyze this user request and extract key information:
User wants: {state['user_message']}

Extract:
- agent_type (trading/will/confidential_rag/other)
- required_features (list of features)
- constraints (any limitations)

Return JSON format."""
        
        response = self.llm.invoke(prompt)
        # Parse response and update state
        state["agent_config"]["intent"] = response.content
        return state
    
    def _suggest_tools(self, state: ForgeState) -> ForgeState:
        """Suggests platform tools based on intent"""
        available_tools = self.tool_registry.list_tools()
        user_message = state["user_message"].lower()
        
        selected = []
        
        # Simple keyword matching (could be improved with LLM)
        if "trade" in user_message or "buy" in user_message or "sell" in user_message:
            # Add trading tools
            for tool in available_tools.get("reactive", []):
                if "trade" in tool.get("name", "").lower():
                    selected.append(tool)
            for tool in available_tools.get("active", []):
                if "price" in tool.get("name", "").lower() or "crypto" in tool.get("name", "").lower():
                    selected.append(tool)
        
        if "will" in user_message or "beneficiary" in user_message:
            # Add will tools
            for tool in available_tools.get("reactive", []):
                if "will" in tool.get("name", "").lower():
                    selected.append(tool)
            for tool in available_tools.get("active", []):
                if "social" in tool.get("name", "").lower() or "checker" in tool.get("name", "").lower():
                    selected.append(tool)
        
        state["selected_tools"] = selected
        return state
    
    def _should_generate_tools(self, state: ForgeState) -> str:
        """Decides if custom tools need to be generated"""
        user_message = state.get("user_message", "").lower()
        # Check if user requested custom functionality
        if any(keyword in user_message for keyword in ["custom", "new tool", "create tool", "add tool"]):
            return "yes"
        return "no"
    
    def _generate_custom_tools(self, state: ForgeState) -> ForgeState:
        """AI generates custom tools"""
        generated = self.ai_code.generate_tool(
            requirements=state["user_message"],
            existing_tools=state["selected_tools"]
        )
        state["generated_tools"] = generated
        # Add to temp registry
        user_id = state["agent_config"].get("user_id", "default")
        for tool in generated:
            self.tool_registry.add_temp_tool(user_id, tool)
        return state
    
    def _generate_logic(self, state: ForgeState) -> ForgeState:
        """AI generates logic.py code"""
        all_tools = state["selected_tools"] + state.get("generated_tools", [])
        logic_code = self.ai_code.generate_logic(
            selected_tools=all_tools,
            user_intent=state["user_message"],
            agent_config=state["agent_config"]
        )
        state["logic_code"] = logic_code
        return state
    
    def _create_agent(self, state: ForgeState) -> ForgeState:
        """Creates agent using agent service"""
        all_tools = state["selected_tools"] + state.get("generated_tools", [])
        agent_id = self.agent_service.create_agent(
            user_id=state["agent_config"]["user_id"],
            tools=all_tools,
            logic_code=state["logic_code"],
            config=state["agent_config"]
        )
        state["agent_id"] = agent_id
        return state
    
    async def process(self, user_message: str, user_id: str) -> Dict[str, Any]:
        """Main entry point for forge workflow"""
        initial_state = ForgeState(
            user_message=user_message,
            chat_history=[],
            selected_tools=[],
            agent_config={"user_id": user_id},
            generated_tools=[],
            logic_code="",
            agent_id="",
            current_step="start"
        )
        final_state = await self.graph.ainvoke(initial_state)
        return final_state
