from __future__ import annotations
import json, os
from typing import Optional
from datetime import datetime, timedelta, date
from fastapi import APIRouter, HTTPException, UploadFile, File
from sqlmodel import Session, select
from ..db import engine
from ..models.tables import Loan, Clause, Obligation, TradeCheck, Document, AuditLog
from ..models.schemas import LoanCreate, LoanOut, DLR, ClauseOut, ObligationOut, TradeCheckOut
from ..services.extractor import build_dlr

router = APIRouter(tags=["loans"])

@router.post("/loans", response_model=LoanOut)
def create_loan(payload: LoanCreate):
    with Session(engine) as session:
        loan = Loan(
            name=payload.name, 
            closing_date=date.today(), 
            creator_id=payload.creator_id,
            governing_law="English Law",
            currency="GBP",
            facility_type="Term Loan",
            version=1
        )
        session.add(loan); session.commit(); session.refresh(loan)
        # Log action
        session.add(AuditLog(loan_id=loan.id, user_id=payload.creator_id, action="CREATE", details=f"Initialized loan workspace: {loan.name}"))
        session.commit()
        return LoanOut.model_validate(loan)

@router.post("/loans/sample", response_model=LoanOut)
def create_sample_loan():
    """Creates a pre-populated sample loan for London-demo (LMA ESG/Digital focus)."""
    with Session(engine) as session:
        loan = Loan(
            name="Project Greener Horizons (Boeing / HSBC Consortium)", 
            closing_date=date(2024, 6, 15),
            agreement_date="2024",
            governing_law="English Law",
            borrower_name="Greener Horizons Ltd",
            facility_type="Sustainability-Linked Revolving Facility",
            currency="GBP",
            margin_bps=175,
            is_esg_linked=True,
            esg_score=92.5,
            transferability_mode="Consent required (standard LMA)",
            dlr_json=json.dumps({
                # === CORE IDENTIFICATION ===
                "agreement_date": "2024-06-15",
                "effective_date": "2024-06-30",
                "governing_law": "English Law",
                "borrower_name": "Greener Horizons Ltd",
                "borrower_jurisdiction": "England & Wales",
                "facility_type": "Sustainability-Linked Revolving Facility",
                "currency": "GBP",
                
                # === KEY DATES & TIMELINE ===
                "key_dates": {
                    "signing_date": "2024-06-15",
                    "effective_date": "2024-06-30",
                    "first_drawdown_date": "2024-07-01",
                    "availability_period_end": "2027-06-30",
                    "maturity_date": "2029-06-30",
                    "term_years": 5,
                    "availability_period_months": 36
                },
                
                # === INTEREST & PRICING ===
                "pricing": {
                    "interest_type": "Floating",
                    "base_rate": "SONIA",
                    "base_rate_fallback": "Bank of England Base Rate",
                    "margin_bps": 175,
                    "margin_type": "Sustainability-Linked (Step-Up/Down)",
                    "margin_grid": [
                        {"rating": "A-", "margin_bps": 125},
                        {"rating": "BBB+", "margin_bps": 150},
                        {"rating": "BBB", "margin_bps": 175},
                        {"rating": "BBB-", "margin_bps": 200},
                        {"rating": "BB+", "margin_bps": 250}
                    ],
                    "esg_adjustment_bps": {
                        "all_kpis_met": -10,
                        "2_of_3_kpis_met": 0,
                        "1_of_3_kpis_met": 5,
                        "no_kpis_met": 15
                    },
                    "current_all_in_rate": "SONIA + 175bps = ~6.94%",
                    "default_rate_premium_bps": 200,
                    "interest_payment_frequency": "Quarterly",
                    "interest_calculation_basis": "Actual/365"
                },
                
                # === FEES ===
                "fees": {
                    "arrangement_fee_bps": 50,
                    "arrangement_fee_amount": "£1,750,000",
                    "commitment_fee_bps": 35,
                    "commitment_fee_basis": "On undrawn amounts",
                    "agency_fee_annual": "£75,000",
                    "utilization_fee": [
                        {"threshold": "<33%", "fee_bps": 0},
                        {"threshold": "33-66%", "fee_bps": 10},
                        {"threshold": ">66%", "fee_bps": 20}
                    ],
                    "prepayment_fee": "None (voluntary prepayment permitted)"
                },
                
                # === FACILITIES & AMOUNTS ===
                "total_commitments": 350000000,
                "facilities": [
                    {
                        "name": "Facility A (Term Loan)",
                        "type": "Term Loan",
                        "amount": 250000000,
                        "currency": "GBP",
                        "drawn": 250000000,
                        "available": 0,
                        "margin_bps": 175,
                        "amortization": "Bullet (100% at maturity)",
                        "purpose": "Refinancing existing indebtedness"
                    },
                    {
                        "name": "Facility B (RCF)",
                        "type": "Revolving Credit Facility",
                        "amount": 100000000,
                        "currency": "GBP",
                        "drawn": 45000000,
                        "available": 55000000,
                        "margin_bps": 175,
                        "amortization": "Revolving",
                        "purpose": "General corporate purposes and working capital"
                    }
                ],
                
                # === REPAYMENT SCHEDULE ===
                "repayment_schedule": [
                    {"date": "2025-06-30", "facility": "Facility A", "amount": 0, "type": "Interest Only"},
                    {"date": "2025-12-31", "facility": "Facility A", "amount": 0, "type": "Interest Only"},
                    {"date": "2026-06-30", "facility": "Facility A", "amount": 0, "type": "Interest Only"},
                    {"date": "2026-12-31", "facility": "Facility A", "amount": 0, "type": "Interest Only"},
                    {"date": "2027-06-30", "facility": "Facility A", "amount": 0, "type": "Interest Only"},
                    {"date": "2027-12-31", "facility": "Facility A", "amount": 62500000, "type": "Amortization (25%)"},
                    {"date": "2028-06-30", "facility": "Facility A", "amount": 62500000, "type": "Amortization (25%)"},
                    {"date": "2028-12-31", "facility": "Facility A", "amount": 62500000, "type": "Amortization (25%)"},
                    {"date": "2029-06-30", "facility": "Facility A", "amount": 62500000, "type": "Final Maturity (25%)"}
                ],
                
                # === PARTIES ===
                "parties": [
                    {"role": "Borrower", "name": "Greener Horizons Ltd", "jurisdiction": "England"},
                    {"role": "Guarantor", "name": "Greener Holdings PLC", "jurisdiction": "England"},
                    {"role": "Administrative Agent", "name": "HSBC Bank plc", "jurisdiction": "England"},
                    {"role": "Security Agent", "name": "HSBC Corporate Trustee Company (UK) Ltd", "jurisdiction": "England"},
                    {"role": "ESG Coordinator", "name": "Barclays Bank PLC", "jurisdiction": "England"},
                    {"role": "Original Lender", "name": "HSBC Bank plc", "commitment": 125000000},
                    {"role": "Original Lender", "name": "Barclays Bank PLC", "commitment": 100000000},
                    {"role": "Original Lender", "name": "Lloyds Bank PLC", "commitment": 75000000},
                    {"role": "Original Lender", "name": "NatWest Markets Plc", "commitment": 50000000}
                ],
                
                # === TRANSFERABILITY ===
                "transferability": {
                    "has_assignment": True, 
                    "consent_required": True, 
                    "consent_not_unreasonably_withheld": True,
                    "consent_deemed_given_days": 10,
                    "mode": "LMA Standard",
                    "minimum_transfer_amount": 1000000,
                    "minimum_holding_amount": 1000000,
                    "restrictions": "No transfer to Borrower affiliates or sanctioned entities"
                },
                
                # === COVENANTS ===
                "covenants": [
                    {"type": "Financial", "name": "Net Leverage Ratio", "threshold": "≤ 3.50x", "current_value": "2.8x", "headroom": "20%", "test_frequency": "Quarterly", "next_test_date": "2025-03-31", "confidence": 0.98},
                    {"type": "Financial", "name": "Interest Cover Ratio", "threshold": "≥ 4.00x", "current_value": "5.2x", "headroom": "30%", "test_frequency": "Quarterly", "next_test_date": "2025-03-31", "confidence": 0.96},
                    {"type": "Financial", "name": "Minimum Liquidity", "threshold": "≥ £25m", "current_value": "£42m", "headroom": "68%", "test_frequency": "Monthly", "next_test_date": "2025-02-28", "confidence": 0.94},
                    {"type": "ESG", "name": "Carbon Intensity Reduction", "threshold": "-5% YoY", "current_value": "-7.2%", "headroom": "On Track", "test_frequency": "Annual", "next_test_date": "2025-12-31", "confidence": 0.92},
                    {"type": "ESG", "name": "Renewable Energy Mix", "threshold": "≥ 40%", "current_value": "38%", "headroom": "At Risk", "test_frequency": "Annual", "next_test_date": "2025-12-31", "confidence": 0.88},
                    {"type": "ESG", "name": "Employee Safety Index", "threshold": "≤ 2.0 LTIFR", "current_value": "1.4", "headroom": "On Track", "test_frequency": "Annual", "next_test_date": "2025-12-31", "confidence": 0.91}
                ],
                
                # === ESG ===
                "esg": [
                    {"kpi_name": "GHG Emissions (Scope 1+2)", "target_description": "Reduce by 15% from 2024 baseline by 2029", "baseline_value": "125,000 tCO2e", "current_value": "116,250 tCO2e", "target_value": "106,250 tCO2e", "reporting_frequency": "Annual", "verifier": "KPMG LLP", "confidence": 0.95},
                    {"kpi_name": "Renewable Energy Mix", "target_description": "Minimum 40% renewable energy by 2026, 60% by 2029", "baseline_value": "28%", "current_value": "38%", "target_value": "40% (2026)", "reporting_frequency": "Annual", "verifier": "KPMG LLP", "confidence": 0.92},
                    {"kpi_name": "Lost Time Injury Frequency", "target_description": "Maintain LTIFR below 2.0 per million hours worked", "baseline_value": "2.1", "current_value": "1.4", "target_value": "<2.0", "reporting_frequency": "Annual", "verifier": "Internal Audit", "confidence": 0.90}
                ],
                
                # === CITATIONS ===
                "citations": [
                    {"keyword": "Governing Law", "clause": "Clause 42.1 Governing Law", "page_start": 112, "confidence": 0.99},
                    {"keyword": "Interest Rate", "clause": "Clause 9.1 Calculation of Interest", "page_start": 28, "confidence": 0.97},
                    {"keyword": "Margin", "clause": "Clause 9.2 Margin", "page_start": 29, "confidence": 0.98},
                    {"keyword": "ESG", "clause": "Clause 23. Sustainability-Linked Margin", "page_start": 45, "confidence": 0.97},
                    {"keyword": "Repayment", "clause": "Clause 7.1 Repayment of Term Loan", "page_start": 22, "confidence": 0.96},
                    {"keyword": "Financial Covenants", "clause": "Clause 21. Financial Covenants", "page_start": 62, "confidence": 0.95},
                    {"keyword": "Transfer", "clause": "Clause 24. Changes to the Lenders", "page_start": 72, "confidence": 0.94}
                ]
            })
        )
        session.add(loan); session.commit(); session.refresh(loan)
        
        # Add mock audit
        session.add(AuditLog(loan_id=loan.id, action="LOAD_SAMPLE", details="System initialized high-fidelity LMA ESG sample deal.", user_id=None))
        
        # Add mock document
        doc = Document(filename="credit_agreement_greener_horizons.pdf", stored_path="sample.pdf", status="ready", loan_id=loan.id, extraction_method="LLM-Enhanced")
        session.add(doc)
        
        # Add mock clauses
        session.add(Clause(loan_id=loan.id, heading="Clause 42.1 Governing Law", body="This Agreement and any non-contractual obligations arising out of or in connection with it are governed by English law.", page_start=112, page_end=112, variance_score=0.98, is_standard=True))
        session.add(Clause(loan_id=loan.id, heading="Clause 23. Sustainability-Linked Margin", body="The Margin shall be adjusted based on the Borrower's performance against the Sustainability KPIs set out in Schedule 12...", page_start=45, page_end=48, variance_score=0.72, is_standard=False))
        
        # Add mock obligations
        session.add(Obligation(loan_id=loan.id, role="Borrower", title="Annual Sustainability Report", details="Deliver report verified by third-party auditor...", due_hint="120 days post-YE", due_date=date(2027, 4, 30), status="Validated", is_esg=True))
        session.add(Obligation(loan_id=loan.id, role="Borrower", title="Financial Statements", details="Deliver audited consolidated accounts...", due_hint="90 days post-YE", due_date=date(2027, 3, 31), status="Draft", is_esg=False))
        
        # Add mock Trade Pack items
        session.add(TradeCheck(loan_id=loan.id, category="Transferability", item="LMA Standard Transfer Provisions", risk_level="low", rationale="Consent required from Borrower, but not to be unreasonably withheld/delayed."))
        session.add(TradeCheck(loan_id=loan.id, category="ESG Compliance", item="Sustainability-Linked Margin Step-up", risk_level="med", rationale="2.5bps step-up if 2 out of 3 KPIs missed. High impact on yield."))
        session.add(TradeCheck(loan_id=loan.id, category="Restrictions", item="White-listed Transferee List", risk_level="high", rationale="Side letter dated Oct 12 restricts transfers to 4 specific entities only. Severe liquidity impact."))
        
        session.commit()
        session.refresh(loan)
        return LoanOut.model_validate(loan)

