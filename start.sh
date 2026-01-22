#!/bin/bash

# HeyPhom Start Script
# Khởi động tất cả services: Backend API, Frontend Web, Cloudflare Tunnel

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🚀 HeyPhom - Starting Services${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo

# Check if service is already running
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
echo -e "${BLUE}[1/3]${NC} Starting Backend API..."
if check_running 4444 "Backend API"; then
  echo "      Skipping..."
else
  cd /Users/mac/HeyPhom/backend-api
  SESSION_DIR=/Users/mac/HeyPhom/sessions npm start > /tmp/heyphom-backend.log 2>&1 &
  sleep 3
  if check_running 4444 "Backend API"; then
    PID=$(lsof -ti:4444)
    echo -e "      ${GREEN}✅ Backend API started successfully${NC}"
    echo -e "      ${GREEN}   PID: $PID | Port: 4444${NC}"
  else
    echo -e "      ${RED}❌ Failed to start Backend API${NC}"
    echo -e "      Check logs: tail -f /tmp/heyphom-backend.log"
  fi
fi
echo

# Start Frontend Web
echo -e "${BLUE}[2/3]${NC} Starting Frontend Web..."
if check_running 3334 "Frontend Web"; then
  echo "      Skipping..."
else
  cd /Users/mac/HeyPhom/frontend-web
  npm run dev > /tmp/heyphom-frontend.log 2>&1 &
  sleep 4
  if check_running 3334 "Frontend Web"; then
    PID=$(lsof -ti:3334)
    echo -e "      ${GREEN}✅ Frontend Web started successfully${NC}"
    echo -e "      ${GREEN}   PID: $PID | Port: 3334${NC}"
  else
    echo -e "      ${RED}❌ Failed to start Frontend Web${NC}"
    echo -e "      Check logs: tail -f /tmp/heyphom-frontend.log"
  fi
fi
echo

# Start Cloudflare Tunnel
echo -e "${BLUE}[3/3]${NC} Starting Cloudflare Tunnel..."
if pgrep -f "cloudflared tunnel --config.*config-heyphom.yml" > /dev/null; then
  echo -e "${YELLOW}⚠️  Cloudflare Tunnel already running${NC}"
  echo "      Skipping..."
else
  cloudflared tunnel --config /Users/mac/.cloudflared/config-heyphom.yml run heyphom > /tmp/heyphom-tunnel.log 2>&1 &
  sleep 3
  if pgrep -f "cloudflared tunnel --config.*config-heyphom.yml" > /dev/null; then
    TUNNEL_PID=$(pgrep -f "cloudflared tunnel --config.*config-heyphom.yml" | head -1)
    echo -e "      ${GREEN}✅ Cloudflare Tunnel started successfully${NC}"
    echo -e "      ${GREEN}   PID: $TUNNEL_PID${NC}"
  else
    echo -e "      ${RED}❌ Failed to start Cloudflare Tunnel${NC}"
    echo -e "      Check logs: tail -f /tmp/heyphom-tunnel.log"
  fi
fi
echo

# Summary
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✅ HeyPhom Services Started!${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo
echo -e "${BLUE}🌐 Access URLs:${NC}"
echo -e "   ${GREEN}Public:${NC}  https://heyphom.truyenthong.edu.vn"
echo -e "   ${GREEN}Local:${NC}   http://localhost:4445"
echo -e "   ${GREEN}Backend:${NC} http://localhost:4444"
echo
echo -e "${BLUE}📊 Running Processes:${NC}"
ps aux | grep -E "node.*4444|node.*vite|cloudflared tunnel --config.*config-heyphom.yml" | grep -v grep | awk '{printf "   PID %-6s - %s %s %s %s\n", $2, $11, $12, $13, $14}'
echo
echo -e "${BLUE}📝 Logs:${NC}"
echo -e "   ${YELLOW}Backend:${NC}  tail -f /tmp/heyphom-backend.log"
echo -e "   ${YELLOW}Frontend:${NC} tail -f /tmp/heyphom-frontend.log"
echo -e "   ${YELLOW}Tunnel:${NC}   tail -f /tmp/heyphom-tunnel.log"
echo
echo -e "${BLUE}💡 Commands:${NC}"
echo -e "   ${YELLOW}Status:${NC}  ./status.sh"
echo -e "   ${YELLOW}Stop:${NC}    ./stop.sh"
echo -e "   ${YELLOW}Restart:${NC} ./restart.sh"
echo
