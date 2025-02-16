# Negotiation Copilot API

An AI-powered negotiation assistant that helps you navigate complex conversations using Monte Carlo Tree Search (MCTS) and large language models.

## Setup

1. Create a virtual environment and activate it:

```bash
python -m venv .venv
source .venv/bin/activate  # On Windows use: .venv\Scripts\activate
```

2. Install uv (if not already installed):

```bash
pip install uv
```

3. Install dependencies using uv:

```bash
# Install all dependencies including development dependencies
uv pip install -e ".[dev]"

# If you modify dependencies in pyproject.toml, sync them:
uv pip sync pyproject.toml

# To update dependencies to their latest compatible versions:
uv pip compile pyproject.toml
```

4. Create a `.env` file with your Together API key:

```bash
TOGETHER_API_KEY=your_api_key_here
```

## Development

### Managing Dependencies

- Add a new dependency:

```bash
uv pip install package_name
```

- Update dependencies:

```bash
uv pip compile pyproject.toml --upgrade
```

- View installed packages:

```bash
uv pip list
```

## Running the API

Start the FastAPI server:

```bash
python main.py
```

The API will be available at `http://localhost:8000`. You can access the interactive API documentation at `http://localhost:8000/docs`.

## API Endpoints

### POST /negotiate

Generate negotiation responses based on the current conversation state.

Request body:

```json
{
  "goal": "Negotiate a project deadline extension from 2 weeks to 4 weeks",
  "messages": ["Hello, I'd like to discuss the project timeline with you."],
  "max_turns": 5,
  "current_turn": 0
}
```

Response:

```json
{
  "options": [
    "I understand you want to discuss the timeline. Could you share what challenges you're facing that require an extension?",
    "I appreciate you bringing this up. Let's explore the project scope and current timeline together.",
    "Thank you for reaching out about the timeline. Can you help me understand the specific factors driving this request?"
  ],
  "state_evaluation": 0.6,
  "visualization_url": null
}
```

### GET /health

Health check endpoint to verify the API is running.

Response:

```json
{
  "status": "healthy"
}
```
