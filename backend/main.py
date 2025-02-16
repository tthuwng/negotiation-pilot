from typing import Any, Dict

import uvicorn


def main() -> None:
    """Start the FastAPI server with WebSocket support."""
    print("Starting negotiation copilot backend server...")

    uvicorn_config: Dict[str, Any] = {
        "app": "api:app",
        "host": "0.0.0.0",
        "port": 8000,
        "reload": True,
        "ws_ping_interval": 20,  # Send ping every 20 seconds
        "ws_ping_timeout": 30,  # Wait 30 seconds for pong response
        "ws_max_size": 16777216,  # 16MB max message size
        "ws_per_message_deflate": True,  # Enable WebSocket compression
        "log_level": "info",
    }
    uvicorn.run(**uvicorn_config)


if __name__ == "__main__":
    main()
