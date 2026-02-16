/**
 * Test YouTube API — run: npx tsx scripts/test-youtube.ts
 * Loads .env.development.local and calls getLatestYouTubeActivity().
 */
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.join(process.cwd(), ".env.development.local") });

import { getLatestYouTubeActivity } from "../src/tools/check_socials";

async function main() {
    console.log("Testing YouTube API...");
    const result = await getLatestYouTubeActivity();
    if (result) {
        console.log("YouTube API OK — latest activity:", result.toISOString());
    } else {
        console.log("YouTube API returned no activity or failed.");
    }
}

main().catch((err) => {
    console.error("Test failed:", err);
    process.exit(1);
});
