import {
  GoogleGenAI,
  FunctionCallingConfigMode,
  createUserContent,
  createModelContent,
  createPartFromFunctionCall,
  createPartFromFunctionResponse,
} from "@google/genai";
import { readRawDataFile, readSystemPrompt } from "./base";
import { toolMap, geminiToolDeclarations } from "./index";
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

// #region agent log
const _log = (msg: string, data: Record<string, unknown>) => {
  fetch("http://127.0.0.1:7248/ingest/bb0cffa1-5a74-4c51-99a8-d91848cdd306", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ location: "llm.ts", message: msg, data, timestamp: Date.now() }),
  }).catch(() => {});
};
// #endregion

export async function runAgent(userMessage: string): Promise<string> {
  const client = getClient();
  _log("runAgent env check", {
    hypothesisId: "H1",
    runId: "post-fix",
    clientCreated: !!client,
  });

  const systemPrompt = await readSystemPrompt();
  const rawData = (await readRawDataFile()) as Record<string, unknown>;
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
  const memoryContext =
    memoryContents.length > 0 || customContents.length > 0
      ? `\n\nMemory / saved items (check here if user asks about secrets or facts not in structured data): ${JSON.stringify([...memoryContents, ...customContents])}`
      : "";
  const notifications = Array.isArray(rawData.notifications) ? rawData.notifications : [];
  const notificationsContext =
    notifications.length > 0
      ? `\n\nPending notifications (user needs to act on these; surface them proactively): ${JSON.stringify(notifications)}`
      : "";
  const nowIso = new Date().toISOString();
  const timeContext = `\n\nCurrent time (message received): ${nowIso}. Use this to compute schedule_event time_of_occur for relative phrases: "tomorrow" = add 1 day, "in 1 week" = add 7 days, "one month later" = add ~30 days, etc. Always output ISO 8601.`;
  const dataContext =
    "User Private Data (use tools to retrieve details): profile (name, addresses, emails, phones, IDs), devices (including phone serial numbers and IMEI), goals (short/mid/long term), interests, hobbies, secrets, transactions, health/mood/journal, scheduled_events, notifications. Always call analyze_personal_context when the user asks to remember, recall, look up personal info. Use save_personal_info for facts to remember; use field 'secrets' for passwords/credentials, never memory. Use schedule_event for reminders and future payments." +
    timeContext +
    memoryContext +
    notificationsContext;
  const initialUserContent = createUserContent(
    `${systemPrompt}\n\n${dataContext}\n\nUser: ${userMessage}`
  );

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
  if (!functionCalls || functionCalls.length === 0) {
    return response.text ?? "";
  }

  const modelParts = functionCalls.map((fc) =>
    createPartFromFunctionCall((fc.name ?? ""), fc.args ?? {})
  );
  const modelContent = createModelContent(modelParts.length === 1 ? modelParts[0] : modelParts);

  const responseParts: ReturnType<typeof createPartFromFunctionResponse>[] = [];
  for (const fc of functionCalls) {
    const name = fc.name ?? "";
    const id = fc.id ?? "";
    let result: unknown;
    try {
      if (name in toolMap) {
        result = await toolMap[name](fc.args ?? {});
      } else {
        result = { error: `Unknown tool: ${name}` };
      }
    } catch (err) {
      result = { error: err instanceof Error ? err.message : String(err) };
    }
    responseParts.push(
      createPartFromFunctionResponse(id, name, { output: result })
    );
  }
  const followUpUserContent = createUserContent(
    responseParts.length === 1 ? responseParts[0] : responseParts
  );

  const finalResponse = await client.models.generateContent({
    model: LLM_MODEL,
    contents: [initialUserContent, modelContent, followUpUserContent],
    config: { maxOutputTokens: 8192 },
  });

  return finalResponse.text ?? "";
}
