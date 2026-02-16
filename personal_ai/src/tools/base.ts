import fs from "fs/promises";
import {
  DATA_FILE_PATH,
  SYSTEM_PROMPT_PATH,
  PersonalData,
  PERSONAL_DATA_KEYS,
} from "../constants";

const DEFAULT_PERSONAL_DATA: PersonalData = {
  secrets: {},
  interests: [],
  goals: [],
  spending: [],
  contacts: [],
  notes: [],
};

export function formatError(error: unknown): { error: string } {
  return {
    error: error instanceof Error ? error.message : String(error),
  };
}

export function safeJsonParse<T>(str: string, fallback: T): T {
  try {
    return JSON.parse(str) as T;
  } catch {
    return fallback;
  }
}

export async function readDataFile(): Promise<PersonalData> {
  try {
    const raw = await fs.readFile(DATA_FILE_PATH, "utf-8");
    const data = safeJsonParse<PersonalData>(raw, DEFAULT_PERSONAL_DATA);
    return normalizePersonalData(data);
  } catch (err: unknown) {
    const code = err && typeof (err as NodeJS.ErrnoException).code === "string" ? (err as NodeJS.ErrnoException).code : "";
    if (code === "ENOENT") {
      return { ...DEFAULT_PERSONAL_DATA };
    }
    throw err;
  }
}

/** Reads data.json as-is (full schema: profile, devices, goals, transactions, etc.). Use for analysis only. */
export async function readRawDataFile(): Promise<unknown> {
  try {
    const raw = await fs.readFile(DATA_FILE_PATH, "utf-8");
    return JSON.parse(raw);
  } catch (err: unknown) {
    const code = err && typeof (err as NodeJS.ErrnoException).code === "string" ? (err as NodeJS.ErrnoException).code : "";
    if (code === "ENOENT") return {};
    throw err;
  }
}

function normalizePersonalData(data: Partial<PersonalData>): PersonalData {
  return {
    secrets: typeof data.secrets === "object" && data.secrets !== null ? data.secrets as Record<string, unknown> : {},
    interests: Array.isArray(data.interests) ? data.interests : [],
    goals: Array.isArray(data.goals) ? data.goals : [],
    spending: Array.isArray(data.spending) ? data.spending : [],
    contacts: Array.isArray(data.contacts) ? data.contacts : [],
    notes: Array.isArray(data.notes) ? data.notes : [],
  };
}

export async function writeDataFile(data: PersonalData): Promise<void> {
  const normalized = normalizePersonalData(data);
  await fs.writeFile(DATA_FILE_PATH, JSON.stringify(normalized, null, 2), "utf-8");
}

export async function readSystemPrompt(): Promise<string> {
  const raw = await fs.readFile(SYSTEM_PROMPT_PATH, "utf-8");
  return raw.trim();
}

export type AddDataField = keyof PersonalData;

export async function appendOrMergeData(
  field: AddDataField,
  value: unknown
): Promise<PersonalData> {
  const data = await readDataFile();

  if (field === "secrets" && typeof value === "object" && value !== null && !Array.isArray(value)) {
    data.secrets = { ...data.secrets, ...(value as Record<string, unknown>) };
  } else if (field === "interests" && typeof value === "string") {
    if (!data.interests.includes(value)) data.interests.push(value);
  } else if (field === "interests" && Array.isArray(value)) {
    data.interests = [...new Set([...data.interests, ...value.map(String)])];
  } else if (field === "goals" && typeof value === "string") {
    data.goals.push(value);
  } else if (field === "goals" && Array.isArray(value)) {
    data.goals = [...data.goals, ...value.map(String)];
  } else if (field === "spending" && Array.isArray(value)) {
    data.spending = [...data.spending, ...value];
  } else if (field === "spending" && value !== undefined) {
    data.spending.push(value);
  } else if (field === "contacts" && Array.isArray(value)) {
    data.contacts = [...data.contacts, ...value];
  } else if (field === "contacts" && value !== undefined) {
    data.contacts.push(value);
  } else if (field === "notes" && Array.isArray(value)) {
    data.notes = [...data.notes, ...value];
  } else if (field === "notes" && value !== undefined) {
    data.notes.push(value);
  } else {
    throw new Error(`Invalid field or value for add-data: ${String(field)}`);
  }

  await writeDataFile(data);
  return data;
}

