#!/bin/bash

# LoanTwin OS - Comprehensive Test Suite Runner
# This script runs all tests for both backend and frontend

set -e  # Exit on error

echo "======================================"
echo "LoanTwin OS - Running All Tests"
echo "======================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Track test results
BACKEND_PASSED=0
FRONTEND_PASSED=0

# Backend Tests
echo -e "${BLUE}[1/2] Running Backend Tests...${NC}"
echo "--------------------------------------"
cd backend

if pytest tests/ -v; then
    echo -e "${GREEN}✓ Backend tests passed${NC}"
    BACKEND_PASSED=1
else
    echo -e "${RED}✗ Backend tests failed${NC}"
fi

cd ..
echo ""

# Frontend Tests
echo -e "${BLUE}[2/2] Running Frontend Tests...${NC}"
echo "--------------------------------------"
cd frontend

if npm test -- --passWithNoTests; then
    echo -e "${GREEN}✓ Frontend tests passed${NC}"
    FRONTEND_PASSED=1
else
    echo -e "${RED}✗ Frontend tests failed${NC}"
fi

cd ..
echo ""

# Summary
echo "======================================"
echo "Test Summary"
echo "======================================"
if [ $BACKEND_PASSED -eq 1 ]; then
    echo -e "${GREEN}✓ Backend: PASSED${NC}"
else
    echo -e "${RED}✗ Backend: FAILED${NC}"
fi

if [ $FRONTEND_PASSED -eq 1 ]; then
    echo -e "${GREEN}✓ Frontend: PASSED${NC}"
else
    echo -e "${RED}✗ Frontend: FAILED${NC}"
fi

echo ""

# Exit with error if any tests failed
if [ $BACKEND_PASSED -eq 1 ] && [ $FRONTEND_PASSED -eq 1 ]; then
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed. Please review the output above.${NC}"
    exit 1
fi
