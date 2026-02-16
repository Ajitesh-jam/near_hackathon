import { agentCall, agentView } from "@neardefi/shade-agent-js";

export type Payout = { accountId: string; amountYocto: bigint };

export function formatError(error: unknown) {
  return { error: error instanceof Error ? error.message : String(error) };
}

export function parseYocto(value: unknown): bigint {
    if (typeof value === "bigint") return value;
    if (typeof value === "number") return BigInt(Math.trunc(value));
    if (typeof value === "string") return BigInt(value);
    if (value && typeof value === "object") {
        const data = value as Record<string, unknown>;
        if (data.amount !== undefined) return parseYocto(data.amount);
        if (data.value !== undefined) return parseYocto(data.value);
        if (data.U128 !== undefined) return parseYocto(data.U128);
    }
    throw new Error("Unable to parse yocto value from contract view response");
}
    
export async function agentViewBalance(): Promise<bigint> {
  return await agentView({
      methodName: "get_vault_balance",
      args: {},
  }).then(parseYocto);
} 

export async function executePayout( payout: Payout): Promise<void> {
      if (payout.amountYocto <= 0n) {
          console.warn(`Skipping beneficiary ${payout.accountId} due to non-positive payout.`);
          throw new Error(`Skipping beneficiary ${payout.accountId} due to non-positive payout.`);
      }

      console.log(`Paying ${payout.accountId} ${payout.amountYocto.toString()} yoctoNEAR via pay_by_agent.`);

      try {
        await agentCall({ 
            methodName: "pay_by_agent",
            args: {
                account_id: payout.accountId,
                amount: payout.amountYocto.toString(),
            },
        }); 
      } catch (error) {
          console.error(`Error executing payout:`, error);
          throw error;
      }
}
