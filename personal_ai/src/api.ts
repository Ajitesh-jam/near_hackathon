import { Hono } from "hono";
import { runAgent } from "./tools/llm";
import {
  formatError,
  appendOrMergeData,
  isPersonalDataKey,
} from "./tools/base";
export function createApi(): Hono {
  const app = new Hono();

  app.get("/", (c) => {
    console.log("[API] GET / (root)");
    return c.json({ status: "ok", service: "personal-ai" });
  });
  app.get("/health", (c) => {
    console.log("[API] GET /health");
    return c.json({ status: "ok", service: "personal-ai" });
  });

  app.post("/chat", async (c) => {
    console.log("[API] POST /chat");
    try {
      const body = await c.req.json<{ message?: string }>();
      const message = body?.message;
      if (message) console.log("[API] /chat message length:", String(message).length);
      if (typeof message !== "string" || !message.trim()) {
        return c.json(formatError(new Error("Missing or empty message")), 400);
      }
      const content = await runAgent(message.trim());
      console.log("[API] /chat success");
      return c.json({ content });
    } catch (error) {
      console.log("[API] /chat error:", error instanceof Error ? error.message : String(error));
      return c.json(formatError(error), 500);
    }
  });

  app.post("/add-data", async (c) => {
    console.log("[API] POST /add-data");
    try {
      const body = await c.req.json<{ field?: string; value?: unknown }>();
      const field = body?.field;
      const value = body?.value;

      if (typeof field !== "string" || !isPersonalDataKey(field)) {
        return c.json(
          formatError(
            new Error(
              `Invalid field. Must be one of: secrets, interests, goals, spending, contacts, notes`
            )
          ),
          400
        );
      }
      await appendOrMergeData(field, value);
      console.log("[API] /add-data success, updated field:", field);
      return c.json({ success: true, updated: field });
    } catch (error) {
      console.log("[API] /add-data error:", error instanceof Error ? error.message : String(error));
      return c.json(formatError(error), 400);
    }
  });

  return app;
}
