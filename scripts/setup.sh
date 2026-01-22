#!/bin/bash

# ============================================
# HeyPhom Initial Setup Script
# ============================================
# Script này giúp thiết lập môi trường HeyPhom
# Chạy một lần khi bắt đầu triển khai
# ============================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PROJECT_DIR="/Users/mac/HeyPhom"

echo -e "${GREEN}"
echo "============================================"
echo "   HeyPhom Initial Setup"
echo "============================================"
echo -e "${NC}"

# ============================================
# System Requirements Check
# ============================================

echo -e "${BLUE}[1/8] Checking system requirements...${NC}"

# Check macOS version
macos_version=$(sw_vers -productVersion)
echo "✓ macOS version: $macos_version"

# Check if running on Apple Silicon
if [[ $(uname -m) == "arm64" ]]; then
    echo "✓ Running on Apple Silicon (ARM64)"
else
    echo -e "${RED}✗ ERROR: This project requires Apple Silicon (M1/M2/M3)${NC}"
    exit 1
fi

# Check RAM
total_ram=$(sysctl hw.memsize | awk '{print $2/1024/1024/1024}')
echo "✓ Total RAM: ${total_ram}GB"
if (( $(echo "$total_ram < 16" | bc -l) )); then
    echo -e "${YELLOW}⚠ WARNING: Less than 16GB RAM detected${NC}"
fi

# Check available disk space
available_space=$(df -h / | tail -1 | awk '{print $4}')
echo "✓ Available disk space: $available_space"

echo ""

# ============================================
# Check Required Software
# ============================================

echo -e "${BLUE}[2/8] Checking required software...${NC}"

# Check Xcode
if command -v xcodebuild &> /dev/null; then
    xcode_version=$(xcodebuild -version | head -n1)
    echo "✓ Xcode: $xcode_version"
else
    echo -e "${RED}✗ Xcode not found. Please install from App Store.${NC}"
    exit 1
fi

# Check Command Line Tools
if xcode-select -p &> /dev/null; then
    echo "✓ Xcode Command Line Tools installed"
else
    echo -e "${YELLOW}⚠ Installing Xcode Command Line Tools...${NC}"
    xcode-select --install
    echo "Please wait for installation to complete, then run this script again."
    exit 0
fi

# Check Swift
if command -v swift &> /dev/null; then
    swift_version=$(swift --version | head -n1)
    echo "✓ Swift: $swift_version"
else
    echo -e "${RED}✗ Swift not found${NC}"
    exit 1
fi

# Check Node.js
if command -v node &> /dev/null; then
    node_version=$(node --version)
    echo "✓ Node.js: $node_version"
else
    echo -e "${RED}✗ Node.js not found. Installing via Homebrew...${NC}"
    brew install node@20
fi

# Check npm
if command -v npm &> /dev/null; then
    npm_version=$(npm --version)
    echo "✓ npm: v$npm_version"
fi

# Check cloudflared
if command -v cloudflared &> /dev/null; then
    cloudflared_version=$(cloudflared --version | head -n1)
    echo "✓ Cloudflared: $cloudflared_version"
else
    echo -e "${YELLOW}⚠ Cloudflared not found. Installing via Homebrew...${NC}"
    brew install cloudflare/cloudflare/cloudflared
fi

# Check nginx
if command -v nginx &> /dev/null; then
    nginx_version=$(nginx -v 2>&1)
    echo "✓ Nginx: $nginx_version"
else
    echo -e "${YELLOW}⚠ Nginx not found (optional)${NC}"
fi

# Check PM2 (optional but recommended)
if command -v pm2 &> /dev/null; then
    echo "✓ PM2 installed"
else
    echo -e "${YELLOW}⚠ PM2 not found. Install with: npm install -g pm2${NC}"
fi

echo ""

# ============================================
# Create Directory Structure
# ============================================

echo -e "${BLUE}[3/8] Creating directory structure...${NC}"

cd "$PROJECT_DIR"

# Core directories
mkdir -p core-engine/{Sources,Tests,.build}
mkdir -p backend-api/{src/{routes,services,middleware},uploads,exports,sessions,logs,temp}
mkdir -p frontend-web/{pages,components,public}
mkdir -p deployment/{cloudflare,nginx,systemd}
mkdir -p scripts
mkdir -p docs
mkdir -p test/samples

echo "✓ Directory structure created"
echo ""

# ============================================
# Copy Environment Files
# ============================================

echo -e "${BLUE}[4/8] Setting up environment files...${NC}"

