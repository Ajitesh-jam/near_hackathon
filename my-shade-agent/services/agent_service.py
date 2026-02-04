"""
Agent service: LangChain + Gemini and Shade Agent helpers.
"""

import base64
import json
import os
from typing import Any, Optional

# LangChain + Gemini
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage
from langchain_core.output_parsers import StrOutputParser

# Shade Agent (shade-agent-py) - used when running inside TEE / with shade-agent-api
try:
    from shade_agent import (
        agent_account_id,
        agent_info,
        agent,
        agent_call as shade_agent_call,
    )
    SHADE_AGENT_AVAILABLE = True
except ImportError:
    SHADE_AGENT_AVAILABLE = False


# --- Gemini / run_agent ---

def _get_llm() -> ChatGoogleGenerativeAI:
    api_key = os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")
    if not api_key:
        raise ValueError("Set GOOGLE_API_KEY or GEMINI_API_KEY in environment")
    return ChatGoogleGenerativeAI(
        model="gemini-2.0-flash",
        google_api_key=api_key,
        temperature=0.7,
    )


def run_agent(prompt: str) -> dict[str, Any]:
    """
    Call Gemini with the given prompt and return the model response.
    """
    llm = _get_llm()
    chain = llm | StrOutputParser()
    response = chain.invoke([HumanMessage(content=prompt)])
    return {"response": response, "prompt": prompt}


# --- Shade Agent: account, info, balance ---

async def get_agent_account_id() -> dict[str, str]:
    """
    View agent account: returns account_id from the Shade Agent.
    """
    if not SHADE_AGENT_AVAILABLE:
        return {"error": "shade_agent not available", "account_id": ""}
    res = await agent_account_id()
    return {"account_id": res.get("account_id", res.get("accountId", ""))}


async def get_agent_info() -> dict[str, Any]:
    """
    Agent info: codehash and checksum from the Shade Agent.
    """
    if not SHADE_AGENT_AVAILABLE:
        return {"error": "shade_agent not available", "codehash": "", "checksum": ""}
    res = await agent_info()
    return {
        "codehash": res.get("codehash", ""),
        "checksum": res.get("checksum", ""),
    }


async def get_agent_balance() -> dict[str, Any]:
    """
    Agent balance: calls agent('getBalance') and returns balance.
    """
    if not SHADE_AGENT_AVAILABLE:
        return {"error": "shade_agent not available", "balance": ""}
    res = await agent("getBalance")
    return {"balance": res.get("balance", "")}


# --- Shade Agent: request_signature (via contract / chainsig) ---

async def request_signature(
    path: str = "ethereum-1",
    payload: str = "",
    key_type: str = "Ecdsa",
) -> dict[str, Any]:
    """
    Request a signature via the contract's request_signature (chainsig).
    Calls the agent contract so chainsig -> MPC is used.
    key_type: "Ecdsa" or "Eddsa"
    """
    if not SHADE_AGENT_AVAILABLE:
        return {"error": "shade_agent not available"}
    res = await agent_call(
        method_name="request_signature",
        args={"path": path, "payload": payload, "key_type": key_type},
    )
    return res if isinstance(res, dict) else {"result": res}


# --- Contract view: get_agent (standalone via NEAR RPC when CONTRACT_ID set) ---

async def get_agent_view(account_id: str) -> dict[str, Any]:
    """
    Call contract view get_agent(account_id) -> Worker { checksum, codehash }.
    Uses shade-agent when available (agent_call for view if supported), else NEAR RPC when CONTRACT_ID is set.
    """
    if SHADE_AGENT_AVAILABLE:
        # Try contract view via agent_call; shade-agent-py may support view via same endpoint
        try:
            res = await agent_call(
                method_name="get_agent",
                args={"account_id": account_id},
            )
            if "error" not in res:
                return res
        except Exception:
            pass
    # Standalone: NEAR RPC query call_function
    contract_id = os.environ.get("CONTRACT_ID")
    if not contract_id:
        return {"error": "CONTRACT_ID not set and shade_agent view not available", "checksum": "", "codehash": ""}
    rpc_url = os.environ.get("NEAR_RPC_URL", "https://rpc.testnet.near.org")
    args_json = json.dumps({"account_id": account_id})
    args_b64 = base64.b64encode(args_json.encode()).decode()
    payload = {
        "jsonrpc": "2.0",
        "id": "dontcare",
        "method": "query",
        "params": {
            "request_type": "call_function",
            "finality": "final",
            "account_id": contract_id,
            "method_name": "get_agent",
            "args_base64": args_b64,
        },
    }
    try:
        import httpx
        async with httpx.AsyncClient() as client:
            r = await client.post(rpc_url, json=payload, timeout=10.0)
            r.raise_for_status()
            data = r.json()
    except Exception as e:
        return {"error": str(e), "checksum": "", "codehash": ""}
    if "error" in data:
        return {"error": data["error"], "checksum": "", "codehash": ""}
    result_b64 = data.get("result", {}).get("result")
    if result_b64 is None:
        return {"error": "no result in RPC response", "checksum": "", "codehash": ""}
    try:
        raw = base64.b64decode(result_b64)
        # Contract uses JSON serialization for view return
        text = raw.decode("utf-8")
        out = json.loads(text)
        return {"checksum": out.get("checksum", ""), "codehash": out.get("codehash", "")}
    except Exception as e:
        return {"error": f"decode: {e}", "checksum": "", "codehash": ""}


# --- Shade Agent: call smart contract ---

async def agent_call(
    method_name: str,
    args: Optional[dict[str, Any]] = None,
    gas: Optional[str] = "30000000000000",
) -> dict[str, Any]:
    """
    Call a method on the agent smart contract.
    """
    if not SHADE_AGENT_AVAILABLE:
        return {"error": "shade_agent not available"}
    payload: dict[str, Any] = {
        "methodName": method_name,
        "args": args or {},
    }
    if gas is not None:
        payload["gas"] = gas
    res = await shade_agent_call(payload)
    return res if isinstance(res, dict) else {"result": res}
