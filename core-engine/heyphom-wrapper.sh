#!/bin/bash
# HeyPhom CLI Wrapper for Backend API
# This script wraps the CLI call with sudo

CLI_PATH="/Users/mac/HeyPhom/core-engine/.build/arm64-apple-macosx/release/heyphom-cli"

# Check if binary exists
if [ ! -f "$CLI_PATH" ]; then
    echo "❌ Binary not found at $CLI_PATH"
    exit 1
fi

# Run with sudo (assumes sudoers is configured for passwordless sudo)
sudo "$CLI_PATH" "$@"
EXIT_CODE=$?

# If output was specified, fix ownership
for ((i=1; i<$#; i++)); do
    if [[ "${!i}" == "--output" ]] || [[ "${!i}" == "-o" ]]; then
        j=$((i+1))
        OUTPUT_PATH="${!j}"
        if [ -d "$OUTPUT_PATH" ]; then
            sudo chown -R mac:staff "$OUTPUT_PATH" 2>/dev/null
        fi
        break
    fi
done

exit $EXIT_CODE
