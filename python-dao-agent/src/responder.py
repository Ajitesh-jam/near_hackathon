"""
Responder: polls for pending proposals, votes via AI, submits to contract.
Uses shade-agent-py (agent_view, agent_call) to interact with the contract.
"""

import asyncio
import hashlib
import logging
from typing import Any, Dict, List, Tuple, cast

from shade_agent import agent_view, agent_call

from .ai import ai_vote, VoteResult

logger = logging.getLogger(__name__)

ProposalRequest = Dict[str, Any]


async def responder() -> None:
    """
    Loop: fetch pending proposals, vote, submit. Uses shade-agent-py.
    Set SHADE_AGENT_API_HOST=shade-agent-api and API_PORT=3140 in Docker/Phala.
    """
    while True:
        try:
            await asyncio.sleep(30)

            requests = await agent_view({
                "methodName": "get_pending_proposals",
                "args": {},
            })

            if not requests:
                logger.info("No pending proposals")
                continue

            logger.info("Found pending proposals amount: %s", len(requests))

            requests_list = cast(List[Tuple[int, ProposalRequest]], requests)
            proposal_id, proposal_req = requests_list[0]
            yield_id = proposal_req["yield_id"]
            proposal_text = proposal_req["proposal_text"]

            manifesto_result = await agent_view({
                "methodName": "get_manifesto",
                "args": {},
            })
            manifesto_text = (
                manifesto_result if isinstance(manifesto_result, str) else str(manifesto_result)
            )

            vote_result: VoteResult = await ai_vote(manifesto_text, proposal_text)

            proposal_hash = hashlib.sha256(proposal_text.encode("utf-8")).hexdigest()
            manifesto_hash = hashlib.sha256(manifesto_text.encode("utf-8")).hexdigest()

            response = {
                "proposal_id": proposal_id,
                "proposal_hash": proposal_hash,
                "manifesto_hash": manifesto_hash,
                "vote": vote_result.vote,
                "reasoning": vote_result.reasoning,
            }

            await agent_call({
                "methodName": "agent_vote",
                "args": {
                    "yield_id": yield_id,
                    "response": response,
                },
            })

            logger.info("Successfully voted on proposal with id: %s", proposal_id)

        except Exception as error:
            logger.exception("Error with responder: %s: %s", type(error).__name__, error)
