from typing import List

from pydantic import BaseModel


class NegotiationRequest(BaseModel):
    goal: str
    messages: List[str]
    current_turn: int = 0


class NegotiationResponse(BaseModel):
    options: List[str]
    state_evaluation: float
