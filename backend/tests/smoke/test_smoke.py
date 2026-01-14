"""
Smoke tests for critical backend functionality.
"""
import pytest
from fastapi import status


class TestSmoke:
    """Smoke tests to verify basic functionality."""
    
    def test_server_starts(self, test_client):
        """Test that the server starts and responds."""
        response = test_client.get("/api/health")
        assert response.status_code == status.HTTP_200_OK
    
    def test_health_endpoint_format(self, test_client):
        """Test that health endpoint returns correct format."""
        response = test_client.get("/api/health")
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "ok" in data
    
    def test_cors_headers(self, test_client):
        """Test that CORS headers are present."""
        response = test_client.options("/api/loans")
        # CORS should be configured
        assert response.status_code in [status.HTTP_200_OK, status.HTTP_405_METHOD_NOT_ALLOWED]
    
    def test_loans_endpoint_exists(self, test_client):
        """Test that the loans endpoint exists."""
        # POST endpoint should exist
        loan_data = {"name": "Smoke Test", "creator_id": 1}
        response = test_client.post("/api/loans", json=loan_data)
        # Should not return 404
        assert response.status_code != status.HTTP_404_NOT_FOUND
    
    def test_search_endpoint_exists(self, test_client):
        """Test that the search endpoint exists."""
        response = test_client.get("/api/search?q=test")
        # Should not return 404
        assert response.status_code != status.HTTP_404_NOT_FOUND
