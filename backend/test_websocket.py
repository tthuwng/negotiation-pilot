import asyncio
import json
from typing import Dict, Optional

import websockets
from rich.console import Console
from rich.tree import Tree


class MCTSVisualizer:
    def __init__(self) -> None:
        self.console = Console()
        self.nodes: Dict[str, Dict] = {}
        self.root_id: Optional[str] = None

    def update_node(self, node_data: Dict) -> None:
        node_id = node_data["node_id"]
        self.nodes[node_id] = node_data
        if not node_data["parent_id"]:
            self.root_id = node_id

    def display_tree(self) -> None:
        if not self.root_id or not self.nodes:
            self.console.print("[yellow]Waiting for nodes...[/]")
            return

        tree = Tree(
            f"[bold blue]Root Node {self.root_id[:8]}[/]\n"
            f"Value: {self.nodes[self.root_id]['value']:.3f}\n"
            f"Visits: {self.nodes[self.root_id]['visits']}"
        )
        self._add_children(self.root_id, tree)

        self.console.clear()
        self.console.print(tree)

    def _add_children(self, node_id: str, tree: Tree) -> None:
        children = [n for n in self.nodes.values() if n["parent_id"] == node_id]
        for child in children:
            child_tree = tree.add(
                f"[green]Node {child['node_id'][:8]}[/]\n"
                f"Value: {child['value']:.3f}\n"
                f"Visits: {child['visits']}\n"
                f"Action: {child['action_taken']}"
            )
            self._add_children(child["node_id"], child_tree)


async def test_mcts_websocket() -> None:
    visualizer = MCTSVisualizer()
    uri = "ws://localhost:8000/ws/mcts"

    async with websockets.connect(uri) as websocket:
        # Send initial negotiation request
        await websocket.send(
            json.dumps(
                {
                    "goal": "Negotiate a project deadline extension from 2 weeks to 4 weeks",
                    "messages": ["Hello, I'd like to discuss the project timeline."],
                    "current_turn": 0,
                }
            )
        )

        while True:
            try:
                message = await websocket.recv()
                data = json.loads(message)

                if data["event_type"] == "error":
                    print(f"Error: {data['message']}")
                    break

                if data["event_type"] == "complete":
                    print("\nSearch complete!")
                    print(f"Best action: {data['best_action']}")
                    print("\nResponse options:")
                    for i, opt in enumerate(data["options"], 1):
                        print(f"{i}. {opt}")
                    break

                # Update visualization for exploration events
                if "node" in data:
                    visualizer.update_node(data["node"])
                    visualizer.display_tree()

            except Exception as e:
                print(f"Error: {str(e)}")
                break


if __name__ == "__main__":
    asyncio.run(test_mcts_websocket())