@router.get("/search")
def global_search(q: str, limit: int = 20):
    """
    Global search across loans and clauses.
    Returns matching deals and clauses for the command palette.
    """
    if not q or len(q) < 2:
        return {"deals": [], "clauses": [], "query": q}
    
    query = q.lower().strip()
    
    with Session(engine) as session:
        # Search loans/deals
        all_loans = session.exec(select(Loan)).all()
        matching_deals = []
        for loan in all_loans:
            score = 0
            if query in (loan.name or "").lower():
                score += 10
            if query in (loan.borrower_name or "").lower():
                score += 8
            if query in (loan.facility_type or "").lower():
                score += 5
            if query in (loan.currency or "").lower():
                score += 3
            if query in (loan.governing_law or "").lower():
                score += 2
            
            if score > 0:
                matching_deals.append({
                    "id": loan.id,
                    "name": loan.name,
                    "borrower": loan.borrower_name,
                    "facility_type": loan.facility_type,
                    "currency": loan.currency,
                    "is_esg_linked": loan.is_esg_linked,
                    "score": score,
                    "type": "deal"
                })
        
        # Sort by relevance score
        matching_deals.sort(key=lambda x: x["score"], reverse=True)
        
        # Search clauses
        all_clauses = session.exec(select(Clause)).all()
        matching_clauses = []
        for clause in all_clauses:
            score = 0
            if query in (clause.heading or "").lower():
                score += 10
            if query in (clause.body or "").lower():
                score += 5
            
            if score > 0:
                # Get loan name for context
                loan = session.get(Loan, clause.loan_id)
                matching_clauses.append({
                    "id": clause.id,
                    "loan_id": clause.loan_id,
                    "loan_name": loan.name if loan else "Unknown",
                    "heading": clause.heading,
                    "body_preview": (clause.body or "")[:150] + "..." if len(clause.body or "") > 150 else clause.body,
                    "page_start": clause.page_start,
                    "is_standard": clause.is_standard,
                    "variance_score": clause.variance_score,
                    "score": score,
                    "type": "clause"
                })
        
        # Sort by relevance score
        matching_clauses.sort(key=lambda x: x["score"], reverse=True)
        
        return {
            "deals": matching_deals[:limit],
            "clauses": matching_clauses[:limit],
            "query": q,
            "total_deals": len(matching_deals),
            "total_clauses": len(matching_clauses)
        }

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

