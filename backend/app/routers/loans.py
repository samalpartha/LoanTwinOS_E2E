from __future__ import annotations
import json, os
from datetime import datetime, timedelta, date
from fastapi import APIRouter, HTTPException, UploadFile, File
from sqlmodel import Session, select
from ..db import engine
from ..models.tables import Loan, Clause, Obligation, TradeCheck, Document
from ..models.schemas import LoanCreate, LoanOut, DLR, ClauseOut, ObligationOut, TradeCheckOut
from ..services.extractor import build_dlr

router = APIRouter(tags=["loans"])

@router.post("/loans", response_model=LoanOut)
def create_loan(payload: LoanCreate):
    with Session(engine) as session:
        loan = Loan(name=payload.name, closing_date=date.today(), creator_id=payload.creator_id)
        session.add(loan); session.commit(); session.refresh(loan)
        return LoanOut.model_validate(loan)

@router.post("/loans/sample", response_model=LoanOut)
def create_sample_loan():
    """Creates a pre-populated sample loan for onboarding."""
    with Session(engine) as session:
        loan = Loan(
            name="Sample Credit Agreement (JPMorgan/Boeing)", 
            closing_date=date(2024, 1, 1),
            agreement_date="2024",
            governing_law="New York",
            dlr_json=json.dumps({
                "agreement_date": "2024",
                "governing_law": "New York",
                "currency": "USD",
                "parties": [{"role": "Administrative Agent", "name": "JPMorgan Chase Bank, N.A."}],
                "facilities": [{"name": "Facility A", "type": "Term Loan", "amount": "1,000,000,000", "currency": "USD"}],
                "transferability": {"has_assignment": True, "consent_required": True, "sanctions_restriction": "Likely"},
                "covenants": [{"type": "Financial", "name": "Net Leverage", "threshold": "< 4.0x", "test_frequency": "Quarterly"}],
                "citations": [
                    {"keyword": "Governing Law", "clause": "Section 10.01 Governing Law", "page_start": 85},
                    {"keyword": "Assignment", "clause": "Section 10.06 Successors and Assigns", "page_start": 92}
                ]
            })
        )
        session.add(loan); session.commit(); session.refresh(loan)
        
        # Add a mock document for the sample
        doc = Document(filename="sample_credit_agreement.pdf", stored_path="sample.pdf", status="ready", loan_id=loan.id)
        session.add(doc)
        
        # Add mock clauses
        session.add(Clause(loan_id=loan.id, heading="Section 10.01 Governing Law", body="This Agreement and the other Loan Documents shall be governed by, and construed in accordance with, the law of the State of New York...", page_start=85, page_end=85))
        
        # Add mock obligations
        session.add(Obligation(loan_id=loan.id, role="Borrower", title="Financial Statements", details="Deliver audited annual financial statements...", due_hint="120 days post-YE", due_date=date(2025, 4, 30), status="open"))
        
        # Add mock Trade Pack items
        session.add(TradeCheck(loan_id=loan.id, category="Transferability", item="Confirm assignment/transfer mechanics", risk_level="med", rationale="Standard assignment provisions detected"))
        session.add(TradeCheck(loan_id=loan.id, category="Consents", item="Borrower consent required for transfer", risk_level="high", rationale="Consent requirement found in Section 10.06"))
        session.add(TradeCheck(loan_id=loan.id, category="Sanctions", item="Sanctions and restricted transferee check", risk_level="high", rationale="Sanctions keywords detected in agreement"))
        
        session.commit()
        session.refresh(loan)
        return LoanOut.model_validate(loan)

@router.get("/loans/{loan_id}", response_model=LoanOut)
def get_loan(loan_id: int):
    with Session(engine) as session:
        loan = session.get(Loan, loan_id)
        if not loan: raise HTTPException(404, "Loan not found")
        return LoanOut.model_validate(loan)

@router.get("/loans/{loan_id}/dlr", response_model=DLR)
def get_dlr(loan_id: int):
    with Session(engine) as session:
        loan = session.get(Loan, loan_id)
        if not loan: raise HTTPException(404, "Loan not found")
        if not loan.dlr_json: raise HTTPException(409, "DLR not ready. Upload and process a document first.")
        data = json.loads(loan.dlr_json)
        return DLR(loan_id=loan.id, **data)

