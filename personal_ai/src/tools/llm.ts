import {
  GoogleGenAI,
  FunctionCallingConfigMode,
  createUserContent,
  createModelContent,
  createPartFromFunctionCall,
  createPartFromFunctionResponse,
} from "@google/genai";
import { readDataFile, readSystemPrompt } from "./base";
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
  const userData = await readDataFile();
  const dataContext =
    "User Private Data (use tools to retrieve details): profile (name, addresses, emails, phones, IDs), devices (including phone serial numbers and IMEI), goals (short/mid/long term), interests, hobbies, secrets, transactions, health/mood/journal. Always call analyze_personal_context when the user asks to remember, recall, look up personal info, or when they ask for an intro/introduction, to describe themselves, or to tell someone about their interests or hobbies. Raw summary: " +
    JSON.stringify(userData);
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
