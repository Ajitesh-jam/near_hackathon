export type SocialPlatform = "instagram" | "gmail" | "twitter" | "youtube";

export interface SocialMediaAccount {
    platform: SocialPlatform;
    username: string;
    timePeriodDays: number;
    lastLoginISO?: string | null;
}

export interface BeneficiaryShare {
    accountId: string;
    split: number; // percentage weight e.g. 50 => 50%
}

export interface WillEntry {
    willText: string;
    executor: string;
    beneficiaries: BeneficiaryShare[];
    socialMediaAccounts: SocialMediaAccount[];
    /// Minimum interval (seconds) between inactivity checks.
    sleepSeconds: number;
    /// Optional fixed amount (yoctoNEAR) to distribute, otherwise vault balance is used.
    targetAmountYocto?: string;
    createdAtISO: string;
    updatedAtISO: string;
}

// export const DEFAULT_SLEEP_SECONDS = 60 * 60 * 24; // 1 day
export const DEFAULT_SLEEP_SECONDS = 5; // 10 seconds

export const will_entry: WillEntry = {
    willText:
        "Check my social media accounts, instagram: shade-agent-01, gmail: shade-agent-01@gmail.com, twitter: shade-agent-01 and when there is no activity for 30 days, distribute my assets.",
    executor: "ajitesh-1.testnet",
    beneficiaries: [
        { accountId: "ajitesh-2.testnet", split: 50 },
        { accountId: "ajitesh-jam.near", split: 50 },
    ],
    socialMediaAccounts: [
        // {
        //     platform: "instagram",
        //     username: "shade-agent-01",
        //     timePeriodDays: 30,
        //     lastLoginISO: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        // },
        {
            platform: "youtube",
            username: "ajitesh.jam@gmail.com",
            timePeriodDays: 3,
            lastLoginISO: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        },
        // {
        //     platform: "gmail",
        //     username: "ajitesh.jam@gmail.com",
        //     timePeriodDays: 3,
        //     lastLoginISO: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        // },
        // {
        //     platform: "twitter",
        //     username: "shade-agent-01",
        //     timePeriodDays: 30,
        //     lastLoginISO: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        // },
    ],
    sleepSeconds: DEFAULT_SLEEP_SECONDS,
    targetAmountYocto: undefined,
    createdAtISO: new Date().toISOString(),
    updatedAtISO: new Date().toISOString(),
};
