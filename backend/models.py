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
    depth: int
    children_ids: List[str] = []
    status: str = "exploring"  # "exploring", "evaluating", "complete"
    evaluation_score: Optional[float] = None


class MCTSExplorationEvent(BaseModel):
    event_type: str  # "node_update", "selection", "expansion", "evaluation", "backprop", "complete"
    node: MCTSNodeUpdate
    metadata: Optional[Dict] = None
    total_nodes: int = 0
    max_depth: int = 0
