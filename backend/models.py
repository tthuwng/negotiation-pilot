from typing import Dict, List, Optional

from pydantic import BaseModel


class NegotiationRequest(BaseModel):
    goal: str
    messages: List[str]
    current_turn: int = 0


class NegotiationResponse(BaseModel):
    options: List[str]
    state_evaluation: float


class MCTSNodeUpdate(BaseModel):
    node_id: str
    parent_id: Optional[str]
    state: str
    visits: int
    value: float
    action_taken: Optional[str]


class MCTSExplorationEvent(BaseModel):
    event_type: str  # "node_update", "selection", "expansion", "evaluation", "backprop"
    node: MCTSNodeUpdate
    metadata: Optional[Dict] = None
    metadata: Optional[Dict] = None
