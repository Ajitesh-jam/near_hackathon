import { serve } from "@hono/node-server";
import { cors } from "hono/cors";
import dotenv from "dotenv";


import { runLogic } from "./logic";

if (process.env.NODE_ENV !== "production") {
  dotenv.config({ path: ".env.development.local" });
}

const app = new Hono();
app.use("*", cors());

const port = Number(process.env.PORT || "3000");
console.log(`App is running on port ${port}`);

runLogic();

serve({ fetch: app.fetch, port });
