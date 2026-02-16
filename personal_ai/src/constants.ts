import path from "path";

const projectRoot = process.cwd();
const srcDir = path.join(projectRoot, "src");

export const DATA_FILE_PATH = path.join(srcDir, "data.json");
export const SYSTEM_PROMPT_PATH = path.join(srcDir, "system_prompt.txt");

export interface PersonalData {
  secrets: Record<string, unknown>;
  interests: string[];
  goals: string[];
  spending: unknown[];
  contacts: unknown[];
  notes: unknown[];
}

export interface NotificationEntry {
  id?: string;
  time_of_occur?: string;
  description?: string;
  which_tool_to_call?: string;
  arguments?: Record<string, unknown>;
  created_at?: string;
  [key: string]: unknown;
}

export interface ScheduledEventEntry {
  id?: string;
  time_of_occur?: string;
  description?: string;
  which_tool_to_call?: string;
  arguments?: Record<string, unknown>;
  created_at?: string;
  [key: string]: unknown;
}


export const PERSONAL_DATA_KEYS: (keyof PersonalData)[] = [
  "secrets",
  "interests",
  "goals",
  "spending",
  "contacts",
  "notes",
];

export const MAX_TOOL_CALLS = 2;
export const LLM_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
export const TOKEN_LIMIT = 4096;

export const DEFAULT_PERSONAL_DATA: PersonalData = {
  secrets: {},
  interests: [],
  goals: [],
  spending: [],
  contacts: [],
  notes: [],
};

export const SAVE_DATA_KEYS = [
    "secrets",
    "memory",
    "notes",
    "interests",
    "hobbies",
    "dailyJournal",
    "moodLogs",
    "goals_short",
    "scheduled_events",
    "near_addresses",
  ] as const;

  export interface AnalyzeResult {
    summary: string;
    details: unknown;
    category?: string;
  }
  
  export type RawData = {
    profile?: Record<string, unknown>;
    secrets?: Record<string, unknown>;
    financialOverview?: Record<string, unknown>;
    goals?: {
      shortTerm?: unknown[];
      midTerm?: unknown[];
      longTerm?: unknown[];
    };
    interests?: string[];
    hobbies?: string[];
    memory?: unknown[];
    llm_custom?: Record<string, unknown[]>;
    devices?: Array<Record<string, unknown> & { id?: string; deviceName?: string; type?: string; serial?: string; imei?: string }>;
    smart_home_devices?: unknown[];
    transaction_history?: unknown[];
    health_daily_logs?: unknown[];
    moodLogs?: unknown[];
    dailyJournal?: unknown[];
    app_sessions?: unknown[];
    scheduled_events?: unknown[];
    notifications?: unknown[];
    near_addresses?: Record<string, string>;
    [key: string]: unknown;
  };
  
export type SaveDataKey = (typeof SAVE_DATA_KEYS)[number];
export type AddDataField = keyof PersonalData;