@router.get("/loans/{loan_id}/clauses", response_model=list[ClauseOut])
def list_clauses(loan_id: int, query: str | None = None):
    with Session(engine) as session:
        clauses = session.exec(select(Clause).where(Clause.loan_id==loan_id)).all()
        if query:
            q=query.lower()
            clauses=[c for c in clauses if q in c.heading.lower() or q in c.body.lower()]
        return [ClauseOut.model_validate(c) for c in clauses]

@router.get("/loans/{loan_id}/obligations", response_model=list[ObligationOut])
def list_obligations(loan_id: int):
    with Session(engine) as session:
        obs = session.exec(select(Obligation).where(Obligation.loan_id==loan_id)).all()
        return [ObligationOut.model_validate(o) for o in obs]

@router.get("/loans/{loan_id}/trade-pack", response_model=list[TradeCheckOut])
def trade_pack(loan_id: int):
    with Session(engine) as session:
        checks = session.exec(select(TradeCheck).where(TradeCheck.loan_id==loan_id)).all()
        return [TradeCheckOut.model_validate(c) for c in checks]

@router.post("/loans/{loan_id}/process-document/{document_id}")
def process_document(loan_id: int, document_id: int):
    with Session(engine) as session:
        loan = session.get(Loan, loan_id)
        doc = session.get(Document, document_id)
        if not loan or not doc or doc.loan_id != loan_id:
            raise HTTPException(404, "Loan/Document not found or not linked")
        doc.status="processing"; session.add(doc); session.commit()

        try:
            dlr, clauses = build_dlr(doc.stored_path)
        except Exception as e:
            doc.status="failed"; doc.error=str(e); session.add(doc); session.commit()
            raise HTTPException(500, f"Processing failed: {e}")

        loan.agreement_date = dlr.get("agreement_date")
        loan.governing_law = dlr.get("governing_law")
        loan.dlr_json = json.dumps(dlr)

        # Clear existing data
        for tbl in [Clause, Obligation, TradeCheck]:
            rows = session.exec(select(tbl).where(tbl.loan_id==loan_id)).all()
            for r in rows: session.delete(r)

        # Add Clauses
        for c in clauses[:250]:
            session.add(Clause(loan_id=loan_id, heading=c["heading"], body=c["body"].strip(),
                              page_start=c["page_start"], page_end=c["page_end"]))

        # Add Obligations with real dates
        closing = loan.closing_date or date.today()
        for o in dlr.get("obligations", []):
            title = o.get("title", "Obligation")
            
            if "financial statements" in title.lower():
                session.add(Obligation(
                    loan_id=loan_id, role=o.get("role", "Borrower"),
                    title=f"{title} (Annual)", details=o.get("details", ""),
                    due_hint="120 days after FYE",
                    due_date=closing + timedelta(days=365 + 120),
                    status="open"
                ))
            elif "compliance certificate" in title.lower():
                for q in range(1, 5):
                    session.add(Obligation(
                        loan_id=loan_id, role=o.get("role", "Borrower"),
                        title=f"{title} (Q{q})", details=o.get("details", ""),
                        due_hint="45 days after Quarter End",
                        due_date=closing + timedelta(days=90 * q + 45),
                        status="open"
                    ))
            else:
                session.add(Obligation(
                    loan_id=loan_id, role=o.get("role", "Borrower"),
                    title=title, details=o.get("details", ""),
                    due_hint=o.get("due_hint", "Per agreement"),
                    due_date=closing + timedelta(days=30),
                    status="open"
                ))

        # Add Trade Pack
        trade_items = [
            ("Transferability", "Confirm assignment/transfer mechanics", "med", "Standard signals"),
            ("Consents", "Borrower consent required for transfer", "high" if dlr.get("transferability",{}).get("consent_required") else "low", "Based on consent extraction"),
            ("Sanctions", "Sanctions and restricted transferee check", "high" if dlr.get("transferability",{}).get("sanctions_restriction") == "Likely" else "low", "Sanctions keyword detected"),
        ]
        for cat, item, risk, rat in trade_items:
            session.add(TradeCheck(loan_id=loan_id, category=cat, item=item, risk_level=risk, rationale=rat))

        doc.status="ready"
        session.add_all([loan, doc])
        session.commit()
    return {"ok": True, "loan_id": loan_id, "document_id": document_id}
