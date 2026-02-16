import fs from "fs/promises";
import {
  DATA_FILE_PATH,
  SYSTEM_PROMPT_PATH,
  PersonalData,
  PERSONAL_DATA_KEYS,
  NotificationEntry,
  ScheduledEventEntry,
  DEFAULT_PERSONAL_DATA,
  SAVE_DATA_KEYS,
  AddDataField,
  SaveDataKey,
} from "../constants";

function isErrnoException(err: unknown): err is NodeJS.ErrnoException {
  return err != null && typeof (err as NodeJS.ErrnoException).code === "string";
}

function normalizePersonalData(data: Partial<PersonalData>): PersonalData {
  const asObj = (v: unknown): Record<string, unknown> =>
    typeof v === "object" && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  const asArr = <T>(v: unknown, def: T[]): T[] => (Array.isArray(v) ? v : def);
  return {
    secrets: asObj(data.secrets),
    interests: asArr(data.interests, []),
    goals: asArr(data.goals, []),
    spending: asArr(data.spending, []),
    contacts: asArr(data.contacts, []),
    notes: asArr(data.notes, []),
  };
}

async function readOrEmpty<T>(parser: (raw: string) => T, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(DATA_FILE_PATH, "utf-8");
    return parser(raw);
  } catch (err) {
    if (isErrnoException(err) && err.code === "ENOENT") return fallback;
    throw err;
  }
}

export function formatError(error: unknown): { error: string } {
  return { error: error instanceof Error ? error.message : String(error) };
}

export function safeJsonParse<T>(str: string, fallback: T): T {
  try {
    return JSON.parse(str) as T;
  } catch {
    return fallback;
  }
}

export async function readDataFile(): Promise<PersonalData> {
  const data = await readOrEmpty(
    (raw) => safeJsonParse<PersonalData>(raw, DEFAULT_PERSONAL_DATA),
    DEFAULT_PERSONAL_DATA
  );
  return normalizePersonalData(data);
}

export async function readRawDataFile(): Promise<unknown> {
  return readOrEmpty((raw) => JSON.parse(raw), {});
}

async function writeRawData(data: Record<string, unknown>): Promise<void> {
  await fs.writeFile(DATA_FILE_PATH, JSON.stringify(data, null, 2), "utf-8");
}

export async function writeDataFile(data: PersonalData): Promise<void> {
  await writeRawData(normalizePersonalData(data) as unknown as Record<string, unknown>);
}

export async function readSystemPrompt(): Promise<string> {
  const raw = await fs.readFile(SYSTEM_PROMPT_PATH, "utf-8");
  return raw.trim();
}

function toTimestampedEntry(value: unknown): Record<string, unknown> {
  const ts = new Date().toISOString();
  if (typeof value === "string") return { content: value, timestamp: ts };
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    return { ...obj, timestamp: obj.timestamp ?? ts };
  }
  return { content: String(value), timestamp: ts };
}

function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (typeof value === "string") return value.split(",").map((s) => s.trim()).filter(Boolean);
  return [String(value)];
}

function parseObjectOrString(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value === "string") {
    try {
      const decoded = JSON.parse(value) as unknown;
      return decoded && typeof decoded === "object" && !Array.isArray(decoded) ? (decoded as Record<string, unknown>) : null;
    } catch {
      return null;
    }
  }
  return null;
}

function mergeSecrets(
  existing: Record<string, unknown>,
  value: unknown
): Record<string, unknown> {
  const secrets = { ...existing };
  const asObj = (v: unknown): Record<string, unknown> | null =>
    v != null && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  const mergeObj = (obj: Record<string, unknown>) => {
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      if (v != null && typeof v === "object" && !Array.isArray(v)) {
        secrets[k] = { ...(asObj(secrets[k]) ?? {}), ...(v as Record<string, unknown>) };
      } else {
        secrets[k] = v;
      }
    }
  };
  if (value && typeof value === "object" && !Array.isArray(value)) {
    mergeObj(value as Record<string, unknown>);
  } else if (typeof value === "string") {
    const decoded = parseObjectOrString(value);
    if (decoded) mergeObj(decoded);
    else secrets._misc = value;
  } else {
    secrets._misc = value;
  }
  return secrets;
}

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

export function isSaveDataKey(key: string): key is SaveDataKey {
  return (SAVE_DATA_KEYS as readonly string[]).includes(key);
}

