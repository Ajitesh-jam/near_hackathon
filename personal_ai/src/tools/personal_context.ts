import { readRawDataFile } from "./helper_functions";
import { AnalyzeResult, RawData } from "../constants";

const hasWord = (s: string, words: string[]) => {
  const lower = s.toLowerCase();
  return words.some((w) => lower.includes(w.toLowerCase()));
};

function getArray<T>(data: RawData, key: keyof RawData): T[] {
  const v = data[key];
  return Array.isArray(v) ? (v as T[]) : [];
}

function getObj<K extends keyof RawData>(data: RawData, key: K): NonNullable<RawData[K]> | Record<string, unknown> {
  const v = data[key];
  return (v && typeof v === "object" && !Array.isArray(v) ? v : {}) as NonNullable<RawData[K]> | Record<string, unknown>;
}

function extractMemoryAndCustom(data: RawData): { memory: unknown[]; custom: Record<string, unknown[]>; contents: string[] } {
  const memory = getArray<unknown>(data, "memory");
  const custom = (data.llm_custom && typeof data.llm_custom === "object" ? data.llm_custom : {}) as Record<string, unknown[]>;
  const memoryContents = memory.map((m) =>
    typeof m === "object" && m && "content" in m ? (m as { content: string }).content : String(m)
  );
  const customContents = Object.entries(custom).flatMap(([k, arr]) =>
    (Array.isArray(arr) ? arr : []).map((v) =>
      typeof v === "object" && v && "content" in v ? `[${k}] ${(v as { content: string }).content}` : `[${k}] ${String(v)}`
    )
  );
  return { memory, custom, contents: [...memoryContents, ...customContents] };
}

function genericSummary(data: RawData): AnalyzeResult {
  const profile = data.profile ? "profile (name, emails, phones, addresses)" : "";
  const devices = getArray(data, "devices").length ? `devices (${getArray(data, "devices").length}, incl. serials/IMEI)` : "";
  const memArr = getArray(data, "memory");
  const memory = memArr.length ? `memory (${memArr.length} saved items)` : "";
  const custom = (data.llm_custom && typeof data.llm_custom === "object" ? data.llm_custom : {}) as Record<string, unknown[]>;
  const customKeys = Object.keys(custom);
  const customSummary =
    customKeys.length > 0
      ? `llm_custom (${customKeys.length} categories: ${customKeys.join(", ")})`
      : "";
  const goals = data.goals
    ? `goals (short/mid/long term: ${(data.goals.shortTerm?.length ?? 0) + (data.goals.midTerm?.length ?? 0) + (data.goals.longTerm?.length ?? 0)} total)`
    : "";
  const interests = getArray(data, "interests").length ? `interests (${getArray(data, "interests").length})` : "";
  const hobbies = getArray(data, "hobbies").length ? `hobbies (${getArray(data, "hobbies").length})` : "";
  const secretsObj = getObj(data, "secrets") as Record<string, unknown>;
  const secrets = Object.keys(secretsObj).length ? `secrets (${Object.keys(secretsObj).length} categories)` : "";
  const txnsLen = getArray(data, "transaction_history").length;
  const txnsStr = txnsLen ? `transactions (${txnsLen})` : "";
  const health = getArray(data, "health_daily_logs").length ? `health logs (${getArray(data, "health_daily_logs").length})` : "";
  const journal = getArray(data, "dailyJournal").length ? `journal (${getArray(data, "dailyJournal").length})` : "";
  const mood = getArray(data, "moodLogs").length ? `mood logs (${getArray(data, "moodLogs").length})` : "";
  const scheduled = getArray(data, "scheduled_events").length ? `scheduled_events (${getArray(data, "scheduled_events").length})` : "";
  const notifications = getArray(data, "notifications").length ? `notifications (${getArray(data, "notifications").length})` : "";
  const nearAddrs = getObj(data, "near_addresses") as Record<string, string>;
  const nearAddrKeys = Object.keys(nearAddrs).filter((k) => nearAddrs[k]);
  const nearAddresses = nearAddrKeys.length ? `near_addresses (${nearAddrKeys.join(", ")})` : "";
  const parts = [profile, devices, memory, customSummary, goals, interests, hobbies, secrets, nearAddresses, txnsStr, health, journal, mood, scheduled, notifications].filter(Boolean);
  return {
    summary: parts.length === 0
      ? "No structured personal data found."
      : `Stored data includes: ${parts.join("; ")}. Ask about a specific topic (e.g. "my phone serial", "goals", "spending", or custom keys like "allergies") for details.`,
    details: {
      hasProfile: !!data.profile,
      deviceCount: getArray(data, "devices").length,
      hasGoals: !!data.goals,
      interestsCount: getArray(data, "interests").length,
      hobbiesCount: getArray(data, "hobbies").length,
      secretKeys: Object.keys(getObj(data, "secrets")).length,
      transactionCount: getArray(data, "transaction_history").length,
      healthLogCount: getArray(data, "health_daily_logs").length,
      journalCount: getArray(data, "dailyJournal").length,
      llm_customKeys: customKeys,
      near_addresses: nearAddrKeys,
      scheduledCount: getArray(data, "scheduled_events").length,
      notificationCount: getArray(data, "notifications").length,
    },
  };
}

