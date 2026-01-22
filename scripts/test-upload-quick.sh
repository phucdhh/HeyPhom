#!/bin/bash

# Quick test upload with userID

echo "🧪 Testing upload with userID..."

# Create test files
TEST_DIR="/tmp/test-upload-$$"
mkdir -p "$TEST_DIR"

echo "Creating test files..."
for i in {1..5}; do
  # Create small test image files
  head -c 100000 /dev/urandom > "$TEST_DIR/test_$i.jpg"
done

echo "✅ Created 5 test files"

# Upload with curl
echo ""
echo "📤 Uploading to server..."

curl -X POST http://localhost:4444/api/upload \
  -H "X-User-Id: user_test_script" \
  -F "quality=low" \
  -F "formats=usdz,obj,stl" \
  -F "files=@$TEST_DIR/test_1.jpg" \
  -F "files=@$TEST_DIR/test_2.jpg" \
  -F "files=@$TEST_DIR/test_3.jpg" \
  -F "files=@$TEST_DIR/test_4.jpg" \
  -F "files=@$TEST_DIR/test_5.jpg" \
  | jq '.'

# Cleanup
rm -rf "$TEST_DIR"
echo ""
echo "✅ Test completed!"
