#!/bin/bash

# HeyPhom Shutdown Script
# Stops all services: Backend, Frontend, Cloudflare Tunnel

set -e

echo "🛑 Stopping HeyPhom Services..."
echo

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Stop Backend API
echo "1️⃣  Stopping Backend API (Port 4444)..."
if lsof -Pi :4444 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
  PID=$(lsof -ti:4444)
  kill -9 $PID 2>/dev/null || true
  sleep 1
  if ! lsof -Pi :4444 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo -e "${GREEN}   ✅ Backend API stopped${NC}"
  else
    echo -e "${RED}   ❌ Failed to stop Backend API${NC}"
  fi
else
  echo -e "${YELLOW}   ⚠️  Backend API not running${NC}"
fi
echo

# Stop Frontend
echo "2️⃣  Stopping Frontend (Port 3334)..."
if lsof -Pi :3334 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
  PID=$(lsof -ti:3334)
  kill -9 $PID 2>/dev/null || true
  sleep 1
  if ! lsof -Pi :3334 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo -e "${GREEN}   ✅ Frontend stopped${NC}"
  else
    echo -e "${RED}   ❌ Failed to stop Frontend${NC}"
  fi
else
  echo -e "${YELLOW}   ⚠️  Frontend not running${NC}"
fi
echo

# Stop Cloudflare Tunnel
echo "3️⃣  Stopping Cloudflare Tunnel..."
if pgrep -f "cloudflared tunnel run heyphom" > /dev/null; then
  PIDS=$(pgrep -f "cloudflared tunnel run heyphom")
  for PID in $PIDS; do
    kill -9 $PID 2>/dev/null || true
  done
  sleep 2
  if ! pgrep -f "cloudflared tunnel run heyphom" > /dev/null; then
    echo -e "${GREEN}   ✅ Cloudflare Tunnel stopped${NC}"
  else
    echo -e "${RED}   ❌ Failed to stop Cloudflare Tunnel${NC}"
  fi
else
  echo -e "${YELLOW}   ⚠️  Cloudflare Tunnel not running${NC}"
fi
echo

# Clean up log files (optional)
echo "4️⃣  Cleaning up log files..."
rm -f /tmp/heyphom-backend.log
rm -f /tmp/heyphom-frontend.log
rm -f /tmp/heyphom-tunnel.log
rm -f /tmp/vite.log
rm -f /tmp/cloudflared.log
echo -e "${GREEN}   ✅ Log files cleaned${NC}"
echo

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ All HeyPhom Services Stopped!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo
echo "📊 Remaining Processes:"
REMAINING=$(ps aux | grep -E "node.*4444|vite|cloudflared tunnel run heyphom" | grep -v grep | wc -l)
if [ $REMAINING -eq 0 ]; then
  echo -e "${GREEN}   ✅ No HeyPhom processes running${NC}"
else
  echo -e "${YELLOW}   ⚠️  Some processes still running:${NC}"
  ps aux | grep -E "node.*4444|vite|cloudflared tunnel run heyphom" | grep -v grep
fi
echo
echo "🚀 To start services again: ./scripts/startup.sh"
echo
