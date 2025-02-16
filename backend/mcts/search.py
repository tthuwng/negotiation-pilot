import logging
from typing import Callable, List, Protocol, Tuple, TypeVar

from .node import MCTSNode

State = TypeVar("State")
Action = TypeVar("Action")


class LLMRolloutEvaluator(Protocol):
    def evaluate_state(self, state_str: str) -> float:
        """Evaluate a state using LLM and return a value between 0 and 1."""
        ...


def mcts_search(
    initial_state: State,
    get_actions_func: Callable[[State], List[Action]],
    transition_func: Callable[[State, Action], State],
    llm_evaluator: LLMRolloutEvaluator,
    n_iterations: int = 100,
    exploration_weight: float = 1.4,
    max_depth: int = 10,
) -> Tuple[Action, MCTSNode[State, Action]]:
    """
    Perform MCTS search with LLM-based rollout evaluation.

    Args:
        initial_state: Starting state
        get_actions_func: Function that returns list of valid actions
        transition_func: Function that returns new state after action
        llm_evaluator: LLM-based evaluator for rollouts
        n_iterations: Number of MCTS iterations
        exploration_weight: UCB exploration parameter
        max_depth: Maximum depth for rollouts

    Returns:
        Tuple of (best_action, root_node)
    """
    root = MCTSNode(initial_state)
    logging.info(f"Starting MCTS search with {n_iterations} iterations")

    # Initialize root node with first evaluation
    root_value = llm_evaluator.evaluate_state(str(initial_state))
    root.update(root_value)

    # Early stopping if we find a very good solution
    best_value = root_value
    no_improvement_count = 0
    early_stop_threshold = 0.95
    patience = 3

    for iteration in range(n_iterations):
        node = root
        path = []

        # Selection and Expansion
        depth = 0
        while depth < max_depth:
            if not node.is_fully_expanded(get_actions_func):
                # Expand node
                new_node = node.expand(get_actions_func, transition_func)
                if new_node:
                    node = new_node
                    path.append(node)
                break
            try:
                node = node.best_child(exploration_weight)
                path.append(node)
            except ValueError:
                # No children available
                break
            depth += 1

        # Evaluation
        if not node.visits:  # Only evaluate if not visited before
            value = llm_evaluator.evaluate_state(str(node.state))
        else:
            value = node.value / node.visits

        # Early stopping check
        if value > best_value:
            best_value = value
            no_improvement_count = 0
        else:
            no_improvement_count += 1

        # Backpropagation
        for n in path:
            n.update(value)

        # Early stopping if we found a very good solution
        if best_value > early_stop_threshold and no_improvement_count >= patience:
            logging.info(
                f"Early stopping at iteration {iteration + 1}: "
                f"Found solution with value {best_value:.3f}"
            )
            break

    # Ensure root has children before selecting best
    if not root.children:
        # Force expansion if no children
        new_node = root.expand(get_actions_func, transition_func)
        if new_node:
            value = llm_evaluator.evaluate_state(str(new_node.state))
            new_node.update(value)

    try:
        best_child = root.most_visited_child()
        return best_child.action_taken, root
    except ValueError:
        # If still no valid children, return None
        logging.warning("No valid actions found during search")
        return None, root