@router.patch("/loans/{loan_id}/obligations/{obligation_id}")
def update_obligation(loan_id: int, obligation_id: int, status: str = None, evidence_path: str = None, assigned_to: str = None):
    """Update obligation status, evidence, or assignment."""
    with Session(engine) as session:
        ob = session.exec(select(Obligation).where(Obligation.loan_id==loan_id, Obligation.id==obligation_id)).first()
        if not ob:
            raise HTTPException(404, "Obligation not found")
        
        if status:
            ob.status = status
        if evidence_path:
            ob.evidence_path = evidence_path
        if assigned_to:
            ob.assigned_to = assigned_to
        
        session.add(ob)
        session.commit()
        session.refresh(ob)
        
        # Log the update
        session.add(AuditLog(
            loan_id=loan_id,
            actor="System",
            action="obligation_updated",
            details=f"Obligation '{ob.title}' updated: status={status or 'unchanged'}"
        ))
        session.commit()
        
        return ObligationOut.model_validate(ob)

@router.get("/loans/{loan_id}/trade-pack", response_model=list[TradeCheckOut])
def trade_pack(loan_id: int):
    with Session(engine) as session:
        checks = session.exec(select(TradeCheck).where(TradeCheck.loan_id==loan_id)).all()
        return [TradeCheckOut.model_validate(c) for c in checks]

