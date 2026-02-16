import {
  GoogleGenAI,
  FunctionCallingConfigMode,
  createUserContent,
  createModelContent,
  createPartFromFunctionCall,
  createPartFromFunctionResponse,
} from "@google/genai";
import type { FunctionDeclaration } from "@google/genai";
import { readRawDataFile, readSystemPrompt } from "./helper_functions";
import { toolMap } from "./agent_tools";
import { LLM_MODEL } from "../constants";

let ai: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (ai) return ai;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set. Get an API key from https://aistudio.google.com/apikey");
  }
  ai = new GoogleGenAI({ apiKey });
  return ai;
}

function buildMemoryAndCustomContext(rawData: Record<string, unknown>): string {
  const memory = Array.isArray(rawData.memory) ? rawData.memory : [];
  const llmCustom = rawData.llm_custom && typeof rawData.llm_custom === "object" ? rawData.llm_custom : {};
  const memoryContents = memory.map((m: unknown) =>
    typeof m === "object" && m && "content" in m ? (m as { content: string }).content : String(m)
  );
  const customContents = Object.entries(llmCustom as Record<string, unknown[]>).flatMap(([k, arr]) =>
    (Array.isArray(arr) ? arr : []).map((v: unknown) =>
      typeof v === "object" && v && "content" in v ? `[${k}] ${(v as { content: string }).content}` : `[${k}] ${String(v)}`
    )
  );
  const all = [...memoryContents, ...customContents];
  return all.length > 0
    ? `\n\nMemory / saved items (check here if user asks about secrets or facts not in structured data): ${JSON.stringify(all)}`
    : "";
}

function buildNearAddressesContext(rawData: Record<string, unknown>): string {
  const addrs = rawData.near_addresses;
  if (!addrs || typeof addrs !== "object" || Array.isArray(addrs)) return "";
  const entries = Object.entries(addrs as Record<string, string>)
    .filter(([, v]) => v && typeof v === "string")
    .map(([k, v]) => `${k}: ${v}`);
  if (entries.length === 0) return "";
  return `\n\nNEAR wallet addresses (use for pay/schedule_event when user says "pay X" or "schedule payment to X"; map name to address): ${JSON.stringify(addrs)}`;
}

function buildInitialContext(rawData: Record<string, unknown>, systemPrompt: string, userMessage: string): string {
  const memoryContext = buildMemoryAndCustomContext(rawData);
  const nearContext = buildNearAddressesContext(rawData);
  const notifications = Array.isArray(rawData.notifications) ? rawData.notifications : [];
  const notificationsContext =
    notifications.length > 0
      ? `\n\nPending notifications (user needs to act on these; surface them proactively): ${JSON.stringify(notifications)}`
      : "";
  const nowIso = new Date().toISOString();
  const timeContext = `\n\nCurrent time (message received): ${nowIso}. Use this to compute schedule_event time_of_occur for relative phrases: "tomorrow" = add 1 day, "in 1 week" = add 7 days, "one month later" = add ~30 days, etc. Always output ISO 8601.`;
  const dataContext =
    "User Private Data (use tools to retrieve details): profile (name, addresses, emails, phones, IDs), devices (including phone serial numbers and IMEI), goals (short/mid/long term), interests, hobbies, secrets, near_addresses (NEAR wallet addresses for relatives/businesses), transactions, health/mood/journal, scheduled_events, notifications. Always call analyze_personal_context when the user asks to remember, recall, look up personal info. Use save_personal_info for facts to remember; use field 'secrets' for passwords/credentials, never memory; use field 'near_addresses' when user saves a NEAR wallet address. Use schedule_event for reminders and future payments. When user says 'pay my mother' or 'schedule payment to X', use the address from near_addresses if the label matches (e.g. mother, dad)." +
    timeContext +
    nearContext +
    memoryContext +
    notificationsContext;
  return `${systemPrompt}\n\n${dataContext}\n\nUser: ${userMessage}`;
}

async function executeToolCalls(
  functionCalls: Array<{ name?: string; id?: string; args?: Record<string, unknown> }>
): Promise<ReturnType<typeof createPartFromFunctionResponse>[]> {
  const results: ReturnType<typeof createPartFromFunctionResponse>[] = [];
  for (const fc of functionCalls) {
    const name = fc.name ?? "";
    const id = fc.id ?? "";
    let result: unknown;
    try {
      result = name in toolMap ? await toolMap[name](fc.args ?? {}) : { error: `Unknown tool: ${name}` };
    } catch (err) {
      result = { error: err instanceof Error ? err.message : String(err) };
    }
    results.push(createPartFromFunctionResponse(id, name, { output: result }));
  }
  return results;
}


