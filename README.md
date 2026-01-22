# 📸 HeyPhom

> Transform your Mac into a powerful 3D Photogrammetry processing server

[![macOS](https://img.shields.io/badge/macOS-Ventura%2B-blue)](https://www.apple.com/macos)
[![Swift](https://img.shields.io/badge/Swift-5.9%2B-orange)](https://swift.org)
[![Node.js](https://img.shields.io/badge/Node.js-v18%2B-green)](https://nodejs.org)
[![RealityKit](https://img.shields.io/badge/RealityKit-Enabled-red)](https://developer.apple.com/documentation/realitykit)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

**HeyPhom** is an open-source photogrammetry platform that converts photos into high-quality 3D models (OBJ, USDZ, STL) using Apple's RealityKit PhotogrammetrySession. Perfect for Mac mini or Mac Studio as headless server.

## ✨ Features

- **📱 Multi-source Input**: Upload from device, Google Drive, or GitHub datasets
- **🔄 Real-time Progress**: WebSocket updates with live 3D preview
- **🎯 Multiple Formats**: Export to OBJ, STL, USDZ
- **🚀 Apple Silicon Optimized**: Leverages M-series GPU/Neural Engine
- **💾 IndexedDB Storage**: Client-side model persistence
- **🌐 Remote Processing**: Submit jobs from anywhere, retrieve when done
- **🔐 UUID-based Isolation**: Each user gets unique storage space
- **📊 Live Preview**: View STL models during processing

## 🏗️ Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Frontend (Web) │────▶│  Backend (API)  │────▶│ Core (Swift)    │
│  React + Vite   │◀────│  Node.js/Fastify│◀────│ RealityKit      │
└─────────────────┘     └─────────────────┘     └─────────────────┘
     IndexedDB           WebSocket/REST         PhotogrammetrySession
```

**Technology Stack:**
- **Frontend**: React 18, Three.js STL Viewer, Vite, IndexedDB
- **Backend**: Node.js 18+, Fastify, WebSocket, Axios, Multer
- **Core Engine**: Swift 5.9, RealityKit PhotogrammetrySession
- **Infrastructure**: Cloudflare Tunnel, PM2, Nginx (optional)

**Why Apple Silicon?**
- 🧠 **Neural Engine**: AI-powered object masking and feature extraction
- ⚡ **Unified Memory**: Fast data transfer between CPU/GPU/Neural Engine  
- 🎮 **Metal GPU**: Hardware-accelerated 3D mesh reconstruction
- 📱 **Native RealityKit**: Apple's optimized photogrammetry framework

## 🚀 Quick Start

```bash
git clone https://github.com/phucdhh/HeyPhom.git
cd HeyPhom

# Build Swift engine
cd core-engine && swift build -c release && cd ..

# Setup backend
cd backend-api && npm install && cp ../.env.example .env && cd ..

# Setup frontend  
cd frontend-web && npm install && npm run build && cd ..

# Start all services
./start.sh

# Check status
./status.sh
```

## 📖 Usage

### Option 1: Upload from GitHub Dataset

1. Open `http://localhost:5173` in your browser
2. Select **"GitHub Dataset"** tab
3. Paste URL: `https://github.com/alicevision/dataset_monstree/tree/master/images`
4. Click **"Download and Process"**

### Option 2: Manual Upload

1. Open web interface
2. Select **"Upload Images"** tab
3. Choose 50-250 images (JPEG/PNG)
4. Submit job

### Option 3: API (Headless)

```bash
# Create user session
USER_ID=$(uuidgen)
SESSION_ID=$(uuidgen)

# Upload images
curl -X POST http://localhost:3000/api/upload \
  -H "X-User-Id: $USER_ID" \
  -F "sessionId=$SESSION_ID" \
  -F "files=@image1.jpg" \
  -F "files=@image2.jpg"

# Start processing
curl -X POST http://localhost:3000/api/process \
  -H "X-User-Id: $USER_ID" \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"'$SESSION_ID'","quality":"medium"}'

# Check status
curl http://localhost:3000/api/jobs/$SESSION_ID \
  -H "X-User-Id: $USER_ID"

# Download result
curl http://localhost:3000/api/models/$SESSION_ID/model.obj \
  -H "X-User-Id: $USER_ID" -o model.obj
```

## 🛠️ Development

### Project Structure

```
HeyPhom/
├── core-engine/          # Swift RealityKit engine
│   ├── Sources/HeyphomCore/
│   │   ├── main.swift           # CLI entry point
│   │   └── PhotogrammetryEngine.swift
│   └── Package.swift
├── backend-api/          # Node.js API server
│   ├── src/
│   │   ├── server.js            # Fastify server
│   │   ├── routes/
│   │   │   ├── upload.js        # File upload + session mgmt
│   │   │   ├── process.js       # Job submission
│   │   │   ├── jobs.js          # Status polling
│   │   │   └── models.js        # Model download
│   │   └── services/
│   │       └── progressService.js # WebSocket progress
│   └── package.json
├── frontend-web/         # React web interface
│   ├── src/
│   │   ├── App.jsx
│   │   ├── components/
│   │   │   ├── UploadForm.jsx
│   │   │   ├── ProgressDisplay.jsx
│   │   │   └── ModelViewer.jsx  # Three.js STL viewer
│   │   └── utils/
│   │       └── indexedDB.js     # Model storage
│   └── package.json
└── scripts/              # Management scripts
    ├── start.sh
    ├── stop.sh
    └── status.sh
```

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/upload` | POST | Upload images, create session |
| `/api/process` | POST | Start photogrammetry job |
| `/api/jobs/:sessionId` | GET | Get job status/progress |
| `/api/models/:sessionId/:filename` | GET | Download output model |
| `/ws` | WebSocket | Real-time progress updates |

### Environment Variables

```bash
# Backend API (.env)
PORT=3000
HOST=0.0.0.0
CORS_ORIGIN=http://localhost:5173
UPLOAD_DIR=./uploads
MODELS_DIR=../users

# Frontend (.env)
VITE_API_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000/ws
```

## 🔧 Configuration

### Photogrammetry Quality Settings

| Quality | Detail | Sample Ordering | Feature Sensitivity | Processing Time |
|---------|--------|-----------------|---------------------|-----------------|
| `preview` | `.preview` | `.unordered` | `.normal` | 5-10 min |
| `low` | `.reduced` | `.unordered` | `.normal` | 10-20 min |
| `medium` | `.medium` | `.sequential` | `.normal` | 30-60 min |
| `high` | `.full` | `.sequential` | `.high` | 2-4 hours |
| `raw` | `.raw` | `.sequential` | `.high` | 4-8 hours |

### Recommended Settings

- **Testing/Preview**: Use `preview` quality with 20-50 images
- **Production**: Use `medium` quality with 100-200 images
- **High-end Models**: Use `high` quality with 200-300+ images

## 📊 Performance

Benchmark on **Mac mini M2** (24GB RAM):

| Images | Quality | Processing Time | Output Size | GPU Usage |
|--------|---------|-----------------|-------------|-----------|
| 50 | preview | 6 min | 15 MB | ~40% |
| 100 | medium | 35 min | 45 MB | ~70% |
| 199 | medium | 1h 12min | 78 MB | ~80% |
| 250 | high | 3h 45min | 120 MB | ~95% |

**Memory Usage:**
- Idle: ~300 MB
- Processing (medium): ~8-12 GB
- Processing (high): ~15-20 GB

## 🌐 Deployment

### Production with Cloudflare Tunnel

```bash
# Install Cloudflare Tunnel
brew install cloudflared

# Authenticate
cloudflared tunnel login

# Create tunnel
cloudflared tunnel create heyphom

# Configure tunnel (~/.cloudflared/config.yml)
tunnel: <TUNNEL_ID>
credentials-file: /Users/mac/.cloudflared/<TUNNEL_ID>.json

ingress:
  - hostname: heyphom.yourdomain.com
    service: http://localhost:5173
  - service: http_status:404

# Route DNS
cloudflared tunnel route dns heyphom heyphom.yourdomain.com

# Run tunnel
cloudflared tunnel run heyphom
```

### Process Management with PM2

```bash
# Install PM2
npm install -g pm2

# Start all services
pm2 start ecosystem.config.js

# Monitor
pm2 monit

# Logs
pm2 logs

# Restart
pm2 restart all

# Startup on boot
pm2 startup
pm2 save
```

## 📸 Photography Guidelines

**Capture Tips for Best Results:**

1. **Coverage**: Take 50-250 photos around the object
   - **Layer 1**: Eye-level circle (0°) - 40% of photos
   - **Layer 2**: High angle (45°) - 30% of photos
   - **Layer 3**: Top-down (70-90°) - 30% of photos

2. **Overlap**: 70-80% overlap between consecutive photos

3. **Lighting**: 
   - Use diffused natural light or soft LED panels
   - Avoid harsh shadows and reflections
   - Consistent lighting throughout capture

4. **Focus**: Keep entire object in sharp focus
   - Use smaller aperture (f/8-f/11) for more depth of field
   - Avoid motion blur (use tripod or fast shutter)

5. **Background**: 
   - Use non-reflective, neutral background
   - Avoid patterns or textures that might confuse algorithm

## 🔍 Troubleshooting

### Issue: "Port 3000 already in use"

```bash
# Find process using port 3000
lsof -ti:3000

# Kill process
kill -9 $(lsof -ti:3000)

# Or change port in .env
PORT=3001
```

### Issue: "Swift build failed"

```bash
# Check Xcode Command Line Tools
xcode-select -p

# Install if missing
xcode-select --install

# Reset if corrupted
sudo xcode-select --reset
```

### Issue: "RealityKit not available"

**Requirements:**
- macOS Ventura 13.0+ or Sonoma 14.0+
- Apple Silicon (M1/M2/M3) or Intel Mac with discrete GPU
- Xcode 15.0+

### Issue: "Progress stuck at downloading images"

- Check backend logs: `./status.sh`
- Verify GitHub URL is accessible
- Check disk space: `df -h`
- Clear temp files: `rm -rf /tmp/heyphom-*.log`

### Issue: "Model not displaying in viewer"

- Check browser console for errors
- Verify model file exists: `ls users/*/sessions/*/`
- Check file size (should be > 1KB)
- Try different browser (Chrome/Edge recommended)

### Issue: "Out of memory during processing"

**Solutions:**
- Use lower quality setting (preview/low)
- Reduce number of images (< 150)
- Close other applications
- Upgrade to Mac with more RAM (16GB+ recommended)

## 🤝 Contributing

We welcome contributions! Areas for improvement:

- [ ] GPU acceleration monitoring dashboard
- [ ] Batch processing multiple objects
- [ ] Texture quality enhancement
- [ ] AR preview on iOS devices
- [ ] Docker containerization
- [ ] Kubernetes deployment configs
- [ ] Automated testing suite
- [ ] Model compression/optimization

**Development Workflow:**

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open Pull Request

## 🚦 Status

| Feature | Status | Notes |
|---------|--------|-------|
| Image Upload | ✅ Complete | Multi-source support |
| GitHub Dataset | ✅ Complete | Recursive download with retry |
| Progress Tracking | ✅ Complete | WebSocket + REST polling |
| 3D Preview | ✅ Complete | Three.js STL viewer |
| Multiple Formats | ✅ Complete | OBJ, STL, USDZ |
| User Isolation | ✅ Complete | UUID-based directories |
| Safari Support | ✅ Complete | Fixed 400 errors |
| Docker | 🚧 Planned | Need macOS container support |
| Mobile App | 🚧 Planned | React Native + Swift |
| Texture Editing | 📋 Backlog | Post-processing tools |

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Apple RealityKit team for PhotogrammetrySession API
- AliceVision for public photogrammetry datasets
- Three.js community for STL viewer components

---

**Made with ❤️ by [Nguyen Dang Minh Phuc](https://github.com/phucdhh)**

**Star ⭐ this project if you find it useful!**