export async function analyze_personal_context(args: {
  query?: string;
  input?: string;
}): Promise<AnalyzeResult> {
  const query = (args.query ?? args.input ?? "").trim();
  const raw = await readRawDataFile();
  const data = raw as RawData;

  if (
    hasWord(query, [
      "intro", "introduction", "introduce", "about me", "describe me", "who i am",
      "interest", "interests", "hobby", "hobbies", "tell him about", "tell her about",
      "new friend", "friend i met", "friend i just met", "create my intro", "write my intro",
    ])
  ) {
    const profile = getObj(data, "profile") as Record<string, unknown>;
    const name = String(profile.fullName ?? profile.username ?? profile.nickname ?? "the user").trim();
    const nickname = profile.nickname ? String(profile.nickname) : "";
    const title = profile.title ? String(profile.title) : "";
    const company = profile.company ? String(profile.company) : "";
    const interests = getArray<string>(data, "interests");
    const hobbies = getArray<string>(data, "hobbies");
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

  if (
    hasWord(query, [
      "serial", "serial number", "imei", "phone", "smartphone", "device",
      "laptop", "tablet", "macbook", "iphone", "ipad", "watch", "wearable",
      "gadget", "electronics", "warranty", "purchase date", "battery",
    ])
  ) {
    const devices = getArray<Record<string, unknown> & { type?: string; deviceName?: string; id?: string; serial?: string; imei?: string }>(data, "devices");
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

  if (
    hasWord(query, [
      "name", "address", "email", "phone number", "contact info", "profile",
      "passport", "aadhaar", "pan", "driving license", "dob", "birth",
      "nationality", "blood group", "where i live", "my email", "my number",
    ])
  ) {
    const profile = getObj(data, "profile") as Record<string, unknown>;
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

  if (hasWord(query, ["secret", "password", "key", "credential", "pin", "token", "login"])) {
    const secrets = getObj(data, "secrets") as Record<string, unknown>;
    const keys = Object.keys(secrets);
    const { memory, custom, contents: memoryAndCustom } = extractMemoryAndCustom(data);
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

  if (hasWord(query, ["goal", "target", "objective", "deadline", "milestone"])) {
    const goals = (getObj(data, "goals") ?? {}) as { shortTerm?: unknown[]; midTerm?: unknown[]; longTerm?: unknown[] };
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

  if (
    hasWord(query, [
      "spend", "expense", "money", "cost", "budget", "transaction", "income",
      "salary", "net worth", "savings", "insurance", "tax",
    ])
  ) {
    const txns = getArray(data, "transaction_history");
    const fin = getObj(data, "financialOverview") as Record<string, unknown>;
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

  if (
    hasWord(query, [
      "health", "steps", "sleep", "mood", "heart", "hrv", "calories",
      "fitness", "water", "weight", "resting",
    ])
  ) {
    const health = getArray(data, "health_daily_logs");
    const moods = getArray(data, "moodLogs");
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

  if (
    hasWord(query, [
      "pay", "payment", "transfer", "send", "wallet", "near address", "near",
      "mother", "dad", "father", "mom", "sibling", "brother", "sister",
      "relative", "business", "pay my", "pay to", "schedule payment",
    ])
  ) {
    const nearAddresses = getObj(data, "near_addresses") as Record<string, string>;
    const addrKeys = Object.keys(nearAddresses).filter((k) => nearAddresses[k]);
    const scheduled = getArray(data, "scheduled_events");
    const notifications = getArray(data, "notifications");
    const addrSummary =
      addrKeys.length > 0
        ? `NEAR addresses stored: ${addrKeys.map((k) => `${k} -> ${nearAddresses[k]}`).join("; ")}. Use these for pay/schedule_event when user says "pay my X" or "schedule payment to X".`
        : "No NEAR wallet addresses stored yet. User can add via chat: 'save my mother's NEAR address as xyz.near'.";
    const schedSummary =
      scheduled.length === 0 && notifications.length === 0
        ? ""
        : ` ${scheduled.length} scheduled event(s), ${notifications.length} notification(s).`;
    return {
      summary: addrSummary + schedSummary,
      details: { near_addresses: nearAddresses, scheduled_events: scheduled, notifications },
      category: "payments",
    };
  }

  if (
    hasWord(query, [
      "scheduled", "schedule", "my schedule", "notifications", "pending", "upcoming",
      "remind me", "reminder to", "pay on", "pay in", "when to pay",
    ])
  ) {
    const scheduled = getArray(data, "scheduled_events");
    const notifications = getArray(data, "notifications");
    const nearAddresses = getObj(data, "near_addresses") as Record<string, string>;
    const summary =
      scheduled.length === 0 && notifications.length === 0
        ? "No scheduled events or notifications."
        : `${scheduled.length} scheduled event(s), ${notifications.length} pending notification(s).`;
    return {
      summary,
      details: { scheduled_events: scheduled, notifications, near_addresses: nearAddresses },
      category: "schedule",
    };
  }

  if (hasWord(query, ["journal", "diary", "note", "memo", "reminder", "entry", "wrote"])) {
    const journal = getArray(data, "dailyJournal");
    return {
      summary:
        journal.length === 0 ? "No journal entries." : `${journal.length} journal entry/entries.`,
      details: { dailyJournal: journal.slice(-30) },
      category: "journal",
    };
  }

  if (hasWord(query, ["smart home", "ac", "thermostat", "light", "lock", "hue", "alexa"])) {
    const smart = getArray(data, "smart_home_devices");
    return {
      summary: smart.length === 0 ? "No smart home devices." : `${smart.length} smart home device(s).`,
      details: smart,
      category: "smart_home",
    };
  }

  if (hasWord(query, ["app", "screen time", "usage", "instagram", "whatsapp", "slack"])) {
    const sessions = getArray(data, "app_sessions");
    return {
      summary: sessions.length === 0 ? "No app session data." : `${sessions.length} app session record(s).`,
      details: sessions,
      category: "app_sessions",
    };
  }

  if (
    hasWord(query, [
      "memory", "remember", "remembered", "what do you know", "what have you learned",
      "saved", "stored", "recall", "recalled", "you know about me",
    ])
  ) {
    const { memory, custom, contents } = extractMemoryAndCustom(data);
    const customKeys = Object.keys(custom);
    const total = contents.length;
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

  const custom = (data.llm_custom && typeof data.llm_custom === "object" ? data.llm_custom : {}) as Record<string, unknown[]>;
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

  if (hasWord(query, ["contact", "people", "friend", "reach", "call"])) {
    const profile = getObj(data, "profile") as Record<string, unknown>;
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

  return genericSummary(data);
}