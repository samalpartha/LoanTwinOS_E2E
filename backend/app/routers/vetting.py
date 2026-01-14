"""
Vetting Router - Document Verification Workflow API
Manages document checklists, uploads, and verification status
"""
from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
import os
import uuid

from ..services.vetting import get_vetting_service
from ..services.demo_data import seed_document_requirements

router = APIRouter(prefix="/vetting", tags=["Document Vetting"])


class VerificationRequest(BaseModel):
    """Request to verify or reject a document."""
    verified: bool
    rejection_reason: Optional[str] = None
    verifier_id: Optional[int] = None


@router.get("/checklist/{loan_type}")
def get_checklist(loan_type: str):
    """Get document checklist for a loan type."""
    service = get_vetting_service()
    checklist = service.get_checklist(loan_type)
    
    if not checklist:
        # Try to seed requirements if none exist
        seed_result = seed_document_requirements()
        checklist = service.get_checklist(loan_type)
    
    return {
        "loan_type": loan_type,
        "requirements": checklist,
        "total_required": sum(1 for r in checklist if r.get("required", False)),
        "total_optional": sum(1 for r in checklist if not r.get("required", False))
    }


@router.get("/checklists")
def get_all_checklists():
    """Get all document checklists grouped by loan type."""
    service = get_vetting_service()
    checklists = service.get_all_checklists()
    
    if not checklists:
        seed_document_requirements()
        checklists = service.get_all_checklists()
    
    return {
        "loan_types": list(checklists.keys()),
        "checklists": checklists
    }


@router.get("/status/{application_id}")
def get_vetting_status(application_id: int):
    """Get complete vetting status for a loan application."""
    service = get_vetting_service()
    status = service.get_vetting_status(application_id)
    
    if "error" in status:
        raise HTTPException(404, status["error"])
    
    return status


@router.post("/submit/{application_id}")
async def submit_document(
    application_id: int,
    requirement_id: int = Form(...),
    file: UploadFile = File(...)
):
    """Upload a document for verification."""
    service = get_vetting_service()
    
    # Validate file
    if not file.filename:
        raise HTTPException(400, "No file provided")
    
    # Allowed file types
    allowed_types = [
        "application/pdf", 
        "image/jpeg", 
        "image/png",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ]
    
    content_type = file.content_type or "application/octet-stream"
    if content_type not in allowed_types:
        # Allow anyway but note it
        pass
    
    # Read file content
    content = await file.read()
    file_size = len(content)
    
    # Max 10MB
    if file_size > 10 * 1024 * 1024:
        raise HTTPException(400, "File too large (max 10MB)")
    
    # Save file
    upload_dir = os.path.join(
        os.path.dirname(__file__), "..", "..", "data", "vetting_docs", str(application_id)
    )
    os.makedirs(upload_dir, exist_ok=True)
    
    # Generate unique filename
    ext = os.path.splitext(file.filename)[1]
    unique_name = f"{uuid.uuid4()}{ext}"
    file_path = os.path.join(upload_dir, unique_name)
    
    with open(file_path, 'wb') as f:
        f.write(content)
    
    # Submit to vetting service
    result = service.submit_document(
        application_id=application_id,
        requirement_id=requirement_id,
        file_path=file_path,
        original_filename=file.filename,
        file_size=file_size,
        mime_type=content_type
    )
    
    if "error" in result:
        raise HTTPException(400, result["error"])
    
    return result


@router.post("/verify/{submission_id}")
def verify_document(submission_id: int, request: VerificationRequest):
    """Verify or reject a submitted document."""
    service = get_vetting_service()
    
    result = service.verify_document(
        submission_id=submission_id,
        verified=request.verified,
        verifier_id=request.verifier_id,
        rejection_reason=request.rejection_reason
    )
    
    if "error" in result:
        raise HTTPException(400, result["error"])
    
    return result


@router.get("/queue")
def get_verification_queue():
    """Get all pending document verifications."""
    service = get_vetting_service()
    pending = service.get_pending_verifications()
    
    return {
        "pending_count": len(pending),
        "verifications": pending
    }


@router.post("/ai-verify/{submission_id}")
def ai_verify_document(submission_id: int):
    """Run AI verification on a submitted document."""
    service = get_vetting_service()
    result = service.auto_verify_with_ai(submission_id)
    
    if "error" in result:
        raise HTTPException(400, result["error"])
    
    return result


@router.get("/ready/{application_id}")
def check_ready_for_approval(application_id: int):
    """Check if application is ready for final approval."""
    service = get_vetting_service()
    ready = service.is_ready_for_approval(application_id)
    
    return {
        "application_id": application_id,
        "ready_for_approval": ready,
        "message": "All required documents verified" if ready else "Missing or unverified documents"
    }


@router.post("/seed-requirements")
def seed_requirements():
    """Seed document requirements templates."""
    return seed_document_requirements()


@router.get("/health")
def vetting_health():
    """Health check for vetting service."""
    service = get_vetting_service()
    checklists = service.get_all_checklists()
    
    return {
        "status": "healthy",
        "loan_types_configured": list(checklists.keys()),
        "total_requirements": sum(len(v) for v in checklists.values())
    }
