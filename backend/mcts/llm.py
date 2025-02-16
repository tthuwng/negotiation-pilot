import logging
import time
from functools import lru_cache
from typing import Any, Dict, List, Optional, Set

from together import Together

import wandb  # make sure to install wandb: pip install wandb

# Global initialization in main.py (or at the top of your application)
if wandb.run is None:
    wandb.init(
        project="negotiation-copilot",
        config={
            "learning_rate": 0.02,
            "architecture": "CNN",
            "dataset": "CIFAR-100",
            "epochs": 10,
        },
    )


class TogetherLLMEvaluator:
    def __init__(
        self,
        api_key: Optional[str] = None,
        model: str = "meta-llama/Llama-3.3-70B-Instruct-Turbo-Free",
        system_prompt: Optional[str] = None,
        generation_prompt: Optional[str] = None,
        min_delay: float = 0.1,
        cache_size: int = 1000,
    ) -> None:
        # For demonstration, a hard-coded API key is used
        self.api_key = (
            "75c648f845ed1d8ce2ac74f471f7eb5f9d2c8627934567d8c0357d9279133061"
        )
        if not self.api_key:
            raise ValueError("Together API key not found")

        self.client = Together(api_key=self.api_key)
        self.model = model
        self.system_prompt = system_prompt
        self.generation_prompt = generation_prompt
        self.last_call_time = 0.0
        self.min_delay = min_delay
        self.cache: Dict[str, List[str]] = {}
        self.response_count = 0
        self.evaluation_cache: Dict[str, float] = {}
        self.seen_states: Set[str] = set()

        # Dictionary to store per-user interaction logs
        self.user_interactions: Dict[str, List[Dict[str, Any]]] = {}

    def log_user_interaction(
        self, user_id: str, action: str, data: Dict[str, Any]
    ) -> None:
        """Log an interaction for a given user both locally and to W&B."""
        log_entry = {
            "user_id": user_id,
            "action": action,
            "data": data,
            "timestamp": time.time(),
        }
        # Log to console or file if needed
        logging.info(f"User Interaction: {log_entry}")
        # Log to W&B
        wandb.log(log_entry)

        # Store locally for additional processing if needed
        if user_id not in self.user_interactions:
            self.user_interactions[user_id] = []
        self.user_interactions[user_id].append(log_entry)

    def _rate_limit(self) -> None:
        """Implement rate limiting between API calls."""
        now = time.time()
        time_since_last = now - self.last_call_time
        if time_since_last < self.min_delay:
            time.sleep(self.min_delay - time_since_last)
        self.last_call_time = time.time()

    def _call_api(
        self,
        messages: List[Dict[str, str]],
        temperature: float = 0.7,
        max_tokens: Optional[int] = None,
        max_retries: int = 2,
        retry_delay: float = 0.5,
    ) -> str:
        """Make API call with retries and rate limiting."""
        last_error = None
        for attempt in range(max_retries):
            try:
                self._rate_limit()
                kwargs = {
                    "model": self.model,
                    "messages": messages,
                    "temperature": temperature,
                }
                if max_tokens:
                    kwargs["max_tokens"] = max_tokens

                response = self.client.chat.completions.create(**kwargs)
                return response.choices[0].message.content.strip()

            except Exception as e:
                last_error = e
                if attempt == max_retries - 1:
                    msg = f"API call failed after {max_retries} attempts"
                    logging.error(f"{msg}: {e}")
                    raise RuntimeError(msg) from e
                logging.warning(f"API call attempt {attempt + 1} failed")
                time.sleep(retry_delay * (attempt + 1))
        raise RuntimeError("API call failed") from last_error

    @lru_cache(maxsize=1000)
    def generate_responses(
        self, state_str: str, n: int = 3, user_id: Optional[str] = None
    ) -> List[str]:
        """Generate possible responses for the current state with caching."""
        # Check cache first
        if state_str in self.cache:
            responses = self.cache[state_str]
            if user_id:
                self.log_user_interaction(
                    user_id, "generate_responses_cache_hit", {"state": state_str}
                )
            return responses

        self.response_count += 1
        logging.info(
            f"[Response Generation #{self.response_count}]\nState:\n{state_str}"
        )
        if user_id:
            self.log_user_interaction(
                user_id, "generate_responses_start", {"state": state_str}
            )

        messages = [
            {"role": "system", "content": self.generation_prompt},
            {
                "role": "user",
                "content": (
                    f"Given this conversation state:\n{state_str}\n\n"
                    f"Generate {n} different possible responses that would help achieve the conversation goal. "
                    "Each response should be strategic and different.\n"
                    "Format: Return ONLY the responses, one per line."
                ),
            },
        ]

        try:
            result = self._call_api(messages, temperature=0.7, max_tokens=150)
            responses = [r.strip() for r in result.split("\n") if r.strip()][:n]
            # Cache the results
            self.cache[state_str] = responses

            if user_id:
                self.log_user_interaction(
                    user_id, "generate_responses_end", {"responses": responses}
                )

            return responses

        except Exception as e:
            logging.error(f"Response generation error: {e}")
            return self._get_fallback_responses(n)

    def _get_fallback_responses(self, n: int) -> List[str]:
        """Get fallback responses when API fails."""
        fallbacks = [
            "I need more information to proceed.",
            "Could we clarify the current situation?",
            "Let's discuss this further.",
        ]
        return fallbacks[:n]

    @lru_cache(maxsize=1000)
    def evaluate_state(self, state_str: str, user_id: Optional[str] = None) -> float:
        """Evaluate a state using LLM with caching."""
        if state_str in self.evaluation_cache:
            value = self.evaluation_cache[state_str]
            if user_id:
                self.log_user_interaction(
                    user_id,
                    "evaluate_state_cache_hit",
                    {"state": state_str, "evaluation": value},
                )
            return value

        if user_id:
            self.log_user_interaction(
                user_id, "evaluate_state_start", {"state": state_str}
            )

        # Record that this state has been seen
        self.seen_states.add(state_str)

        messages = [
            {"role": "system", "content": self.system_prompt},
            {
                "role": "user",
                "content": (
                    f"Evaluate this conversation state:\n{state_str}\n\n"
                    "Consider:\n1. Progress toward goal\n2. Professional tone\n3. Strategic effectiveness\n\n"
                    "Respond with ONLY a number between 0 and 1."
                ),
            },
        ]

        try:
            result = self._call_api(messages, temperature=0.1)
            try:
                value = float(result)
                value = max(0.0, min(1.0, value))
                self.evaluation_cache[state_str] = value
                if user_id:
                    self.log_user_interaction(
                        user_id, "evaluate_state_end", {"evaluation": value}
                    )
                return value
            except ValueError:
                logging.warning(f"Could not parse value from result: {result}")
                return 0.5

        except Exception as e:
            logging.error(f"State evaluation error: {e}")
            return 0.5
