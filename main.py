"""Start the VN crochet website with Python's built-in web server.

Run:
    python main.py

The server uses only Python's standard library, so no pip packages are
required. Press Ctrl+C in the terminal to stop it.
"""

from __future__ import annotations

import argparse
import functools
import http.server
import pathlib
import webbrowser


PROJECT_ROOT = pathlib.Path(__file__).resolve().parent
DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 8000


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the VN crochet website locally.")
    parser.add_argument("--host", default=DEFAULT_HOST, help="Interface to bind (default: 127.0.0.1)")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help="Port to use (default: 8000)")
    parser.add_argument(
        "--no-browser",
        action="store_true",
        help="Start the server without opening a browser window",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    handler = functools.partial(
        http.server.SimpleHTTPRequestHandler,
        directory=str(PROJECT_ROOT),
    )
    server = http.server.ThreadingHTTPServer((args.host, args.port), handler)
    url = f"http://localhost:{args.port}"

    print(f"VN crochet is running at {url}")
    print("Press Ctrl+C to stop the server.")

    if not args.no_browser:
        webbrowser.open(url)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping VN crochet server.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
