import type { FunctionDeclaration } from "@google/genai";
import { analyze_personal_context } from "./personal_context";

export const toolMap: Record<string, (args: unknown) => Promise<unknown>> = {
  analyze_personal_context: (args) =>
    analyze_personal_context(args as { query?: string; input?: string }),
};

/** Gemini API function declarations for tool calling. */
export const geminiToolDeclarations: FunctionDeclaration[] = [
  {
    name: "analyze_personal_context",
    description:
      "Retrieve and analyze the user's private data. ALWAYS use when the user asks to remember, look up, or recall anything personal. Data includes: devices (phone/laptop serial numbers, IMEI), profile (name, address, email, phone numbers, passport), goals (short/mid/long term), secrets, transactions/spending, health logs, mood logs, daily journal, smart home devices, app usage. Use for: 'serial number of my phone', 'my IMEI', 'my goals', 'my spending', 'my address', 'my passport', 'my devices', 'health', 'journal', etc. Returns structured summary and details.",
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
];
