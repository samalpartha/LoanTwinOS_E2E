"""
Vetting Service - Document Verification Workflow
Manages document checklists, submissions, and verification status
"""
from typing import Dict, List, Any, Optional
from sqlmodel import Session, select
from datetime import datetime
import os

from ..db import engine
from ..models.tables import LoanApplication, DocumentRequirement, SubmittedDocument


class VettingService:
    """Service for managing loan application vetting workflow."""
    
    def __init__(self):
        self.upload_dir = os.path.join(
            os.path.dirname(__file__), "..", "..", "data", "vetting_docs"
        )
        os.makedirs(self.upload_dir, exist_ok=True)
    
    def get_checklist(self, loan_type: str) -> List[Dict[str, Any]]:
        """Get required documents for a loan type."""
        with Session(engine) as session:
            requirements = session.exec(
                select(DocumentRequirement)
                .where(DocumentRequirement.loan_type == loan_type)
                .order_by(DocumentRequirement.order)
            ).all()
            
            return [req.model_dump() for req in requirements]
    
    def get_all_checklists(self) -> Dict[str, List[Dict[str, Any]]]:
        """Get all document checklists grouped by loan type."""
        with Session(engine) as session:
            all_reqs = session.exec(
                select(DocumentRequirement).order_by(DocumentRequirement.order)
            ).all()
            
            grouped = {}
            for req in all_reqs:
                if req.loan_type not in grouped:
                    grouped[req.loan_type] = []
                grouped[req.loan_type].append(req.model_dump())
            
            return grouped
    
    def get_vetting_status(self, application_id: int) -> Dict[str, Any]:
        """Get complete vetting status for an application."""
        with Session(engine) as session:
            application = session.get(LoanApplication, application_id)
            if not application:
                return {"error": "Application not found"}
            
            # Get required documents for this loan type
            requirements = session.exec(
                select(DocumentRequirement)
                .where(DocumentRequirement.loan_type == application.loan_type)
                .order_by(DocumentRequirement.order)
            ).all()
            
            # Get submitted documents
            submissions = session.exec(
                select(SubmittedDocument)
                .where(SubmittedDocument.loan_application_id == application_id)
            ).all()
            
            # Build status report
            submitted_req_ids = {s.requirement_id: s for s in submissions}
            
            checklist = []
            required_count = 0
            submitted_count = 0
            verified_count = 0
            rejected_count = 0
            
            for req in requirements:
                submission = submitted_req_ids.get(req.id)
                
                item = {
                    "requirement_id": req.id,
                    "document_name": req.document_name,
                    "description": req.description,
                    "required": req.required,
                    "verification_type": req.verification_type,
                    "status": "not_submitted"
                }
                
                if req.required:
                    required_count += 1
                
                if submission:
                    submitted_count += 1
                    item["status"] = submission.status
                    item["submission_id"] = submission.id
                    item["filename"] = submission.original_filename
                    item["submitted_at"] = submission.submitted_at.isoformat()
                    
                    if submission.status == "verified":
                        verified_count += 1
                    elif submission.status == "rejected":
                        rejected_count += 1
                        item["rejection_reason"] = submission.rejection_reason
                    
                    if submission.ai_analysis:
                        item["ai_analysis"] = submission.ai_analysis
                
                checklist.append(item)
            
            # Calculate completion percentage
            if required_count > 0:
                completion = (verified_count / required_count) * 100
            else:
                completion = 100 if verified_count == submitted_count else 0
            
            # Determine overall status
            if rejected_count > 0:
                overall_status = "has_issues"
            elif verified_count == required_count and required_count > 0:
                overall_status = "complete"
            elif submitted_count > 0:
                overall_status = "in_progress"
            else:
                overall_status = "not_started"
            
            return {
                "application_id": application_id,
                "loan_type": application.loan_type,
                "overall_status": overall_status,
                "completion_percentage": round(completion, 1),
                "required_documents": required_count,
                "submitted_documents": submitted_count,
                "verified_documents": verified_count,
                "rejected_documents": rejected_count,
                "ready_for_approval": overall_status == "complete",
                "checklist": checklist
            }
    
    def submit_document(
        self, 
        application_id: int, 
        requirement_id: int, 
        file_path: str,
        original_filename: str,
        file_size: int,
        mime_type: Optional[str] = None
    ) -> Dict[str, Any]:
        """Submit a document for verification."""
        with Session(engine) as session:
            # Verify application exists
            application = session.get(LoanApplication, application_id)
            if not application:
                return {"error": "Application not found"}
            
            # Verify requirement exists
            requirement = session.get(DocumentRequirement, requirement_id)
            if not requirement:
                return {"error": "Document requirement not found"}
            
            # Check if already submitted
            existing = session.exec(
                select(SubmittedDocument)
                .where(SubmittedDocument.loan_application_id == application_id)
                .where(SubmittedDocument.requirement_id == requirement_id)
            ).first()
            
            if existing:
                # Update existing submission
                existing.file_path = file_path
                existing.original_filename = original_filename
                existing.file_size = file_size
                existing.mime_type = mime_type
                existing.status = "pending"
                existing.submitted_at = datetime.utcnow()
                existing.rejection_reason = None
                session.add(existing)
                session.commit()
                session.refresh(existing)
                
                return {
                    "status": "updated",
                    "submission_id": existing.id,
                    "message": "Document re-submitted for verification"
                }
            
            # Create new submission
            submission = SubmittedDocument(
                loan_application_id=application_id,
                requirement_id=requirement_id,
                file_path=file_path,
                original_filename=original_filename,
                file_size=file_size,
                mime_type=mime_type,
                status="pending"
            )
            session.add(submission)
            session.commit()
            session.refresh(submission)
            
            return {
                "status": "submitted",
                "submission_id": submission.id,
                "message": "Document submitted for verification"
            }
    
    def verify_document(
        self, 
        submission_id: int, 
        verified: bool, 
        verifier_id: Optional[int] = None,
        rejection_reason: Optional[str] = None
    ) -> Dict[str, Any]:
        """Verify or reject a submitted document."""
        with Session(engine) as session:
            submission = session.get(SubmittedDocument, submission_id)
            if not submission:
                return {"error": "Submission not found"}
            
            if verified:
                submission.status = "verified"
                submission.rejection_reason = None
            else:
                submission.status = "rejected"
                submission.rejection_reason = rejection_reason or "Document does not meet requirements"
            
            submission.verified_by = verifier_id
            submission.verified_at = datetime.utcnow()
            session.add(submission)
            session.commit()
            
            return {
                "status": "success",
                "submission_id": submission_id,
                "verification_status": submission.status,
                "message": f"Document {'verified' if verified else 'rejected'}"
            }
    
    def get_pending_verifications(self) -> List[Dict[str, Any]]:
        """Get all pending document verifications."""
        with Session(engine) as session:
            pending = session.exec(
                select(SubmittedDocument)
                .where(SubmittedDocument.status == "pending")
                .order_by(SubmittedDocument.submitted_at)
            ).all()
            
            results = []
            for sub in pending:
                # Get related info
                application = session.get(LoanApplication, sub.loan_application_id)
                requirement = session.get(DocumentRequirement, sub.requirement_id)
                
                results.append({
                    "submission_id": sub.id,
                    "application_id": sub.loan_application_id,
                    "requirement_id": sub.requirement_id,
                    "document_name": requirement.document_name if requirement else "Unknown",
                    "filename": sub.original_filename,
                    "file_size": sub.file_size,
                    "submitted_at": sub.submitted_at.isoformat(),
                    "loan_amount": application.loan_amount if application else 0,
                    "grade": application.grade if application else "Unknown",
                    "verification_type": requirement.verification_type if requirement else "manual"
                })
            
            return results
    
    def is_ready_for_approval(self, application_id: int) -> bool:
        """Check if application has all required documents verified."""
        status = self.get_vetting_status(application_id)
        return status.get("ready_for_approval", False)
    
    def auto_verify_with_ai(self, submission_id: int) -> Dict[str, Any]:
        """Placeholder for AI-based document verification."""
        # This would integrate with document AI services
        # For now, return a simulated result
        
        with Session(engine) as session:
            submission = session.get(SubmittedDocument, submission_id)
            if not submission:
                return {"error": "Submission not found"}
            
            # Simulate AI analysis
            analysis = {
                "confidence": 0.92,
                "document_type_match": True,
                "data_extracted": {
                    "document_date": "2025-01-10",
                    "issuer": "Sample Bank",
                    "key_values_found": True
                },
                "issues": []
            }
            
            submission.ai_analysis = str(analysis)
            session.add(submission)
            session.commit()
            
            return {
                "status": "analyzed",
                "submission_id": submission_id,
                "analysis": analysis,
                "recommendation": "verify" if analysis["confidence"] > 0.8 else "manual_review"
            }


# Singleton instance
_service = None

def get_vetting_service() -> VettingService:
    """Get or create the vetting service instance."""
    global _service
    if _service is None:
        _service = VettingService()
    return _service
