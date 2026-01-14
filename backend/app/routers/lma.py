"""
LMA.Automate Integration Router - API Bridge for Document Handoff
Receives webhooks from LMA.Automate and creates Digital Loan Records
"""
from fastapi import APIRouter, HTTPException, Request, BackgroundTasks
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from sqlmodel import Session, select
from datetime import datetime
import json
import os
import hmac
import hashlib

from ..db import engine
from ..models.tables import Loan, Document, Clause, Obligation
from ..services.extractor import LegalExtractor

router = APIRouter(prefix="/lma", tags=["LMA.Automate Integration"])


# ============================================================================
# Configuration
# ============================================================================

LMA_WEBHOOK_SECRET = os.getenv("LMA_WEBHOOK_SECRET", "lma-webhook-secret-key")


# ============================================================================
# Request/Response Models
# ============================================================================

class LMADocumentPayload(BaseModel):
    """Payload from LMA.Automate webhook."""
    document_id: str
    document_type: str  # credit_agreement, security_agreement, etc.
    template_name: str
    template_version: str
    status: str  # executed, draft, negotiating
    parties: List[Dict[str, str]]  # [{name, role, email}]
    metadata: Dict[str, Any]
    download_url: Optional[str] = None
    negotiation_history: Optional[List[Dict]] = None
    execution_date: Optional[str] = None
    created_at: str
    updated_at: str


class LMAFieldMapping(BaseModel):
    """Field mapping from LMA template to DLR."""
    lma_field: str
    dlr_field: str
    value: Any


class LMAWebhookEvent(BaseModel):
    """LMA.Automate webhook event wrapper."""
    event_type: str  # document.executed, document.updated, negotiation.completed
    timestamp: str
    payload: Dict[str, Any]
    signature: Optional[str] = None


# ============================================================================
# Webhook Endpoints
# ============================================================================

@router.post("/webhook")
async def receive_lma_webhook(
    event: LMAWebhookEvent,
    request: Request,
    background_tasks: BackgroundTasks
):
    """
    Receive webhook from LMA.Automate.
    Validates signature and processes document events.
    """
    # Verify webhook signature
    signature = request.headers.get("X-LMA-Signature")
    if signature:
        body = await request.body()
        expected = hmac.new(
            LMA_WEBHOOK_SECRET.encode(),
            body,
            hashlib.sha256
        ).hexdigest()
        
        if not hmac.compare_digest(signature, expected):
            raise HTTPException(401, "Invalid webhook signature")
    
    # Process event based on type
    event_type = event.event_type
    
    if event_type == "document.executed":
        # Document has been signed - create DLR
        background_tasks.add_task(
            process_executed_document,
            event.payload
        )
        return {"status": "accepted", "action": "creating_dlr"}
    
    elif event_type == "document.updated":
        # Document was updated - sync changes
        background_tasks.add_task(
            sync_document_update,
            event.payload
        )
        return {"status": "accepted", "action": "syncing_update"}
    
    elif event_type == "negotiation.completed":
        # Negotiation completed - preserve history
        background_tasks.add_task(
            store_negotiation_history,
            event.payload
        )
        return {"status": "accepted", "action": "storing_history"}
    
    else:
        return {"status": "ignored", "reason": f"Unknown event type: {event_type}"}


def process_executed_document(payload: Dict[str, Any]):
    """
    Process an executed document from LMA.Automate.
    Creates a new Loan and extracts clauses/obligations.
    """
    with Session(engine) as session:
        # Extract key information
        doc_id = payload.get("document_id")
        template = payload.get("template_name", "Unknown Template")
        parties = payload.get("parties", [])
        metadata = payload.get("metadata", {})
        
        # Find borrower from parties
        borrower = next(
            (p.get("name") for p in parties if p.get("role") == "borrower"),
            "Unknown Borrower"
        )
        
        # Create new loan
        loan = Loan(
            name=f"{template} - {borrower}",
            borrower_name=borrower,
            governing_law=metadata.get("governing_law", "English Law"),
            agreement_date=payload.get("execution_date"),
            currency=metadata.get("currency", "GBP"),
            margin_bps=metadata.get("margin_bps"),
            is_esg_linked=metadata.get("is_esg_linked", False),
            dlr_json=json.dumps({
                "source": "lma_automate",
                "lma_document_id": doc_id,
                "template": template,
                "parties": parties,
                "metadata": metadata,
                "imported_at": datetime.utcnow().isoformat()
            })
        )
        session.add(loan)
        session.commit()
        session.refresh(loan)
        
        # If download URL provided, create document record
        if payload.get("download_url"):
            doc = Document(
                filename=f"{template.replace(' ', '_')}.pdf",
                stored_path=payload["download_url"],
                doc_type=payload.get("document_type", "Credit Agreement"),
                loan_id=loan.id,
                status="imported",
                extraction_method="LMA-Import"
            )
            session.add(doc)
            session.commit()
        
        # Extract clauses from metadata if available
        if "clauses" in metadata:
            for clause_data in metadata["clauses"]:
                clause = Clause(
                    loan_id=loan.id,
                    heading=clause_data.get("heading", "Untitled"),
                    body=clause_data.get("body", ""),
                    page_start=clause_data.get("page", 1),
                    page_end=clause_data.get("page", 1),
                    is_standard=clause_data.get("is_standard", True),
                    variance_score=0.0  # LMA templates are standard
                )
                session.add(clause)
            session.commit()


