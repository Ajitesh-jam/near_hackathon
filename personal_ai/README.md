# Personal AI

A sovereign personal AI core with horizontally scalable modular tools. Designed for secure execution (e.g. TEE). Uses a thin API layer, LLM orchestration, tool registry, and structured JSON private memory.

## Prerequisites

- Node.js 20+
- [Docker](https://docs.docker.com/get-docker/) (optional, for containerized run)
- [Gemini API key](https://aistudio.google.com/apikey) from Google AI Studio

## Setup

1. Clone or copy this project and go to its root:

   ```bash
   cd personal_ai
   ```

2. Create `.env.development.local` in the project root with:

   ```
   GEMINI_API_KEY=your-gemini-api-key-here
   PORT=3000
   ```

   Get your API key from [Google AI Studio](https://aistudio.google.com/apikey).

3. Install dependencies:

   ```bash
   npm install
   ```

## Run locally

```bash
npm run dev
```

The API listens on `http://localhost:3000` (or the port set in `PORT`).

## API

- **GET /** or **GET /health** — Health check. Returns `{ status: "ok" }` or similar.
- **POST /chat** — Send a message to the agent. Body: `{ "message": "your question or request" }`. Returns `{ "content": "agent reply" }`.
- **POST /add-data** — Add or merge data into private memory (`data.json`). Body: `{ "field": "interests" | "goals" | "spending" | "contacts" | "notes" | "secrets", "value": ... }`. Returns success JSON.

All reads/writes to private memory go through `src/data.json` and the base tools; the agent uses this context when answering.

## Run with Docker

Build the image:

```bash
npm run docker:build
```

Run with docker-compose (uses `.env.development.local`):

```bash
docker compose up
```

Or run the built image directly:

```bash
docker run -p 3000:3000 --env-file .env.development.local personal-ai
```

(Use the actual image name you built, e.g. `pivortex/my-app:latest` if you kept the default script.)

## Project structure

- `src/index.ts` — Bootstrap: createApi, runLogic, serve.
- `src/api.ts` — HTTP endpoints (POST /chat, POST /add-data, health).
- `src/logic.ts` — Minimal init (e.g. log "Personal AI Ready").
- `src/constants.ts` — Paths, types, config.
- `src/data.json` — Private memory (secrets, interests, goals, spending, contacts, notes).
- `src/system_prompt.txt` — Agent behavior and tool rules.
- `src/tools/` — Tool registry (`index.ts`), LLM orchestration (`llm.ts`), tools (`personal_context.ts`, `base.ts`).

To add a new capability: add a new file under `src/tools/`, implement the tool, and register it in `src/tools/index.ts`. No changes needed in api, llm, index, or logic.

## Contract

The `contract/` folder contains the NEAR smart contract (Rust). It is kept for compatibility; the Personal AI app runs independently and does not require the contract for basic chat and add-data flows.
