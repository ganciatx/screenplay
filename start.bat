@echo off
echo Starting Screenplay editor at http://localhost:8765
echo Press Ctrl+C to stop the server.
start http://localhost:8765
python -m http.server 8765