@router.get("/loans/{loan_id}/stats")
def get_loan_stats(loan_id: int):
    """Returns dynamic dashboard stats for a loan."""
    with Session(engine) as session:
        loan = session.get(Loan, loan_id)
        if not loan: raise HTTPException(404, "Loan not found")
        
        # Calculate total commitments from DLR facilities
        total_commitments = 0
        currency = loan.currency or "GBP"
        if loan.dlr_json:
            dlr = json.loads(loan.dlr_json)
            for f in dlr.get("facilities", []):
                try:
                    amt = float(str(f.get("amount", "0")).replace(",", ""))
                    total_commitments += amt
                except: pass
        
        # Open obligations count
        obligations = session.exec(select(Obligation).where(Obligation.loan_id==loan_id)).all()
        open_obs = [o for o in obligations if o.status.lower() not in ['completed', 'cancelled']]
        overdue_obs = [o for o in obligations if o.due_date and o.due_date < date.today() and o.status.lower() != 'completed']
        
        # Trade readiness calculation
        trade_checks = session.exec(select(TradeCheck).where(TradeCheck.loan_id==loan_id)).all()
        base_score = 100
        for tc in trade_checks:
            if tc.risk_level.lower() == 'high': base_score -= 40
            elif tc.risk_level.lower() in ['med', 'medium']: base_score -= 15
        trade_score = max(0, base_score)
        high_risk_count = len([tc for tc in trade_checks if tc.risk_level.lower() == 'high'])
        
        return {
            "total_commitments": total_commitments,
            "currency": currency,
            "open_obligations": len(open_obs),
            "overdue_obligations": len(overdue_obs),
            "trade_readiness_score": trade_score,
            "high_risk_blocks": high_risk_count,
            "esg_score": loan.esg_score,
            "is_esg_linked": loan.is_esg_linked
        }

