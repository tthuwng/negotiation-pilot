#!/usr/bin/env python3
import asyncio
import sys
from typing import NoReturn

from test_websocket import test_mcts_websocket


async def main() -> NoReturn:
    """Run the WebSocket test client with error handling."""
    try:
        await test_mcts_websocket()
    except KeyboardInterrupt:
        print("\nTest client stopped by user")
        sys.exit(0)
    except ConnectionRefusedError:
        print("\nError: Could not connect to the server. Is it running?")
        sys.exit(1)
    except Exception as e:
        print(f"\nUnexpected error: {str(e)}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
