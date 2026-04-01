#!/bin/bash
# Creates a clickable macOS dock shortcut for the FE Civil app.
# Run once from the repo directory: ./create_shortcut.sh

APP_NAME="FE Civil Exam"
APP_PATH="$HOME/Applications/${APP_NAME}.app"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

APPLESCRIPT=$(cat <<EOF
tell application "Terminal"
    activate
    do script "cd '${SCRIPT_DIR}' && ./start.sh; exit"
end tell
EOF
)

echo ""
echo "🔨  Building ${APP_NAME}.app ..."
osacompile -o "$APP_PATH" -e "$APPLESCRIPT"

echo "✅  Created: ${APP_PATH}"
echo ""
echo "    Drag it to your Dock from the window that's about to open."
echo ""
open "$HOME/Applications"