if [ ! -f backend-api/.env ]; then
    if [ -f .env.example ]; then
        cp .env.example backend-api/.env
        echo "✓ Created .env from .env.example"
        echo -e "${YELLOW}⚠ Please edit backend-api/.env with your configuration${NC}"
    else
        echo -e "${YELLOW}⚠ .env.example not found. Skipping...${NC}"
    fi
else
    echo "✓ .env already exists"
fi

echo ""

# ============================================
# Build Swift Engine
# ============================================

echo -e "${BLUE}[5/8] Building Swift Engine...${NC}"

if [ -f core-engine/Package.swift ]; then
    cd core-engine
    echo "Building Swift package in release mode..."
    swift build -c release
    
    if [ -f .build/release/heyphom-cli ]; then
        echo "✓ Swift Engine built successfully"
        .build/release/heyphom-cli --version || echo "CLI version check (may fail if not implemented yet)"
    else
        echo -e "${YELLOW}⚠ Build completed but executable not found${NC}"
    fi
    cd ..
else
    echo -e "${YELLOW}⚠ Package.swift not found. Skipping Swift build...${NC}"
fi

echo ""

# ============================================
# Install Backend Dependencies
# ============================================

echo -e "${BLUE}[6/8] Installing backend dependencies...${NC}"

if [ -f backend-api/package.json ]; then
    cd backend-api
    npm install
    echo "✓ Backend dependencies installed"
    cd ..
else
    echo -e "${YELLOW}⚠ package.json not found. Skipping npm install...${NC}"
fi

echo ""

# ============================================
# Setup Cloudflare Tunnel
# ============================================

echo -e "${BLUE}[7/8] Cloudflare Tunnel setup...${NC}"

if command -v cloudflared &> /dev/null; then
    echo "Cloudflare Tunnel is installed."
    echo ""
    echo "To complete Cloudflare setup, run these commands:"
    echo ""
    echo "  1. Login to Cloudflare:"
    echo "     cloudflared tunnel login"
    echo ""
    echo "  2. Create tunnel:"
    echo "     cloudflared tunnel create heyphom-tunnel"
    echo ""
    echo "  3. Configure DNS:"
    echo "     cloudflared tunnel route dns heyphom-tunnel heyphom.truyenthong.edu.vn"
    echo ""
    echo "  4. Create config file at ~/.cloudflared/config.yml"
    echo "     (See README.md for details)"
    echo ""
    echo "  5. Run tunnel:"
    echo "     cloudflared tunnel run heyphom-tunnel"
    echo ""
else
    echo -e "${YELLOW}⚠ Cloudflared not installed${NC}"
fi

echo ""

# ============================================
# Setup Cron Job for Cleanup
# ============================================

echo -e "${BLUE}[8/8] Setting up automated cleanup...${NC}"

# Make cleanup script executable
if [ -f scripts/cleanup.sh ]; then
    chmod +x scripts/cleanup.sh
    echo "✓ Cleanup script is executable"
    
    echo ""
    echo "To setup automatic cleanup, add to crontab:"
    echo "  crontab -e"
    echo ""
    echo "Add this line (runs every 6 hours):"
    echo "  0 */6 * * * $PROJECT_DIR/scripts/cleanup.sh >> $PROJECT_DIR/backend-api/logs/cleanup.log 2>&1"
    echo ""
else
    echo -e "${YELLOW}⚠ Cleanup script not found${NC}"
fi

echo ""

# ============================================
# Final Summary
# ============================================

echo -e "${GREEN}"
echo "============================================"
echo "   Setup Complete!"
echo "============================================"
echo -e "${NC}"

echo "Next steps:"
echo ""
echo "1. Edit configuration:"
echo "   nano backend-api/.env"
echo ""
echo "2. Start backend API:"
echo "   cd backend-api"
echo "   npm start"
echo "   # or use PM2:"
echo "   pm2 start src/server.js --name heyphom-api"
echo ""
echo "3. Test the API:"
echo "   curl http://localhost:3333/health"
echo ""
echo "4. Setup Cloudflare Tunnel (see instructions above)"
echo ""
echo "5. Access your app:"
echo "   https://heyphom.truyenthong.edu.vn"
echo ""
echo -e "${YELLOW}Don't forget to:${NC}"
echo "  - Configure backend-api/.env"
echo "  - Setup Cloudflare Tunnel"
echo "  - Add cleanup cron job"
echo "  - Setup PM2 for auto-restart"
echo ""

# Show useful commands
echo -e "${BLUE}Useful commands:${NC}"
echo "  View logs:     pm2 logs heyphom-api"
echo "  Restart:       pm2 restart heyphom-api"
echo "  Stop:          pm2 stop heyphom-api"
echo "  Monitor:       pm2 monit"
echo "  Cleanup:       ./scripts/cleanup.sh"
echo ""

exit 0
