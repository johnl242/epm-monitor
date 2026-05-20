#!/bin/bash
# EPM Commercial - Production Build Script

echo "=========================================="
echo "  EPM Commercial - Production Build"
echo "=========================================="
echo ""

# Stop on error
set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Directories
BACKEND_DIR="/workspace/backend"
FRONTEND_DIR="/workspace/epm-web"
DESKTOP_DIR="/workspace/desktop"
OUTPUT_DIR="/workspace/build"

echo -e "${YELLOW}Creating output directory...${NC}"
mkdir -p $OUTPUT_DIR

# Build Frontend
echo ""
echo -e "${YELLOW}Building Web Admin Portal...${NC}"
cd $FRONTEND_DIR
npm install
npm run build
echo -e "${GREEN}Frontend built successfully${NC}"

# Copy frontend to output
cp -r $FRONTEND_DIR/dist $OUTPUT_DIR/web

# Build Backend
echo ""
echo -e "${YELLOW}Building Backend API...${NC}"
cd $BACKEND_DIR
npm install
tar -czf $OUTPUT_DIR/backend.tar.gz -C $BACKEND_DIR .
echo -e "${GREEN}Backend packaged successfully${NC}"

# Desktop Build Note
echo ""
echo -e "${YELLOW}Desktop Agent Build Instructions:${NC}"
echo "The Desktop Agent must be built on Windows."
echo ""
echo "On a Windows machine with Node.js 20.x:"
echo ""
echo "  1. Copy this project to Windows"
echo "  2. cd desktop"
echo "  3. npm install"
echo "  4. npm run build:win"
echo "  5. The installer will be at: dist/EPM Monitor Setup.exe"
echo ""

echo "=========================================="
echo -e "${GREEN}  Build Complete!${NC}"
echo "=========================================="
echo ""
echo "Output location: $OUTPUT_DIR"
echo ""
echo "Contents:"
echo "  - web/     : Web Admin Portal (deploy to CDN)"
echo "  - backend.tar.gz : Backend API (deploy to server)"
echo "  - desktop  : Build instructions above"
echo ""