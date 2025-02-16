from fastapi import FastAPI, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from starlette.websockets import WebSocketState

from mcts.llm import TogetherLLMEvaluator
from mcts.search import mcts_search
from models import MCTSExplorationEvent, NegotiationRequest, NegotiationResponse

app = FastAPI()

# Add CORS middleware with more specific configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Add your frontend URL
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
        "You are an expert negotiator. Generate strategic responses "
        "that are professional, persuasive, and goal-oriented. "
        "Consider the context and history to craft effective messages "
        "that move towards the negotiation goal."
    ),
    min_delay=0.1,
    cache_size=1000,
)


class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def send_event(self, websocket: WebSocket, event: dict):
        if websocket.application_state == WebSocketState.CONNECTED:
            try:
                await websocket.send_json(event)
            except RuntimeError:
                # Connection might have been closed during send
                self.disconnect(websocket)


manager = ConnectionManager()


@app.websocket("/ws/mcts")
async def mcts_exploration(websocket: WebSocket):
    await manager.connect(websocket)

    try:
        # Receive initial negotiation request
        data = await websocket.receive_json()
        request = NegotiationRequest(**data)

        # Define event callback for MCTS exploration
        async def on_exploration_event(event: MCTSExplorationEvent):
            await manager.send_event(websocket, event.dict())

        # Run MCTS search with event streaming
        state_str = f"Goal: {request.goal}\nMessages: {request.messages}"
        best_action, root = await mcts_search(
            initial_state=state_str,
            get_actions_func=lambda s: llm.generate_responses(s, n=3),
            transition_func=lambda s, a: f"{s}\n{a}",
            llm_evaluator=llm,
            n_iterations=10,
            exploration_weight=1.4,
            max_depth=3,
            event_callback=on_exploration_event,
        )

        # Send final results
        await manager.send_event(
            websocket,
            {
                "event_type": "complete",
                "best_action": best_action,
                "options": llm.generate_responses(state_str, n=3),
                "state_evaluation": llm.evaluate_state(state_str),
            },
        )

    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        await manager.send_event(websocket, {"event_type": "error", "message": str(e)})
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


@app.get("/health")
async def health_check() -> dict:
    """Health check endpoint."""
    return {"status": "healthy"}
    return {"status": "healthy"}
