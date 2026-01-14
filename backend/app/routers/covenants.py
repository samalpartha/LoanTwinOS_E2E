"""
Covenant Monitoring Router - Real-time Covenant Tracking & Breach Detection
Implements covenant extraction, test scheduling, and automated alerts
"""
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from sqlmodel import Session, select
from datetime import datetime, date, timedelta
import json
import os

from ..db import engine
from ..models.tables import Loan, Covenant, CovenantTest
from ..middleware.security import require_auth, require_role, Role

# Try to import Groq for covenant extraction
try:
    from groq import Groq
    GROQ_AVAILABLE = True
except ImportError:
    GROQ_AVAILABLE = False

router = APIRouter(prefix="/covenants", tags=["Covenant Monitoring"])


# ============================================================================
# Request/Response Models
# ============================================================================

class CovenantCreate(BaseModel):
    loan_id: int
    covenant_type: str  # financial, information, affirmative, negative
    name: str
    description: str
    threshold: str
    test_frequency: str = "quarterly"
    cure_period_days: int = 30


class CovenantTestCreate(BaseModel):
    covenant_id: int
    test_date: date
    reporting_period: str
    actual_value: str


# ============================================================================
# Dashboard & Global Endpoints (must be before parametric routes)
# ============================================================================

@router.get("/dashboard")
def get_covenant_dashboard():
    """Get covenant monitoring dashboard summary."""
    with Session(engine) as session:
        # Get all covenants
        all_covenants = session.exec(select(Covenant).where(Covenant.is_active == True)).all()
        
        # Get recent tests
        recent_tests = session.exec(
            select(CovenantTest)
            .order_by(CovenantTest.test_date.desc())
            .limit(100)
        ).all()
        
        # Calculate statistics
        total_covenants = len(all_covenants)
        
        # Compliance status
        tested_covenant_ids = set(t.covenant_id for t in recent_tests)
        compliant = sum(1 for t in recent_tests if t.is_compliant)
        breached = sum(1 for t in recent_tests if not t.is_compliant)
        pending = total_covenants - len(tested_covenant_ids)
        
        # Upcoming tests (covenants due for testing)
        upcoming = []
        today = date.today()
        for cov in all_covenants:
            # Get last test date
            last_test = session.exec(
                select(CovenantTest)
                .where(CovenantTest.covenant_id == cov.id)
                .order_by(CovenantTest.test_date.desc())
                .limit(1)
            ).first()
            
            if cov.test_frequency == "quarterly":
                next_due = (last_test.test_date + timedelta(days=90)) if last_test else today
            elif cov.test_frequency == "annual":
                next_due = (last_test.test_date + timedelta(days=365)) if last_test else today
            elif cov.test_frequency == "semi-annual":
                next_due = (last_test.test_date + timedelta(days=180)) if last_test else today
            else:
                next_due = (last_test.test_date + timedelta(days=30)) if last_test else today
            
            if next_due <= today + timedelta(days=30):  # Due within 30 days
                upcoming.append({
                    "covenant_id": cov.id,
                    "name": cov.name,
                    "loan_id": cov.loan_id,
                    "due_date": next_due.isoformat(),
                    "days_until_due": (next_due - today).days
                })
        
        return {
            "summary": {
                "total_covenants": total_covenants,
                "compliant": compliant,
                "breached": breached,
                "pending_test": pending,
                "compliance_rate": round((compliant / (compliant + breached) * 100) if (compliant + breached) > 0 else 100, 1)
            },
            "upcoming_tests": sorted(upcoming, key=lambda x: x["days_until_due"])[:10],
            "recent_breaches": [
                {
                    "covenant_id": t.covenant_id,
                    "test_date": t.test_date.isoformat(),
                    "actual": t.actual_value,
                    "threshold": t.threshold_value
                }
                for t in recent_tests if not t.is_compliant
            ][:5]
        }


