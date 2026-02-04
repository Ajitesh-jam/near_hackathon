/**
 * Unified base types for all tools.
 * ACTIVE tools implement check() and runLoop()
 * REACTIVE tools implement execute()
 */

export type ToolType = "active" | "reactive";

export interface CheckResult {
  status: string;
  data?: Record<string, unknown>;
  trigger: boolean;
}

export interface ExecuteResult {
  status: string;
  result?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ConfigSchema {
  [key: string]: { type: string; required?: boolean; default?: unknown };
}

export interface ToolConfig {
  [key: string]: unknown;
}

export interface ToolMetadata {
  name: string;
  type: ToolType;
  description: string;
  config_schema: ConfigSchema;
}

export interface Tool {
  readonly name: string;
  readonly tool_type: ToolType;
  config: ToolConfig;
  is_running: boolean;
  check?(): Promise<CheckResult> | CheckResult;
  runLoop?(callback: (result: CheckResult) => Promise<void> | void): Promise<void>;
  execute?(...args: unknown[]): ExecuteResult;
  get_metadata(): ToolMetadata;
  _get_config_schema(): ConfigSchema;
}
