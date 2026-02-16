const BACKEND_URL_KEY = "agent_backend_url";

export function getBackendUrl(): string | null {
  return localStorage.getItem(BACKEND_URL_KEY);
}

export function setBackendUrl(url: string): void {
  localStorage.setItem(BACKEND_URL_KEY, url.replace(/\/+$/, ""));
}

async function apiFetch(path: string, options?: RequestInit) {
  const base = getBackendUrl();
  if (!base) throw new Error("Backend URL not configured");
  const res = await fetch(`${base}${path}`, {
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

  respondNotification: (id: string, action: "approve" | "reject") =>
    apiFetch(`/notifications/${id}/respond`, {
      method: "POST",
      body: JSON.stringify({ action }),
    }),

  getScheduledEvents: (): Promise<{ notifications: ScheduledEvent[] }> =>
    apiFetch("/scheduled-events"),

  rejectScheduledEvent: (id: string) =>
    apiFetch(`/scheduled-events/${id}/reject`, { method: "POST" }),

  chat: async (message: string) => {
    const base = getBackendUrl();
    if (!base) throw new Error("Backend URL not configured");
    const res = await fetch(`${base}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    if (!res.ok) throw new Error(`Chat error ${res.status}`);
    return res.json();
  },

  addData: (endpoint: string, data: Record<string, unknown>) =>
    apiFetch(`/${endpoint}`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
};
