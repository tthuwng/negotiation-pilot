import logging
from typing import (
    Any,
    Callable,
    Coroutine,
    Dict,
    List,
    Optional,
    Protocol,
    Tuple,
    TypeVar,
)

from models import MCTSExplorationEvent, MCTSNodeUpdate

from .node import MCTSNode

State = TypeVar("State")
Action = TypeVar("Action")
EventCallback = Callable[[MCTSExplorationEvent], Coroutine[Any, Any, None]]


class LLMRolloutEvaluator(Protocol):
    def evaluate_state(self, state_str: str) -> float:
        """Evaluate a state using LLM and return a value between 0 and 1."""
        ...


def get_node_depth(node: MCTSNode) -> int:
    """Calculate the depth of a node in the tree."""
    depth = 0
    current = node
    while current.parent:
        depth += 1
        current = current.parent
    return depth


def get_children_ids(node: MCTSNode) -> List[str]:
    """Get list of children node IDs."""
    return [str(id(child)) for child in node.children]


async def mcts_search(
    initial_state: State,
    get_actions_func: Callable[[State], List[Action]],
    transition_func: Callable[[State, Action], State],
    llm_evaluator: LLMRolloutEvaluator,
    n_iterations: int = 100,
    exploration_weight: float = 1.4,
    max_depth: int = 10,
    event_callback: Optional[EventCallback] = None,
) -> Tuple[Optional[Action], MCTSNode[State, Action]]:
    """
    Perform MCTS search with LLM-based rollout evaluation and event streaming.
    """
    root = MCTSNode(initial_state)
    all_nodes: Dict[str, MCTSNode] = {str(id(root)): root}
    current_max_depth = 0

    async def emit_event(
        event_type: str,
        node: MCTSNode,
        metadata: Optional[dict] = None,
        status: str = "exploring",
        evaluation_score: Optional[float] = None,
    ):
        if event_callback:
            node_depth = get_node_depth(node)
            current_max_depth = max(node_depth, current_max_depth)

            await event_callback(
                MCTSExplorationEvent(
                    event_type=event_type,
                    node=MCTSNodeUpdate(
                        node_id=str(id(node)),
                        parent_id=str(id(node.parent)) if node.parent else None,
                        state=str(node.state),
                        visits=node.visits,
                        value=node.value,
                        action_taken=str(node.action_taken)
                        if node.action_taken
                        else None,
                        depth=node_depth,
                        children_ids=get_children_ids(node),
                        status=status,
                        evaluation_score=evaluation_score,
                    ),
                    metadata=metadata,
                    total_nodes=len(all_nodes),
                    max_depth=current_max_depth,
                )
            )

    # Initialize root node
    root_value = llm_evaluator.evaluate_state(str(initial_state))
    root.update(root_value)
    await emit_event(
        "initialization", root, status="complete", evaluation_score=root_value
    )

    for iteration in range(n_iterations):
        node = root
        path = []

        # Selection
        while node.is_fully_expanded(get_actions_func) and node.children:
            node = node.best_child(exploration_weight)
            path.append(node)
            await emit_event("selection", node)

        # Expansion
        if not node.is_fully_expanded(get_actions_func):
            new_node = node.expand(get_actions_func, transition_func)
            if new_node:
                node = new_node
                all_nodes[str(id(node))] = node
                path.append(node)
                await emit_event("expansion", node)

        # Evaluation
        await emit_event("evaluation", node, status="evaluating")
        value = llm_evaluator.evaluate_state(str(node.state))
        await emit_event(
            "evaluation",
            node,
            metadata={"evaluation_value": value},
            status="complete",
            evaluation_score=value,
        )

        # Backpropagation
        for n in path:
            prev_value = n.value
            prev_visits = n.visits
            n.update(value)
            await emit_event(
                "backprop",
                n,
                metadata={
                    "value_delta": n.value - prev_value,
                    "visits_delta": n.visits - prev_visits,
                },
                status="complete",
                evaluation_score=n.value / max(n.visits, 1),
            )

    try:
        best_child = root.most_visited_child()
        return best_child.action_taken, root
    except ValueError:
        logging.warning("No valid actions found during search")
        return None, root