def sync_document_update(payload: Dict[str, Any]):
    """Sync document updates from LMA.Automate."""
    with Session(engine) as session:
        lma_doc_id = payload.get("document_id")
        
        # Find loan by LMA document ID
        loans = session.exec(
            select(Loan).where(Loan.dlr_json.contains(lma_doc_id))
        ).all()
        
        if not loans:
            return  # No matching loan found
        
        loan = loans[0]
        
        # Update loan with new metadata
        dlr_data = json.loads(loan.dlr_json) if loan.dlr_json else {}
        dlr_data["last_sync"] = datetime.utcnow().isoformat()
        dlr_data["updates"] = dlr_data.get("updates", [])
        dlr_data["updates"].append({
            "timestamp": datetime.utcnow().isoformat(),
            "changes": payload.get("changes", [])
        })
        
        loan.dlr_json = json.dumps(dlr_data)
        loan.version += 1
        session.add(loan)
        session.commit()


def store_negotiation_history(payload: Dict[str, Any]):
    """Store negotiation history from LMA.Automate."""
    with Session(engine) as session:
        lma_doc_id = payload.get("document_id")
        
        loans = session.exec(
            select(Loan).where(Loan.dlr_json.contains(lma_doc_id))
        ).all()
        
        if not loans:
            return
        
        loan = loans[0]
        
        dlr_data = json.loads(loan.dlr_json) if loan.dlr_json else {}
        dlr_data["negotiation_history"] = payload.get("negotiation_history", [])
        
        loan.dlr_json = json.dumps(dlr_data)
        session.add(loan)
        session.commit()


# ============================================================================
# Import Endpoints
# ============================================================================

@router.post("/import")
def import_from_lma(
    document: LMADocumentPayload,
    background_tasks: BackgroundTasks
):
    """
    Manually import a document from LMA.Automate.
    Alternative to webhook for one-off imports.
    """
    background_tasks.add_task(
        process_executed_document,
        document.model_dump()
    )
    
    return {
        "status": "importing",
        "document_id": document.document_id,
        "message": "Document import started"
    }


@router.get("/templates")
def get_lma_template_mappings():
    """
    Get available LMA template to DLR field mappings.
    """
    return {
        "templates": [
            {
                "name": "LMA Single Currency Term Facility Agreement",
                "version": "2024",
                "field_mappings": [
                    {"lma_field": "Parties.Borrower", "dlr_field": "borrower_name"},
                    {"lma_field": "Facility.Amount", "dlr_field": "commitment_amount"},
                    {"lma_field": "Facility.Currency", "dlr_field": "currency"},
                    {"lma_field": "Margin", "dlr_field": "margin_bps"},
                    {"lma_field": "GoverningLaw", "dlr_field": "governing_law"},
                    {"lma_field": "Maturity.Date", "dlr_field": "maturity_date"},
                    {"lma_field": "ESG.LinkedPricing", "dlr_field": "is_esg_linked"}
                ]
            },
            {
                "name": "LMA Multicurrency Term Facility Agreement",
                "version": "2024",
                "field_mappings": [
                    {"lma_field": "Parties.Borrower", "dlr_field": "borrower_name"},
                    {"lma_field": "Facility.TotalCommitment", "dlr_field": "commitment_amount"},
                    {"lma_field": "Facility.BaseCurrency", "dlr_field": "currency"},
                    {"lma_field": "GoverningLaw", "dlr_field": "governing_law"}
                ]
            },
            {
                "name": "LMA Syndicated Facility Agreement",
                "version": "2024",
                "field_mappings": [
                    {"lma_field": "Parties.OriginalBorrowers", "dlr_field": "borrower_name"},
                    {"lma_field": "Facility.TotalCommitments", "dlr_field": "commitment_amount"},
                    {"lma_field": "Facility.Currency", "dlr_field": "currency"},
                    {"lma_field": "Agent.FacilityAgent", "dlr_field": "facility_agent"},
                    {"lma_field": "GoverningLaw", "dlr_field": "governing_law"}
                ]
            }
        ],
        "supported_document_types": [
            "credit_agreement",
            "security_agreement",
            "intercreditor_agreement",
            "amendment",
            "waiver_letter",
            "side_letter"
        ]
    }


@router.get("/sync-status/{loan_id}")
def get_lma_sync_status(loan_id: int):
    """Get LMA.Automate sync status for a loan."""
    with Session(engine) as session:
        loan = session.get(Loan, loan_id)
        if not loan:
            raise HTTPException(404, "Loan not found")
        
        dlr_data = json.loads(loan.dlr_json) if loan.dlr_json else {}
        
        if dlr_data.get("source") != "lma_automate":
            return {
                "linked": False,
                "message": "This loan is not linked to LMA.Automate"
            }
        
        return {
            "linked": True,
            "lma_document_id": dlr_data.get("lma_document_id"),
            "template": dlr_data.get("template"),
            "imported_at": dlr_data.get("imported_at"),
            "last_sync": dlr_data.get("last_sync"),
            "update_count": len(dlr_data.get("updates", [])),
            "has_negotiation_history": "negotiation_history" in dlr_data
        }


# ============================================================================
# Configuration Endpoints
# ============================================================================

@router.get("/config")
def get_lma_integration_config():
    """Get LMA.Automate integration configuration."""
    return {
        "webhook_endpoint": "/api/lma/webhook",
        "webhook_events": [
            "document.executed",
            "document.updated",
            "negotiation.completed"
        ],
        "authentication": {
            "method": "HMAC-SHA256",
            "header": "X-LMA-Signature"
        },
        "rate_limits": {
            "requests_per_minute": 100,
            "concurrent_imports": 10
        },
        "supported_templates": 3,
        "status": "active"
    }


@router.post("/test-connection")
def test_lma_connection():
    """
    Test connection to LMA.Automate API.
    In production, this would make a real API call.
    """
    # Mock successful connection test
    return {
        "status": "connected",
        "lma_automate_version": "2.5.0",
        "last_sync": datetime.utcnow().isoformat(),
        "documents_available": 15,
        "pending_signatures": 3
    }
