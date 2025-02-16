from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from mcts.llm import TogetherLLMEvaluator
from models import NegotiationRequest, NegotiationResponse

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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
