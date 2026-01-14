"""
Pytest configuration and shared fixtures for backend tests.
"""
import pytest
from fastapi.testclient import TestClient
from app.main import app


@pytest.fixture
def test_client():
    """
    Create a FastAPI TestClient for making test requests.
    """
    return TestClient(app)


@pytest.fixture
def sample_loan_data():
    """
    Sample loan data for testing.
    """
    return {
        "loan_id": "TEST-001",
        "borrower_name": "Test Borrower Inc.",
        "amount": 1000000.00,
        "currency": "USD",
        "interest_rate": 5.5,
        "term_months": 60,
        "status": "active"
    }


@pytest.fixture
def sample_workspace_data():
    """
    Sample workspace data for testing.
    """
    return {
        "workspace_id": "WS-TEST-001",
        "name": "Test Workspace",
        "description": "Test workspace for unit tests"
    }


@pytest.fixture
def mock_pdf_file():
    """
    Mock PDF file for testing file uploads.
    """
    from io import BytesIO
    content = b"%PDF-1.4\n%Test PDF content"
    return BytesIO(content)
