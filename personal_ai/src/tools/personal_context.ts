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
  // Also include memory and llm_custom: user may have saved passwords there before secrets support; LLM should check both.
  if (hasWord(query, ["secret", "password", "key", "credential", "pin", "token", "login"])) {
    const secrets = data.secrets ?? {};
    const keys = Object.keys(secrets);
    const memory = Array.isArray(data.memory) ? data.memory : [];
    const custom = data.llm_custom && typeof data.llm_custom === "object" ? data.llm_custom : {};
    const memoryAndCustom = [
      ...memory.map((m: unknown) => (typeof m === "object" && m && "content" in m ? (m as { content: string }).content : String(m))),
      ...Object.entries(custom).flatMap(([k, arr]) =>
        (Array.isArray(arr) ? arr : []).map((v: unknown) =>
          typeof v === "object" && v && "content" in v ? `[${k}] ${(v as { content: string }).content}` : `[${k}] ${String(v)}`
        )
      ),
    ];
    const summary =
      keys.length === 0 && memoryAndCustom.length === 0
        ? "No secrets stored."
        : `Secrets: ${keys.length} categories (${keys.join(", ")}). Memory/custom items that may contain credentials: ${memoryAndCustom.length}.`;
    return {
      summary,
      details: {
        secrets,
        secretKeys: keys,
        memory,
        llm_custom: custom,
        memoryAndCustomContents: memoryAndCustom,
      },
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

  // ----- Scheduled events and notifications -----
  if (
    hasWord(query, [
      "scheduled", "schedule", "my schedule", "notifications", "pending", "upcoming",
      "remind me", "reminder to", "pay on", "pay in", "when to pay",
    ])
  ) {
    const scheduled = Array.isArray(data.scheduled_events) ? data.scheduled_events : [];
    const notifications = Array.isArray(data.notifications) ? data.notifications : [];
    const summary =
      scheduled.length === 0 && notifications.length === 0
        ? "No scheduled events or notifications."
        : `${scheduled.length} scheduled event(s), ${notifications.length} pending notification(s).`;
    return {
      summary,
      details: { scheduled_events: scheduled, notifications },
      category: "schedule",
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

  // ----- Memory / learned facts (LLM-saved from past conversations) + custom fields -----
  if (
    hasWord(query, [
      "memory", "remember", "remembered", "what do you know", "what have you learned",
      "saved", "stored", "recall", "recalled", "you know about me",
    ])
  ) {
    const memory = Array.isArray(data.memory) ? data.memory : [];
    const custom = data.llm_custom && typeof data.llm_custom === "object" ? data.llm_custom : {};
    const customKeys = Object.keys(custom);
    const customEntries = customKeys.flatMap((k) =>
      (Array.isArray(custom[k]) ? custom[k] : []).map((v: unknown) => ({ _key: k, ...(typeof v === "object" && v ? (v as Record<string, unknown>) : { content: v }) }))
    );
    const total = memory.length + customEntries.length;
    const summary =
      total === 0
        ? "No memories saved yet. Use save_personal_info when the user shares facts to remember."
        : `${memory.length} memory items, ${customKeys.length} custom categories (${customKeys.join(", ") || "none"}): ${total} total saved items.`;
    return {
      summary,
      details: { memory, llm_custom: custom, customKeys },
      category: "memory",
    };
  }

  // ----- Custom field lookup: user asks about a specific saved topic (e.g. "my allergies", "diet preferences") -----
  const custom = data.llm_custom && typeof data.llm_custom === "object" ? data.llm_custom : {};
  const customKeys = Object.keys(custom);
  const queryLower = query.toLowerCase();
  const matchedKey = customKeys.find((k) => {
    const kLower = k.toLowerCase();
    if (queryLower.includes(kLower)) return true;
    // Also match when all parts of key (split by _) appear in query, e.g. "diet_preferences" for "my diet preferences"
    const parts = kLower.split("_").filter(Boolean);
    return parts.length > 0 && parts.every((p) => queryLower.includes(p));
  });
  if (matchedKey && Array.isArray(custom[matchedKey]) && (custom[matchedKey] as unknown[]).length > 0) {
    const items = custom[matchedKey] as unknown[];
    return {
      summary: `Found ${items.length} saved item(s) for "${matchedKey}".`,
      details: { [matchedKey]: items },
      category: "llm_custom",
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
  const memory = Array.isArray(data.memory) ? `memory (${data.memory.length} saved items)` : "";
  const custom = data.llm_custom && typeof data.llm_custom === "object" ? data.llm_custom : {};
  const customKeys = Object.keys(custom);
  const customSummary =
    customKeys.length > 0
      ? `llm_custom (${customKeys.length} categories: ${customKeys.join(", ")})`
      : "";
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
  const scheduled = Array.isArray(data.scheduled_events) ? `scheduled_events (${data.scheduled_events.length})` : "";
  const notifications = Array.isArray(data.notifications) ? `notifications (${data.notifications.length})` : "";
  const parts = [profile, devices, memory, customSummary, goals, interests, hobbies, secrets, txns, health, journal, mood, scheduled, notifications].filter(Boolean);
  return {
    summary: parts.length === 0
      ? "No structured personal data found."
      : `Stored data includes: ${parts.join("; ")}. Ask about a specific topic (e.g. "my phone serial", "goals", "spending", or custom keys like "allergies") for details.`,
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
      llm_customKeys: customKeys,
      scheduledCount: Array.isArray(data.scheduled_events) ? data.scheduled_events.length : 0,
      notificationCount: Array.isArray(data.notifications) ? data.notifications.length : 0,
    },
  };
}
