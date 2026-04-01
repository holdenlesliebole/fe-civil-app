#!/bin/bash
# FE Civil Practice App — launcher

set -e

# Load API key from server/.env if present
if [ -f "server/.env" ]; then
  export $(grep -v '^#' server/.env | xargs)
fi

# Check for API key
if [ -z "$ANTHROPIC_API_KEY" ]; then
  echo ""
  echo "❌  ANTHROPIC_API_KEY is not set."
  echo ""
  echo "    Copy the example file and add your key:"
  echo "    cp server/.env.example server/.env"
  echo "    Then edit server/.env and paste your key."
  echo ""
  exit 1
fi

# Set terminal window title (used to close the window on shutdown)
printf '\033]0;FE Civil Exam\007'

echo ""
echo "🔵  FE Civil Practice Exam"
echo "─────────────────────────"

# Install server deps if needed
if [ ! -d "server/node_modules" ]; then
  echo "📦  Installing server dependencies..."
  cd server && npm install --silent && cd ..
fi

# Install client deps if needed
if [ ! -d "client/node_modules" ]; then
  echo "📦  Installing client dependencies..."
  cd client && npm install --silent && cd ..
fi

# Build client if missing or source has changed
needs_build=false
if [ ! -d "client/build" ]; then
  needs_build=true
elif [ -n "$(find client/src -newer client/build/index.html 2>/dev/null | head -1)" ]; then
  needs_build=true
fi

if [ "$needs_build" = true ]; then
  echo "📦  Building app..."
  (cd client && DISABLE_ESLINT_PLUGIN=true npm run build --silent)
  echo "✅  Build complete."
fi

echo "🚀  Starting on http://localhost:3000 ..."
echo "    Browser will open automatically when ready."
echo ""
echo "    Press Ctrl+C to stop."
echo ""

(cd server && node index.js) &
SERVER_PID=$!

# Open browser once server is ready
(
  for i in $(seq 1 30); do
    if curl -s http://localhost:3000 > /dev/null 2>&1; then
      open "http://localhost:3000"
      break
    fi
    sleep 1
  done
) &
BROWSER_WAIT_PID=$!

# Cleanup on exit — kill processes then close the terminal window
trap "
  kill \$SERVER_PID \$BROWSER_WAIT_PID 2>/dev/null
  sleep 0.3
  lsof -ti:3000 | xargs kill 2>/dev/null
  osascript -e 'tell application \"Terminal\" to close (every window whose name contains \"FE Civil Exam\")' 2>/dev/null
" EXIT INT TERM HUP

wait
