#!/bin/bash

# HeyPhom Restart Script
# Khởi động lại tất cả services: Backend API, Frontend Web, Cloudflare Tunnel

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🔄 HeyPhom - Restarting Services${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Stop services
echo -e "${YELLOW}Step 1: Stopping services...${NC}"
echo
"$SCRIPT_DIR/stop.sh"

echo
echo -e "${YELLOW}Step 2: Waiting 2 seconds...${NC}"
sleep 2
echo

# Start services
echo -e "${YELLOW}Step 3: Starting services...${NC}"
echo
"$SCRIPT_DIR/start.sh"

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ HeyPhom Services Restarted Successfully!${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo
