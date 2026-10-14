#!/usr/bin/env bash

# ==============================================================================
# EcoPulse — Unified Application Launcher
# ==============================================================================
# Usage:
#   ./run.sh          # Default: Runs API + Web Dashboard
#   ./run.sh all      # Runs API + Web Dashboard
#   ./run.sh full     # Runs API + Web Dashboard + Mobile (Expo)
#   ./run.sh web      # Runs API + Web Dashboard
#   ./run.sh api      # Runs Backend API only
#   ./run.sh mobile   # Runs Backend API + Mobile (Expo)
#   ./run.sh status   # Checks service health & port status
#   ./run.sh stop     # Gracefully shuts down running EcoPulse services
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Color Codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# Child PIDs tracking
PIDS=()

cleanup() {
  echo ""
  echo -e "${YELLOW}🛑 Shutting down EcoPulse services...${NC}"
  for pid in "${PIDS[@]}"; do
    if kill -0 "$pid" 2>/dev/null; then
      kill -TERM "$pid" 2>/dev/null || kill -9 "$pid" 2>/dev/null
    fi
  done
  wait 2>/dev/null
  echo -e "${GREEN}✓ All services stopped cleanly.${NC}"
  exit 0
}

trap cleanup INT TERM

kill_port() {
  local port=$1
  local pids
  pids=$(lsof -ti :"$port" 2>/dev/null || true)
  if [ -n "$pids" ]; then
    echo -e "${YELLOW}  Freeing port $port (Killing PID(s): $pids)...${NC}"
    echo "$pids" | xargs kill -9 2>/dev/null || true
    sleep 0.5
  fi
}

check_prerequisites() {
  echo -e "${BOLD}${BLUE}==> 1. Checking Prerequisites...${NC}"

  # Check Node
  if ! command -v node >/dev/null 2>&1; then
    echo -e "${RED}Error: Node.js is not installed. Please install Node.js v20+.${NC}"
    exit 1
  fi
  NODE_VER=$(node -v)
  echo -e "  ${GREEN}✓${NC} Node.js version: $NODE_VER"

  # Check pnpm
  if ! command -v pnpm >/dev/null 2>&1; then
    echo -e "${RED}Error: pnpm is not installed. Run 'npm install -g pnpm'.${NC}"
    exit 1
  fi
  PNPM_VER=$(pnpm -v)
  echo -e "  ${GREEN}✓${NC} pnpm version: $PNPM_VER"

  # Check .env
  if [ ! -f .env ]; then
    if [ -f .env.example ]; then
      echo -e "${YELLOW}  ⚠️  .env not found. Copying from .env.example...${NC}"
      cp .env.example .env
      echo -e "  ${GREEN}✓${NC} Created .env from .env.example"
    else
      echo -e "${RED}Error: Neither .env nor .env.example found.${NC}"
      exit 1
    fi
  else
    echo -e "  ${GREEN}✓${NC} .env file present"
  fi

  # Check node_modules
  if [ ! -d "node_modules" ] || [ ! -d "apps/api/node_modules" ] || [ ! -d "apps/web/node_modules" ]; then
    echo -e "${YELLOW}  Installing dependencies with pnpm...${NC}"
    pnpm install
  else
    echo -e "  ${GREEN}✓${NC} Monorepo dependencies installed"
  fi
}

check_database() {
  echo -e "${BOLD}${BLUE}==> 2. Verifying Database Connection & Migrations...${NC}"
  if pnpm --filter @ecopulse/api db:check >/dev/null 2>&1; then
    echo -e "  ${GREEN}✓${NC} PostgreSQL database is reachable"
  else
    echo -e "  ${YELLOW}⚠️  Database check returned an error. Verify your DATABASE_URL in .env if needed.${NC}"
  fi
}

