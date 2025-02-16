import asyncio
from typing import Dict, List

from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from starlette.websockets import WebSocketState

from mcts.llm import TogetherLLMEvaluator
from mcts.search import mcts_search
from models import (
    BossChatRequest,
    BossChatResponse,
    MCTSExplorationEvent,
    NegotiationRequest,
    NegotiationResponse,
)

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize LLM evaluator
llm = TogetherLLMEvaluator(
    system_prompt=(
        "You are an expert negotiation evaluator. "
        "Given a conversation state with a goal and message history, "
        "evaluate how well the conversation is progressing towards "
        "achieving the negotiation goal on a scale from 0 to 1."
    ),
    generation_prompt=(
        "You are an expert negotiator. Generate strategic and extremely concise responses (max 2 sentences) "
        "that are professional, persuasive, and goal-oriented. "
        "Consider the context and history to craft effective messages "
        "that move towards the negotiation goal."
    ),
    min_delay=0.1,
    cache_size=1000,
)

# Initialize bossy manager LLM
bossy_llm = TogetherLLMEvaluator(
    system_prompt=(
        "You are a bossy and demanding manager in a workplace conversation. "
        "You are direct, sometimes impatient, and focused on business results. "
        "While professional, you tend to be skeptical of requests and need strong convincing. "
        "You value efficiency and don't like excuses."
    ),
    generation_prompt=(
        "As a bossy manager, respond very humanly and extremely concisely (max 2 sentences) to the conversation in a direct and slightly impatient manner. "
        "Be professional but show your authority and skepticism. Your responses should reflect "
        "your focus on business results and efficiency."
    ),
    min_delay=0.1,
    cache_size=1000,
)


class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.connection_states: Dict[str, dict] = {}
        self.node_batches: Dict[str, List[dict]] = {}
        self.batch_size = 10
        self.batch_interval = 0.1  # seconds

    async def connect(self, websocket: WebSocket) -> str:
        await websocket.accept()
        connection_id = str(id(websocket))
        self.active_connections[connection_id] = websocket
        self.connection_states[connection_id] = {
            "last_event_id": None,
            "is_processing": False,
            "event_count": 0,
            "nodes": {},
        }
        self.node_batches[connection_id] = []
        return connection_id

    def disconnect(self, websocket: WebSocket) -> None:
        connection_id = str(id(websocket))
        if connection_id in self.active_connections:
            del self.active_connections[connection_id]
        if connection_id in self.connection_states:
            del self.connection_states[connection_id]
        if connection_id in self.node_batches:
            del self.node_batches[connection_id]

    async def send_node_batch(self, connection_id: str) -> None:
        """Send accumulated node updates as a batch."""
        if (
            connection_id in self.active_connections
            and connection_id in self.node_batches
            and self.node_batches[connection_id]
        ):
            websocket = self.active_connections[connection_id]
            if websocket.application_state == WebSocketState.CONNECTED:
                try:
                    # Prepare batch event
                    batch_event = {
                        "event_type": "node_batch",
                        "nodes": self.node_batches[connection_id],
                        "total_nodes": len(
                            self.connection_states[connection_id]["nodes"]
                        ),
                        "max_depth": max(
                            (
                                n.get("depth", 0)
                                for n in self.connection_states[connection_id][
                                    "nodes"
                                ].values()
                            ),
                            default=0,
                        ),
                    }
                    await websocket.send_json(batch_event)
                    self.node_batches[connection_id] = []
                except Exception as e:
                    print(f"Error sending batch: {e}")

    async def add_node_update(self, websocket: WebSocket, node: dict) -> None:
        """Add node update to batch and send if batch is full."""
        connection_id = str(id(websocket))
        if connection_id in self.node_batches:
            # Update node tracking
            if connection_id in self.connection_states:
                self.connection_states[connection_id]["nodes"][node["node_id"]] = node

            # Add to batch
            self.node_batches[connection_id].append(node)

            # Send batch if full
            if len(self.node_batches[connection_id]) >= self.batch_size:
                await self.send_node_batch(connection_id)

    async def send_event(self, websocket: WebSocket, event: dict) -> bool:
        """Send non-node events immediately."""
        connection_id = str(id(websocket))
        if (
            websocket.application_state == WebSocketState.CONNECTED
            and connection_id in self.active_connections
        ):
            try:
                if "node" in event:
                    await self.add_node_update(websocket, event["node"])
                    return True
                elif "nodes" in event:
                    # Handle batch node updates
                    for node in event["nodes"]:
                        await self.add_node_update(websocket, node)
                    return True
                else:
                    # For non-node events, send immediately
                    await websocket.send_json(event)
                    return True
            except Exception as e:
                print(f"Error sending event: {e}")
                return False
        return False


