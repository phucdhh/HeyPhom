#!/bin/bash

# HeyPhom Stop Script
# Dừng tất cả services: Backend API, Frontend Web, Cloudflare Tunnel

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🛑 HeyPhom - Stopping Services${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo

# Stop Backend API
echo -e "${BLUE}[1/3]${NC} Stopping Backend API (Port 4444)..."
if lsof -Pi :4444 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
  PID=$(lsof -ti:4444)
  kill -9 $PID 2>/dev/null || true
  sleep 1
  if ! lsof -Pi :4444 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo -e "      ${GREEN}✅ Backend API stopped (PID: $PID)${NC}"
  else
    echo -e "      ${RED}❌ Failed to stop Backend API${NC}"
  fi
else
  echo -e "      ${YELLOW}⚠️  Backend API not running${NC}"
fi
echo

# Stop Frontend Web
echo -e "${BLUE}[2/3]${NC} Stopping Frontend Web (Port 4445)..."
if lsof -Pi :4445 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
  PID=$(lsof -ti:4445)
  kill -9 $PID 2>/dev/null || true
  sleep 1
  if ! lsof -Pi :3334 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo -e "      ${GREEN}✅ Frontend Web stopped (PID: $PID)${NC}"
  else
    echo -e "      ${RED}❌ Failed to stop Frontend Web${NC}"
  fi
else
  echo -e "      ${YELLOW}⚠️  Frontend Web not running${NC}"
fi
echo

# Stop Cloudflare Tunnel
echo -e "${BLUE}[3/3]${NC} Stopping Cloudflare Tunnel..."
if pgrep -f "cloudflared tunnel --config.*config-heyphom.yml" > /dev/null; then
  PIDS=$(pgrep -f "cloudflared tunnel --config.*config-heyphom.yml")
  echo -e "      Stopping PIDs: $PIDS"
  for PID in $PIDS; do
    kill -9 $PID 2>/dev/null || true
  done
  sleep 2
  if ! pgrep -f "cloudflared tunnel --config.*config-heyphom.yml" > /dev/null; then
    echo -e "      ${GREEN}✅ Cloudflare Tunnel stopped${NC}"
  else
    echo -e "      ${RED}❌ Failed to stop Cloudflare Tunnel${NC}"
  fi
else
  echo -e "      ${YELLOW}⚠️  Cloudflare Tunnel not running${NC}"
fi
echo

# Clean up log files
echo -e "${BLUE}[•]${NC} Cleaning up log files..."
rm -f /tmp/heyphom-backend.log 2>/dev/null || true
rm -f /tmp/heyphom-frontend.log 2>/dev/null || true
rm -f /tmp/heyphom-tunnel.log 2>/dev/null || true
rm -f /tmp/vite.log 2>/dev/null || true
rm -f /tmp/cloudflared.log 2>/dev/null || true
echo -e "      ${GREEN}✅ Log files cleaned${NC}"
echo

# Check remaining processes
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
REMAINING=$(ps aux | grep -E "node.*4444|node.*vite|cloudflared tunnel --config.*config-heyphom.yml" | grep -v grep | wc -l | tr -d ' ')
if [ "$REMAINING" -eq 0 ]; then
  echo -e "${GREEN}✅ All HeyPhom Services Stopped Successfully!${NC}"
else
  echo -e "${YELLOW}⚠️  Warning: Some processes still running:${NC}"
  ps aux | grep -E "node.*4444|node.*vite|cloudflared tunnel --config.*config-heyphom.yml" | grep -v grep | awk '{printf "   PID %-6s - %s %s %s %s\n", $2, $11, $12, $13, $14}'
  echo
  echo -e "${YELLOW}   Run again: ./stop.sh${NC}"
fi
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo
echo -e "${BLUE}💡 To start services again:${NC}"
echo -e "   ${GREEN}./start.sh${NC}"
echo
