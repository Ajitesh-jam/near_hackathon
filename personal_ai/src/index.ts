import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import dotenv from "dotenv";

import { createApi } from "./api";
import { runLogic } from "./logic";

if (process.env.NODE_ENV !== "production") {
  dotenv.config({ path: ".env.development.local" });
}

const app = createApi();

// Explicit OPTIONS preflight so browser gets Access-Control-Allow-Headers and sends the actual POST
const preflightHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};
app.use("*", async (c, next) => {
  if (c.req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: preflightHeaders });
  }
  await next();
});

// CORS for non-OPTIONS responses so browser can read the body
app.use("*", cors({ origin: "*", allowMethods: ["GET", "POST", "OPTIONS"], allowHeaders: ["Content-Type"] }));

app.use("*", async (c, next) => {
  const method = c.req.method;
  const path = c.req.path;
  const start = Date.now();
  console.log(`[${new Date().toISOString()}] ${method} ${path}`);
  await next();
  console.log(`[${new Date().toISOString()}] ${method} ${path} ${c.res.status} ${Date.now() - start}ms`);
});

const port = Number(process.env.PORT || "3000");
console.log(`App is running on port ${port}`);

runLogic();

serve({ fetch: app.fetch, port });
