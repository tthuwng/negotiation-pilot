import logging
from dataclasses import dataclass
from typing import List, Optional

from mcts.llm import TogetherLLMEvaluator
from mcts.search import mcts_search
from mcts.viz import save_mcts_visualization


def setup_logging(level: int = logging.INFO) -> None:
    """Configure logging format and level."""
    logging.basicConfig(
        level=level,
        format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%H:%M:%S",
    )


@dataclass
class ConversationState:
    """Represents a state in a goal-oriented conversation."""

    goal: str
    messages: List[str]
    max_turns: int = 5
    current_turn: int = 0

    def __str__(self) -> str:
        history = "\n  ".join(self.messages) if self.messages else "No messages"
        return (
            f"Goal: {self.goal}\n"
            f"History:\n  {history}\n"
            f"Turn: {self.current_turn}/{self.max_turns}"
        )


def get_actions(
    state: ConversationState, llm_evaluator: TogetherLLMEvaluator
) -> List[str]:
    """Get possible response actions using LLM."""
    if state.current_turn >= state.max_turns:
        return []
    return llm_evaluator.generate_responses(str(state), n=3)


def transition(state: ConversationState, action: str) -> ConversationState:
    """Apply a response action to get new state."""
    return ConversationState(
        goal=state.goal,
        messages=state.messages + [action],
        max_turns=state.max_turns,
        current_turn=state.current_turn + 1,
    )


def display_options(options: List[str]) -> None:
    """Display response options to user."""
    print("\nAvailable responses:")
    for i, option in enumerate(options, 1):
        print(f"{i}. {option}")


def get_user_choice(options: List[str]) -> Optional[str]:
    """Get user's choice of response or custom input."""
    while True:
        choice = input(
            "\nSelect response (1-3) or type your own response (or 'q' to quit): "
        )
        if choice.lower() == "q":
            return None
        if choice.isdigit() and 1 <= int(choice) <= len(options):
            return options[int(choice) - 1]
        if choice.strip():
            return choice.strip()
        print("Invalid choice. Please try again.")


def display_conversation(state: ConversationState) -> None:
    """Display current conversation state."""
    print("\nCurrent Conversation:")
    print("-" * 40)
    print(f"Goal: {state.goal}")
    print("\nHistory:")
    for i, msg in enumerate(state.messages, 1):
        role = "You" if i % 2 == 0 else "Other"
        print(f"{role}: {msg}")
    print("-" * 40)


def main() -> None:
    setup_logging(level=logging.INFO)
    logging.info("Starting interactive negotiation chat...")

    # Initialize LLM evaluator with aggressive caching
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
        min_delay=0.1,  # Reduced delay between API calls
        cache_size=1000,  # Increased cache size
    )

    # Initialize conversation
    initial_state = ConversationState(
        goal="Negotiate a project deadline extension from 2 weeks to 4 weeks",
        messages=["Hello, I'd like to discuss the project timeline with you."],
        max_turns=5,
    )

    current_state = initial_state
    turn_count = 0
    save_viz = input("Would you like to save visualizations? (y/n): ").lower() == "y"

    while turn_count < initial_state.max_turns:
        display_conversation(current_state)

        # Run MCTS to get best responses with reduced parameters
        def get_actions_with_llm(state: ConversationState) -> List[str]:
            return get_actions(state, llm)

        best_action, root = mcts_search(
            initial_state=current_state,
            get_actions_func=get_actions_with_llm,
            transition_func=transition,
            llm_evaluator=llm,
            n_iterations=5,  # Reduced from 10
            max_depth=2,  # Reduced from 3
        )

        if best_action is None:
            print("\nNo valid responses generated. Ending conversation...")
            break

        # Get top 3 responses from MCTS
        top_children = sorted(root.children, key=lambda n: n.visits, reverse=True)[:3]
        options = [c.action_taken for c in top_children if c.action_taken is not None]

        if not options:
            print("\nNo valid response options available. Ending conversation...")
            break

        # Save visualization only if requested
        if save_viz:
            save_mcts_visualization(
                root,
                filename=f"negotiation_tree_turn_{turn_count}",
                max_depth=2,
                max_width=3,
            )

        # Display options and get user choice
        display_options(options)
        user_response = get_user_choice(options)

        if user_response is None:
            print("\nEnding conversation...")
            break

        # Update state with user's response
        current_state = transition(current_state, user_response)
        turn_count += 1

        if turn_count >= initial_state.max_turns:
            print("\nReached maximum number of turns.")
            break

    print("\nFinal conversation state:")
    display_conversation(current_state)


if __name__ == "__main__":
    main()
