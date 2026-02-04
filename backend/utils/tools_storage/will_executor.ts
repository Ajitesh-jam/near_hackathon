/**
 * REACTIVE tool: Executes will by transferring assets
 */
import type { ToolConfig, ExecuteResult, ConfigSchema } from "./base";

const TOOL_TYPE = "reactive" as const;

export function getConfigSchema(): ConfigSchema {
  return {
    beneficiary: { type: "string", required: true },
    amount: { type: "string", required: true },
    chain: { type: "string", default: "near" },
  };
}

function transferAssets(
  beneficiary: string,
  amount: string,
  chain: string
): Record<string, unknown> {
  // Placeholder - would use NEAR Chain Signatures API
  return {
    tx_hash: `0x${beneficiary}_${amount}`,
    chain,
    timestamp: new Date().toISOString(),
  };
}

/** Execute will transfer. Args: (config, beneficiary?, amount?, chain?). API passes args: [beneficiary, amount, chain]. */
export function execute(
  config: ToolConfig,
  beneficiary?: string,
  amount?: string,
  chain?: string
): ExecuteResult {
  const ben = beneficiary ?? "";
  const amt = amount ?? "0";
  const ch = chain ?? (config.chain as string) ?? "near";
  const result = transferAssets(ben, amt, ch);
  return {
    status: "success",
    beneficiary: ben,
    amount: amt,
    chain: ch,
    result,
  };
}
