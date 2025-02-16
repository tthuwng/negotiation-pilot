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


def create_node_update(
    node: MCTSNode, status: str, evaluation_score: Optional[float] = None
) -> MCTSNodeUpdate:
    """Create a node update event."""
    return MCTSNodeUpdate(
        node_id=str(id(node)),
        parent_id=str(id(node.parent)) if node.parent else None,
        state=str(node.state),
        visits=node.visits,
        value=node.value,
        action_taken=str(node.action_taken) if node.action_taken else None,
        depth=get_node_depth(node),
        children_ids=get_children_ids(node),
        status=status,
        evaluation_score=evaluation_score,
    )


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
        include_all_nodes: bool = False,
    ):
        """Emit an event with optional node batch update."""
        if event_callback:
            nonlocal current_max_depth
            node_depth = get_node_depth(node)
            current_max_depth = max(node_depth, current_max_depth)

            # Always include the current node and its ancestors in updates
            nodes_to_update = []
            current = node
            while current:
                nodes_to_update.append(
                    create_node_update(
                        current, current.status, current.evaluation_score
                    )
                )
                current = current.parent

            # For certain events, include all nodes
            if include_all_nodes:
                nodes_to_update.extend(
                    [
                        create_node_update(n, n.status, n.evaluation_score)
                        for n in all_nodes.values()
                        if str(id(n)) not in {str(id(node)) for node in nodes_to_update}
                    ]
                )

            event = MCTSExplorationEvent(
                event_type=event_type,
                node=create_node_update(node, status, evaluation_score),
                nodes=nodes_to_update,
                metadata=metadata,
                total_nodes=len(all_nodes),
                max_depth=current_max_depth,
                state_evaluation=evaluation_score,
            )
            await event_callback(event)

    # Initialize root node
    root_value = llm_evaluator.evaluate_state(str(initial_state))
    root.update(root_value)
    root.evaluation_score = root_value
    root.status = "complete"
    await emit_event(
        "initialization",
        root,
        status="complete",
        evaluation_score=root_value,
        include_all_nodes=True,
    )

    for iteration in range(n_iterations):
        node = root
        path = []

        # Selection
        while node.is_fully_expanded(get_actions_func) and node.children:
            node = node.best_child(exploration_weight)
            path.append(node)
            node.status = "exploring"
            await emit_event("selection", node)

        # Expansion
        if not node.is_fully_expanded(get_actions_func):
            new_node = node.expand(get_actions_func, transition_func)
            if new_node:
                node = new_node
                all_nodes[str(id(node))] = node
                path.append(node)
                node.status = "exploring"
                await emit_event("expansion", node, include_all_nodes=True)

        # Evaluation
        node.status = "evaluating"
        await emit_event("evaluation", node, status="evaluating")
        value = llm_evaluator.evaluate_state(str(node.state))
        node.evaluation_score = value
        node.status = "complete"
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
            n.status = "complete"
            n.evaluation_score = n.value / max(n.visits, 1)
            await emit_event(
                "backprop",
                n,
                metadata={
                    "value_delta": n.value - prev_value,
                    "visits_delta": n.visits - prev_visits,
                },
                status="complete",
                evaluation_score=n.evaluation_score,
            )

    try:
        best_child = root.most_visited_child()
        # Send final complete event with all nodes
        await emit_event(
            "complete",
            root,
            metadata={
                "best_action": str(best_child.action_taken),
                "best_value": best_child.value / best_child.visits,
            },
            status="complete",
            evaluation_score=root.evaluation_score,
            include_all_nodes=True,
        )
        return best_child.action_taken, root
    except ValueError:
        logging.warning("No valid actions found during search")
        return None, root