export function isPersonalDataKey(key: string): key is AddDataField {
  return (PERSONAL_DATA_KEYS as readonly string[]).includes(key);
}

/** Standard keys the LLM can save to. Custom keys are also allowed. */
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
] as const;

export type SaveDataKey = (typeof SAVE_DATA_KEYS)[number];

export function isSaveDataKey(key: string): key is SaveDataKey {
  return (SAVE_DATA_KEYS as readonly string[]).includes(key);
}

/** Sanitize custom field name: alphanumeric, underscores, hyphens only. */
function sanitizeCustomField(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64) || "custom";
}

/** Merge new data into raw data.json without destroying existing structure. Accepts any field; unknown fields go to llm_custom. */
export async function mergeIntoRawData(
  field: string,
  value: unknown
): Promise<{ success: boolean; field: string }> {
  const trimmed = String(field || "").trim();
  if (!trimmed) throw new Error("Field name is required");
  const raw = (await readRawDataFile()) as Record<string, unknown>;
  const now = new Date().toISOString().slice(0, 10);
  const fieldKey = trimmed as SaveDataKey;

  if (fieldKey === "secrets") {
    const secrets = (raw.secrets ?? {}) as Record<string, unknown>;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const toMerge = value as Record<string, unknown>;
      for (const k of Object.keys(toMerge)) {
        const v = toMerge[k];
        if (v !== null && v !== undefined && typeof v === "object" && !Array.isArray(v)) {
          secrets[k] = { ...((secrets[k] as Record<string, unknown>) ?? {}), ...(v as Record<string, unknown>) };
        } else {
          secrets[k] = v;
        }
      }
      raw.secrets = secrets;
    } else if (typeof value === "string") {
      try {
        const decoded = JSON.parse(value) as Record<string, unknown>;
        if (decoded && typeof decoded === "object") {
          for (const k of Object.keys(decoded)) {
            const v = decoded[k];
            if (v !== null && v !== undefined && typeof v === "object" && !Array.isArray(v)) {
              secrets[k] = { ...((secrets[k] as Record<string, unknown>) ?? {}), ...(v as Record<string, unknown>) };
            } else {
              secrets[k] = v;
            }
          }
          raw.secrets = secrets;
        }
      } catch {
        raw.secrets = { ...secrets, _misc: value };
      }
    } else {
      raw.secrets = { ...secrets, _misc: value };
    }
  } else if (fieldKey === "memory" || fieldKey === "notes") {
    const arr = Array.isArray(raw.memory) ? (raw.memory as unknown[]) : [];
    const entry =
      typeof value === "string"
        ? { content: value, timestamp: new Date().toISOString() }
        : value && typeof value === "object" && !Array.isArray(value)
          ? { ...(value as Record<string, unknown>), timestamp: (value as Record<string, unknown>).timestamp ?? new Date().toISOString() }
          : { content: String(value), timestamp: new Date().toISOString() };
    raw.memory = [...arr, entry];
  } else if (fieldKey === "interests") {
    const arr = Array.isArray(raw.interests) ? (raw.interests as string[]) : [];
    const newVals = Array.isArray(value)
      ? value.map(String)
      : typeof value === "string"
        ? value.split(",").map((s) => s.trim()).filter(Boolean)
        : [String(value)];
    raw.interests = [...new Set([...arr, ...newVals])];
  } else if (fieldKey === "hobbies") {
    const arr = Array.isArray(raw.hobbies) ? (raw.hobbies as string[]) : [];
    const newVals = Array.isArray(value)
      ? value.map(String)
      : typeof value === "string"
        ? value.split(",").map((s) => s.trim()).filter(Boolean)
        : [String(value)];
    raw.hobbies = [...new Set([...arr, ...newVals])];
  } else if (fieldKey === "dailyJournal") {
    const arr = Array.isArray(raw.dailyJournal) ? (raw.dailyJournal as Record<string, unknown>[]) : [];
    let parsed: Record<string, unknown> | null = null;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      parsed = value as Record<string, unknown>;
    } else if (typeof value === "string") {
      try {
        const decoded = JSON.parse(value) as unknown;
        if (decoded && typeof decoded === "object" && !Array.isArray(decoded)) parsed = decoded as Record<string, unknown>;
      } catch {
        /* fall through */
      }
    }
    const entry = parsed ?? { date: now, entry: String(value), tags: ["llm-saved"] };
    if (!entry.date) entry.date = now;
    if (!entry.entry) entry.entry = typeof value === "string" && !parsed ? value : String(value);
    raw.dailyJournal = [...arr, entry];
  } else if (fieldKey === "moodLogs") {
    const arr = Array.isArray(raw.moodLogs) ? (raw.moodLogs as Record<string, unknown>[]) : [];
    let parsed: Record<string, unknown> | null = null;
    if (value && typeof value === "object" && !Array.isArray(value)) parsed = value as Record<string, unknown>;
    else if (typeof value === "string") {
      try {
        const decoded = JSON.parse(value) as unknown;
        if (decoded && typeof decoded === "object" && !Array.isArray(decoded)) parsed = decoded as Record<string, unknown>;
      } catch {
        /* fall through */
      }
    }
    const entry = parsed ?? { date: now, mood: String(value), notes: "From conversation" };
    if (!entry.date) entry.date = now;
    raw.moodLogs = [...arr, entry];
  } else if (fieldKey === "goals_short") {
    const goals = (raw.goals ?? {}) as { shortTerm?: unknown[] };
    const short = Array.isArray(goals.shortTerm) ? goals.shortTerm : [];
    const entry =
      typeof value === "string"
        ? { id: `ST_${Date.now()}`, title: value, category: "Personal", status: "In Progress", priority: "Medium" }
        : value && typeof value === "object"
          ? value
          : { id: `ST_${Date.now()}`, title: String(value), category: "Personal", status: "In Progress" };
    goals.shortTerm = [...short, entry];
    raw.goals = goals;
  } else if (fieldKey === "scheduled_events") {
    const arr = Array.isArray(raw.scheduled_events) ? (raw.scheduled_events as Record<string, unknown>[]) : [];
    let event: Record<string, unknown>;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      event = value as Record<string, unknown>;
      if (!event.id) event.id = `evt_${Date.now()}`;
      if (!event.created_at) event.created_at = new Date().toISOString();
    } else if (typeof value === "string") {
      try {
        const decoded = JSON.parse(value) as Record<string, unknown>;
        event = decoded && typeof decoded === "object" ? decoded : { description: value };
      } catch {
        event = { description: value };
      }
      if (!event.id) event.id = `evt_${Date.now()}`;
      if (!event.created_at) event.created_at = new Date().toISOString();
    } else {
      event = { id: `evt_${Date.now()}`, description: String(value), created_at: new Date().toISOString() };
    }
    raw.scheduled_events = [...arr, event];
  } else {
    // Custom field: store under llm_custom for data that doesn't fit standard keys
    const customKey = sanitizeCustomField(trimmed);
    const bucket = (raw.llm_custom ?? {}) as Record<string, unknown[]>;
    const existing = Array.isArray(bucket[customKey]) ? bucket[customKey] : [];
    const entry =
      typeof value === "string"
        ? { content: value, timestamp: new Date().toISOString() }
        : value !== null && typeof value === "object" && !Array.isArray(value)
          ? { ...(value as Record<string, unknown>), timestamp: (value as Record<string, unknown>).timestamp ?? new Date().toISOString() }
          : { content: String(value), timestamp: new Date().toISOString() };
    bucket[customKey] = [...existing, entry];
    raw.llm_custom = bucket;
    await fs.writeFile(DATA_FILE_PATH, JSON.stringify(raw, null, 2), "utf-8");
    return { success: true, field: customKey };
  }

  await fs.writeFile(DATA_FILE_PATH, JSON.stringify(raw, null, 2), "utf-8");
  return { success: true, field: trimmed };
}