manager = ConnectionManager()


@app.websocket("/ws/mcts")
async def mcts_exploration(websocket: WebSocket):
    connection_id = await manager.connect(websocket)
    mcts_task = None
    batch_task = None

    try:
        # Start batch sending task
        async def send_batches():
            while True:
                await asyncio.sleep(manager.batch_interval)
                await manager.send_node_batch(connection_id)

        batch_task = asyncio.create_task(send_batches())

        # Receive initial negotiation request
        data = await websocket.receive_json()
        request = NegotiationRequest(**data)

        # Define event callback for MCTS exploration
        async def on_exploration_event(event: MCTSExplorationEvent):
            if connection_id in manager.active_connections:
                await manager.send_event(websocket, event.dict())

        # Run MCTS search in a separate task
        async def run_mcts():
            try:
                state_str = f"Goal: {request.goal}\nMessages: {request.messages}"
                best_action, root = await mcts_search(
                    initial_state=state_str,
                    get_actions_func=lambda s: llm.generate_responses(s, n=3),
                    transition_func=lambda s, a: f"{s}\n{a}",
                    llm_evaluator=llm,
                    n_iterations=50,
                    exploration_weight=1.4,
                    max_depth=4,
                    event_callback=on_exploration_event,
                )

                if connection_id in manager.active_connections:
                    # Send final batch of nodes
                    await manager.send_node_batch(connection_id)

                    # Send completion event
                    final_event = {
                        "event_type": "complete",
                        "metadata": {
                            "options": llm.generate_responses(state_str, n=3),
                            "scores": [llm.evaluate_state(state_str)],
                        },
                        "total_nodes": len(
                            manager.connection_states[connection_id]["nodes"]
                        ),
                        "max_depth": max(
                            (
                                n.get("depth", 0)
                                for n in manager.connection_states[connection_id][
                                    "nodes"
                                ].values()
                            ),
                            default=0,
                        ),
                    }
                    await manager.send_event(websocket, final_event)

            except Exception as e:
                if connection_id in manager.active_connections:
                    await manager.send_event(
                        websocket,
                        {
                            "event_type": "error",
                            "metadata": {"message": str(e)},
                            "total_nodes": 0,
                            "max_depth": 0,
                        },
                    )
            finally:
                if connection_id in manager.connection_states:
                    manager.connection_states[connection_id]["is_processing"] = False

        # Start MCTS search in background
        mcts_task = asyncio.create_task(run_mcts())

    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        if connection_id in manager.active_connections:
            await manager.send_event(
                websocket,
                {
                    "event_type": "error",
                    "metadata": {"message": str(e)},
                    "total_nodes": 0,
                    "max_depth": 0,
                },
            )
        manager.disconnect(websocket)
    finally:
        # Clean up tasks
        if mcts_task and not mcts_task.done():
            mcts_task.cancel()
        if batch_task and not batch_task.done():
            batch_task.cancel()
        manager.disconnect(websocket)


@app.post("/negotiate", response_model=NegotiationResponse)
async def negotiate(request: NegotiationRequest) -> NegotiationResponse:
    """
    Generate negotiation responses based on the current conversation state.
    """
    try:
        # Get state evaluation
        state_str = f"Goal: {request.goal}\nMessages: {request.messages}"
        state_evaluation = llm.evaluate_state(state_str)

        # Generate response options
        options = llm.generate_responses(state_str, n=3)

        if not options:
            raise HTTPException(
                status_code=400, detail="No valid response options available"
            )

        return NegotiationResponse(options=options, state_evaluation=state_evaluation)

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error processing request: {str(e)}"
        )


@app.post("/chat/boss", response_model=BossChatResponse)
async def chat_with_boss(request: BossChatRequest) -> BossChatResponse:
    """
    Generate a single response from the bossy manager character.
    This endpoint is separate from the negotiation logic and just provides
    character-based responses.
    """
    try:
        messages = [
            {"role": "system", "content": bossy_llm.system_prompt},
            {
                "role": "user",
                "content": f"Given this conversation:\n{request.messages}\n\nRespond as the bossy manager:",
            },
        ]

        response = bossy_llm._call_api(messages, temperature=0.8)
        return BossChatResponse(response=response)

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error processing request: {str(e)}"
        )


@app.get("/health")
async def health_check() -> dict:
    """Health check endpoint."""
    return {"status": "healthy"}
