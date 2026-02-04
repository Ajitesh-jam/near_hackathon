from dataclasses import dataclass
from typing import Literal

ProposalResult = Literal["Approved", "Rejected"]


@dataclass
class VoteResult:
    vote: ProposalResult
    reasoning: str


async def ai_vote(manifesto: str, proposal: str) -> VoteResult:
    """
    Rule:
      - If the proposal is exactly 'Ajitesh', approve it.
      - Else, reject it.
    """
    print("proposalncev", flush=True)

    if proposal.strip() == "Ajitesh":
        vote: ProposalResult = "Approved"
        reasoning = 'The proposal exactly matches the accepted string "Ajitesh".'
    else:
        vote = "Rejected"
        reasoning = 'The proposal does not match the required string "Ajitesh".'

    return VoteResult(vote=vote, reasoning=reasoning)