/** Move scheduled events whose time_of_occur has passed into notifications. Returns count moved. */
export async function moveDueEventsToNotifications(): Promise<number> {
  const raw = (await readRawDataFile()) as Record<string, unknown>;
  const scheduled = Array.isArray(raw.scheduled_events) ? raw.scheduled_events as Record<string, unknown>[] : [];
  const notifications = Array.isArray(raw.notifications) ? raw.notifications as Record<string, unknown>[] : [];
  const now = new Date().toISOString();
  const stillScheduled: Record<string, unknown>[] = [];
  const moved: Record<string, unknown>[] = [];
  for (const evt of scheduled) {
    const t = evt.time_of_occur;
    if (typeof t === "string" && t <= now) {
      moved.push(evt);
    } else {
      stillScheduled.push(evt);
    }
  }
  if (moved.length === 0) return 0;
  raw.scheduled_events = stillScheduled;
  raw.notifications = [...notifications, ...moved];
  await fs.writeFile(DATA_FILE_PATH, JSON.stringify(raw, null, 2), "utf-8");
  return moved.length;
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

/** Get all notifications. */
export async function getNotifications(): Promise<NotificationEntry[]> {
  const raw = (await readRawDataFile()) as Record<string, unknown>;
  const arr = Array.isArray(raw.notifications) ? raw.notifications : [];
  return arr as NotificationEntry[];
}

/** Get a notification by id. */
export async function getNotificationById(id: string): Promise<NotificationEntry | null> {
  const arr = await getNotifications();
  const found = arr.find((n) => (n.id ?? (n as Record<string, unknown>).id) === id);
  return found ?? null;
}

/** Remove a notification by id. Returns the removed entry if found. */
export async function removeNotificationById(id: string): Promise<{ found: boolean; removed?: NotificationEntry }> {
  const raw = (await readRawDataFile()) as Record<string, unknown>;
  const arr = Array.isArray(raw.notifications) ? (raw.notifications as NotificationEntry[]) : [];
  const idx = arr.findIndex((n) => (n.id ?? (n as Record<string, unknown>).id) === id);
  if (idx < 0) return { found: false };
  const removed = arr[idx];
  raw.notifications = arr.filter((_, i) => i !== idx);
  await fs.writeFile(DATA_FILE_PATH, JSON.stringify(raw, null, 2), "utf-8");
  return { found: true, removed };
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

/** Get all scheduled events. */
export async function getScheduledEvents(): Promise<ScheduledEventEntry[]> {
  const raw = (await readRawDataFile()) as Record<string, unknown>;
  const arr = Array.isArray(raw.scheduled_events) ? raw.scheduled_events : [];
  return arr as ScheduledEventEntry[];
}

/** Remove a scheduled event by id. */
export async function removeScheduledEventById(id: string): Promise<{ found: boolean }> {
  const raw = (await readRawDataFile()) as Record<string, unknown>;
  const arr = Array.isArray(raw.scheduled_events) ? (raw.scheduled_events as ScheduledEventEntry[]) : [];
  const idx = arr.findIndex((n) => (n.id ?? (n as Record<string, unknown>).id) === id);
  if (idx < 0) return { found: false };
  raw.scheduled_events = arr.filter((_, i) => i !== idx);
  await fs.writeFile(DATA_FILE_PATH, JSON.stringify(raw, null, 2), "utf-8");
  return { found: true };
}
