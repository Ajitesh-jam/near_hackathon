import { useState } from "react";
import { addData, type AddDataField } from "../api";

const FIELDS: { key: AddDataField; label: string; hint: string; inputType: "text" | "textarea" | "keyValue" }[] = [
  { key: "interests", label: "Interests", hint: "One per line or comma-separated", inputType: "text" },
  { key: "goals", label: "Goals", hint: "One goal per line", inputType: "textarea" },
  { key: "spending", label: "Spending entry", hint: "e.g. {\"amount\": 50, \"category\": \"food\", \"date\": \"2025-01-15\"}", inputType: "textarea" },
  { key: "contacts", label: "Contact", hint: "e.g. {\"name\": \"Jane\", \"email\": \"j@example.com\"}", inputType: "textarea" },
  { key: "notes", label: "Note", hint: "Plain text or JSON", inputType: "textarea" },
  { key: "secrets", label: "Secret (key-value)", hint: "Key and value (stored locally only)", inputType: "keyValue" },
];

function parseValue(field: AddDataField, raw: string, key?: string): unknown {
  const trimmed = raw.trim();
  if (field === "secrets" && key !== undefined) {
    return { [key]: trimmed };
  }
  if (field === "interests") {
    const list = trimmed.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
    return list.length === 1 ? list[0] : list;
  }
  if (field === "goals") {
    const list = trimmed.split("\n").map((s) => s.trim()).filter(Boolean);
    return list.length === 1 ? list[0] : list;
  }
  if (field === "spending" || field === "contacts") {
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return [{ raw: trimmed }];
    }
  }
  if (field === "notes") {
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return trimmed;
    }
  }
  return trimmed;
}

export default function AddData() {
  const [activeField, setActiveField] = useState<AddDataField>("interests");
  const [text, setText] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [secretValue, setSecretValue] = useState("");
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  const meta = FIELDS.find((f) => f.key === activeField)!;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("idle");
    setMessage("");
    try {
      let value: unknown;
      if (activeField === "secrets") {
        if (!secretKey.trim()) {
          setStatus("error");
          setMessage("Secret key is required.");
          return;
        }
        value = { [secretKey.trim()]: secretValue };
      } else {
        value = parseValue(activeField, text);
        if (activeField === "interests" && (Array.isArray(value) ? value.length === 0 : !value) ||
            activeField === "goals" && (Array.isArray(value) ? value.length === 0 : !value) ||
            (activeField === "spending" || activeField === "contacts" || activeField === "notes") && !text.trim()) {
          setStatus("error");
          setMessage("Please enter something.");
          return;
        }
      }
      await addData(activeField, value);
      setStatus("success");
      setMessage("Saved.");
      setText("");
      setSecretKey("");
      setSecretValue("");
    } catch (err) {
      setStatus("error");
      setMessage(err instanceof Error ? err.message : "Request failed.");
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <h2 className="text-xl font-semibold text-stone-100 mb-2">Add to your data</h2>
      <p className="text-stone-500 text-sm mb-6">
        Choose a category and enter data. It will be sent in the format the backend expects.
      </p>

      <div className="flex flex-wrap gap-2 mb-6">
        {FIELDS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => {
              setActiveField(f.key);
              setStatus("idle");
              setMessage("");
            }}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              activeField === f.key
                ? "bg-emerald-600 text-white"
                : "bg-stone-800 text-stone-400 hover:text-stone-200 hover:bg-stone-700"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-xl bg-stone-900/80 border border-stone-700 p-4">
          <label className="block text-sm font-medium text-stone-300 mb-2">{meta.label}</label>
          <p className="text-stone-500 text-xs mb-3">{meta.hint}</p>

          {meta.inputType === "keyValue" ? (
            <div className="space-y-3">
              <input
                type="text"
                value={secretKey}
                onChange={(e) => setSecretKey(e.target.value)}
                placeholder="Key (e.g. api_key)"
                className="w-full rounded-lg bg-stone-800 border border-stone-600 px-3 py-2 text-stone-100 placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
              <input
                type="password"
                value={secretValue}
                onChange={(e) => setSecretValue(e.target.value)}
                placeholder="Value"
                className="w-full rounded-lg bg-stone-800 border border-stone-600 px-3 py-2 text-stone-100 placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>
          ) : (
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={meta.key === "spending" ? '{"amount": 20, "category": "coffee"}' : meta.key === "contacts" ? '{"name": "Alex", "email": "alex@example.com"}' : "Enter text..."}
              rows={meta.inputType === "textarea" ? 5 : 2}
              className="w-full rounded-lg bg-stone-800 border border-stone-600 px-3 py-2 text-stone-100 placeholder-stone-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 resize-y font-mono text-sm"
            />
          )}
        </div>

        {message && (
          <p className={`text-sm ${status === "error" ? "text-red-400" : "text-emerald-400"}`}>
            {message}
          </p>
        )}

        <button
          type="submit"
          className="w-full rounded-xl bg-emerald-600 py-3 text-white font-medium hover:bg-emerald-500 transition-colors"
        >
          Add {meta.label}
        </button>
      </form>
    </div>
  );
}
