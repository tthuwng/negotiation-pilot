import logging
import os
import time
from functools import lru_cache
from typing import Dict, List, Optional, Set

from together import Together


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
        self.api_key = "75c648f845ed1d8ce2ac74f471f7eb5f9d2c8627934567d8c0357d9279133061"
        if not self.api_key:
            raise ValueError("Together API key not found")

        self.client = Together(api_key=self.api_key)
        self.model = model
        self.system_prompt = system_prompt or (
            "You are an expert conversation evaluator. "
            "Given a conversation state with a goal and message history, "
            "evaluate how well the conversation is progressing towards "
            "the goal on a scale from 0 to 1."
        )
        self.generation_prompt = generation_prompt or (
            "You are an expert conversationalist. "
            "Given a conversation goal and history, generate appropriate "
            "next responses that would help achieve the goal effectively. "
            "Be strategic, professional, and context-aware."
        )
        self.last_call_time = 0.0
        self.min_delay = min_delay
        self.cache: Dict[str, List[str]] = {}
        self.response_count = 0
        self.evaluation_cache: Dict[str, float] = {}
        self.seen_states: Set[str] = set()

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
        max_retries: int = 2,  # Reduced retries
        retry_delay: float = 0.5,  # Reduced delay
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
    def generate_responses(self, state_str: str, n: int = 3) -> List[str]:
        """Generate possible responses for the current state with caching."""
        # Check cache first
        if state_str in self.cache:
            return self.cache[state_str]

        self.response_count += 1
        logging.info(
            f"[Response Generation #{self.response_count}]" f"\nState:\n{state_str}"
        )

        messages = [
            {"role": "system", "content": self.generation_prompt},
            {
                "role": "user",
                "content": (
                    f"Given this conversation state:\n{state_str}\n\n"
                    f"Generate {n} different possible responses "
                    "that would help achieve the conversation goal. "
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
    def evaluate_state(self, state_str: str) -> float:
        """Evaluate a state using LLM with caching."""
        # Check if we've seen this state before
        if state_str in self.evaluation_cache:
            return self.evaluation_cache[state_str]

        # Add to seen states
        self.seen_states.add(state_str)

        messages = [
            {"role": "system", "content": self.system_prompt},
            {
                "role": "user",
                "content": (
                    f"Evaluate this conversation state:\n{state_str}\n\n"
                    "Consider:\n"
                    "1. Progress toward goal\n"
                    "2. Professional tone\n"
                    "3. Strategic effectiveness\n\n"
                    "Respond with ONLY a number between 0 and 1."
                ),
            },
        ]

        try:
            result = self._call_api(messages, temperature=0.1)
            try:
                value = float(result)
                value = max(0.0, min(1.0, value))
                # Cache the result
                self.evaluation_cache[state_str] = value
                return value
            except ValueError:
                logging.warning(f"Could not parse value from result: {result}")
                return 0.5

        except Exception as e:
            logging.error(f"State evaluation error: {e}")
            return 0.5
