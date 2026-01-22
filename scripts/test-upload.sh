#!/bin/bash
# Test upload and monitor progress

SESSION_ID="test_$(date +%s)_$(head -c 4 /dev/urandom | base64 | tr -dc 'a-zA-Z0-9' | head -c 8)"
QUALITY="${1:-low}"
INPUT_DIR="${2:-/Users/mac/HeyPhom/upload/imageset1}"

echo "🧪 Testing HeyPhom Upload & Processing"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Session ID: $SESSION_ID"
echo "Quality: $QUALITY"
echo "Input: $INPUT_DIR"
echo ""

# Count images
IMAGE_COUNT=$(ls "$INPUT_DIR"/*.{jpg,jpeg,png,heic} 2>/dev/null | wc -l | tr -d ' ')
echo "📸 Images found: $IMAGE_COUNT"

if [ "$IMAGE_COUNT" -eq 0 ]; then
    echo "❌ No images found in $INPUT_DIR"
    exit 1
fi

echo ""
echo "📤 Creating temporary upload directory..."
UPLOAD_DIR="/tmp/heyphom-test-upload-$$"
mkdir -p "$UPLOAD_DIR"

echo "📋 Copying images..."
cp "$INPUT_DIR"/*.{jpg,jpeg,png,heic} "$UPLOAD_DIR/" 2>/dev/null

# Create FormData with curl
echo ""
echo "🚀 Starting upload..."
echo ""

cd "$UPLOAD_DIR"
RESPONSE=$(curl -s -X POST http://localhost:3333/api/upload \
    -F "quality=$QUALITY" \
    -F "formats=usdz" \
    $(ls *.{jpg,jpeg,png,heic} 2>/dev/null | sed 's/^/-F files=@/'))

echo "$RESPONSE" | jq .

# Extract session ID from response
REAL_SESSION_ID=$(echo "$RESPONSE" | jq -r '.data.sessionId')

if [ "$REAL_SESSION_ID" = "null" ] || [ -z "$REAL_SESSION_ID" ]; then
    echo ""
    echo "❌ Upload failed"
    rm -rf "$UPLOAD_DIR"
    exit 1
fi

echo ""
echo "✅ Upload successful!"
echo "📊 Monitoring progress for session: $REAL_SESSION_ID"
echo ""

# Monitor progress
while true; do
    STATUS=$(curl -s "http://localhost:3333/api/jobs/$REAL_SESSION_ID" | jq -r '.data.status')
    PROGRESS=$(curl -s "http://localhost:3333/api/jobs/$REAL_SESSION_ID" | jq -r '.data.progress')
    STAGE=$(curl -s "http://localhost:3333/api/jobs/$REAL_SESSION_ID" | jq -r '.data.currentStage // "N/A"')
    
    echo -ne "\r🔄 Status: $STATUS | Progress: $PROGRESS% | Stage: $STAGE                    "
    
    if [ "$STATUS" = "completed" ]; then
        echo ""
        echo ""
        echo "🎉 Processing completed!"
        curl -s "http://localhost:3333/api/jobs/$REAL_SESSION_ID" | jq '.data.results'
        break
    elif [ "$STATUS" = "failed" ]; then
        echo ""
        echo ""
        echo "❌ Processing failed"
        curl -s "http://localhost:3333/api/jobs/$REAL_SESSION_ID" | jq '.data.error'
        break
    fi
    
    sleep 2
done

# Cleanup
echo ""
echo "🧹 Cleaning up..."
rm -rf "$UPLOAD_DIR"

echo "✅ Test completed!"
