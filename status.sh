#!/bin/bash

# HeyPhom Status Script
# Kiểm tra trạng thái tất cả services

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

clear
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📊 HeyPhom System Status${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${CYAN}Date: $(date '+%Y-%m-%d %H:%M:%S')${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo

# Check Backend API
echo -e "${BLUE}[1/3] Backend API (Port 4444)${NC}"
if lsof -Pi :4444 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
  PID=$(lsof -ti:4444)
  UPTIME=$(ps -o etime= -p $PID | tr -d ' ')
  echo -e "      Status: ${GREEN}✅ RUNNING${NC}"
  echo -e "      PID:    ${GREEN}$PID${NC}"
  echo -e "      Uptime: ${GREEN}$UPTIME${NC}"
  echo -e "      URL:    ${CYAN}http://localhost:4444${NC}"
  
  # Test health endpoint
  if command -v curl >/dev/null 2>&1; then
    echo -n "      Health: "
    HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4444/health 2>/dev/null || echo "000")
    if [ "$HEALTH" = "200" ]; then
      echo -e "${GREEN}✅ OK (HTTP $HEALTH)${NC}"
    else
      echo -e "${YELLOW}⚠️  HTTP $HEALTH${NC}"
    fi
  fi
else
  echo -e "      Status: ${RED}❌ STOPPED${NC}"
  echo -e "      ${YELLOW}Run: ./start.sh to start${NC}"
fi
echo

# Check Frontend Web
echo -e "${BLUE}[2/3] Frontend Web (Port 4445)${NC}"
if lsof -Pi :4445 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
  PID=$(lsof -ti:4445)
  UPTIME=$(ps -o etime= -p $PID | tr -d ' ')
  echo -e "      Status: ${GREEN}✅ RUNNING${NC}"
  echo -e "      PID:    ${GREEN}$PID${NC}"
  echo -e "      Uptime: ${GREEN}$UPTIME${NC}"
  echo -e "      URL:    ${CYAN}http://localhost:4445${NC}"
  
  # Test frontend
  if command -v curl >/dev/null 2>&1; then
    echo -n "      HTTP:   "
    HTTP=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3334 2>/dev/null || echo "000")
    if [ "$HTTP" = "200" ]; then
      echo -e "${GREEN}✅ OK (HTTP $HTTP)${NC}"
    else
      echo -e "${YELLOW}⚠️  HTTP $HTTP${NC}"
    fi
  fi
else
  echo -e "      Status: ${RED}❌ STOPPED${NC}"
  echo -e "      ${YELLOW}Run: ./start.sh to start${NC}"
fi
echo

# Check Cloudflare Tunnel
echo -e "${BLUE}[3/3] Cloudflare Tunnel${NC}"
if pgrep -f "cloudflared tunnel --config.*config-heyphom.yml" > /dev/null; then
  PIDS=$(pgrep -f "cloudflared tunnel --config.*config-heyphom.yml")
  PID=$(echo "$PIDS" | head -1)
  UPTIME=$(ps -o etime= -p $PID | tr -d ' ')
  COUNT=$(echo "$PIDS" | wc -l | tr -d ' ')
  echo -e "      Status:     ${GREEN}✅ RUNNING${NC}"
  echo -e "      PID:        ${GREEN}$PID${NC}"
  echo -e "      Uptime:     ${GREEN}$UPTIME${NC}"
  echo -e "      Processes:  ${GREEN}$COUNT${NC}"
  echo -e "      Config:     ${CYAN}config-heyphom.yml${NC}"
  echo -e "      Public URL: ${CYAN}https://heyphom.truyenthong.edu.vn${NC}"
  
  # Check connections from log
  if [ -f /tmp/heyphom-tunnel.log ]; then
    CONNECTIONS=$(grep "Registered tunnel connection" /tmp/heyphom-tunnel.log | tail -4 | wc -l | tr -d ' ')
    if [ "$CONNECTIONS" -gt 0 ]; then
      echo -e "      Connections: ${GREEN}$CONNECTIONS active${NC}"
    fi
  fi
else
  echo -e "      Status: ${RED}❌ STOPPED${NC}"
  echo -e "      ${YELLOW}Run: ./start.sh to start${NC}"
fi
echo

# Summary table
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📋 Process Summary${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo
--config.*config-heyphom.yml
PROCESSES=$(ps aux | grep -E "node.*4444|node.*vite|cloudflared tunnel run heyphom" | grep -v grep)
if [ -n "$PROCESSES" ]; then
  echo "$PROCESSES" | awk '{
    printf "%-8s %-10s %-6s %-6s %s %s %s %s\n", 
    $2, $3"%", $4"%", $6"K", $11, $12, $13, $14
  }' | while read line; do
    echo -e "   ${GREEN}$line${NC}"
  done
else
  echo -e "   ${YELLOW}No HeyPhom processes running${NC}"
fi
echo

# Access URLs
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}🌐 Access URLs${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "   ${CYAN}Public:${NC}  https://heyphom.truyenthong.edu.vn"
echo -e "   ${CYAN}Local:${NC}   http://localhost:4445"
echo -e "   ${CYAN}Backend:${NC} http://localhost:4444"
echo -e "   ${CYAN}API:${NC}     http://localhost:4444/api/info"
echo -e "   ${CYAN}Health:${NC}  http://localhost:4444/health"
echo

# System Resources
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}💻 System Resources${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

# CPU Usage
if command -v top >/dev/null 2>&1; then
  CPU=$(top -l 1 | grep "CPU usage" | awk '{print $3}' | sed 's/%//')
  echo -e "   CPU Usage:  ${GREEN}${CPU}%${NC}"
fi

# Memory Usage
if command -v vm_stat >/dev/null 2>&1; then
  PAGES=$(vm_stat | grep "Pages active" | awk '{print $3}' | sed 's/\.//')
  USED_MB=$((PAGES * 4096 / 1024 / 1024))
  echo -e "   Memory:     ${GREEN}~${USED_MB} MB used${NC}"
fi

# Disk Space
DISK=$(df -h /Users/mac/HeyPhom | tail -1 | awk '{print $5}')
echo -e "   Disk:       ${GREEN}$DISK used${NC}"
echo

# Log Files
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}📝 Log Files${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

for LOG in backend frontend tunnel; do
  FILE="/tmp/heyphom-${LOG}.log"
  if [ -f "$FILE" ]; then
    SIZE=$(du -h "$FILE" | awk '{print $1}')
    LINES=$(wc -l < "$FILE" | tr -d ' ')
    echo -e "   ${CYAN}${LOG}:${NC} $FILE (${GREEN}$SIZE, $LINES lines${NC})"
  else
    echo -e "   ${CYAN}${LOG}:${NC} ${YELLOW}No log file${NC}"
  fi
done
echo

# Commands
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BLUE}💡 Available Commands${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "   ${GREEN}./start.sh${NC}    - Start all services"
echo -e "   ${GREEN}./stop.sh${NC}     - Stop all services"
echo -e "   ${GREEN}./restart.sh${NC}  - Restart all services"
echo -e "   ${GREEN}./status.sh${NC}   - Show this status (refresh)"
echo
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo
