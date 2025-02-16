from typing import Dict, List, Literal, Optional

from pydantic import BaseModel


class NegotiationRequest(BaseModel):
    goal: str
    messages: List[str]
    current_turn: int = 0


class NegotiationResponse(BaseModel):
    options: List[str]
    state_evaluation: float


class BossChatRequest(BaseModel):
    messages: List[str]


class BossChatResponse(BaseModel):
    response: str


class MCTSNodeUpdate(BaseModel):
    node_id: str
    parent_id: Optional[str]
    state: str
    visits: int
    value: float
    action_taken: Optional[str]
    depth: int
    children_ids: List[str] = []
    status: Literal["exploring", "evaluating", "complete"] = "exploring"
    evaluation_score: Optional[float] = None


class MCTSExplorationEvent(BaseModel):
    event_type: Literal[
        "node_update",
        "selection",
        "expansion",
        "evaluation",
        "backprop",
        "complete",
        "error",
    ]
    node: Optional[MCTSNodeUpdate] = None
    nodes: Optional[List[MCTSNodeUpdate]] = None
    metadata: Optional[Dict] = None
    total_nodes: int = 0
    max_depth: int = 0
    state_evaluation: Optional[float] = None