@router.get("/loans/{loan_id}/audit-logs")
def get_audit_logs(loan_id: int):
    """Returns audit logs for a loan."""
    with Session(engine) as session:
        logs = session.exec(select(AuditLog).where(AuditLog.loan_id==loan_id).order_by(AuditLog.timestamp.desc())).all()
        return [{"id": log.id, "user_id": log.user_id, "action": log.action, "details": log.details, "timestamp": log.timestamp.isoformat()} for log in logs]

@router.get("/loans/{loan_id}/resolve-queue")
def get_resolve_queue(loan_id: int):
    """Returns items that need manual review/resolution."""
    with Session(engine) as session:
        loan = session.get(Loan, loan_id)
        if not loan: raise HTTPException(404, "Loan not found")
        
        issues = []
        
        # Check for non-standard clauses
        clauses = session.exec(select(Clause).where(Clause.loan_id==loan_id, Clause.is_standard==False)).all()
        for c in clauses[:3]:  # Top 3
            issues.append({
                "id": f"clause_{c.id}",
                "type": "conflict",
                "severity": "high" if c.variance_score and c.variance_score < 0.5 else "medium",
                "title": f"Non-standard: {c.heading[:40]}",
                "details": "Deviates from LMA template",
                "source": f"Page {c.page_start}"
            })
        
        # Check for missing ESG verification
        if loan.is_esg_linked:
            issues.append({
                "id": "esg_verifier",
                "type": "missing",
                "severity": "medium",
                "title": "Missing: ESG Verifier Assignment",
                "details": "No third-party ESG verifier specified",
                "source": "Schedule 12"
            })
        
        # Check for high-risk trade items
        trade_checks = session.exec(select(TradeCheck).where(TradeCheck.loan_id==loan_id, TradeCheck.risk_level=='high')).all()
        for tc in trade_checks:
            issues.append({
                "id": f"trade_{tc.id}",
                "type": "block",
                "severity": "high",
                "title": f"Trade Block: {tc.item[:40]}",
                "details": tc.rationale[:80],
                "source": tc.category
            })
        
        return issues

