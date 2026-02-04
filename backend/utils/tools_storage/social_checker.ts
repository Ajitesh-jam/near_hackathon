/**
 * ACTIVE tool: Checks social media login status
 */
import type { ToolConfig, CheckResult, ConfigSchema } from "./base";

const TOOL_TYPE = "active" as const;

export function getConfigSchema(): ConfigSchema {
  return {
    platform: { type: "string", required: true, default: "instagram" },
    username: { type: "string", required: true },
    password: { type: "string", required: true },
    monitoring_period_days: { type: "int", default: 180 },
    interval: { type: "int", default: 86400 },
  };
}

async function checkLastLogin(
  _platform: string,
  _username: string,
  _password: string
): Promise<Date> {
  // Placeholder - would use actual social media API
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d;
}

export async function check(config: ToolConfig): Promise<CheckResult> {
  const platform = (config.platform as string) ?? "instagram";
  const username = config.username as string;
  const password = config.password as string;
  const lastLogin = await checkLastLogin(platform, username, password);
  const monitoringPeriodDays = (config.monitoring_period_days as number) ?? 180;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - monitoringPeriodDays);
  const trigger = lastLogin < cutoffDate;
  return {
    status: "ok",
    data: {
      platform,
      username,
      last_login: lastLogin.toISOString(),
    },
    trigger,
  };
}

export async function runLoop(
  config: ToolConfig,
  callback: (result: CheckResult) => Promise<void> | void
): Promise<void> {
  const interval = (config.interval as number) ?? 86400; // Daily check
  const intervalMs = interval * 1000;
  while (true) {
    const result = await check(config);
    if (result.trigger) {
      await callback(result);
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}
