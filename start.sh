#!/bin/bash
# EPM Commercial - Quick Start Script

echo "=========================================="
echo "  EPM Commercial - Employee Monitor"
echo "  Quick Start Script"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}Error: Node.js is not installed${NC}"
    echo "Please install Node.js 20.x from https://nodejs.org"
    exit 1
fi

echo -e "${GREEN}Node.js found:${NC} $(node --version)"

# Function to start backend
start_backend() {
    echo ""
    echo -e "${YELLOW}Starting Backend API...${NC}"
    cd /workspace/backend

    if [ ! -d "node_modules" ]; then
        echo "Installing backend dependencies..."
        npm install
    fi

    npm run dev &
    echo "Backend running at http://localhost:3000"
}

# Function to start frontend
start_frontend() {
    echo ""
    echo -e "${YELLOW}Starting Web Portal...${NC}"
    cd /workspace/epm-web

    if [ ! -d "node_modules" ]; then
        echo "Installing frontend dependencies..."
        npm install
    fi

    npm run dev &
    echo "Frontend running at http://localhost:5173"
}

# Function to start desktop (will only work on Windows)
start_desktop() {
    echo ""
    echo -e "${YELLOW}Starting Desktop Agent...${NC}"
    cd /workspace/desktop

    if [ ! -d "node_modules" ]; then
        echo "Installing desktop dependencies..."
        npm install
    fi

    npm run dev &
    echo "Desktop agent starting (Windows only)"
}

# Main menu
echo ""
echo "What would you like to do?"
echo ""
echo "1) Start Backend API only"
echo "2) Start Web Portal only"
echo "3) Start Desktop Agent only (Windows)"
echo "4) Start Backend + Web Portal"
echo "5) Start all components"
echo "6) Build for production"
echo "7) Exit"
echo ""

read -p "Enter option (1-7): " option

case $option in
    1)
        start_backend
        ;;
    2)
        start_frontend
        ;;
    3)
        start_desktop
        ;;
    4)
        start_backend
        sleep 2
        start_frontend
        ;;
    5)
        start_backend
        sleep 2
        start_frontend
        sleep 2
        start_desktop
        ;;
    6)
        echo ""
        echo -e "${YELLOW}Building for production...${NC}"
        echo ""
        echo "Building Web Portal..."
        cd /workspace/epm-web
        npm run build
        echo ""
        echo -e "${GREEN}Web Portal built at: dist/${NC}"
        echo ""
        echo "To build Desktop Agent, run on Windows:"
        echo "  cd desktop && npm run build:win"
        ;;
    7)
        echo "Goodbye!"
        exit 0
        ;;
    *)
        echo "Invalid option"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}Services started!${NC}"
echo ""
echo "View running services:"
echo "  ps aux | grep node"
echo ""
echo "Stop all services:"
echo "  pkill -f node"
echo ""