const BACKEND_URL_KEY = "agent_backend_url";

export function getBackendUrl(): string | null {
  return localStorage.getItem(BACKEND_URL_KEY);
}

export function setBackendUrl(url: string): void {
  localStorage.setItem(BACKEND_URL_KEY, url.replace(/\/+$/, ""));
}

/** Use proxy path to avoid CORS when backend is localhost:3000 */
function getEffectiveBaseUrl(): string {
  const base = getBackendUrl();
  if (!base) throw new Error("Backend URL not configured");
  const normalized = base.replace(/\/+$/, "");
  // Route through Vite proxy to avoid CORS in dev
  if (
    typeof window !== "undefined" &&
    /^https?:\/\/localhost:3000(\/|$)/i.test(normalized)
  ) {
    return "/agent-api";
  }
  return normalized;
}

async function apiFetch(path: string, options?: RequestInit) {
  const base = getEffectiveBaseUrl();
  const url = `${base}${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text}`);
  }
  return res.json();
}

export interface Notification {
  id: string;
  time_of_occur: string;
  description: string;
  which_tool_to_call: string;
  arguments: Record<string, unknown>;
  created_at: string;
}

export interface ScheduledEvent {
  id: string;
  time_of_occur: string;
  description: string;
  which_tool_to_call?: string;
  arguments?: Record<string, unknown>;
  created_at: string;
}

export const api = {
  getNotifications: (): Promise<{ notifications: Notification[] }> =>
    apiFetch("/notifications"),

  respondNotification: (id: string, action: "approve" | "reject" | "dismiss") =>
    apiFetch(`/notifications/${id}/respond`, {
      method: "POST",
      body: JSON.stringify({ action }),
    }),

  getScheduledEvents: (): Promise<{ notifications: ScheduledEvent[] }> =>
    apiFetch("/scheduled-events"),

  rejectScheduledEvent: (id: string) =>
    apiFetch(`/scheduled-events/${id}/reject`, { method: "POST" }),

  chat: async (message: string) => {
    const base = getEffectiveBaseUrl();
    const url = `${base}/chat`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    if (!res.ok) throw new Error(`Chat error ${res.status}`);
    // Backend now returns plain text
    const text = await res.text();
    return { content: text };
  },

  addData: (endpoint: string, data: Record<string, unknown>) =>
    apiFetch(`/${endpoint}`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
};
