import { executePayout } from "./base";
import { mergeIntoRawData, addNotification } from "./helper_functions";
import { analyze_personal_context } from "./personal_context";

async function notifyResult(tool: string, success: boolean, message: string, detail?: string): Promise<void> {
  const status = success ? "Success" : "Failed";
  const desc = detail ? `${message}: ${status} — ${detail}` : `${message}: ${status}`;
  await addNotification(desc, { tool, success });
}


export async function save_personal_info(args: {
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
    await notifyResult("save_personal_info", true, `Saved "${field}"`, undefined);
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await notifyResult("save_personal_info", false, `Save "${field}"`, msg);
    return { success: false, error: msg };
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
      await notifyResult("schedule_event", true, `Scheduled: ${description.trim()}`, undefined);
      return { success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await notifyResult("schedule_event", false, `Schedule "${description}"`, msg);
      return { success: false, error: msg };
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
    const msg = `Payment to ${rec} (${amt} NEAR)`;
    console.log(`[PAY] ${msg}, address ${addr}`);
    const yoctoAmount = BigInt(amt) * BigInt(10 ** 24);
    try {
      await executePayout({ accountId: rec, amountYocto: yoctoAmount });
      await notifyResult("pay", true, msg, undefined);
      return { success: true, message: "Payment successful" };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      await notifyResult("pay", false, msg, errMsg);
      return { success: false, error: errMsg };
    }
  }
  
export const toolMap: Record<string, (args: unknown) => Promise<unknown>> = {
    analyze_personal_context: (args) =>
    analyze_personal_context(args as { query?: string; input?: string }),
    save_personal_info: (args) => save_personal_info(args as { field?: string; value?: unknown; reason?: string }),
    schedule_event: (args) => schedule_event(args as { time_of_occur?: string; description?: string; which_tool_to_call?: string; arguments?: Record<string, unknown> }),
    pay: (args) => pay(args as { recipient?: string; amount?: string; address?: string; arguments?: Record<string, unknown> }),
  };