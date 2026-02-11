/**
 * Runs active tools continuously in the background and provides reactive tool handlers for API calls.
 * Active tools: run check/runLoop alongside the server.
 * Reactive tools: execute on-demand when an API is hit.
 */
import type { ToolConfig, CheckResult, ExecuteResult } from "./tools/base";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname_ =
  typeof __dirname !== "undefined"
    ? __dirname
    : path.dirname(process.argv[1] || ".");

export interface ToolEntry {
  name: string;
  config: ToolConfig;
}

export interface ToolsConfig {
  active: ToolEntry[];
  reactive: ToolEntry[];
}

const CONFIG_PATH = path.join(__dirname_, "..", "tools.config.json");

function loadToolsConfig(): ToolsConfig {
  try {
    const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
    const data = JSON.parse(raw) as ToolsConfig;
    return {
      active: Array.isArray(data.active) ? data.active : [],
      reactive: Array.isArray(data.reactive) ? data.reactive : [],
    };
  } catch {
    return { active: [], reactive: [] };
  }
}

/** Active tool module shape: check, runLoop */
interface ActiveToolModule {
  check?(config: ToolConfig): Promise<CheckResult> | CheckResult;
  runLoop?(
    config: ToolConfig,
    callback: (result: CheckResult) => Promise<void> | void
  ): Promise<void>;
  getConfigSchema?(): unknown;
}

/** Reactive tool module shape: execute */
interface ReactiveToolModule {
  execute?(config: ToolConfig, ...args: unknown[]): ExecuteResult;
  getConfigSchema?(): unknown;
}

/** Start all active tools in the background (run continuously). */
export async function startActiveTools(
  onTrigger?: (toolName: string, result: CheckResult) => void | Promise<void>
): Promise<void> {
  const config = loadToolsConfig();
  for (const entry of config.active) {
    try {
      const mod = await import(`./tools/${entry.name}`) as ActiveToolModule;
      if (typeof mod.runLoop === "function") {
        const callback = (result: CheckResult) => {
          if (onTrigger) {
            void Promise.resolve(onTrigger(entry.name, result)).catch((err) =>
              console.error(`Active tool ${entry.name} trigger callback error:`, err)
            );
          }
        };
        void mod.runLoop(entry.config, callback).catch((err) =>
          console.error(`Active tool ${entry.name} runLoop error:`, err)
        );
        console.log(`Started active tool: ${entry.name}`);
      }
    } catch (err) {
      console.error(`Failed to start active tool ${entry.name}:`, err);
    }
  }
}

/** Get reactive tool handlers: name -> { execute(config, ...args) }. */
export async function getReactiveTools(): Promise<
  Map<string, { execute: (config: ToolConfig, ...args: unknown[]) => ExecuteResult; config: ToolConfig }>
> {
  const config = loadToolsConfig();
  const map = new Map<
    string,
    { execute: (config: ToolConfig, ...args: unknown[]) => ExecuteResult; config: ToolConfig }
  >();
  for (const entry of config.reactive) {
    try {
      const mod = await import(`./tools/${entry.name}`) as ReactiveToolModule;
      if (typeof mod.execute === "function") {
        map.set(entry.name, {
          execute: (cfg: ToolConfig, ...args: unknown[]) =>
            mod.execute!(cfg, ...args),
          config: entry.config,
        });
      }
    } catch (err) {
      console.error(`Failed to load reactive tool ${entry.name}:`, err);
    }
  }
  return map;
}

/** List all configured tools (active + reactive) with metadata. */
export async function listToolsMetadata(): Promise<{
  active: Array<{ name: string; config: ToolConfig }>;
  reactive: Array<{ name: string; config: ToolConfig }>;
}> {
  const config = loadToolsConfig();
  return {
    active: config.active.map((e) => ({ name: e.name, config: e.config })),
    reactive: config.reactive.map((e) => ({ name: e.name, config: e.config })),
  };
}
