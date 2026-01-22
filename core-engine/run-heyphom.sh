#!/bin/bash
# HeyPhom CLI Wrapper Script
# Automatically runs the CLI with sudo for proper resource allocation

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLI_PATH="$SCRIPT_DIR/.build/arm64-apple-macosx/release/heyphom-cli"
ASKPASS_SCRIPT="$SCRIPT_DIR/sudo-askpass.sh"

# Check if binary exists
if [ ! -f "$CLI_PATH" ]; then
    echo "❌ Binary not found. Building..."
    cd "$SCRIPT_DIR" && swift build -c release
    if [ $? -ne 0 ]; then
        echo "❌ Build failed"
        exit 1
    fi
fi

# Setup SUDO_ASKPASS for non-interactive sudo
export SUDO_ASKPASS="$ASKPASS_SCRIPT"

# Run with sudo (use stdbuf to disable output buffering)
echo "🔐 Running HeyPhom CLI with elevated privileges..."
if command -v stdbuf >/dev/null 2>&1; then
  sudo -A stdbuf -oL -eL "$CLI_PATH" "$@"
else
  sudo -A "$CLI_PATH" "$@"
fi

# Fix ownership of output files if output path was provided
prev_arg=""
for arg in "$@"; do
    if [[ "$prev_arg" == "--output" ]] || [[ "$prev_arg" == "-o" ]]; then
        OUTPUT_PATH="$arg"
        if [ -d "$OUTPUT_PATH" ]; then
            echo "🔧 Fixing file ownership..."
            sudo -A chown -R $(whoami):staff "$OUTPUT_PATH"
            echo "✅ Ownership fixed"
        fi
        break
    fi
    prev_arg="$arg"
done