function sanitizeCustomField(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64) || "custom";
}

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
    raw.secrets = mergeSecrets((raw.secrets ?? {}) as Record<string, unknown>, value);
  } else if (fieldKey === "memory" || fieldKey === "notes") {
    const arr = Array.isArray(raw.memory) ? (raw.memory as unknown[]) : [];
    raw.memory = [...arr, toTimestampedEntry(value)];
  } else if (fieldKey === "interests" || fieldKey === "hobbies") {
    const key = fieldKey as "interests" | "hobbies";
    const arr = Array.isArray(raw[key]) ? (raw[key] as string[]) : [];
    raw[key] = [...new Set([...arr, ...parseStringArray(value)])];
  } else if (fieldKey === "dailyJournal") {
    const arr = Array.isArray(raw.dailyJournal) ? (raw.dailyJournal as Record<string, unknown>[]) : [];
    const parsed = parseObjectOrString(value);
    const entry = parsed ?? { date: now, entry: String(value), tags: ["llm-saved"] };
    entry.date ??= now;
    entry.entry ??= typeof value === "string" && !parsed ? value : String(value);
    raw.dailyJournal = [...arr, entry];
  } else if (fieldKey === "moodLogs") {
    const arr = Array.isArray(raw.moodLogs) ? (raw.moodLogs as Record<string, unknown>[]) : [];
    const parsed = parseObjectOrString(value);
    const entry = parsed ?? { date: now, mood: String(value), notes: "From conversation" };
    entry.date ??= now;
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
  } else if (fieldKey === "near_addresses") {
    const existing = (raw.near_addresses && typeof raw.near_addresses === "object" && !Array.isArray(raw.near_addresses))
      ? (raw.near_addresses as Record<string, string>)
      : {};
    let toAdd: Record<string, string> = {};
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const obj = value as Record<string, unknown>;
      for (const k of Object.keys(obj)) {
        const v = obj[k];
        if (v != null && typeof v === "string" && v.trim()) toAdd[k] = v.trim();
      }
    } else if (typeof value === "string") {
      const decoded = parseObjectOrString(value) as Record<string, unknown> | null;
      if (decoded) {
        for (const k of Object.keys(decoded)) {
          const v = decoded[k];
          if (v != null && typeof v === "string" && v.trim()) toAdd[k] = v.trim();
        }
      }
    }
    raw.near_addresses = { ...existing, ...toAdd };
  } else if (fieldKey === "scheduled_events") {
    const arr = Array.isArray(raw.scheduled_events) ? (raw.scheduled_events as Record<string, unknown>[]) : [];
    const parsed = parseObjectOrString(value);
    const event: Record<string, unknown> = parsed ?? { description: typeof value === "string" ? value : String(value) };
    event.id ??= `evt_${Date.now()}`;
    event.created_at ??= new Date().toISOString();
    raw.scheduled_events = [...arr, event];
  } else {
    const customKey = sanitizeCustomField(trimmed);
    const bucket = (raw.llm_custom ?? {}) as Record<string, unknown[]>;
    const existing = Array.isArray(bucket[customKey]) ? bucket[customKey] : [];
    bucket[customKey] = [...existing, toTimestampedEntry(value)];
    raw.llm_custom = bucket;
    await writeRawData(raw);
    return { success: true, field: customKey };
  }

  await writeRawData(raw);
  return { success: true, field: trimmed };
}

function asArray<T>(raw: Record<string, unknown>, key: string): T[] {
  const arr = raw[key];
  return Array.isArray(arr) ? (arr as T[]) : [];
}

export async function moveDueEventsToNotifications(): Promise<number> {
  const raw = (await readRawDataFile()) as Record<string, unknown>;
  const scheduled = asArray<Record<string, unknown>>(raw, "scheduled_events");
  const notifications = asArray<Record<string, unknown>>(raw, "notifications");
  const now = new Date().toISOString();
  const moved: Record<string, unknown>[] = [];
  const remaining: Record<string, unknown>[] = [];
  for (const evt of scheduled) {
    const t = evt.time_of_occur;
    (typeof t === "string" && t <= now ? moved : remaining).push(evt);
  }
  if (moved.length === 0) return 0;
  raw.scheduled_events = remaining;
  raw.notifications = [...notifications, ...moved];
  await writeRawData(raw);
  return moved.length;
}

/** Add an informational notification (e.g. agent result: payment success/failed). No tool execution on dismiss. */
export async function addNotification(description: string, meta?: Record<string, unknown>): Promise<void> {
  const raw = (await readRawDataFile()) as Record<string, unknown>;
  const notifications = asArray<Record<string, unknown>>(raw, "notifications");
  const entry: Record<string, unknown> = {
    id: `notif_${Date.now()}`,
    time_of_occur: new Date().toISOString(),
    description,
    created_at: new Date().toISOString(),
    informational: true,
    ...meta,
  };
  raw.notifications = [...notifications, entry];
  await writeRawData(raw);
}

export async function getNotifications(): Promise<NotificationEntry[]> {
  const raw = (await readRawDataFile()) as Record<string, unknown>;
  return asArray<NotificationEntry>(raw, "notifications");
}

export async function getNotificationById(id: string): Promise<NotificationEntry | null> {
  const arr = await getNotifications();
  return arr.find((n) => (n.id ?? (n as Record<string, unknown>).id) === id) ?? null;
}

export async function removeNotificationById(id: string): Promise<{ found: boolean; removed?: NotificationEntry }> {
  const raw = (await readRawDataFile()) as Record<string, unknown>;
  const arr = asArray<NotificationEntry>(raw, "notifications");
  const idx = arr.findIndex((n) => (n.id ?? (n as Record<string, unknown>).id) === id);
  if (idx < 0) return { found: false };
  raw.notifications = arr.filter((_, i) => i !== idx);
  await writeRawData(raw);
  return { found: true, removed: arr[idx] };
}

export async function getScheduledEvents(): Promise<ScheduledEventEntry[]> {
  const raw = (await readRawDataFile()) as Record<string, unknown>;
  return asArray<ScheduledEventEntry>(raw, "scheduled_events");
}

export async function removeScheduledEventById(id: string): Promise<{ found: boolean }> {
  const raw = (await readRawDataFile()) as Record<string, unknown>;
  const arr = asArray<ScheduledEventEntry>(raw, "scheduled_events");
  const idx = arr.findIndex((n) => (n.id ?? (n as Record<string, unknown>).id) === id);
  if (idx < 0) return { found: false };
  raw.scheduled_events = arr.filter((_, i) => i !== idx);
  await writeRawData(raw);
  return { found: true };
}