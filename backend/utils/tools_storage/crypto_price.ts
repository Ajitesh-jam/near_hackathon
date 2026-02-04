/**
 * ACTIVE tool: Monitors crypto price continuously
 */
import type { ToolConfig, CheckResult, ConfigSchema } from "./base";

const TOOL_TYPE = "active" as const;

export function getConfigSchema(): ConfigSchema {
  return {
    symbol: { type: "string", required: true, default: "BTC" },
    threshold: { type: "float", required: false },
    interval: { type: "int", default: 60 },
    above_threshold: { type: "bool", default: true },
  };
}

async function fetchPrice(_symbol: string): Promise<number> {
  // Placeholder - would use actual API/oracle. In production, use NEAR oracle or external API
  return 40000 + Math.random() * 10000; // Mock BTC price
}

export async function check(config: ToolConfig): Promise<CheckResult> {
  const symbol = (config.symbol as string) ?? "BTC";
  const threshold = config.threshold as number | undefined;
  const price = await fetchPrice(symbol);
  let trigger = false;
  if (threshold !== undefined) {
    const aboveThreshold = (config.above_threshold as boolean) ?? true;
    trigger = aboveThreshold ? price >= threshold : price <= threshold;
  }
  return {
    status: "ok",
    data: { symbol, price },
    trigger,
  };
}

export async function runLoop(
  config: ToolConfig,
  callback: (result: CheckResult) => Promise<void> | void
): Promise<void> {
  const interval = (config.interval as number) ?? 60;
  const intervalMs = interval * 1000;
  while (true) {
    const result = await check(config);
    if (result.trigger) {
      await callback(result);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}
