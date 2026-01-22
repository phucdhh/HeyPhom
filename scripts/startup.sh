#!/bin/bash

# HeyPhom Startup Script
# Starts all services: Backend, Frontend, Cloudflare Tunnel

set -e

echo "🚀 Starting HeyPhom Services..."
echo

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if services are already running
check_running() {
  local port=$1
  local service=$2
  if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo -e "${YELLOW}⚠️  $service already running on port $port${NC}"
    return 0
  else
    return 1
  fi
}

# Start Backend API
echo "1️⃣  Starting Backend API (Port 4444)..."
if check_running 4444 "Backend API"; then
  echo "   Skipping..."
else
  cd /Users/mac/HeyPhom/backend-api
  SESSION_DIR=/Users/mac/HeyPhom/sessions npm start > /tmp/heyphom-backend.log 2>&1 &
  sleep 3
  if check_running 4444 "Backend API"; then
    echo -e "${GREEN}   ✅ Backend API started (PID: $(lsof -ti:4444))${NC}"
  else
    echo -e "${RED}   ❌ Failed to start Backend API${NC}"
  fi
fi
echo

# Start Frontend
echo "2️⃣  Starting Frontend (Port 3334)..."
if check_running 3334 "Frontend"; then
  echo "   Skipping..."
else
  cd /Users/mac/HeyPhom/frontend-web
  npm run dev > /tmp/heyphom-frontend.log 2>&1 &
  sleep 4
  if check_running 3334 "Frontend"; then
    echo -e "${GREEN}   ✅ Frontend started (PID: $(lsof -ti:3334))${NC}"
  else
    echo -e "${RED}   ❌ Failed to start Frontend${NC}"
  fi
fi
echo

# Start Cloudflare Tunnel
echo "3️⃣  Starting Cloudflare Tunnel..."
if pgrep -f "cloudflared tunnel run heyphom" > /dev/null; then
  echo -e "${YELLOW}   ⚠️  Cloudflare Tunnel already running${NC}"
  echo "   Skipping..."
else
  cloudflared tunnel run heyphom > /tmp/heyphom-tunnel.log 2>&1 &
  sleep 3
  if pgrep -f "cloudflared tunnel run heyphom" > /dev/null; then
    TUNNEL_PID=$(pgrep -f "cloudflared tunnel run heyphom" | head -1)
    echo -e "${GREEN}   ✅ Cloudflare Tunnel started (PID: $TUNNEL_PID)${NC}"
  else
    echo -e "${RED}   ❌ Failed to start Cloudflare Tunnel${NC}"
  fi
fi
echo

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ HeyPhom Services Started!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo
echo "🌐 Access URLs:"
echo "   Public:  https://heyphom.truyenthong.edu.vn"
echo "   Local:   http://localhost:4445"
echo "   Backend: http://localhost:4444"
echo
echo "📊 Service Status:"
ps aux | grep -E "node.*4444|vite|cloudflared tunnel run heyphom" | grep -v grep | awk '{print "   " $2 " - " $11 " " $12 " " $13 " " $14}'
echo
echo "📝 Logs:"
echo "   Backend:  tail -f /tmp/heyphom-backend.log"
echo "   Frontend: tail -f /tmp/heyphom-frontend.log"
echo "   Tunnel:   tail -f /tmp/heyphom-tunnel.log"
echo
echo "🛑 To stop all services: ./scripts/shutdown.sh"
echo
