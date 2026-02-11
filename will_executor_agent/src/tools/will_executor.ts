import { BeneficiaryShare, WillEntry, will_entry } from "../contants";
import { checkSocialMediaActivity } from "./check_socials";
import { agentViewBalance, executePayout, Payout } from "./base";

const MS_IN_SECOND = 1000;
// const SECONDS_PER_DAY = 24 * 60 * 60;
const SECONDS_PER_DAY = 10;


export type WillRequestPayload = Omit<WillEntry, "createdAtISO" | "updatedAtISO">;

export type PartialWillPayload = Partial<
  Pick<WillEntry, "willText" | "executor" | "beneficiaries" | "socialMediaAccounts" | "sleepSeconds" | "targetAmountYocto">
>;

export function overwriteWill(entry: WillEntry): void {
  will_entry.willText = entry.willText;
  will_entry.executor = entry.executor;
  will_entry.beneficiaries = entry.beneficiaries;
  will_entry.socialMediaAccounts = entry.socialMediaAccounts;
  will_entry.sleepSeconds = entry.sleepSeconds;
  will_entry.targetAmountYocto = entry.targetAmountYocto;
  will_entry.createdAtISO = entry.createdAtISO;
  will_entry.updatedAtISO = entry.updatedAtISO;
}

export function mutateWill(mutator: (entry: WillEntry) => void): void {
  mutator(will_entry);
  will_entry.updatedAtISO = new Date().toISOString();
}

function calculateSleepInterval(will: WillEntry): number {
    const minSocialWindowDays = Math.min(...will.socialMediaAccounts.map((acc) => acc.timePeriodDays));
    const socialWindowSeconds = minSocialWindowDays * SECONDS_PER_DAY;
    return Math.max(6, Math.min(will.sleepSeconds, socialWindowSeconds));
}

function calculatePayouts(totalYocto: bigint, beneficiaries: BeneficiaryShare[]): Payout[] {
    const PRECISION = 10000;
    const units = beneficiaries.map((b) => ({
        accountId: b.accountId,
        units: Math.round(b.split * PRECISION),
    }));
    const totalUnits = units.reduce((sum, item) => sum + item.units, 0);

    if (totalUnits === 0) {
        throw new Error("Total beneficiary split cannot be zero.");
    }

    const payouts = [];
    let remaining = totalYocto;

    for (let i = 0; i < units.length; i++) {
        const { accountId, units: shareUnits } = units[i];
        const isLast = i === units.length - 1;
        const amount = isLast
            ? remaining
            : (totalYocto * BigInt(shareUnits)) / BigInt(totalUnits);

        payouts.push({ accountId, amountYocto: amount });
        remaining -= amount;
    }

    return payouts;
}

export async function willExecutorAgent(): Promise<void> {
    console.log("Will executor agent started.");

    while (true) {
        try {
            if (!will_entry.socialMediaAccounts.length) {
                console.warn("No social accounts configured; skipping cycle.");
                console.log(`Sleeping for ${will_entry.sleepSeconds} seconds`);
                await new Promise(resolve => setTimeout(resolve, will_entry.sleepSeconds * MS_IN_SECOND));
                continue;
            }
            console.log("Checking social media activity");

            const sleepSeconds = calculateSleepInterval(will_entry);
            console.log(`Sleeping for ${sleepSeconds} seconds`);
            await new Promise(resolve => setTimeout(resolve, sleepSeconds * MS_IN_SECOND));

            if (!will_entry.socialMediaAccounts.length) {
                console.warn("No social accounts configured after wake; skipping execution.");
                continue;
            }

            const activityResults = await Promise.all(
                will_entry.socialMediaAccounts.map(async (account) => {
                    const result = await checkSocialMediaActivity(account);
                    if (result.lastActiveAt) {
                        account.lastLoginISO = result.lastActiveAt.toISOString();
                    }
                    return result.withinGracePeriod;
                }),
            );

            const recentActivity = activityResults.some(Boolean);
            if (recentActivity) {
                console.log("Recent social activity detected; postponing execution.");
                continue;
            }

            console.log("No recent social activity detected; executing will.");

            const totalYocto = will_entry.targetAmountYocto
                ? BigInt(will_entry.targetAmountYocto)
                : await agentViewBalance();
            const payouts = calculatePayouts(totalYocto, will_entry.beneficiaries);

            for (const payout of payouts) {
                await executePayout(payout);
            }
        } catch (error) {
            console.error(`Error running will executor loop:`, error);
            // Brief cooldown to avoid runaway logs.
            await new Promise(resolve => setTimeout(resolve, 30 * MS_IN_SECOND));
        }
    }
}