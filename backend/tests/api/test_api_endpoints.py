"""
API tests for all backend endpoints.
"""
import pytest
from fastapi import status


class TestAPIEndpoints:
    """Test suite for API endpoints."""
    
    def test_create_loan_api(self, test_client):
        """Test POST /api/loans endpoint."""
        loan_data = {"name": "API Test Loan", "creator_id": 1}
        response = test_client.post("/api/loans", json=loan_data)
        assert response.status_code == status.HTTP_200_OK
        assert "id" in response.json()
    
    def test_get_loan_by_id(self, test_client):
        """Test GET /api/loans/{loan_id} endpoint."""
        # Create a loan first
        loan_data = {"name": "Test Loan", "creator_id": 1}
        create_response = test_client.post("/api/loans", json=loan_data)
        loan_id = create_response.json()["id"]
        
        # Get the loan
        response = test_client.get(f"/api/loans/{loan_id}")
        assert response.status_code == status.HTTP_200_OK
    
    def test_get_obligations_api(self, test_client):
        """Test GET /api/loans/{loan_id}/obligations endpoint."""
        # Create a loan first
        loan_data = {"name": "Test Loan", "creator_id": 1}
        create_response = test_client.post("/api/loans", json=loan_data)
        loan_id = create_response.json()["id"]
        
        response = test_client.get(f"/api/loans/{loan_id}/obligations")
        assert response.status_code == status.HTTP_200_OK
        assert isinstance(response.json(), list)
    
    def test_get_clauses_api(self, test_client):
        """Test GET /api/loans/{loan_id}/clauses endpoint."""
        # Create a loan first
        loan_data = {"name": "Test Loan", "creator_id": 1}
        create_response = test_client.post("/api/loans", json=loan_data)
        loan_id = create_response.json()["id"]
        
        response = test_client.get(f"/api/loans/{loan_id}/clauses")
        assert response.status_code == status.HTTP_200_OK
        assert isinstance(response.json(), list)
    
    def test_experts_api(self, test_client):
        """Test GET /api/experts endpoint."""
        response = test_client.get("/api/experts")
        # Should exist and return data or 404
        assert response.status_code in [status.HTTP_200_OK, status.HTTP_404_NOT_FOUND]
    
    def test_api_response_format(self, test_client):
        """Test that API responses are in JSON format."""
        loan_data = {"name": "Test Loan", "creator_id": 1}
        response = test_client.post("/api/loans", json=loan_data)
        assert response.headers["content-type"] == "application/json"
    
    def test_api_error_handling(self, test_client):
        """Test API error responses."""
        response = test_client.get("/api/nonexistent-endpoint")
        assert response.status_code == status.HTTP_404_NOT_FOUND
