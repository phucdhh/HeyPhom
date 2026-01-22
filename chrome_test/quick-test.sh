#!/bin/bash

# Quick test script for HeyPhom local upload
# Usage: ./quick-test.sh

echo "🧪 Starting HeyPhom local upload test..."
echo ""

# Run upload test
echo "📤 Uploading chrome_test dataset..."
SESSION_OUTPUT=$(node test-chunked-cloudflare.js 2>&1)
SESSION_ID=$(echo "$SESSION_OUTPUT" | grep "Final session:" | awk '{print $NF}')

if [ -z "$SESSION_ID" ]; then
  echo "❌ Upload failed - no session ID returned"
  exit 1
fi

echo "✅ Upload successful!"
echo "🆔 Session ID: $SESSION_ID"
echo ""
echo "⏳ Monitoring progress..."
echo ""

# Monitor progress
for i in {1..15}; do
  RESPONSE=$(curl -s "http://localhost:4444/api/jobs/$SESSION_ID")
  STATUS=$(echo "$RESPONSE" | jq -r '.data.status // "unknown"')
  PROGRESS=$(echo "$RESPONSE" | jq -r '.data.progress // 0')
  STAGE=$(echo "$RESPONSE" | jq -r '.data.stage // "Unknown"')
  
  echo "[$i/15] Status: $STATUS | Progress: $PROGRESS% | Stage: $STAGE"
  
  if [ "$STATUS" == "completed" ]; then
    echo ""
    echo "🎉 Processing completed!"
    echo ""
    echo "📊 Final results:"
    curl -s "http://localhost:4444/api/jobs/$SESSION_ID" | jq '{
      status: .data.status,
      progress: .data.progress,
      stage: .data.stage,
      processingTime: .data.processingTime,
      results: (.data.results | keys)
    }'
    echo ""
    
    # Check for issues
    if [ "$STAGE" != "Complete" ]; then
      echo "⚠️  WARNING: Final stage is '$STAGE' instead of 'Complete'"
      exit 1
    fi
    
    echo "✅ All checks passed!"
    exit 0
  elif [ "$STATUS" == "failed" ]; then
    echo ""
    echo "❌ Processing failed!"
    curl -s "http://localhost:4444/api/jobs/$SESSION_ID" | jq '.data.error'
    exit 1
  fi
  
  sleep 10
done

echo ""
echo "⏰ Timeout - processing took too long (>150s)"
echo "Current status:"
curl -s "http://localhost:4444/api/jobs/$SESSION_ID" | jq '{status: .data.status, progress: .data.progress, stage: .data.stage}'
exit 1
