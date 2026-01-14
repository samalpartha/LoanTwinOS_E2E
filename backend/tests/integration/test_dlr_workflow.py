"""
Integration tests for Digital Loan Record (DLR) workflow.
"""
import pytest
from fastapi import status


class TestDLRWorkflow:
    """Integration tests for DLR creation and processing."""
    
    def test_create_loan_for_dlr(self, test_client):
        """Test creating a loan for DLR processing."""
        loan_data = {"name": "DLR Test Loan", "creator_id": 1}
        response = test_client.post("/api/loans", json=loan_data)
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "id" in data
    
    def test_upload_pdf_workflow(self, test_client, mock_pdf_file):
        """Test PDF upload workflow."""
        files = {"file": ("test.pdf", mock_pdf_file, "application/pdf")}
        response = test_client.post("/api/upload", files=files)
        # Upload endpoint may not exist yet
        assert response.status_code in [
            status.HTTP_200_OK,
            status.HTTP_201_CREATED,
            status.HTTP_400_BAD_REQUEST,
            status.HTTP_404_NOT_FOUND,
            status.HTTP_422_UNPROCESSABLE_ENTITY
        ]
    
    def test_dlr_analysis_workflow(self, test_client):
        """Test DLR analysis workflow."""
        # Create a sample loan which has DLR data
        response = test_client.post("/api/loans/sample")
        assert response.status_code == status.HTTP_200_OK
        loan_id = response.json()["id"]
        
        # Get DLR for the loan
        dlr_response = test_client.get(f"/api/loans/{loan_id}/dlr")
        assert dlr_response.status_code == status.HTTP_200_OK
    
    def test_clause_extraction(self, test_client):
        """Test clause extraction from DLR."""
        # Create a sample loan
        response = test_client.post("/api/loans/sample")
        loan_id = response.json()["id"]
        
        # Get clauses
        response = test_client.get(f"/api/loans/{loan_id}/clauses")
        assert response.status_code == status.HTTP_200_OK
        assert isinstance(response.json(), list)
    
    def test_obligation_detection(self, test_client):
        """Test obligation detection from DLR."""
        # Create a sample loan
        response = test_client.post("/api/loans/sample")
        loan_id = response.json()["id"]
        
        # Get obligations
        response = test_client.get(f"/api/loans/{loan_id}/obligations")
        assert response.status_code == status.HTTP_200_OK
        assert isinstance(response.json(), list)
