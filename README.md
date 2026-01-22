# 📸 HeyPhom

Transform an Apple Silicon Mac into a powerful 3D Photogrammetry processing server

[![macOS](https://img.shields.io/badge/macOS-Ventura%2B-blue)](https://www.apple.com/macos)
[![Swift](https://img.shields.io/badge/Swift-5.9%2B-orange)](https://swift.org)
[![Node.js](https://img.shields.io/badge/Node.js-v18%2B-green)](https://nodejs.org)
[![RealityKit](https://img.shields.io/badge/RealityKit-Enabled-red)](https://developer.apple.com/documentation/realitykit)

**HeyPhom** is an open-source photogrammetry platform that converts photos into high-quality 3D models (OBJ, USDZ, STL) using Apple's RealityKit PhotogrammetrySession.

## ✨ Features

- 📱 Multi-source Input: Upload, Google Drive, GitHub datasets
- 🔄 Real-time Progress: WebSocket + live 3D preview  
- 🎯 Multiple Formats: OBJ, STL, USDZ
- 🚀 Apple Silicon Optimized
- 💾 IndexedDB Storage
- 🌐 Remote Processing

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

# Start
[start.sh](http://_vscodecontentref_/7)