import { Hono } from "hono";
import { runAgent } from "./tools/llm";
import {
  formatError,
  appendOrMergeData,
  isPersonalDataKey,
  getNotifications,
  getNotificationById,
  removeNotificationById,
  getScheduledEvents,
  removeScheduledEventById,
} from "./tools/base";
import { toolMap } from "./tools/index";
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

  app.get("/notifications", async (c) => {
    console.log("[API] GET /notifications");
    try {
      const all = await getNotifications();
      const items = all.map((n) => ({
        id: n.id ?? (n as Record<string, unknown>).id,
        time_of_occur: n.time_of_occur ?? (n as Record<string, unknown>).time_of_occur,
        description: n.description ?? (n as Record<string, unknown>).description,
        which_tool_to_call: n.which_tool_to_call ?? (n as Record<string, unknown>).which_tool_to_call,
        arguments: n.arguments ?? (n as Record<string, unknown>).arguments,
        created_at: n.created_at ?? (n as Record<string, unknown>).created_at,
      }));
      return c.json({ notifications: items });
    } catch (error) {
      console.log("[API] /notifications error:", error instanceof Error ? error.message : String(error));
      return c.json(formatError(error), 500);
    }
  });

  app.post("/notifications/:id/respond", async (c) => {
    const id = c.req.param("id");
    console.log("[API] POST /notifications/:id/respond", id);
    try {
      const body = (await c.req.json<{ action?: string }>().catch(() => ({}))) as { action?: string };
      const action = (body?.action ?? "").toLowerCase();
      if (action !== "approve" && action !== "reject") {
        return c.json(formatError(new Error("action must be 'approve' or 'reject'")), 400);
      }
      const notification = await getNotificationById(id);
      if (!notification) {
        return c.json(formatError(new Error("Notification not found")), 404);
      }
      if (action === "approve") {
        const toolName = (notification.which_tool_to_call ?? "pay") as string;
        const toolArgs = (notification.arguments ?? {}) as Record<string, unknown>;
        const executor = toolMap[toolName];
        if (executor) {
          try {
            const result = await executor(toolArgs);
            console.log("[API] Tool executed:", toolName, result);
          } catch (err) {
            console.error("[API] Tool execution failed:", err);
            return c.json(
              formatError(new Error(`Tool ${toolName} failed: ${err instanceof Error ? err.message : String(err)}`)),
              500
            );
          }
        } else {
          console.warn("[API] Unknown tool:", toolName, "- skipping execution");
        }
      }
      const { found } = await removeNotificationById(id);
      if (!found) {
        return c.json(formatError(new Error("Notification not found")), 404);
      }
      return c.json({
        success: true,
        action,
        message: action === "approve" ? "Executed and removed" : "Removed",
      });
    } catch (error) {
      console.log("[API] /notifications/:id/respond error:", error instanceof Error ? error.message : String(error));
      return c.json(formatError(error), 500);
    }
  });

  app.get("/scheduled-events", async (c) => {
    console.log("[API] GET /scheduled-events");
    try {
      const all = await getScheduledEvents();
      const items = all.map((e) => ({
        id: e.id ?? (e as Record<string, unknown>).id,
        time_of_occur: e.time_of_occur ?? (e as Record<string, unknown>).time_of_occur,
        description: e.description ?? (e as Record<string, unknown>).description,
        which_tool_to_call: e.which_tool_to_call ?? (e as Record<string, unknown>).which_tool_to_call,
        arguments: e.arguments ?? (e as Record<string, unknown>).arguments,
        created_at: e.created_at ?? (e as Record<string, unknown>).created_at,
      }));
      return c.json({ scheduled_events: items });
    } catch (error) {
      console.log("[API] /scheduled-events error:", error instanceof Error ? error.message : String(error));
      return c.json(formatError(error), 500);
    }
  });

  app.post("/scheduled-events/:id/reject", async (c) => {
    const id = c.req.param("id");
    console.log("[API] POST /scheduled-events/:id/reject", id);
    try {
      const { found } = await removeScheduledEventById(id);
      if (!found) {
        return c.json(formatError(new Error("Scheduled event not found")), 404);
      }
      return c.json({ success: true, message: "Scheduled event removed" });
    } catch (error) {
      console.log("[API] /scheduled-events/:id/reject error:", error instanceof Error ? error.message : String(error));
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
