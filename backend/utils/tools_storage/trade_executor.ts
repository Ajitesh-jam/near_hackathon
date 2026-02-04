/**
 * REACTIVE tool: Executes trades on-demand
 */
import type { ToolConfig, ExecuteResult, ConfigSchema } from "./base";

const TOOL_TYPE = "reactive" as const;

export function getConfigSchema(): ConfigSchema {
  return {
    exchange: { type: "string", default: "near" },
    api_key: { type: "string", required: true },
  };
}

function buy(symbol: string, amount: number, config: ToolConfig): ExecuteResult {
  const exchange = (config.exchange as string) ?? "near";
  return {
    status: "success",
    exchange,
    order_id: `buy_${symbol}_${amount}`,
    timestamp: new Date().toISOString(),
  };
}

function sell(symbol: string, amount: number, config: ToolConfig): ExecuteResult {
  const exchange = (config.exchange as string) ?? "near";
  return {
    status: "success",
    exchange,
    order_id: `sell_${symbol}_${amount}`,
    timestamp: new Date().toISOString(),
  };
}

/** Execute trade. Args: (config, action, symbol, amount). API passes args: ["buy"|"sell", symbol, amount]. */
export function execute(
  config: ToolConfig,
  action?: string,
  symbol?: string,
  amount?: number
): ExecuteResult {
  const act = action ?? "buy";
  const sym = symbol ?? "BTC";
  const amt = amount ?? 0;
  if (act === "buy") {
    const result = buy(sym, amt, config);
    return { status: "success", action: act, symbol: sym, amount: amt, result };
  }
  if (act === "sell") {
    const result = sell(sym, amt, config);
    return { status: "success", action: act, symbol: sym, amount: amt, result };
  }
  return { status: "error", message: "Invalid action" };
}
