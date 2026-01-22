#!/bin/bash

echo "🧪 Testing HeyPhom Upload & Progress Tracking"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Find test images
TEST_DIR="/Users/mac/HeyPhom/upload/sess_1768843457557_baTpO1ZN"

if [ ! -d "$TEST_DIR" ]; then
  echo "❌ Test directory not found: $TEST_DIR"
  exit 1
fi

# Count images
IMAGE_COUNT=$(ls "$TEST_DIR"/*.{jpg,jpeg,png,JPG,JPEG,PNG,heic,HEIC} 2>/dev/null | wc -l | tr -d ' ')

echo "📸 Found $IMAGE_COUNT images in test directory"

if [ "$IMAGE_COUNT" -lt 30 ]; then
  echo "❌ Need at least 30 images for testing"
  exit 1
fi

# Take first 35 images for quick test
echo "📦 Creating test archive with 35 images..."
cd "$TEST_DIR"
ls *.{jpg,jpeg,png,JPG,JPEG,PNG,heic,HEIC} 2>/dev/null | head -35 > /tmp/test-files.txt

# Upload via curl (multipart form-data)
echo "📤 Uploading to http://localhost:4444/api/upload"
echo ""

RESPONSE=$(curl -s -X POST http://localhost:4444/api/upload \
  -F "quality=low" \
  -F "formats=usdz" \
  $(while read file; do echo "-F files=@$file"; done < /tmp/test-files.txt) \
  2>&1)

echo "Response:"
echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"

# Extract session ID
SESSION_ID=$(echo "$RESPONSE" | jq -r '.data.sessionId' 2>/dev/null)

if [ -z "$SESSION_ID" ] || [ "$SESSION_ID" = "null" ]; then
  echo "❌ Failed to get session ID"
  exit 1
fi

echo ""
echo "✅ Upload successful!"
echo "📝 Session ID: $SESSION_ID"
echo "🔗 Track progress: http://localhost:4445 (WebSocket will connect)"
echo ""
echo "Monitoring progress for 30 seconds..."
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Monitor progress
for i in {1..30}; do
  STATUS=$(curl -s "http://localhost:4444/api/jobs/$SESSION_ID" | jq -r '.data | "\(.status) - \(.progress)% - \(.currentStage // "N/A")"' 2>/dev/null)
  echo "[$i/30] $STATUS"
  sleep 1
done

echo ""
echo "✅ Test complete. Check WebSocket console for real-time updates."
