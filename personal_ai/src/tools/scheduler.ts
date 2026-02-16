import { moveDueEventsToNotifications } from "./base";

const POLL_INTERVAL_MS = 60_000;

/** Background loop: every 60s, move due scheduled_events to notifications. */
export function runSchedulerLoop(): void {
  console.log("[Scheduler] Starting scheduler loop (poll every 60s)");
  const run = async () => {
    try {
      const moved = await moveDueEventsToNotifications();
      if (moved > 0) {
        console.log(`[Scheduler] Moved ${moved} event(s) to notifications`);
      }
    } catch (err) {
      console.error("[Scheduler] Error:", err instanceof Error ? err.message : String(err));
    }
  };
  run();
  setInterval(run, POLL_INTERVAL_MS);
}
