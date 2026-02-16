import { readRawDataFile } from "./base";

export interface AnalyzeResult {
  summary: string;
  details: unknown;
  category?: string;
}

function hasWord(s: string, words: string[]): boolean {
  const lower = s.toLowerCase();
  return words.some((w) => lower.includes(w.toLowerCase()));
}

type RawData = {
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
  devices?: Array<Record<string, unknown> & { id?: string; deviceName?: string; type?: string; serial?: string; imei?: string }>;
  smart_home_devices?: unknown[];
  transaction_history?: unknown[];
  health_daily_logs?: unknown[];
  moodLogs?: unknown[];
  dailyJournal?: unknown[];
  app_sessions?: unknown[];
  [key: string]: unknown;
};

export async function analyze_personal_context(args: {
  query?: string;
  input?: string;
}): Promise<AnalyzeResult> {
  const query = (args.query ?? args.input ?? "").trim();
  const raw = await readRawDataFile();
  const data = raw as RawData;

  // ----- Intro / about me / interests / hobbies (verbose for writing intros) -----
  if (
    hasWord(query, [
      "intro", "introduction", "introduce", "about me", "describe me", "who i am",
      "interest", "interests", "hobby", "hobbies", "tell him about", "tell her about",
      "new friend", "friend i met", "friend i just met", "create my intro", "write my intro",
    ])
  ) {
    const profile = data.profile ?? {};
    const name = String(profile.fullName ?? profile.username ?? profile.nickname ?? "the user").trim();
    const nickname = profile.nickname ? String(profile.nickname) : "";
    const title = profile.title ? String(profile.title) : "";
    const company = profile.company ? String(profile.company) : "";
    const interests = Array.isArray(data.interests) ? data.interests : [];
    const hobbies = Array.isArray(data.hobbies) ? data.hobbies : [];
    const interestsText = interests.length > 0 ? interests.join(", ") : "none listed";
    const hobbiesText = hobbies.length > 0 ? hobbies.join(", ") : "none listed";
    const summary =
      `Intro context: ${name}${nickname ? ` (${nickname})` : ""}. ` +
      (title ? `Role: ${title}. ` : "") +
      (company ? `Works at ${company}. ` : "") +
      `Interests: ${interestsText}. Hobbies: ${hobbiesText}. ` +
      "Use this to draft a short, friendly introduction the user can send (e.g. to a new friend online).";
    return {
      summary,
      details: {
        name,
        nickname: nickname || undefined,
        title: title || undefined,
        company: company || undefined,
        interests,
        hobbies,
        introBlurb: `Name: ${name}. ${title ? `Works as ${title} at ${company || "a company"}. ` : ""}Interests: ${interestsText}. Hobbies: ${hobbiesText}.`,
      },
      category: "intro",
    };
  }

  // ----- Devices: serial number, phone, imei, laptop, tablet, etc. -----
  if (
    hasWord(query, [
      "serial", "serial number", "imei", "phone", "smartphone", "device",
      "laptop", "tablet", "macbook", "iphone", "ipad", "watch", "wearable",
      "gadget", "electronics", "warranty", "purchase date", "battery",
    ])
  ) {
    const devices = Array.isArray(data.devices) ? data.devices : [];
    const phone = devices.find(
      (d) =>
        (String(d.type || "").toLowerCase() === "smartphone") ||
        (String(d.deviceName || "").toLowerCase().includes("iphone")) ||
        (String(d.deviceName || "").toLowerCase().includes("phone"))
    );
    const summary =
      devices.length === 0
        ? "No devices in stored data."
        : phone
          ? `Phone: ${phone.deviceName ?? phone.id} — Serial: ${phone.serial ?? "—"}, IMEI: ${phone.imei ?? "—"}. Total ${devices.length} device(s) in your data.`
          : `${devices.length} device(s): ${devices.map((d) => `${d.deviceName ?? d.id} (${d.serial ?? "no serial"})`).join("; ")}.`;
    return {
      summary,
      details: devices.length ? devices : { message: "No devices." },
      category: "devices",
    };
  }

  // ----- Profile: name, address, email, phone number, passport, id -----
  if (
    hasWord(query, [
      "name", "address", "email", "phone number", "contact info", "profile",
      "passport", "aadhaar", "pan", "driving license", "dob", "birth",
      "nationality", "blood group", "where i live", "my email", "my number",
    ])
  ) {
    const profile = data.profile ?? {};
    const addresses = Array.isArray(profile.addresses) ? profile.addresses : [];
    const summary =
      Object.keys(profile).length === 0
        ? "No profile in stored data."
        : `Profile: ${profile.fullName ?? profile.username ?? "—"}; primary email: ${profile.primaryEmail ?? "—"}; primary phone: ${profile.phonePrimary ?? "—"}; addresses: ${addresses.length}.`;
    return {
      summary,
      details: profile,
      category: "profile",
    };
  }

  // ----- Secrets (passwords, keys, credentials) -----
  if (hasWord(query, ["secret", "password", "key", "credential", "pin", "token", "login"])) {
    const secrets = data.secrets ?? {};
    const keys = Object.keys(secrets);
    return {
      summary:
        keys.length === 0
          ? "No secrets stored."
          : `Stored ${keys.length} secret category/categories. Keys: ${keys.join(", ")}.`,
      details: { count: keys.length, keys },
      category: "secrets",
    };
  }

  // ----- Goals (short/mid/long term) -----
  if (hasWord(query, ["goal", "target", "objective", "deadline", "milestone"])) {
    const goals = data.goals ?? {};
    const short = Array.isArray(goals.shortTerm) ? goals.shortTerm : [];
    const mid = Array.isArray(goals.midTerm) ? goals.midTerm : [];
    const long = Array.isArray(goals.longTerm) ? goals.longTerm : [];
    const total = short.length + mid.length + long.length;
    const title = (g: unknown) => (g && typeof g === "object" && "title" in g ? (g as { title?: string }).title : undefined);
    const titles = [
      ...short.map(title),
      ...mid.map(title),
      ...long.map(title),
    ].filter(Boolean);
    return {
      summary:
        total === 0
          ? "No goals in stored data."
          : `${total} goal(s): ${titles.slice(0, 10).join("; ")}${titles.length > 10 ? "…" : ""}.`,
      details: goals,
      category: "goals",
    };
  }

  // ----- Spending, transactions, budget, money -----
  if (
    hasWord(query, [
      "spend", "expense", "money", "cost", "budget", "transaction", "income",
      "salary", "net worth", "savings", "insurance", "tax",
    ])
  ) {
    const txns = Array.isArray(data.transaction_history) ? data.transaction_history : [];
    const fin = data.financialOverview ?? {};
    const summary =
      txns.length === 0 && Object.keys(fin).length === 0
        ? "No financial data."
        : `Financial overview present; ${txns.length} transaction(s) in history.`;
    return {
      summary,
      details: { financialOverview: fin, transactionCount: txns.length, recentTransactions: txns.slice(0, 20) },
      category: "financial",
    };
  }

  // ----- Health, fitness, sleep, mood -----
  if (
    hasWord(query, [
      "health", "steps", "sleep", "mood", "heart", "hrv", "calories",
      "fitness", "water", "weight", "resting",
    ])
  ) {
    const health = Array.isArray(data.health_daily_logs) ? data.health_daily_logs : [];
    const moods = Array.isArray(data.moodLogs) ? data.moodLogs : [];
    const summary =
      health.length === 0 && moods.length === 0
        ? "No health or mood logs."
        : `${health.length} health log(s), ${moods.length} mood log(s).`;
    return {
      summary,
      details: { health_daily_logs: health.slice(-14), moodLogs: moods.slice(-14) },
      category: "health",
    };
  }

  // ----- Journal, notes, diary -----
  if (hasWord(query, ["journal", "diary", "note", "memo", "reminder", "entry", "wrote"])) {
    const journal = Array.isArray(data.dailyJournal) ? data.dailyJournal : [];
    return {
      summary:
        journal.length === 0 ? "No journal entries." : `${journal.length} journal entry/entries.`,
      details: { dailyJournal: journal.slice(-30) },
      category: "journal",
    };
  }

  // ----- Smart home -----
  if (hasWord(query, ["smart home", "ac", "thermostat", "light", "lock", "hue", "alexa"])) {
    const smart = Array.isArray(data.smart_home_devices) ? data.smart_home_devices : [];
    return {
      summary: smart.length === 0 ? "No smart home devices." : `${smart.length} smart home device(s).`,
      details: smart,
      category: "smart_home",
    };
  }

  // ----- App usage -----
  if (hasWord(query, ["app", "screen time", "usage", "instagram", "whatsapp", "slack"])) {
    const sessions = Array.isArray(data.app_sessions) ? data.app_sessions : [];
    return {
      summary: sessions.length === 0 ? "No app session data." : `${sessions.length} app session record(s).`,
      details: sessions,
      category: "app_sessions",
    };
  }

  // ----- Contacts / people (if present in profile or future schema) -----
  if (hasWord(query, ["contact", "people", "friend", "reach", "call"])) {
    const profile = data.profile ?? {};
    const phones = [profile.phonePrimary, profile.phoneSecondary].filter(Boolean);
    const emails = [profile.primaryEmail, profile.secondaryEmail].filter(Boolean);
    return {
      summary:
        phones.length === 0 && emails.length === 0
          ? "No contact info in stored data."
          : `Contact info in profile: phones ${phones.length}, emails ${emails.length}.`,
      details: { phones, emails, profileContactFields: profile },
      category: "contacts",
    };
  }

  // ----- Generic: full inclusive summary of what's in the data -----
  return genericSummary(data);
}