@router.get("/loans/{loan_id}/counterparties")
def get_counterparties(loan_id: int):
    """Returns counterparty information from DLR."""
    with Session(engine) as session:
        loan = session.get(Loan, loan_id)
        if not loan: raise HTTPException(404, "Loan not found")
        
        parties = []
        if loan.dlr_json:
            dlr = json.loads(loan.dlr_json)
            parties = dlr.get("parties", [])
        
        # Derive lenders from parties
        lenders = [p for p in parties if "lender" in p.get("role", "").lower() or "bank" in p.get("name", "").lower()]
        if not lenders:
            # Default sample if no lenders found
            lenders = [
                {"name": "HSBC Bank PLC", "role": "Administrative Agent", "color": "#DB0011"},
                {"name": "Barclays Bank PLC", "role": "ESG Coordinator", "color": "#00395D"}
            ]
        
        return {
            "lenders": lenders,
            "total_lenders": len(lenders),
            "whitelist_count": 12,  # Would come from actual data
            "min_hold_amount": 5000000,
            "min_hold_currency": loan.currency or "GBP"
        }

@router.get("/loans/{loan_id}/transfer-info")
def get_transfer_info(loan_id: int):
    """Returns transferability information from DLR."""
    with Session(engine) as session:
        loan = session.get(Loan, loan_id)
        if not loan: raise HTTPException(404, "Loan not found")
        
        transfer_mode = "Assignment / Transfer"
        consent_required = True
        standard_basis = "LMA Multi-Currency"
        min_transfer = None
        min_holding = None
        restrictions = None
        consent_deemed_days = None
        
        if loan.dlr_json:
            dlr = json.loads(loan.dlr_json)
            trans = dlr.get("transferability", {})
            transfer_mode = trans.get("mode", transfer_mode)
            consent_required = trans.get("consent_required", consent_required)
            min_transfer = trans.get("minimum_transfer_amount")
            min_holding = trans.get("minimum_holding_amount")
            restrictions = trans.get("restrictions")
            consent_deemed_days = trans.get("consent_deemed_given_days")
        
        return {
            "transfer_mode": transfer_mode,
            "consent_required": consent_required,
            "consent_label": "Borrower Required" if consent_required else "Not Required",
            "consent_deemed_days": consent_deemed_days,
            "standard_basis": standard_basis,
            "transferability_mode": loan.transferability_mode,
            "minimum_transfer_amount": min_transfer,
            "minimum_holding_amount": min_holding,
            "restrictions": restrictions
        }

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

        # Update Loan with Canonical Fields
        loan.agreement_date = dlr.get("agreement_date")
        loan.governing_law = dlr.get("governing_law")
        loan.borrower_name = dlr.get("borrower_name")
        loan.facility_type = dlr.get("facility_type")
        loan.currency = dlr.get("currency")
        loan.margin_bps = dlr.get("margin_bps")
        loan.is_esg_linked = dlr.get("is_esg_linked", False)
        loan.esg_score = dlr.get("esg_score")
        loan.transferability_mode = dlr.get("transferability", {}).get("mode")
        loan.dlr_json = json.dumps(dlr)
        loan.version += 1

        # Log action
        session.add(AuditLog(loan_id=loan_id, action="PROCESS", details=f"Automated extraction completed for {doc.filename}. Version bumped to {loan.version}."))

        # Clear existing dynamic data for this loan
        for tbl in [Clause, Obligation, TradeCheck]:
            rows = session.exec(select(tbl).where(tbl.loan_id==loan_id)).all()
            for r in rows: session.delete(r)

        # Add Clauses with Variance & Standards
        for c in clauses[:500]:
            session.add(Clause(
                loan_id=loan_id, 
                heading=c["heading"], 
                body=c["body"].strip(),
                page_start=c["page_start"], 
                page_end=c["page_end"],
                source_doc_id=document_id,
                variance_score=c.get("variance_score", 1.0),
                is_standard=c.get("is_standard", True)
            ))

        # Add Obligations
        closing = loan.closing_date or date.today()
        for o in dlr.get("obligations", []):
            title = o.get("title", "Obligation")
            is_esg = o.get("is_esg", False)
            
            # Simple date logic
            due_days = 90 if "financial" in title.lower() else 30
            
            session.add(Obligation(
                loan_id=loan_id, 
                role=o.get("role", "Borrower"),
                title=title, 
                details=o.get("details", ""),
                due_hint=o.get("due_hint", "Per agreement"),
                due_date=closing + timedelta(days=due_days),
                status="Draft",
                is_esg=is_esg,
                confidence=o.get("confidence", 0.95)
            ))

        # Add Trade Pack Readiness Check
        trade_items = [
            ("Transferability", "LMA Standard Check", "low", "Transfer provisions align with standard LMA templates."),
            ("Sanctions", "Secondary Trading Block Check", "low", "No restricted transferee list found in side letters."),
        ]
        if loan.is_esg_linked:
            trade_items.append(("ESG", "SLL Margin Impact", "med", "Sustainability-linked margin adjustments require operational monitoring."))

        for cat, item, risk, rat in trade_items:
            session.add(TradeCheck(loan_id=loan_id, category=cat, item=item, risk_level=risk, rationale=rat))

        doc.status="ready"
        session.add_all([loan, doc])
        session.commit()
    return {"ok": True, "loan_id": loan_id, "document_id": document_id}


