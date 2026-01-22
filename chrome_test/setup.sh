#!/bin/bash

# HeyPhom Chrome Test Setup

echo "🔧 Setting up HeyPhom Chrome Test..."

cd "$(dirname "$0")"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Create test-images directory
if [ ! -d "test-images" ]; then
  mkdir test-images
  echo "📁 Created test-images directory"
fi

# Check if test images exist
IMAGE_COUNT=$(find test-images -type f \( -iname "*.jpg" -o -iname "*.jpeg" -o -iname "*.png" -o -iname "*.heic" \) | wc -l)

if [ "$IMAGE_COUNT" -lt 30 ]; then
  echo ""
  echo "⚠️  Need at least 30 test images"
  echo "   Currently found: $IMAGE_COUNT images"
  echo ""
  echo "📥 Please add images to: $(pwd)/test-images/"
  echo ""
  echo "💡 Tips:"
  echo "   - Use iPhone photos"
  echo "   - Take photos from different angles"
  echo "   - Minimum 30 images recommended"
  echo ""
  echo "Example:"
  echo "   cp ~/Pictures/test-object/*.jpg test-images/"
  echo ""
else
  echo "✅ Found $IMAGE_COUNT test images"
  echo ""
  echo "🚀 Ready to test!"
  echo ""
  echo "Run tests:"
  echo "   npm test          - Browser test with Puppeteer"
  echo "   npm run test-api  - Direct API test"
  echo ""
fi