@router.get("/breaches")
def get_active_breaches_endpoint(loan_id: Optional[int] = Query(None)):
    """Get all active covenant breaches."""
    with Session(engine) as session:
        query = select(CovenantTest).where(CovenantTest.is_compliant == False)
        
        if loan_id:
            covenant_ids = [c.id for c in session.exec(
                select(Covenant).where(Covenant.loan_id == loan_id)
            ).all()]
            query = query.where(CovenantTest.covenant_id.in_(covenant_ids))
        
        breaches = session.exec(
            query.order_by(CovenantTest.test_date.desc())
        ).all()
        
        result = []
        for breach in breaches:
            covenant = session.get(Covenant, breach.covenant_id)
            loan = session.get(Loan, covenant.loan_id) if covenant else None
            
            result.append({
                "id": breach.id,
                "covenant_id": breach.covenant_id,
                "covenant_name": covenant.name if covenant else "Unknown",
                "loan_id": covenant.loan_id if covenant else None,
                "loan_name": loan.name if loan else "Unknown",
                "test_date": breach.test_date.isoformat(),
                "actual_value": breach.actual_value,
                "threshold": breach.threshold_value,
                "variance": breach.variance_pct,
                "days_to_cure": (
                    (breach.test_date + timedelta(days=covenant.cure_period_days) - date.today()).days
                    if covenant and breach.test_date else None
                ),
                "status": breach.status
            })
        
        return {
            "breaches": result,
            "count": len(result)
        }


# ============================================================================
# Covenant Management
# ============================================================================

@router.get("/{loan_id}")
def get_loan_covenants(loan_id: int):
    """Get all covenants for a loan."""
    with Session(engine) as session:
        covenants = session.exec(
            select(Covenant)
            .where(Covenant.loan_id == loan_id)
            .where(Covenant.is_active == True)
            .order_by(Covenant.covenant_type)
        ).all()
        
        result = []
        for c in covenants:
            # Get latest test result
            latest_test = session.exec(
                select(CovenantTest)
                .where(CovenantTest.covenant_id == c.id)
                .order_by(CovenantTest.test_date.desc())
                .limit(1)
            ).first()
            
            result.append({
                "id": c.id,
                "covenant_type": c.covenant_type,
                "name": c.name,
                "description": c.description,
                "threshold": c.threshold,
                "test_frequency": c.test_frequency,
                "cure_period_days": c.cure_period_days,
                "confidence": c.confidence,
                "source_page": c.source_page,
                "latest_test": {
                    "date": latest_test.test_date.isoformat() if latest_test else None,
                    "actual": latest_test.actual_value if latest_test else None,
                    "is_compliant": latest_test.is_compliant if latest_test else None,
                    "status": latest_test.status if latest_test else "pending"
                } if latest_test else None
            })
        
        return {"covenants": result, "count": len(result)}


@router.post("")
def create_covenant(
    covenant_data: CovenantCreate,
    current_user: Dict = Depends(require_auth)
):
    """Add a new covenant to track."""
    with Session(engine) as session:
        loan = session.get(Loan, covenant_data.loan_id)
        if not loan:
            raise HTTPException(404, "Loan not found")
        
        covenant = Covenant(
            loan_id=covenant_data.loan_id,
            covenant_type=covenant_data.covenant_type,
            name=covenant_data.name,
            description=covenant_data.description,
            threshold=covenant_data.threshold,
            test_frequency=covenant_data.test_frequency,
            cure_period_days=covenant_data.cure_period_days
        )
        session.add(covenant)
        session.commit()
        session.refresh(covenant)
        
        return {"id": covenant.id, "message": "Covenant created"}


