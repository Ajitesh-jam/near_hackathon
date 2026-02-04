"""
Centralized prompts for the backend.
Single source of truth for Forge workflow and AI code generation.
"""

# --- Forge workflow prompts ---

CLARIFY_INTENT = """Analyze this user request for building an agent:
User request: {user_message}
Selected tools: {selected_tools}

Based on the user's request and selected tools, provide:
1. A summary of what the agent will do
2. Any clarification questions if details are missing
3. Always include a final confirmation question: "Is everything in order to continue?"

Return JSON: {{"summary": str, "questions": [str], "confirmation": str}}"""

REVIEW_TOOLS = """Review the selected tools for this agent:
User requirements: {user_message}
Selected tools: {tools_list}

Suggest tool additions or removals if needed.
Return JSON: {{"add": [tool_names], "remove": [tool_names], "reason": str}}"""


# --- AI code generation prompts ---

TOOL_GENERATION = """User requirements: {requirements}
Existing tools: {existing_tools}

Generate Python tool class(es) following this pattern:
1. Inherit from Tool base class
2. Implement _determine_type() returning ToolType.ACTIVE or ToolType.REACTIVE
3. For ACTIVE: implement check() and run_loop()
4. For REACTIVE: implement execute()
5. Implement _get_config_schema()

Return ONLY valid Python code, no explanations."""

LOGIC_GENERATION = """Generate AgentLogic class for a NEAR agent.

User Intent: {user_intent}
Active Tools: {active_tools}
Reactive Tools: {reactive_tools}

The logic should:
1. Handle triggers from ACTIVE tools in on_trigger()
2. Execute REACTIVE tools based on conditions
3. Manage state between tool calls
4. Implement user's specific requirements

Return complete Python code for AgentLogic class."""

# --- TypeScript agent prompts ---

TOOL_GENERATION_TS = """User requirements: {requirements}
Existing tools: {existing_tools}

Generate TypeScript tool(s) that implement the Tool pattern from src/tools/base.ts.
1. Use types from "./base" (ToolType, CheckResult, ExecuteResult, ConfigSchema, ToolConfig).
2. For ACTIVE tools: export async function check(config: ToolConfig): Promise<CheckResult> and export async function runLoop(config, callback).
3. For REACTIVE tools: export function execute(...args, config: ToolConfig): ExecuteResult.
4. Export function getConfigSchema(): ConfigSchema.
5. Add a JSDoc comment at the top describing the tool (e.g. "ACTIVE tool: ..." or "REACTIVE tool: ...").

Return ONLY valid TypeScript code, no explanations. Single file per tool. Use export."""

LOGIC_GENERATION_TS = """Generate a TypeScript module for a NEAR agent (src/logic.ts) that will be imported by responder.ts.

User Intent: {user_intent}
Active Tools: {active_tools}
Reactive Tools: {reactive_tools}

The module should:
1. Export an async function runLogic() or similar that implements the agent behavior.
2. Use the provided tools (import from "./tools/...") - call check/runLoop for active tools, execute for reactive tools as needed.
3. Optionally use agentView and agentCall from "@neardefi/shade-agent-js" for contract interaction.
4. Match the pattern of responder.ts: loop, fetch data (agentView), call AI or tools, then agentCall if needed.

Return complete TypeScript code for src/logic.ts only. Use ES modules (import/export). No markdown wrapper."""

WILL_AGENT_TEMPLATE = """You are a helpful assistant that can answer questions and help with tasks. You will be given a time to monitor, a beneficiary address, an amount to send, and terms and conditions. You will need to monitor the time to monitor and send the amount to the beneficiary address if the terms and conditions are met. You will need to return the result of the monitoring."""
