// Use /api in dev (Vite proxies to backend); override with VITE_API_URL for direct backend URL
const API_BASE = import.meta.env.VITE_API_URL ?? "/api";

export type AddDataField = "secrets" | "interests" | "goals" | "spending" | "contacts" | "notes";

export async function chat(message: string): Promise<{ content: string }> {
  const res = await fetch(`${API_BASE}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json();
}

export async function addData(field: AddDataField, value: unknown): Promise<{ success: boolean; data: unknown }> {
  const res = await fetch(`${API_BASE}/add-data`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ field, value }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || res.statusText);
  }
  return res.json();
}