/** Gemini API function declarations for tool calling. */
export const geminiToolDeclarations: FunctionDeclaration[] = [
  {
    name: "analyze_personal_context",
    description:
      "Retrieve and analyze the user's private data. ALWAYS use when the user asks to remember, look up, or recall anything personal. Data includes: near_addresses (NEAR wallet addresses for relatives/businesses—use for 'pay my mother', 'schedule payment to dad'), devices (phone/laptop serial numbers, IMEI), profile (name, address, email, phone numbers, passport), goals (short/mid/long term), secrets, transactions/spending, health logs, mood logs, daily journal, smart home devices, app usage. Use for: 'pay my mother', 'my goals', 'serial number of my phone', 'my IMEI', etc. Returns structured summary and details including near_addresses when relevant.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The user's question or topic (e.g. 'serial number of my phone', 'my goals', 'my address'). Pass the full user question when they ask to remember or look up something.",
        },
        input: {
          type: "string",
          description: "Alternative to query: the user's input or topic.",
        },
      },
    },
  },
  {
    name: "save_personal_info",
    description:
      "Save information the user wants you to remember. CRITICAL: Passwords, credentials, login info, pins, tokens MUST use field 'secrets'—never memory. Use memory/notes for non-secret facts. Call when: user says 'save my password', 'remember that...', 'note that...', shares preferences, goals, interests, mood. Standard fields: secrets (passwords/credentials), memory/notes (general facts), interests, hobbies, dailyJournal, moodLogs, goals_short. Custom key for other data.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        field: {
          type: "string",
          description:
            "Where to save. MUST use 'secrets' for passwords, credentials. Use 'near_addresses' for NEAR wallet addresses (value: object e.g. {\"mother\":\"mother.near\",\"dad\":\"dad.near\"}). Use memory/notes for non-secret facts. Other: interests, hobbies, dailyJournal, moodLogs, goals_short, or custom key.",
        },
        value: {
          description:
            "For secrets: object like {\"kgp_erp\":{\"login_password\":\"abc123\"}}. For near_addresses: object like {\"mother\":\"mother.near\",\"dad\":\"dad.near\"}. For memory/notes: string. For interests/hobbies: string or comma-separated. For dailyJournal/moodLogs/goals_short: string or JSON object.",
        },
        reason: {
          type: "string",
          description: "Brief reason why this is being saved (for logging).",
        },
      },
      required: ["field", "value"],
    },
  },
  {
    name: "schedule_event",
    description:
      "Schedule a future event/reminder. Call when user says 'remind me to X', 'pay Y in 1 day', 'schedule Z for March 3rd'. Events move to notifications when time arrives.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        time_of_occur: {
          type: "string",
          description: "ISO 8601 date-time when event should occur (e.g. 2026-03-03T00:00:00.000Z). For 'in 1 day' use Date plus 86400000ms.",
        },
        description: {
          type: "string",
          description: "Human-readable description of the event (e.g. Pay 3 NEAR to Dad).",
        },
        which_tool_to_call: {
          type: "string",
          description: "Tool to invoke when user acts on the notification (e.g. pay). Default: pay.",
        },
        arguments: {
          type: "object",
          description: "Arguments for the tool (e.g. { recipient: 'Dad', amount: '3', address: 'Dad NEAR address' }).",
        },
      },
      required: ["time_of_occur", "description"],
    },
  },
  {
    name: "pay",
    description:
      "Execute a payment (placeholder). Call when user confirms they want to pay. Logs the payment; no actual transfer.",
    parametersJsonSchema: {
      type: "object",
      properties: {
        recipient: { type: "string", description: "Recipient name or identifier." },
        amount: { type: "string", description: "Amount to pay (e.g. 3 for 3 NEAR)." },
        address: { type: "string", description: "Recipient NEAR address or payment destination." },
      },
    },
  },
];



export async function runAgent(userMessage: string): Promise<string> {
  const client = getClient();
  const [systemPrompt, rawData] = await Promise.all([readSystemPrompt(), readRawDataFile()]);
  const data = rawData as Record<string, unknown>;
  const initialPrompt = buildInitialContext(data, systemPrompt, userMessage);
  const initialUserContent = createUserContent(initialPrompt);

  const response = await client.models.generateContent({
    model: LLM_MODEL,
    contents: initialUserContent,
    config: {
      tools: [{ functionDeclarations: geminiToolDeclarations }],
      toolConfig: {
        functionCallingConfig: {
          mode: FunctionCallingConfigMode.AUTO,
        },
      },
    },
  });

  const functionCalls = response.functionCalls;
  if (!functionCalls?.length) return response.text ?? "";

  const modelParts = functionCalls.map((fc) => createPartFromFunctionCall(fc.name ?? "", fc.args ?? {}));
  const modelContent = createModelContent(modelParts.length === 1 ? modelParts[0] : modelParts);
  const responseParts = await executeToolCalls(functionCalls);
  const followUpUserContent = createUserContent(responseParts.length === 1 ? responseParts[0] : responseParts);

  const finalResponse = await client.models.generateContent({
    model: LLM_MODEL,
    contents: [initialUserContent, modelContent, followUpUserContent],
    config: { maxOutputTokens: 8192 },
  });

  return finalResponse.text ?? "";
}