function genericSummary(data: RawData): AnalyzeResult {
  const profile = data.profile ? "profile (name, emails, phones, addresses)" : "";
  const devices = Array.isArray(data.devices) ? `devices (${data.devices.length}, incl. serials/IMEI)` : "";
  const goals = data.goals
    ? `goals (short/mid/long term: ${(data.goals.shortTerm?.length ?? 0) + (data.goals.midTerm?.length ?? 0) + (data.goals.longTerm?.length ?? 0)} total)`
    : "";
  const interests = Array.isArray(data.interests) ? `interests (${data.interests.length})` : "";
  const hobbies = Array.isArray(data.hobbies) ? `hobbies (${data.hobbies.length})` : "";
  const secrets = data.secrets ? `secrets (${Object.keys(data.secrets).length} categories)` : "";
  const txns = Array.isArray(data.transaction_history) ? `transactions (${data.transaction_history.length})` : "";
  const health = Array.isArray(data.health_daily_logs) ? `health logs (${data.health_daily_logs.length})` : "";
  const journal = Array.isArray(data.dailyJournal) ? `journal (${data.dailyJournal.length})` : "";
  const mood = Array.isArray(data.moodLogs) ? `mood logs (${data.moodLogs.length})` : "";
  const parts = [profile, devices, goals, interests, hobbies, secrets, txns, health, journal, mood].filter(Boolean);
  return {
    summary: parts.length === 0
      ? "No structured personal data found."
      : `Stored data includes: ${parts.join("; ")}. Ask about a specific topic (e.g. "my phone serial", "goals", "spending") for details.`,
    details: {
      hasProfile: !!data.profile,
      deviceCount: Array.isArray(data.devices) ? data.devices.length : 0,
      hasGoals: !!data.goals,
      interestsCount: Array.isArray(data.interests) ? data.interests.length : 0,
      hobbiesCount: Array.isArray(data.hobbies) ? data.hobbies.length : 0,
      secretKeys: data.secrets ? Object.keys(data.secrets).length : 0,
      transactionCount: Array.isArray(data.transaction_history) ? data.transaction_history.length : 0,
      healthLogCount: Array.isArray(data.health_daily_logs) ? data.health_daily_logs.length : 0,
      journalCount: Array.isArray(data.dailyJournal) ? data.dailyJournal.length : 0,
    },
  };
}
