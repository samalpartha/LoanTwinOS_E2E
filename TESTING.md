# LoanTwin OS - Testing Suite

## Overview
This document provides instructions for running the comprehensive test suite for LoanTwin OS.

## Test Structure

### Backend Tests (Python/FastAPI)
- **Location**: `backend/tests/`
- **Framework**: pytest
- **Test Types**:
  - Unit tests: `tests/unit/`
  - Integration tests: `tests/integration/`
  - API tests: `tests/api/`
  - Smoke tests: `tests/smoke/`

### Frontend Tests (Next.js/TypeScript)
- **Location**: `frontend/__tests__/`
- **Framework**: Jest + React Testing Library
- **Test Types**:
  - Unit tests: `__tests__/unit/`
  - Integration tests: `__tests__/integration/`
  - Smoke tests: `__tests__/smoke/`

## Running Tests

### Prerequisites

**Backend:**
```bash
cd backend
pip install -r requirements.txt
```

**Frontend:**
```bash
cd frontend
npm install
```

### Run All Tests
```bash
./scripts/run-all-tests.sh
```

### Backend Tests Only

```bash
cd backend

# Run all backend tests
pytest

# Run specific test types
pytest tests/unit/          # Unit tests only
pytest tests/integration/   # Integration tests only
pytest tests/api/           # API tests only
pytest tests/smoke/         # Smoke tests only

# Run with coverage
pytest --cov=app --cov-report=html

# Run verbose
pytest -v
```

### Frontend Tests Only

```bash
cd frontend

# Run all frontend tests (Jest only, excludes E2E)
npm test

# Run specific test types
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests only
npm run test:smoke         # Smoke tests only

# Run E2E tests with Playwright
npm run test:e2e           # Run all E2E tests
npm run test:e2e:headed    # Run with visible browser
npm run test:e2e:debug     # Run in debug mode

# Run with coverage
npm run test:coverage

# Run in watch mode
npm run test:watch
```

## Test Status

### Backend Tests
**Status**: ✅ **28/28 passing (100%)**

- Unit Tests: 6/6 passing
- API Tests: 7/7 passing
- Integration Tests: 10/10 passing
- Smoke Tests: 5/5 passing
- **Coverage**: 32%

### Frontend Tests
**Status**: ✅ **23/23 Jest tests passing + 8 Playwright E2E tests**

- Unit Tests: API client tests
- Integration Tests: DLR workflow, Obligations
- Smoke Tests: Page loads, navigation
- E2E Tests: 8 comprehensive smoke tests with Playwright

## E2E Testing with Playwright

The frontend includes comprehensive E2E tests using Playwright:

### E2E Test Coverage
1. Home page loads with correct title
2. DLR page navigation and content
3. Obligations page navigation
4. Experts page navigation
5. Contact page navigation
6. Navigation links functionality
7. Console error detection
8. Responsive design (mobile & desktop)

### Running E2E Tests
```bash
cd frontend

# Run all E2E tests
npm run test:e2e

# Run with visible browser (headed mode)
npm run test:e2e:headed

# Debug mode with Playwright Inspector
npm run test:e2e:debug
```

### E2E Test Configuration
- **Browser**: Chromium (can be extended to Firefox, WebKit)
- **Base URL**: http://localhost:3001 (configurable via BASE_URL env var)
- **Reports**: HTML report generated at `playwright-report/`
- **Screenshots**: Captured on failure in `test-results/`

## Test Coverage

After running tests with coverage:

**Backend**: Open `backend/htmlcov/index.html` in your browser
**Frontend**: Coverage report will be displayed in terminal

## Continuous Testing

For development, use watch mode:

**Backend:**
```bash
cd backend
pytest-watch
```

**Frontend:**
```bash
cd frontend
npm run test:watch
```

## Writing New Tests

### Backend Test Example
```python
# backend/tests/unit/test_example.py
import pytest

def test_example(test_client):
    response = test_client.get("/api/endpoint")
    assert response.status_code == 200
```

### Frontend Test Example
```typescript
// frontend/__tests__/unit/example.test.ts
describe('Example Test', () => {
  it('should pass', () => {
    expect(true).toBe(true);
  });
});
```

## Troubleshooting

**Backend tests fail with import errors:**
- Ensure you're in the backend directory
- Run `pip install -r requirements.txt`

**Frontend tests fail with module errors:**
- Ensure you're in the frontend directory
- Run `npm install`
- Check that `jest.config.js` and `jest.setup.js` exist

**Tests pass locally but fail in script:**
- Ensure both backend and frontend servers are stopped
- Check that all dependencies are installed
