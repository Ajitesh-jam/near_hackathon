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
