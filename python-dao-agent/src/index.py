import asyncio
import logging
import os
import sys

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from shade_agent import agent_info

from .responder import responder

# Configure logging for containers (Phala Cloud, Docker): stdout, unbuffered, so logs load
def _configure_logging() -> None:
    root = logging.getLogger()
    root.setLevel(logging.INFO)
    if not root.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setLevel(logging.INFO)
        handler.setFormatter(
            logging.Formatter("%(asctime)s [%(levelname)s] %(name)s: %(message)s")
        )
        root.addHandler(handler)
    # Ensure stdout/stderr are line-buffered when not a TTY (e.g. in Phala)
    try:
        if not sys.stdout.isatty():
            sys.stdout.reconfigure(line_buffering=True)  # type: ignore[attr-defined]
        if not sys.stderr.isatty():
            sys.stderr.reconfigure(line_buffering=True)  # type: ignore[attr-defined]
    except AttributeError:
        pass


_configure_logging()
logger = logging.getLogger(__name__)

# Immediate startup message so Phala Cloud log viewer has something to show
print("python-dao-agent starting", flush=True)
logger.info("python-dao-agent startup")

# Load environment variables (only needed for local development)
if os.getenv("NODE_ENV") != "production":
    load_dotenv(".env.development.local")

logger.info("Building FastAPI app")
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def health_check():
    return {"message": "App is running"}


async def start_responder() -> None:
    if os.getenv("NODE_ENV") == "production":
        # In production wait until agent is registered to start the responder
        while True:
            await asyncio.sleep(10)
            logger.info("Looping check if registered")
            try:
                res = await agent_info()
                checksum = res.get("checksum")
                if checksum is not None and checksum != "":
                    break
            except Exception as e:
                logger.exception("Error in checksum loop: %s", e)
    logger.info("Starting responder")
    asyncio.create_task(responder())


@app.on_event("startup")
async def on_startup():
    await start_responder()


if __name__ == "__main__":
    port = int(os.getenv("PORT", "3000"))
    logger.info("App is running on port %s", port)
    # log_level=info and access_log so uvicorn logs go to stdout and show in Phala
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=port,
        log_level="info",
        access_log=True,
    )
