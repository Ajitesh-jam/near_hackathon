import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import dotenv from "dotenv";
import { agentInfo } from "@neardefi/shade-agent-js";
import { responder } from "./responder";
import {
  startActiveTools,
  getReactiveTools,
  listToolsMetadata,
} from "./toolRunner";

// Load environment variables from .env file (only needed for local development)
if (process.env.NODE_ENV !== "production") {
  dotenv.config({ path: ".env.development.local" });
}

const app = new Hono();

// Configure CORS to restrict access to the server
app.use(cors());

// Health check
app.get("/", (c) => c.json({ message: "App is running" }));
app.get("/health", (c) => c.json({ status: "healthy", service: "agent-api" }));

// --- Tool APIs ---

// List configured tools (active and reactive)
app.get("/api/tools", async (c) => {
  try {
    const meta = await listToolsMetadata();
    return c.json({ active: meta.active, reactive: meta.reactive });
  } catch (e) {
    console.error("listToolsMetadata error:", e);
    return c.json({ error: "Failed to list tools" }, 500);
  }
});

// Execute a reactive tool by name (POST with body: { args: unknown[] })
app.post("/api/tools/reactive/:name/execute", async (c) => {
  const name = c.req.param("name");
  if (!name) {
    return c.json({ error: "Missing tool name" }, 400);
  }
  try {
    const body = await c.req.json().catch(() => ({})) as { args?: unknown[] };
    const args: unknown[] = Array.isArray(body.args) ? body.args : [];
    const reactiveMap = await getReactiveTools();
    const tool = reactiveMap.get(name);
    if (!tool) {
      return c.json({ error: `Reactive tool not found: ${name}` }, 404);
    }
    const result = tool.execute(tool.config, ...args);
    return c.json(result);
  } catch (e) {
    console.error(`Reactive tool ${name} execute error:`, e);
    return c.json({ error: String(e) }, 500);
  }
});

// Set port
const port = Number(process.env.PORT || "3000");
console.log(`App is running on port ${port}`);

async function main() {
  // Start active tools in the background (run continuously alongside server)
  await startActiveTools((toolName, result) => {
    console.log(`Active tool ${toolName} triggered:`, result);
  });

  // Original logic: DAO responder loop (polls proposals, votes, calls contract)
  async function startResponder() {
    if (process.env.NODE_ENV === "production") {
      while (true) {
        await new Promise((resolve) => setTimeout(resolve, 10000));
        console.log("Looping check if registered");
        try {
          const res = await agentInfo();
          const checksum = res.checksum;
          if (checksum != null && checksum !== undefined) {
            break;
          }
        } catch (error) {
          console.error("Error in checksum loop:", error);
        }
      }
    }
    console.log("Starting responder");
    responder();
  }

  startResponder();

  serve({ fetch: app.fetch, port });
}

main();
