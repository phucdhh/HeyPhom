#!/bin/bash

# Test WebSocket connection
echo "🧪 Testing WebSocket connection..."

# Create a test session ID
SESSION_ID="test_$(date +%s)"

echo "📝 Session ID: $SESSION_ID"
echo ""

# Use websocat if available, otherwise suggest installation
if command -v websocat &> /dev/null; then
  echo "🔌 Connecting to WebSocket..."
  echo "   ws://localhost:3333/ws/$SESSION_ID"
  echo ""
  echo "Press Ctrl+C to disconnect"
  echo ""
  
  websocat "ws://localhost:3333/ws/$SESSION_ID"
else
  echo "⚠️  websocat not found. Install it with:"
  echo "   brew install websocat"
  echo ""
  echo "Or test manually with:"
  echo "   wscat -c ws://localhost:3333/ws/$SESSION_ID"
  echo ""
  echo "Or use the browser console:"
  echo "   const ws = new WebSocket('ws://localhost:3333/ws/$SESSION_ID')"
  echo "   ws.onmessage = (e) => console.log('Received:', e.data)"
fi
