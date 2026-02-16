# Personal AI – Frontend

Frontend for the Personal AI backend (chat + add-data).

## Setup

1. Copy `.env.example` to `.env` and set the backend URL if needed:
   ```bash
   cp .env.example .env
   # Edit .env: VITE_API_URL=http://localhost:3000
   ```
2. Install and run:
   ```bash
   npm install
   npm run dev
   ```
3. Open http://localhost:5173. Ensure the Personal AI backend is running on the URL set in `VITE_API_URL` (default `http://localhost:3000`).

## Features

- **Chat** – Send messages to the Personal AI; replies are shown in a simple chat layout.
- **Add data** – Add items to your private data (interests, goals, spending, contacts, notes, secrets). The form turns your input into the JSON shape expected by the backend `POST /add-data` API.

## Build

```bash
npm run build
npm run preview   # serve dist/
```
