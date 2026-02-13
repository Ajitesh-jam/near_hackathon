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


if there is will executor agent, then ask the user to provide the will text, executor, beneficiaries, social media accounts, sleep seconds, target amount yocto.
You can think of it as a structure called will_entry with fields like:
- willText: string (the full will text / instructions)
- executor: string (NEAR account ID of the executor)
- beneficiaries: array of objects with accountId and split (percentage)
- socialMediaAccounts: array with platform, username, timePeriodDays, lastLoginISO
- sleepSeconds: number
- targetAmountYocto: string or undefined
- createdAtISO / updatedAtISO: ISO timestamp strings

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

LOGIC_GENERATION_TS = """Generate two TypeScript files for a NEAR agent: src/logic.ts and src/contants.ts.

User Intent: {user_intent}
Active Tools: {active_tools}
Reactive Tools: {reactive_tools}

---

1) src/logic.ts
- Import all agent tools from "./tools/..." (based on the active/reactive tools above).
- Export a function runLogic(): void that is called by the agent to execute the logic.
- Inside runLogic(), run whatever agent entry point the tools provide (e.g. willExecutorAgent(), or the main async function from the active tool). Use an async IIFE and catch errors.
- Add short comments for missing env vars or setup steps.

Example pattern (described, not exact code):
- Import the main agent function from the appropriate tool (for example, a function called willExecutorAgent from \"./tools/will_executor\").
- In runLogic(), start an async IIFE that awaits that function and logs any errors.

If there are multiple tools, run the main entry point that orchestrates them (e.g. the active tool's run loop or agent function).

---

2) src/contants.ts
- Export all constants and types required for the agent tools to run (config objects, types, defaults).
- Include types (interfaces) that the tools and logic depend on.
- Fill values from user intent where possible; use placeholders (e.g. "YOUR_ACCOUNT.testnet") with comments.

Example (will executor), described structurally:
- A will_entry object with fields:
  - willText: string describing the will conditions.
  - executor: NEAR account ID string (e.g. \"ajitesh-1.testnet\").
  - beneficiaries: array of objects like {{ accountId: string, split: number }}.
  - socialMediaAccounts: array of objects like {{ platform: string, username: string, timePeriodDays: number, lastLoginISO: string }}.
  - sleepSeconds: number.
  - targetAmountYocto: string or undefined.
  - createdAtISO / updatedAtISO: ISO timestamp strings.

OUTPUT FORMAT (strict): Return exactly two blocks, in order, with these exact headers. No markdown or extra text.

=== FILE: src/logic.ts ===
<full TypeScript code for src/logic.ts>

=== FILE: src/contants.ts ===
<full TypeScript code for src/contants.ts>
"""

WILL_AGENT_TEMPLATE = """You are a helpful assistant that can answer questions and help with tasks. You will be given a time to monitor, a beneficiary address, an amount to send, and terms and conditions. You will need to monitor the time to monitor and send the amount to the beneficiary address if the terms and conditions are met. You will need to return the result of the monitoring."""