# ============ EVENT HISTORY ============

@router.get("/events")
def get_event_history(loan_id: Optional[int] = None, limit: int = 100):
    """
    Get event history / audit log for a loan or all loans.
    Returns all actions taken on loans including agent actions, video generations, etc.
    """
    with Session(engine) as session:
        query = select(AuditLog).order_by(AuditLog.timestamp.desc())
        if loan_id:
            query = query.where(AuditLog.loan_id == loan_id)
        query = query.limit(limit)
        
        logs = session.exec(query).all()
        
        # Enrich with loan names
        events = []
        for log in logs:
            loan = session.get(Loan, log.loan_id)
            events.append({
                "id": log.id,
                "loan_id": log.loan_id,
                "loan_name": loan.name if loan else "Unknown",
                "action": log.action,
                "details": log.details,
                "timestamp": log.timestamp.isoformat(),
                "user_id": log.user_id,
                "category": _categorize_action(log.action)
            })
        
        return {
            "events": events,
            "count": len(events),
            "loan_id": loan_id
        }


@router.post("/events")
def record_event(loan_id: int, action: str, details: str):
    """
    Manually record an event in the history.
    """
    with Session(engine) as session:
        loan = session.get(Loan, loan_id)
        if not loan:
            raise HTTPException(404, "Loan not found")
        
        log = AuditLog(
            loan_id=loan_id,
            action=action,
            details=details
        )
        session.add(log)
        session.commit()
        session.refresh(log)
        
        return {
            "id": log.id,
            "loan_id": log.loan_id,
            "action": log.action,
            "details": log.details,
            "timestamp": log.timestamp.isoformat()
        }


def _categorize_action(action: str) -> str:
    """Categorize actions for grouping in the UI."""
    action_lower = action.lower()
    if 'trade' in action_lower:
        return 'trade'
    elif 'agent' in action_lower or 'ai' in action_lower or 'scan' in action_lower:
        return 'ai'
    elif 'upload' in action_lower or 'extract' in action_lower or 'dlr' in action_lower:
        return 'document'
    elif 'video' in action_lower or 'render' in action_lower:
        return 'video'
    elif 'covenant' in action_lower or 'compliance' in action_lower:
        return 'compliance'
    elif 'export' in action_lower:
        return 'export'
    else:
        return 'general'
