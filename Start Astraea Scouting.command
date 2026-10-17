#!/bin/bash
cd "$(dirname "$0")" || exit 1

if ! command -v python3 >/dev/null 2>&1; then
  echo "Python 3 is not installed. Download it from https://www.python.org/downloads/macos/"
  read -r -p "Press Enter to close."
  exit 1
fi

if [ ! -d venv ]; then
  echo "First run: setting up (needs internet once)..."
  python3 -m venv venv || exit 1
  ./venv/bin/pip install --quiet -r requirements.txt || exit 1
fi

PORT="${PORT:-5001}"
(sleep 2 && open "http://localhost:$PORT") &
echo "Astraea Scouting is running. Keep this window open; close it to stop the app."
PORT="$PORT" ./venv/bin/python app.py
