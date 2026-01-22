#!/bin/bash
# Monitor HeyPhom job status

SESSION_ID="$1"

if [ -z "$SESSION_ID" ]; then
  echo "Usage: $0 <session_id>"
  exit 1
fi

SESSION_FILE="/Users/mac/HeyPhom/backend-api/sessions/${SESSION_ID}.json"

echo "📊 Monitoring job: $SESSION_ID"
echo ""

while true; do
  if [ ! -f "$SESSION_FILE" ]; then
    echo "❌ Session file not found"
    exit 1
  fi
  
  STATUS=$(cat "$SESSION_FILE" | jq -r '.status')
  PROGRESS=$(cat "$SESSION_FILE" | jq -r '.progress')
  STAGE=$(cat "$SESSION_FILE" | jq -r '.currentStage // "N/A"')
  ERROR=$(cat "$SESSION_FILE" | jq -r '.error // ""')
  
  # Clear line and print status
  printf "\r\033[K📊 Status: %-12s | Progress: %3s%% | Stage: %-30s" "$STATUS" "$PROGRESS" "$STAGE"
  
  # Check if completed or failed
  if [ "$STATUS" = "completed" ]; then
    echo ""
    echo ""
    echo "✅ Processing completed!"
    
    # Show file sizes
    EXPORT_DIR="/Users/mac/HeyPhom/backend-api/exports/${SESSION_ID}"
    if [ -d "$EXPORT_DIR" ]; then
      echo ""
      echo "📦 Generated files:"
      ls -lh "$EXPORT_DIR"/*.{usdz,obj,stl} 2>/dev/null | awk '{print "  - " $9 " (" $5 ")"}'
    fi
    exit 0
  elif [ "$STATUS" = "failed" ]; then
    echo ""
    echo ""
    echo "❌ Processing failed!"
    if [ ! -z "$ERROR" ]; then
      echo "Error: $ERROR"
    fi
    exit 1
  fi
  
  sleep 2
done
