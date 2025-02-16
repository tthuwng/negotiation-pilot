from typing import Optional

import graphviz

from .node import MCTSNode


def create_mcts_graph(
    root: MCTSNode, max_depth: int = 5, max_width: int = 10
) -> graphviz.Digraph:
    """
    Create a Graphviz visualization of the MCTS tree.

    Args:
        root: Root node of the MCTS tree
        max_depth: Maximum depth to visualize
        max_width: Maximum number of children to show per node

    Returns:
        Graphviz digraph object
    """
    dot = graphviz.Digraph(comment="MCTS Tree")
    dot.attr(rankdir="TB")

    def format_state(state_str: str, max_len: int = 50) -> str:
        """Format state string for display."""
        lines = state_str.split("\n")
        formatted = []
        for line in lines:
            if len(line) > max_len:
                formatted.append(line[:max_len] + "...")
            else:
                formatted.append(line)
        return "\\n".join(formatted[:5])

    def add_node(
        node: MCTSNode, depth: int = 0, parent_id: Optional[str] = None
    ) -> None:
        if depth >= max_depth:
            return

        node_id = str(id(node))
        state_display = format_state(str(node.state))

        label = (
            f"{state_display}\\n" f"Visits: {node.visits}\\n" f"Value: {node.value:.2f}"
        )

        dot.node(node_id, label, shape="box", style="rounded")

        if parent_id:
            action_str = str(node.action_taken)
            if len(action_str) > 30:
                action_str = action_str[:27] + "..."
            dot.edge(parent_id, node_id, label=action_str)

        sorted_children = sorted(node.children, key=lambda n: n.visits, reverse=True)[
            :max_width
        ]

        for child in sorted_children:
            add_node(child, depth + 1, node_id)

    add_node(root)
    return dot


def save_mcts_visualization(
    root: MCTSNode,
    filename: str = "mcts_tree",
    format: str = "png",
    max_depth: int = 5,
    max_width: int = 10,
) -> None:
    """
    Save MCTS tree visualization to a file.

    Args:
        root: Root node of the MCTS tree
        filename: Output filename (without extension)
        format: Output format (png, pdf, svg)
        max_depth: Maximum depth to visualize
        max_width: Maximum number of children to show per node
    """
    dot = create_mcts_graph(root, max_depth, max_width)
    dot.render(filename, format=format, cleanup=True)
