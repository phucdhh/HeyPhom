# HeyPhom Chrome Headless Test

Automated testing for HeyPhom upload functionality.

## Quick Start

```bash
./setup.sh
```

## Add Test Images

1. Add at least 30 images to `test-images/` directory:

```bash
# Copy from your Photos library
cp ~/Pictures/your-object/*.jpg test-images/

# Or use sample images
# Minimum 30 images required for photogrammetry
```

## Run Tests

### Option 1: Browser Test (Recommended)
Opens Chrome with DevTools to see what's happening:

```bash
npm test
```

### Option 2: Direct API Test
Tests API without browser (faster):

```bash
npm run test-api
```

## What it does

### Browser Test (`test-upload.js`)
1. Opens Chrome browser with DevTools
2. Navigates to https://heyphom.truyenthong.edu.vn
3. Uploads test images
4. Selects quality and formats
5. Starts processing
6. Waits for completion (max 10 minutes)
7. Takes screenshots at each step
8. Logs all network requests

### API Test (`test-api.js`)
1. Reads images from test-images/
2. Creates multipart form data
3. Posts directly to /api/upload
4. Shows upload progress
5. Displays response

## Screenshots Generated

- `page-loaded.png` - Initial page load
- `before-upload.png` - Before clicking upload
- `during-upload.png` - During upload (5s after start)
- `completed.png` - After processing complete
- `error.png` - If error occurs

## Logs

All console output and network requests are logged to terminal:
- `→ REQUEST:` - Outgoing requests
- `← RESPONSE:` - Server responses  
- `❌ REQUEST FAILED:` - Failed requests
- `PAGE LOG:` - Console messages from browser

## Troubleshooting

### Upload stuck at 0-1%
Check backend logs:
```bash
tail -f /tmp/heyphom-backend.log
```

### Connection timeout
Check if services are running:
```bash
cd /Users/mac/HeyPhom
./status.sh
```

### Not enough images
```bash
# Check count
ls -1 test-images/*.jpg | wc -l

# Should be >= 30
```

## File Structure

```
chrome_test/
├── test-upload.js      # Puppeteer browser test
├── test-api.js         # Direct API test
├── setup.sh            # Setup script
├── test-images/        # Your test images (30+ required)
├── *.png               # Generated screenshots
└── README.md           # This file
```
