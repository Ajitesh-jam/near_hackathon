import axios from "axios";
import { google } from "googleapis";
import { TwitterApi } from "twitter-api-v2";
import { SocialMediaAccount } from "../contants";

const MS_IN_DAY = 1000 * 60 * 60 * 24;

export interface SocialActivityResult {
    lastActiveAt: Date | null;
    withinGracePeriod: boolean;
}

export async function checkSocialMediaActivity(account: SocialMediaAccount): Promise<SocialActivityResult> {
    let lastActiveDate: Date | null = null;

    console.log(`Checking ${account.platform} activity for ${account.username}`);

    try {
        switch (account.platform) {

            case "youtube":
                lastActiveDate = await getLatestYouTubeActivity(account);
                break;
            case "gmail":
                lastActiveDate = await getLatestGmailActivity();
                break;
            case "twitter":
                lastActiveDate = await getLatestTwitterActivity(account.username);
                break;
            case "instagram":
                lastActiveDate = await getLatestInstagramActivity();
                break;
            default:
                throw new Error(`Unsupported platform: ${account.platform}`);
        }

        if (!lastActiveDate) {
            // Fail-safe: if API fails or no data, rely on previous login.
            const lastKnownLogin = account.lastLoginISO ? new Date(account.lastLoginISO) : null;
            return {
                lastActiveAt: lastKnownLogin,
                withinGracePeriod: true,
            };
        }

        const now = new Date();
        const diffInDays = (now.getTime() - lastActiveDate.getTime()) / MS_IN_DAY;
        const withinGrace = diffInDays <= account.timePeriodDays;

        if (!withinGrace) {
            console.log(
                `[ALERT] Inactivity detected on ${account.platform} (${account.username}) for ${diffInDays.toFixed(1)} days.`,
            );
        }

        return {
            lastActiveAt: lastActiveDate,
            withinGracePeriod: withinGrace,
        };
    } catch (error) {
        console.error(`Error checking ${account.platform}:`, error);
        return {
            lastActiveAt: null,
            withinGracePeriod: true,
        };
    }
}

// --- Credential helpers (prefer platform-specific env, fallback to GMAIL_* for Google APIs) ---
function getYouTubeOAuthCredentials(): {
    clientId: string;
    clientSecret: string;
    refreshToken: string;
} | null {
    const clientId =
        process.env.YOUTUBE_CLIENT_ID || process.env.GMAIL_CLIENT_ID;
    const clientSecret =
        process.env.YOUTUBE_CLIENT_SECRET || process.env.GMAIL_CLIENT_SECRET;
    const refreshToken =
        process.env.YOUTUBE_REFRESH_TOKEN || process.env.GMAIL_REFRESH_TOKEN;
    if (!clientId || !clientSecret || !refreshToken) return null;
    return { clientId, clientSecret, refreshToken };
}

function getGmailOAuthCredentials(): {
    clientId: string;
    clientSecret: string;
    refreshToken: string;
} | null {
    const clientId = process.env.GMAIL_CLIENT_ID;
    const clientSecret = process.env.GMAIL_CLIENT_SECRET;
    const refreshToken = process.env.GMAIL_REFRESH_TOKEN;
    if (!clientId || !clientSecret || !refreshToken) return null;
    return { clientId, clientSecret, refreshToken };
}

// --- Platform Specific Logic ---

export async function getLatestYouTubeActivity(_account?: SocialMediaAccount): Promise<Date | null> {
    const creds = getYouTubeOAuthCredentials();
    if (!creds) {
        console.warn(
            "Missing YouTube credentials. Set YOUTUBE_CLIENT_ID/YOUTUBE_CLIENT_SECRET/YOUTUBE_REFRESH_TOKEN (or GMAIL_*)."
        );
        return null;
    }

    try {
        const auth = new google.auth.OAuth2(creds.clientId, creds.clientSecret);
        auth.setCredentials({ refresh_token: creds.refreshToken });
        const youtube = google.youtube({ version: "v3", auth });

        const response = await youtube.activities.list({
            part: ["snippet", "contentDetails"],
            mine: true,
            maxResults: 1,
        });

        const activities = response.data.items;
        if (!activities?.length) return null;

        const latestActivityDate = activities[0].snippet?.publishedAt;
        if (!latestActivityDate) return null;

        return new Date(latestActivityDate);
    } catch (err) {
        console.error(
            "YouTube OAuth check failed:",
            err  
        );
        return null;
    }
}

async function getLatestGmailActivity(): Promise<Date | null> {
    const creds = getGmailOAuthCredentials();
    if (!creds) {
        console.warn("Missing Gmail credentials; skipping Gmail check.");
        return null;
    }

    try {
        const auth = new google.auth.OAuth2(creds.clientId, creds.clientSecret);
        auth.setCredentials({ refresh_token: creds.refreshToken });
        const gmail = google.gmail({ version: "v1", auth });

        const res = await gmail.users.messages.list({
            userId: "me",
            q: "in:sent",
            maxResults: 1,
        });
        if (!res.data.messages?.length) return null;

        const msg = await gmail.users.messages.get({
            userId: "me",
            id: res.data.messages[0].id!,
        });
        return msg.data.internalDate
            ? new Date(parseInt(msg.data.internalDate, 10))
            : null;
    } catch (err) {
        console.error(
            "Gmail check failed:",
            err instanceof Error ? err.message : err
        );
        return null;
    }
}

async function getLatestTwitterActivity(username: string): Promise<Date | null> {
    const token = process.env.TWITTER_BEARER_TOKEN;
    if (!token) {
        console.warn("Missing Twitter bearer token; skipping Twitter check.");
        return null;
    }

    const client = new TwitterApi(token);
    const user = await client.v2.userByUsername(username);
    const tweets = await client.v2.userTimeline(
        user.data.id,
        {
            max_results: 5,
            "tweet.fields": ["created_at"],
        } as Record<string, unknown>,
    );

    if (!tweets.data.data?.length) return null;
    const createdAt = tweets.data.data[0].created_at;
    return createdAt ? new Date(createdAt) : null;
}

async function getLatestInstagramActivity(): Promise<Date | null> {
    const instagramToken = process.env.INSTAGRAM_ACCESS_TOKEN;
    if (!instagramToken) {
        console.warn("Missing Instagram access token; skipping Instagram check.");
        return null;
    }

    const url = `https://graph.facebook.com/v19.0/me/media?fields=timestamp&access_token=${instagramToken}`;
    const res = await axios.get(url);
    if (!res.data.data?.length) return null;
    return res.data.data[0].timestamp ? new Date(res.data.data[0].timestamp) : null;
}
