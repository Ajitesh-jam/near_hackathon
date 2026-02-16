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
