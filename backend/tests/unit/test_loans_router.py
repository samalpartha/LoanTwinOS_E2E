"""
Unit tests for loans router endpoints.
"""
import pytest
from fastapi import status


class TestLoansRouter:
    """Test suite for loans router."""
    
    def test_health_check(self, test_client):
        """Test the health check endpoint."""
        response = test_client.get("/api/health")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["ok"] == True
    
    def test_create_loan(self, test_client):
        """Test creating a new loan."""
        loan_data = {
            "name": "Test Loan",
            "creator_id": 1
        }
        response = test_client.post("/api/loans", json=loan_data)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "id" in data
        assert data["name"] == "Test Loan"
    
    def test_create_sample_loan(self, test_client):
        """Test creating a sample loan."""
        response = test_client.post("/api/loans/sample")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "id" in data
        assert "name" in data
    
    def test_get_loan_by_id(self, test_client):
        """Test retrieving a loan by ID."""
        # First create a loan
        loan_data = {"name": "Test Loan", "creator_id": 1}
        create_response = test_client.post("/api/loans", json=loan_data)
        loan_id = create_response.json()["id"]
        
        # Then retrieve it
        response = test_client.get(f"/api/loans/{loan_id}")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["id"] == loan_id
    
    def test_get_nonexistent_loan(self, test_client):
        """Test retrieving a non-existent loan."""
        response = test_client.get("/api/loans/99999")
        assert response.status_code == status.HTTP_404_NOT_FOUND
    
    def test_invalid_loan_data(self, test_client):
        """Test creating a loan with invalid data."""
        invalid_data = {"name": 123}  # name should be string
        response = test_client.post("/api/loans", json=invalid_data)
        # Should return 422 (validation error)
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY
