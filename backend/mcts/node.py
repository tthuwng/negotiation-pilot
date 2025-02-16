from __future__ import annotations

from math import log, sqrt
from typing import Callable, Generic, List, Literal, Optional, TypeVar

State = TypeVar("State")
Action = TypeVar("Action")
NodeStatus = Literal["exploring", "evaluating", "complete"]


class MCTSNode(Generic[State, Action]):
    def __init__(
        self,
        state: State,
        parent: Optional[MCTSNode[State, Action]] = None,
        action_taken: Optional[Action] = None,
    ) -> None:
        self.state = state
        self.parent = parent
        self.action_taken = action_taken
        self.children: List[MCTSNode[State, Action]] = []
        self.visits: int = 0
        self.value: float = 0.0
        self.status: NodeStatus = "exploring"
        self.evaluation_score: Optional[float] = None

    def ucb_score(self, exploration_weight: float = 1.4) -> float:
        """Calculate the UCB score for this node."""
        if not self.parent:
            return float("inf")

        # Handle unvisited nodes
        if self.visits == 0:
            return float("inf")

        # Handle parent with no visits (shouldn't happen but safety check)
        if self.parent.visits == 0:
            return float("inf")

        exploitation = self.value / self.visits
        exploration = exploration_weight * sqrt(
            2 * log(self.parent.visits) / self.visits
        )
        return exploitation + exploration

    def is_fully_expanded(
        self, get_actions_func: Callable[[State], List[Action]]
    ) -> bool:
        """Check if all possible actions have been tried from this state."""
        available_actions = get_actions_func(self.state)
        return len(self.children) >= len(available_actions)

    def expand(
        self,
        get_actions_func: Callable[[State], List[Action]],
        transition_func: Callable[[State, Action], State],
    ) -> Optional[MCTSNode[State, Action]]:
        """Create a new child node for an untried action."""
        available_actions = get_actions_func(self.state)
        tried_actions = {
            child.action_taken
            for child in self.children
            if child.action_taken is not None
        }

        untried = [a for a in available_actions if a not in tried_actions]
        if not untried:
            return None

        action = untried[0]
        new_state = transition_func(self.state, action)
        child = MCTSNode(new_state, parent=self, action_taken=action)
        self.children.append(child)
        return child

    def best_child(self, exploration_weight: float = 1.4) -> MCTSNode[State, Action]:
        """Select the child with the highest UCB score."""
        if not self.children:
            raise ValueError("Node has no children")
        return max(self.children, key=lambda c: c.ucb_score(exploration_weight))

    def most_visited_child(self) -> MCTSNode[State, Action]:
        """Select the most visited child node."""
        if not self.children:
            raise ValueError("Node has no children")
        return max(self.children, key=lambda c: c.visits)

    def update(self, value: float) -> None:
        """Update node statistics with a new value."""
        self.visits += 1
        self.value += value

    def __repr__(self) -> str:
        return (
            f"MCTSNode(state={self.state}, "
            f"visits={self.visits}, value={self.value:.2f}, "
            f"status={self.status})"
        )