@router.post("/extract/{loan_id}")
def extract_covenants_from_document(loan_id: int, current_user: Dict = Depends(require_auth)):
    """AI extracts covenants from loan agreement."""
    with Session(engine) as session:
        loan = session.get(Loan, loan_id)
        if not loan:
            raise HTTPException(404, "Loan not found")
        
        # Get DLR JSON if available
        dlr_data = json.loads(loan.dlr_json) if loan.dlr_json else {}
        
        # Extract covenants using AI
        extracted = extract_covenants_ai(loan, dlr_data)
        
        # Save extracted covenants
        created_count = 0
        for cov in extracted:
            covenant = Covenant(
                loan_id=loan_id,
                covenant_type=cov.get("type", "financial"),
                name=cov.get("name", "Unknown"),
                description=cov.get("description", ""),
                threshold=cov.get("threshold", ""),
                test_frequency=cov.get("test_frequency", "quarterly"),
                cure_period_days=cov.get("cure_period_days", 30),
                source_page=cov.get("source_page"),
                source_clause=cov.get("source_clause"),
                confidence=cov.get("confidence", 0.8)
            )
            session.add(covenant)
            created_count += 1
        
        session.commit()
        
        return {
            "extracted": len(extracted),
            "saved": created_count,
            "covenants": extracted
        }


def extract_covenants_ai(loan: Loan, dlr_data: dict) -> List[Dict[str, Any]]:
    """Use AI to extract covenants from loan data."""
    
    # Default covenants if AI unavailable
    default_covenants = [
        {
            "type": "financial",
            "name": "Leverage Ratio",
            "description": "Total Debt to EBITDA ratio",
            "threshold": "< 3.5x",
            "test_frequency": "quarterly",
            "cure_period_days": 30,
            "confidence": 0.95
        },
        {
            "type": "financial",
            "name": "Interest Cover",
            "description": "EBITDA to Interest Expense ratio",
            "threshold": "> 4.0x",
            "test_frequency": "quarterly",
            "cure_period_days": 30,
            "confidence": 0.95
        },
        {
            "type": "information",
            "name": "Annual Audited Accounts",
            "description": "Delivery of audited annual financial statements",
            "threshold": "Within 120 days of fiscal year end",
            "test_frequency": "annual",
            "cure_period_days": 30,
            "confidence": 0.90
        },
        {
            "type": "information",
            "name": "Quarterly Financials",
            "description": "Delivery of unaudited quarterly financial statements",
            "threshold": "Within 45 days of quarter end",
            "test_frequency": "quarterly",
            "cure_period_days": 15,
            "confidence": 0.90
        }
    ]
    
    # Try AI extraction
    if GROQ_AVAILABLE:
        api_key = os.getenv("GROQ_API_KEY", "")
        if api_key:
            try:
                groq_client = Groq(api_key=api_key)
                
                # Get clauses if available
                clauses_text = ""
                if "clauses" in dlr_data:
                    for clause in dlr_data.get("clauses", [])[:10]:
                        if "covenant" in clause.get("heading", "").lower() or "financial" in clause.get("heading", "").lower():
                            clauses_text += f"Clause: {clause.get('heading', '')}\n{clause.get('body', '')[:500]}\n\n"
                
                if clauses_text:
                    prompt = f"""Extract financial and information covenants from these clause texts.

Loan: {loan.name}
Borrower: {loan.borrower_name or 'Unknown'}

Clause Texts:
{clauses_text}

Return as JSON array:
[
    {{
        "type": "financial|information|affirmative|negative",
        "name": "Covenant name",
        "description": "Brief description",
        "threshold": "Specific threshold (e.g., < 3.5x, within 45 days)",
        "test_frequency": "quarterly|semi-annual|annual|monthly",
        "cure_period_days": 30,
        "confidence": 0.9
    }}
]"""
                    
                    response = groq_client.chat.completions.create(
                        model="llama3-70b-8192",
                        messages=[
                            {"role": "system", "content": "You are a legal document analyst specializing in loan covenants. Return only valid JSON arrays."},
                            {"role": "user", "content": prompt}
                        ],
                        max_tokens=1000,
                        temperature=0.1
                    )
                    
                    response_text = response.choices[0].message.content.strip()
                    if "[" in response_text:
                        json_start = response_text.index("[")
                        json_end = response_text.rindex("]") + 1
                        extracted = json.loads(response_text[json_start:json_end])
                        return extracted
            except Exception as e:
                print(f"AI covenant extraction failed: {e}")
    
    return default_covenants


