import os

# Avoid OpenMP duplicate lib error on macOS (e.g. with LangChain/numpy)
os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")

# Env: CONTRACT_ID = contract account (e.g. ajitesh-1.testnet) for standalone get_agent view.
# Contract must be initialized (init(owner_id)) and owner must call approve_codehash before use.

from fastapi import FastAPI, Query, Response
from fastapi.middleware.cors import CORSMiddleware
import services.agent_service as agent_service

import time
import uvicorn

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

COMMON_HEADERS = {
    "X-Service-Name": "agent-api",
    "X-Service-Status": "ok",
}

@app.get("/")
def health_check(response: Response):
    response.headers.update(COMMON_HEADERS)
    response.headers["X-Timestamp"] = str(time.time())
    return {"status": "healthy", "time": time.time()}

@app.post("/agent/chat")
async def agent_chat(request: dict) -> dict:
    prompt = request.get("message") or request.get("prompt", "")
    response_data = agent_service.run_agent(prompt)
    return response_data


@app.get("/agent/account")
async def agent_account() -> dict:
    """View agent account (account_id)."""
    return await agent_service.get_agent_account_id()


@app.get("/agent/info")
async def agent_info() -> dict:
    """Agent info: codehash and checksum."""
    return await agent_service.get_agent_info()


@app.get("/agent/balance")
async def agent_balance() -> dict:
    """Agent balance."""
    return await agent_service.get_agent_balance()


@app.get("/agent/get_agent")
async def agent_get_agent(account_id: str = Query(..., description="NEAR account_id")) -> dict:
    """Contract view get_agent(account_id) -> Worker { checksum, codehash }."""
    return await agent_service.get_agent_view(account_id)


@app.post("/agent/request-signature")
async def agent_request_signature(request: dict) -> dict:
    """Request a signature via contract (chainsig). Body: path, payload, key_type (Ecdsa|Eddsa)."""
    path = request.get("path", "ethereum-1")
    payload = request.get("payload", "")
    key_type = request.get("key_type", "Ecdsa")
    return await agent_service.request_signature(path=path, payload=payload, key_type=key_type)


@app.post("/agent/call")
async def agent_call_contract(request: dict) -> dict:
    """Call a method on the agent smart contract. Body: methodName, args, gas (optional)."""
    method_name = request.get("methodName") or request.get("method_name", "")
    args = request.get("args", {})
    gas = request.get("gas")
    return await agent_service.agent_call(
        method_name=method_name,
        args=args,
        gas=gas,
    )


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8080, reload=True)