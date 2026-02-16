import type { FunctionDeclaration } from "@google/genai";
import { analyze_personal_context } from "./personal_context";
import { mergeIntoRawData } from "./base";

async function save_personal_info(args: {
  field?: string;
  value?: unknown;
  reason?: string;
}): Promise<{ success: boolean; field?: string; error?: string }> {
  const field = args?.field;
  const value = args?.value;

  if (typeof field !== "string" || !field.trim()) {
    return {
      success: false,
      error: "Field is required. Use secrets for passwords/credentials; memory, notes, interests, hobbies, dailyJournal, moodLogs, goals_short; or a custom key for other data.",
    };
  }
  if (value === undefined || value === null) {
    return { success: false, error: "Value is required" };
  }

  try {
    const result = await mergeIntoRawData(field, value);
    return result;
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function schedule_event(args: {
  time_of_occur?: string;
  description?: string;
  which_tool_to_call?: string;
  arguments?: Record<string, unknown>;
}): Promise<{ success: boolean; id?: string; error?: string }> {
  const { time_of_occur, description, which_tool_to_call, arguments: toolArgs } = args ?? {};
  if (!time_of_occur || typeof time_of_occur !== "string") {
    return { success: false, error: "time_of_occur (ISO 8601) is required" };
  }
  if (!description || typeof description !== "string") {
    return { success: false, error: "description is required" };
  }
  try {
    const event = {
      time_of_occur: time_of_occur.trim(),
      description: description.trim(),
      which_tool_to_call: typeof which_tool_to_call === "string" ? which_tool_to_call : "pay",
      arguments: toolArgs && typeof toolArgs === "object" ? toolArgs : {},
    };
    await mergeIntoRawData("scheduled_events", event);
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function pay(args: {
  recipient?: string;
  amount?: string;
  address?: string;
  arguments?: Record<string, unknown>;
}): Promise<{ success: boolean; message?: string; error?: string }> {
  const recipient = args?.recipient ?? (args?.arguments as Record<string, unknown>)?.recipient ?? "unknown";
  const amount = args?.amount ?? (args?.arguments as Record<string, unknown>)?.amount ?? "0";
  const address = args?.address ?? (args?.arguments as Record<string, unknown>)?.address ?? "unknown address";
  const rec = String(recipient);
  const amt = String(amount);
  const addr = String(address);
  console.log(`[PAY] Payment done to ${rec}, amount ${amt} NEAR, address ${addr}`);
  return { success: true, message: "Payment logged (placeholder)" };
}

export const toolMap: Record<string, (args: unknown) => Promise<unknown>> = {
  analyze_personal_context: (args) =>
    analyze_personal_context(args as { query?: string; input?: string }),
  save_personal_info: (args) => save_personal_info(args as { field?: string; value?: unknown; reason?: string }),
  schedule_event: (args) => schedule_event(args as { time_of_occur?: string; description?: string; which_tool_to_call?: string; arguments?: Record<string, unknown> }),
  pay: (args) => pay(args as { recipient?: string; amount?: string; address?: string; arguments?: Record<string, unknown> }),
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
            "Where to save. MUST use 'secrets' for passwords, credentials, login info, pins, tokens. Use memory/notes for non-secret facts. Other: interests, hobbies, dailyJournal, moodLogs, goals_short, or custom key.",
        },
        value: {
          description:
            "For secrets: object like {\"kgp_erp\":{\"login_password\":\"abc123\"}} or {\"category\":{\"key\":\"value\"}}. For memory/notes: string. For interests/hobbies: string or comma-separated. For dailyJournal/moodLogs/goals_short: string or JSON object.",
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