# ============================================================================
# Covenant Testing & Compliance
# ============================================================================

@router.post("/test")
def record_covenant_test(
    test_data: CovenantTestCreate,
    current_user: Dict = Depends(require_auth)
):
    """Record a covenant test result."""
    with Session(engine) as session:
        covenant = session.get(Covenant, test_data.covenant_id)
        if not covenant:
            raise HTTPException(404, "Covenant not found")
        
        # Determine compliance
        is_compliant = check_compliance(covenant.threshold, test_data.actual_value)
        
        test = CovenantTest(
            covenant_id=test_data.covenant_id,
            test_date=test_data.test_date,
            reporting_period=test_data.reporting_period,
            actual_value=test_data.actual_value,
            threshold_value=covenant.threshold,
            is_compliant=is_compliant,
            status="compliant" if is_compliant else "breached",
            verified_by=current_user.get("id")
        )
        
        if not is_compliant:
            # Calculate cure deadline
            test.cure_deadline = test_data.test_date + timedelta(days=covenant.cure_period_days)
            test.breach_amount = f"Actual: {test_data.actual_value} vs Threshold: {covenant.threshold}"
        
        session.add(test)
        session.commit()
        session.refresh(test)
        
        return {
            "id": test.id,
            "is_compliant": is_compliant,
            "status": test.status,
            "cure_deadline": test.cure_deadline.isoformat() if test.cure_deadline else None
        }


def check_compliance(threshold: str, actual: str) -> bool:
    """Check if actual value meets threshold."""
    try:
        # Parse threshold (e.g., "< 3.5x", "> 4.0x")
        threshold_clean = threshold.lower().replace("x", "").strip()
        actual_clean = actual.lower().replace("x", "").strip()
        
        # Extract operator and value
        if "<" in threshold_clean:
            threshold_val = float(threshold_clean.replace("<", "").replace("=", "").strip())
            actual_val = float(actual_clean)
            return actual_val < threshold_val
        elif ">" in threshold_clean:
            threshold_val = float(threshold_clean.replace(">", "").replace("=", "").strip())
            actual_val = float(actual_clean)
            return actual_val > threshold_val
        else:
            # Assume equality
            return actual_clean == threshold_clean
    except:
        # If parsing fails, return True (manual review needed)
        return True


@router.post("/cure/{test_id}")
def record_covenant_cure(
    test_id: int,
    notes: str,
    current_user: Dict = Depends(require_auth)
):
    """Record that a breached covenant has been cured."""
    with Session(engine) as session:
        test = session.get(CovenantTest, test_id)
        if not test:
            raise HTTPException(404, "Covenant test not found")
        
        if test.status != "breached":
            raise HTTPException(400, "Covenant is not in breached status")
        
        test.status = "cured"
        test.notes = notes
        session.add(test)
        session.commit()
        
        return {"message": "Covenant marked as cured", "status": "cured"}


@router.post("/waive/{test_id}")
def waive_covenant_breach(
    test_id: int,
    waiver_notes: str,
    current_user: Dict = Depends(require_role([Role.ADMIN, Role.ANALYST]))
):
    """Waive a covenant breach (requires authorization)."""
    with Session(engine) as session:
        test = session.get(CovenantTest, test_id)
        if not test:
            raise HTTPException(404, "Covenant test not found")
        
        test.status = "waived"
        test.notes = f"WAIVED by User {current_user.get('id')}: {waiver_notes}"
        session.add(test)
        session.commit()
        
        return {"message": "Covenant breach waived", "status": "waived"}