show_status() {
  echo -e "${BOLD}${CYAN}======================================================${NC}"
  echo -e "${BOLD}${CYAN}            EcoPulse Service Status Monitor           ${NC}"
  echo -e "${BOLD}${CYAN}======================================================${NC}"
  
  echo -e "\n${BOLD}Ports:${NC}"
  for port in 4000 3000 8081; do
    local pid
    pid=$(lsof -ti :"$port" 2>/dev/null || true)
    if [ -n "$pid" ]; then
      echo -e "  • Port ${BOLD}$port${NC}: ${GREEN}IN USE${NC} (PID: $pid)"
    else
      echo -e "  • Port ${BOLD}$port${NC}: ${YELLOW}FREE${NC}"
    fi
  done

  echo -e "\n${BOLD}Health Checks:${NC}"
  if curl -s http://localhost:4000/health >/dev/null 2>&1; then
    echo -e "  • API (http://localhost:4000/health): ${GREEN}UP${NC}"
    local sys_stat
    sys_stat=$(curl -s http://localhost:4000/api/system/status 2>/dev/null || true)
    if [ -n "$sys_stat" ]; then
      echo -e "    $sys_stat"
    fi
  else
    echo -e "  • API (http://localhost:4000/health): ${RED}DOWN / NOT RUNNING${NC}"
  fi

  if curl -s http://localhost:3000 >/dev/null 2>&1; then
    echo -e "  • Web Dashboard (http://localhost:3000): ${GREEN}UP${NC}"
  else
    echo -e "  • Web Dashboard (http://localhost:3000): ${YELLOW}DOWN / NOT RUNNING${NC}"
  fi

  echo ""
}

stop_services() {
  echo -e "${YELLOW}Stopping all EcoPulse services running on ports 4000, 3000, 8081...${NC}"
  kill_port 4000
  kill_port 3000
  kill_port 8081
  echo -e "${GREEN}✓ All services stopped.${NC}"
}

run_api() {
  echo -e "${BOLD}${GREEN}==> Launching EcoPulse API Server (Port 4000)...${NC}"
  kill_port 4000
  pnpm --filter @ecopulse/api dev &
  PIDS+=($!)
}

run_web() {
  echo -e "${BOLD}${GREEN}==> Launching EcoPulse Web Dashboard (Port 3000)...${NC}"
  kill_port 3000
  pnpm --filter @ecopulse/web dev &
  PIDS+=($!)
}

run_mobile() {
  echo -e "${BOLD}${GREEN}==> Launching EcoPulse Mobile Metro Bundler (Port 8081)...${NC}"
  kill_port 8081
  pnpm --filter @ecopulse/mobile start &
  PIDS+=($!)
}

# ------------------------------------------------------------------------------
# Command Routing
# ------------------------------------------------------------------------------
MODE="${1:-all}"

case "$MODE" in
  status)
    show_status
    exit 0
    ;;
  stop)
    stop_services
    exit 0
    ;;
  help|-h|--help)
    echo -e "${BOLD}EcoPulse Launcher Usage:${NC}"
    echo -e "  ./run.sh          - Runs API + Web Dashboard (default)"
    echo -e "  ./run.sh all      - Runs API + Web Dashboard"
    echo -e "  ./run.sh full     - Runs API + Web Dashboard + Mobile (Expo)"
    echo -e "  ./run.sh web      - Runs API + Web Dashboard"
    echo -e "  ./run.sh api      - Runs Backend API only (port 4000)"
    echo -e "  ./run.sh mobile   - Runs Backend API + Mobile (Expo Metro)"
    echo -e "  ./run.sh status   - Check health of services and ports"
    echo -e "  ./run.sh stop     - Stop all services on ports 4000, 3000, 8081"
    exit 0
    ;;
  all|web|"")
    check_prerequisites
    check_database
    echo -e "${BOLD}${CYAN}======================================================${NC}"
    echo -e "${BOLD}${CYAN}       🌲 Starting EcoPulse (API + Web Dashboard)     ${NC}"
    echo -e "${BOLD}${CYAN}======================================================${NC}"
    echo -e "  • Web Dashboard : ${BOLD}http://localhost:3000${NC}"
    echo -e "  • Backend API   : ${BOLD}http://localhost:4000${NC}"
    echo -e "  • API Health    : ${BOLD}http://localhost:4000/health${NC}"
    echo -e "  • System Status : ${BOLD}http://localhost:4000/api/system/status${NC}"
    echo -e "  • Press ${BOLD}Ctrl+C${NC} anytime to stop all services cleanly."
    echo -e "${CYAN}------------------------------------------------------${NC}\n"
    run_api
    sleep 2
    run_web
    wait
    ;;
  api)
    check_prerequisites
    check_database
    echo -e "${BOLD}${CYAN}======================================================${NC}"
    echo -e "${BOLD}${CYAN}             🌲 Starting EcoPulse API Server          ${NC}"
    echo -e "${BOLD}${CYAN}======================================================${NC}"
    echo -e "  • Backend API   : ${BOLD}http://localhost:4000${NC}"
    echo -e "  • API Health    : ${BOLD}http://localhost:4000/health${NC}"
    echo -e "  • System Status : ${BOLD}http://localhost:4000/api/system/status${NC}"
    echo -e "  • Press ${BOLD}Ctrl+C${NC} anytime to stop."
    echo -e "${CYAN}------------------------------------------------------${NC}\n"
    run_api
    wait
    ;;
  mobile)
    check_prerequisites
    check_database
    echo -e "${BOLD}${CYAN}======================================================${NC}"
    echo -e "${BOLD}${CYAN}        🌲 Starting EcoPulse (API + Mobile Metro)     ${NC}"
    echo -e "${BOLD}${CYAN}======================================================${NC}"
    echo -e "  • Backend API   : ${BOLD}http://localhost:4000${NC}"
    echo -e "  • Mobile Metro  : ${BOLD}http://localhost:8081${NC}"
    echo -e "  • Press ${BOLD}Ctrl+C${NC} anytime to stop."
    echo -e "${CYAN}------------------------------------------------------${NC}\n"
    run_api
    sleep 2
    run_mobile
    wait
    ;;
  full)
    check_prerequisites
    check_database
    echo -e "${BOLD}${CYAN}======================================================${NC}"
    echo -e "${BOLD}${CYAN}    🌲 Starting EcoPulse Full Stack (API+Web+Mobile)  ${NC}"
    echo -e "${BOLD}${CYAN}======================================================${NC}"
    echo -e "  • Web Dashboard : ${BOLD}http://localhost:3000${NC}"
    echo -e "  • Backend API   : ${BOLD}http://localhost:4000${NC}"
    echo -e "  • Mobile Metro  : ${BOLD}http://localhost:8081${NC}"
    echo -e "  • Press ${BOLD}Ctrl+C${NC} anytime to stop all services cleanly."
    echo -e "${CYAN}------------------------------------------------------${NC}\n"
    run_api
    sleep 2
    run_web
    sleep 1
    run_mobile
    wait
    ;;
  *)
    echo -e "${RED}Unknown mode: $MODE${NC}"
    echo "Run './run.sh --help' for options."
    exit 1
    ;;
esac
