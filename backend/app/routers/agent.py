"""
LoanTwin Agentic AI Router
Handles autonomous recommendations, pre-cleared marketplace, and stress testing
"""
from __future__ import annotations
import json
import random
from datetime import datetime, date, timedelta
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select
from ..db import engine
from ..models.tables import Loan, Clause, Obligation, TradeCheck, AuditLog

router = APIRouter(prefix="/agent", tags=["agent"])

# ============ SCHEMAS ============

class AgentRecommendation(BaseModel):
    id: str
    issue_type: str  # 'missing', 'conflict', 'block', 'opportunity'
    severity: str    # 'critical', 'warning', 'ready', 'opportunity'
    title: str
    description: str
    ai_recommendation: str
    drafted_action: dict | None = None
    action_type: str  # 'approve_send', 'view_redline', 'request_waiver', 'instant_trade'
    action_label: str
    estimated_impact: str
    confidence: float

class PreClearedBuyer(BaseModel):
    id: str
    name: str
    type: str  # 'bank', 'fund', 'insurance'
    credit_rating: str
    pre_cleared: bool
    relationship: str
    last_trade_date: str | None = None

class StressScenario(BaseModel):
    name: str
    description: str
    fx_shock_pct: float
    rate_shock_bps: int
    revenue_shock_pct: float

class StressTestResult(BaseModel):
    scenario: str
    covenant_breaches: list[dict]
    cash_flow_impact: dict
    overall_risk: str
    breach_probability: float

class ESGMarginAdjustment(BaseModel):
    kpi_name: str
    target: str
    current_value: float | None
    status: str  # 'on_track', 'at_risk', 'breached'
    margin_impact_bps: float
    next_test_date: str

# ============ AGENTIC RECOMMENDATIONS ============

@router.get("/recommendations/{loan_id}", response_model=list[AgentRecommendation])
def get_agent_recommendations(loan_id: int):
    """Returns AI-powered actionable recommendations for a loan."""
    with Session(engine) as session:
        loan = session.get(Loan, loan_id)
        if not loan: raise HTTPException(404, "Loan not found")
        
        recommendations = []
        
        # Check for ESG verification needs
        if loan.is_esg_linked:
            recommendations.append(AgentRecommendation(
                id="esg_verifier",
                issue_type="missing",
                severity="critical",
                title="Missing ESG Verifier Assignment",
                description="No third-party ESG verifier specified for sustainability-linked covenants.",
                ai_recommendation="Based on deal size and sector (Aviation), KPMG is the recommended verifier. Engagement letter drafted using LMA ESG Standard template.",
                drafted_action={
                    "type": "engagement_letter",
                    "recipient": "KPMG Sustainability Services",
                    "template": "LMA_ESG_Verifier_Engagement_v2",
                    "deal_reference": loan.name,
                    "commitment_amount": _get_total_commitment(loan),
                    "kpis": ["GHG Emissions", "Renewable Energy Mix"],
                    "fee_estimate": "£45,000 - £65,000"
                },
                action_type="approve_send",
                action_label="Approve & Send to KPMG",
                estimated_impact="Clears ESG verification requirement. +15 to Trade Readiness Score.",
                confidence=0.94
            ))
        
        # Check for non-standard clauses
        clauses = session.exec(select(Clause).where(Clause.loan_id==loan_id, Clause.is_standard==False)).all()
        for clause in clauses[:2]:
            recommendations.append(AgentRecommendation(
                id=f"clause_{clause.id}",
                issue_type="conflict",
                severity="warning",
                title=f"Clause Deviation: {clause.heading[:40]}",
                description=f"Clause matches only {int((clause.variance_score or 0.7) * 100)}% of LMA standard. Commercial impact detected.",
                ai_recommendation="AI has generated suggested redline to bring clause back to market standard. Changes reduce operational burden on Borrower.",
                drafted_action={
                    "type": "redline",
                    "original_text": clause.body[:200] + "...",
                    "suggested_text": _generate_standard_redline(clause.heading),
                    "lma_reference": "LMA Investment Grade v5.2, Clause 24.3"
                },
                action_type="view_redline",
                action_label="View & Apply Redline",
                estimated_impact="Standardizes documentation. Reduces legal review time by 2 days.",
                confidence=0.87
            ))
        
        # Check for trade blocks
        trade_checks = session.exec(select(TradeCheck).where(TradeCheck.loan_id==loan_id, TradeCheck.risk_level=='high')).all()
        for tc in trade_checks:
            if 'white' in tc.item.lower() or 'transferee' in tc.rationale.lower():
                recommendations.append(AgentRecommendation(
                    id=f"trade_{tc.id}",
                    issue_type="opportunity",
                    severity="opportunity",
                    title="Pre-Cleared Buyers Available",
                    description=f"Transfer restricted to specific entities per side letter. {tc.rationale}",
                    ai_recommendation="Identified 4 Pre-Cleared Buyers from white-list (J.P. Morgan, Citi, BlackRock, Allianz). Instant settlement available.",
                    drafted_action={
                        "type": "instant_trade",
                        "pre_cleared_count": 4,
                        "buyers": ["J.P. Morgan", "Citibank", "BlackRock", "Allianz"],
                        "settlement": "T+0"
                    },
                    action_type="instant_trade",
                    action_label="View Pre-Cleared Offers",
                    estimated_impact="Enables instant liquidity. Settlement T+0 instead of T+20.",
                    confidence=0.96
                ))
            else:
                recommendations.append(AgentRecommendation(
                    id=f"trade_{tc.id}",
                    issue_type="block",
                    severity="warning",
                    title=f"Trade Block: {tc.item}",
                    description=tc.rationale,
                    ai_recommendation="Waiver request drafted for Syndication Agent citing precedent from similar ESG-linked facilities.",
                    drafted_action={
                        "type": "waiver_request",
                        "recipient": "Agent Bank (HSBC)",
                        "template": "LMA_Transfer_Waiver_Request",
                        "precedent_deals": ["Project Aurora (2024)", "Green Horizons II (2023)"]
                    },
                    action_type="request_waiver",
                    action_label="Send Waiver Request",
                    estimated_impact="If approved, increases Trade Readiness by +40 points.",
                    confidence=0.78
                ))
        
        # Check for overdue obligations
        obligations = session.exec(select(Obligation).where(Obligation.loan_id==loan_id)).all()
        overdue = [o for o in obligations if o.due_date and o.due_date < date.today() and o.status.lower() != 'completed']
        for ob in overdue[:2]:
            recommendations.append(AgentRecommendation(
                id=f"obligation_{ob.id}",
                issue_type="missing",
                severity="critical",
                title=f"Overdue: {ob.title}",
                description=f"Due {ob.due_date}. {ob.details[:100]}",
                ai_recommendation="Drafted reminder notice to Borrower's designated compliance officer with escalation path.",
                drafted_action={
                    "type": "reminder_notice",
                    "recipient": "Borrower Compliance Team",
                    "escalation_date": (date.today() + timedelta(days=3)).isoformat(),
                    "template": "LMA_Compliance_Reminder"
                },
                action_type="approve_send",
                action_label="Send Reminder",
                estimated_impact="Triggers formal compliance process. Protects lender rights.",
                confidence=0.92
            ))
        
        return recommendations

# ============ PRE-CLEARED MARKETPLACE ============

@router.get("/marketplace/{loan_id}", response_model=dict)
def get_marketplace_data(loan_id: int):
    """Returns pre-cleared marketplace data for instant liquidity."""
    with Session(engine) as session:
        loan = session.get(Loan, loan_id)
        if not loan: raise HTTPException(404, "Loan not found")
        
        # Extract white-list from DLR or generate sample
        pre_cleared_buyers = [
            PreClearedBuyer(id="jpm", name="J.P. Morgan", type="bank", credit_rating="A+", pre_cleared=True, relationship="Existing Lender", last_trade_date="2024-08-15"),
            PreClearedBuyer(id="citi", name="Citibank", type="bank", credit_rating="A", pre_cleared=True, relationship="Existing Lender", last_trade_date="2024-06-22"),
            PreClearedBuyer(id="blackrock", name="BlackRock CLO Fund", type="fund", credit_rating="AA-", pre_cleared=True, relationship="White-listed", last_trade_date=None),
            PreClearedBuyer(id="allianz", name="Allianz Investment", type="insurance", credit_rating="AA", pre_cleared=True, relationship="White-listed", last_trade_date=None),
        ]
        
        interested_buyers = [
            {"id": "apollo", "name": "Apollo Global", "type": "fund", "pre_cleared": False, "interest_level": "High", "waiver_status": "Not Requested"},
            {"id": "kkr", "name": "KKR Credit", "type": "fund", "pre_cleared": False, "interest_level": "Medium", "waiver_status": "Not Requested"},
        ]
        
        total_commitment = _get_total_commitment(loan)
        
        return {
            "loan_id": loan_id,
            "loan_name": loan.name,
            "total_commitment": total_commitment,
            "currency": loan.currency or "GBP",
            "available_for_sale": total_commitment * 0.25,  # 25% available
            "min_ticket_size": 5000000,
            "settlement_type": "T+0 (Pre-Cleared) / T+5 (With Waiver)",
            "pre_cleared_buyers": [b.model_dump() for b in pre_cleared_buyers],
            "interested_buyers": interested_buyers,
            "instant_liquidity_available": True,
            "trade_readiness_score": _calculate_trade_score(session, loan_id)
        }

# In-memory trade storage (would be database in production)
_active_trades: Dict[str, Dict] = {}

@router.post("/marketplace/{loan_id}/initiate-trade")
def initiate_trade(
    loan_id: int, 
    buyer_id: str, 
    amount: float,
    price_percent: float = 99.5,
    trade_type: str = "assignment",
    settlement_date: str = None
):
    """Initiates a trade with a pre-cleared buyer."""
    with Session(engine) as session:
        loan = session.get(Loan, loan_id)
        if not loan: raise HTTPException(404, "Loan not found")
        
        trade_id = f"TRD-{loan_id}-{datetime.now().strftime('%Y%m%d%H%M%S')}"
        settle_date = settlement_date or date.today().isoformat()
        
        # Calculate proceeds
        proceeds = amount * (price_percent / 100)
        
        # Create trade record
        trade = {
            "trade_id": trade_id,
            "loan_id": loan_id,
            "loan_name": loan.name,
            "buyer_id": buyer_id,
            "amount": amount,
            "price_percent": price_percent,
            "proceeds": proceeds,
            "trade_type": trade_type,
            "settlement_date": settle_date,
            "settlement_type": "T+0" if buyer_id.startswith("PC-") else "T+5",
            "status": "pending_confirmation",
            "status_history": [
                {"status": "initiated", "timestamp": datetime.now().isoformat(), "by": "system"},
            ],
            "documents": {
                "assignment_agreement": {"status": "draft_ready", "generated_at": datetime.now().isoformat()},
                "transfer_certificate": {"status": "pending_buyer"},
                "kyc_aml": {"status": "cleared"},
                "ssi_instructions": {"status": "awaiting_exchange"}
            },
            "workflow": [
                {"step": "Trade Initiation", "status": "completed", "timestamp": datetime.now().isoformat()},
                {"step": "Buyer Confirmation", "status": "pending", "expected": (datetime.now() + timedelta(hours=2)).isoformat()},
                {"step": "SSI Exchange", "status": "pending"},
                {"step": "Agent Notification", "status": "queued"},
                {"step": "Settlement", "status": "pending", "expected": settle_date}
            ],
            "created_at": datetime.now().isoformat()
        }
        
        _active_trades[trade_id] = trade
        
        # Log the trade initiation
        session.add(AuditLog(
            loan_id=loan_id,
            action="TRADE_INITIATED",
            details=f"Trade {trade_id} initiated with {buyer_id} for {loan.currency} {amount:,.0f} @ {price_percent}% ({trade_type}). Settlement: {settle_date}."
        ))
        session.commit()
        
        return trade

@router.get("/trades/{trade_id}")
def get_trade_status(trade_id: str):
    """Get status of a trade."""
    trade = _active_trades.get(trade_id)
    if not trade:
        raise HTTPException(404, "Trade not found")
    return trade

@router.get("/marketplace/{loan_id}/trades")
def list_loan_trades(loan_id: int):
    """List all trades for a loan."""
    trades = [t for t in _active_trades.values() if t["loan_id"] == loan_id]
    return {
        "loan_id": loan_id,
        "trade_count": len(trades),
        "trades": sorted(trades, key=lambda x: x["created_at"], reverse=True)
    }

@router.post("/trades/{trade_id}/confirm")
def confirm_trade(trade_id: str):
    """Buyer confirms the trade."""
    trade = _active_trades.get(trade_id)
    if not trade:
        raise HTTPException(404, "Trade not found")
    
    trade["status"] = "confirmed"
    trade["status_history"].append({
        "status": "confirmed", 
        "timestamp": datetime.now().isoformat(), 
        "by": "buyer"
    })
    
    # Update workflow
    for step in trade["workflow"]:
        if step["step"] == "Buyer Confirmation":
            step["status"] = "completed"
            step["timestamp"] = datetime.now().isoformat()
        elif step["step"] == "SSI Exchange":
            step["status"] = "in_progress"
    
    return trade

@router.post("/trades/{trade_id}/settle")
def settle_trade(trade_id: str):
    """Complete trade settlement."""
    trade = _active_trades.get(trade_id)
    if not trade:
        raise HTTPException(404, "Trade not found")
    
    trade["status"] = "settled"
    trade["status_history"].append({
        "status": "settled", 
        "timestamp": datetime.now().isoformat(), 
        "by": "system"
    })
    trade["settled_at"] = datetime.now().isoformat()
    
    # Mark all workflow steps as complete
    for step in trade["workflow"]:
        step["status"] = "completed"
        if "timestamp" not in step:
            step["timestamp"] = datetime.now().isoformat()
    
    # Update documents
    for doc in trade["documents"]:
        trade["documents"][doc]["status"] = "executed"
    
    return trade

@router.post("/marketplace/{loan_id}/request-waiver")
def request_waiver(loan_id: int, buyer_id: str, buyer_name: str):
    """Requests a waiver for a non-pre-cleared buyer."""
    with Session(engine) as session:
        loan = session.get(Loan, loan_id)
        if not loan: raise HTTPException(404, "Loan not found")
        
        session.add(AuditLog(
            loan_id=loan_id,
            action="WAIVER_REQUESTED",
            details=f"Transfer waiver requested for {buyer_name}. Sent to Agent Bank for approval."
        ))
        session.commit()
        
        return {
            "status": "waiver_requested",
            "waiver_id": f"WVR-{loan_id}-{datetime.now().strftime('%Y%m%d%H%M%S')}",
            "buyer": buyer_name,
            "expected_response_days": 5,
            "drafted_letter_sent": True,
            "tracking_status": "Awaiting Counter-signature"
        }

# ============ STRESS TESTING ============

@router.get("/stress-test/{loan_id}", response_model=dict)
def get_stress_scenarios(loan_id: int):
    """Returns available stress test scenarios."""
    scenarios = [
        StressScenario(name="Base Case", description="Current market conditions", fx_shock_pct=0, rate_shock_bps=0, revenue_shock_pct=0),
        StressScenario(name="Rate Hike", description="Central bank raises rates 100bps", fx_shock_pct=0, rate_shock_bps=100, revenue_shock_pct=-5),
        StressScenario(name="FX Crisis", description="EUR/USD moves 10%", fx_shock_pct=10, rate_shock_bps=25, revenue_shock_pct=-8),
        StressScenario(name="Recession", description="Revenue decline scenario", fx_shock_pct=5, rate_shock_bps=50, revenue_shock_pct=-20),
        StressScenario(name="Perfect Storm", description="Combined adverse scenario", fx_shock_pct=15, rate_shock_bps=150, revenue_shock_pct=-30),
    ]
    return {"loan_id": loan_id, "scenarios": [s.model_dump() for s in scenarios]}

@router.post("/stress-test/{loan_id}/run")
def run_stress_test(loan_id: int, scenario_name: str):
    """Runs a stress test scenario and returns impact analysis."""
    with Session(engine) as session:
        loan = session.get(Loan, loan_id)
        if not loan: raise HTTPException(404, "Loan not found")
        
        # Parse DLR for covenants
        covenants = []
        if loan.dlr_json:
            dlr = json.loads(loan.dlr_json)
            covenants = dlr.get("covenants", [])
        
        # Scenario parameters
        scenarios = {
            "Base Case": {"fx": 0, "rate": 0, "revenue": 0},
            "Rate Hike": {"fx": 0, "rate": 100, "revenue": -5},
            "FX Crisis": {"fx": 10, "rate": 25, "revenue": -8},
            "Recession": {"fx": 5, "rate": 50, "revenue": -20},
            "Perfect Storm": {"fx": 15, "rate": 150, "revenue": -30},
        }
        
        params = scenarios.get(scenario_name, scenarios["Base Case"])
        
        # Calculate covenant impacts
        breaches = []
        for cov in covenants:
            threshold = cov.get("threshold", "< 4.0x")
            # Simulate impact
            if "leverage" in cov.get("name", "").lower():
                stress_value = 3.2 * (1 - params["revenue"] / 100)  # Leverage increases with revenue decline
                limit = float(threshold.replace("<", "").replace("x", "").strip())
                if stress_value > limit:
                    breaches.append({
                        "covenant": cov.get("name"),
                        "current": "3.2x",
                        "stressed": f"{stress_value:.1f}x",
                        "threshold": threshold,
                        "status": "BREACH",
                        "margin_impact": "+50 bps"
                    })
                else:
                    breaches.append({
                        "covenant": cov.get("name"),
                        "current": "3.2x",
                        "stressed": f"{stress_value:.1f}x",
                        "threshold": threshold,
                        "status": "COMPLIANT",
                        "margin_impact": "None"
                    })
        
        # Calculate cash flow impact
        total_commitment = _get_total_commitment(loan)
        base_interest = total_commitment * ((loan.margin_bps or 175) / 10000)
        stressed_interest = base_interest * (1 + params["rate"] / 10000)
        
        # Calculate breach probability
        breach_probability = min(0.95, 0.1 + (abs(params["revenue"]) / 100) + (params["rate"] / 500))
        
        overall_risk = "Low" if breach_probability < 0.3 else "Medium" if breach_probability < 0.6 else "High"
        
        return {
            "scenario": scenario_name,
            "parameters": params,
            "covenant_analysis": breaches,
            "cash_flow_impact": {
                "base_annual_interest": base_interest,
                "stressed_annual_interest": stressed_interest,
                "incremental_cost": stressed_interest - base_interest,
                "currency": loan.currency or "GBP"
            },
            "overall_risk": overall_risk,
            "breach_probability": breach_probability,
            "recommendation": _get_stress_recommendation(breach_probability, scenario_name)
        }

# ============ ESG DYNAMIC MARGINS ============

@router.get("/esg-margins/{loan_id}", response_model=dict)
def get_esg_margins(loan_id: int):
    """Returns ESG KPI status and margin adjustments."""
    with Session(engine) as session:
        loan = session.get(Loan, loan_id)
        if not loan: raise HTTPException(404, "Loan not found")
        
        if not loan.is_esg_linked:
            return {"loan_id": loan_id, "is_esg_linked": False, "adjustments": []}
        
        # Parse ESG KPIs from DLR
        kpis = []
        if loan.dlr_json:
            dlr = json.loads(loan.dlr_json)
            for esg in dlr.get("esg", []):
                status = random.choice(["on_track", "on_track", "at_risk"])
                margin_impact = -2.5 if status == "on_track" else 0 if status == "at_risk" else 5.0
                kpis.append(ESGMarginAdjustment(
                    kpi_name=esg.get("kpi_name", "ESG KPI"),
                    target=esg.get("target_description", "Meet target"),
                    current_value=random.uniform(0.85, 1.05) if status == "on_track" else random.uniform(0.7, 0.85),
                    status=status,
                    margin_impact_bps=margin_impact,
                    next_test_date=(date.today() + timedelta(days=90)).isoformat()
                ))
        
        total_margin_adjustment = sum(k.margin_impact_bps for k in kpis)
        effective_margin = (loan.margin_bps or 175) + total_margin_adjustment
        
        return {
            "loan_id": loan_id,
            "is_esg_linked": True,
            "base_margin_bps": loan.margin_bps or 175,
            "total_esg_adjustment_bps": total_margin_adjustment,
            "effective_margin_bps": effective_margin,
            "kpi_status": [k.model_dump() for k in kpis],
            "next_margin_reset": (date.today() + timedelta(days=90)).isoformat(),
            "verification_status": "Third-Party Verified" if random.random() > 0.3 else "Self-Reported"
        }

@router.post("/esg-margins/{loan_id}/simulate")
def simulate_esg_margin(loan_id: int, kpi_name: str, new_value: float):
    """Simulates margin impact of changing an ESG KPI value."""
    with Session(engine) as session:
        loan = session.get(Loan, loan_id)
        if not loan: raise HTTPException(404, "Loan not found")
        
        # Determine status based on value (assuming 1.0 = 100% of target)
        if new_value >= 1.0:
            status = "on_track"
            margin_impact = -2.5
        elif new_value >= 0.85:
            status = "at_risk"
            margin_impact = 0
        else:
            status = "breached"
            margin_impact = 5.0
        
        return {
            "kpi_name": kpi_name,
            "simulated_value": new_value,
            "status": status,
            "margin_impact_bps": margin_impact,
            "annual_cost_impact": _get_total_commitment(loan) * (margin_impact / 10000),
            "currency": loan.currency or "GBP"
        }

# ============ AGENT ACTIONS ============

@router.post("/execute/{loan_id}/{recommendation_id}")
def execute_agent_action(loan_id: int, recommendation_id: str):
    """Executes an agent-recommended action."""
    with Session(engine) as session:
        loan = session.get(Loan, loan_id)
        if not loan: raise HTTPException(404, "Loan not found")
        
        action_type = recommendation_id.split("_")[0]
        
        # Log the execution
        session.add(AuditLog(
            loan_id=loan_id,
            action="AGENT_EXECUTE",
            details=f"Agent executed action: {recommendation_id}. Autonomous workflow triggered."
        ))
        session.commit()
        
        # Return appropriate response based on action type
        if action_type == "esg":
            return {
                "status": "executed",
                "action": "ESG Verifier Engagement",
                "result": "Engagement letter sent to KPMG Sustainability Services",
                "tracking_status": "Awaiting Counter-signature",
                "expected_completion": (date.today() + timedelta(days=5)).isoformat()
            }
        elif action_type == "clause":
            return {
                "status": "executed",
                "action": "Redline Applied",
                "result": "Clause updated to LMA standard. Amendment logged.",
                "tracking_status": "Pending Legal Review",
                "expected_completion": (date.today() + timedelta(days=2)).isoformat()
            }
        elif action_type == "trade":
            return {
                "status": "executed",
                "action": "Trade Block Resolution",
                "result": "Waiver request sent to Agent Bank",
                "tracking_status": "Awaiting Approval",
                "expected_completion": (date.today() + timedelta(days=5)).isoformat()
            }
        else:
            return {
                "status": "executed",
                "action": recommendation_id,
                "result": "Action completed by LoanTwin Agent",
                "tracking_status": "Complete"
            }

# ============ HELPER FUNCTIONS ============

def _get_total_commitment(loan: Loan) -> float:
    if not loan.dlr_json:
        return 350000000  # Default
    try:
        dlr = json.loads(loan.dlr_json)
        total = 0
        for f in dlr.get("facilities", []):
            amt = str(f.get("amount", "0")).replace(",", "")
            total += float(amt)
        return total if total > 0 else 350000000
    except:
        return 350000000

def _calculate_trade_score(session: Session, loan_id: int) -> int:
    trade_checks = session.exec(select(TradeCheck).where(TradeCheck.loan_id==loan_id)).all()
    score = 100
    for tc in trade_checks:
        if tc.risk_level.lower() == 'high':
            score -= 40
        elif tc.risk_level.lower() in ['med', 'medium']:
            score -= 15
    return max(0, score)

def _generate_standard_redline(heading: str) -> str:
    """Generates a sample LMA-standard redline suggestion."""
    return "The Borrower shall deliver to the Agent, within 45 days after the end of each Fiscal Quarter, a compliance certificate signed by an authorized officer..."

def _get_stress_recommendation(breach_prob: float, scenario: str) -> str:
    if breach_prob < 0.3:
        return f"Deal shows resilience under {scenario}. No immediate action required."
    elif breach_prob < 0.6:
        return f"Moderate risk under {scenario}. Consider covenant reset discussions or hedging strategies."
    else:
        return f"High breach probability under {scenario}. Recommend immediate engagement with Borrower on covenant amendments or credit enhancement."


# ============ AGENT ORCHESTRATION ============

@router.post("/workflow/{loan_id}")
def execute_agent_workflow(loan_id: int):
    """Run full agent workflow: analyze, research, draft, queue for approval."""
    from ..services.agents import orchestrator
    
    recommendations = orchestrator.analyze_loan(loan_id)
    
    return {
        "loan_id": loan_id,
        "workflow_id": f"WF-{loan_id}-{datetime.now().strftime('%Y%m%d%H%M%S')}",
        "status": "completed",
        "recommendations_generated": len(recommendations),
        "recommendations": [
            {
                "id": r.id,
                "issue_type": r.issue_type,
                "severity": r.severity,
                "title": r.title,
                "description": r.description,
                "action_id": r.suggested_action.id,
                "action_title": r.suggested_action.title,
                "action_type": r.suggested_action.action_type.value,
                "confidence": r.suggested_action.confidence,
                "requires_approval": r.suggested_action.requires_approval
            }
            for r in recommendations
        ]
    }


@router.get("/approval-queue")
def get_approval_queue(loan_id: int = None):
    """Get all pending actions awaiting approval."""
    from ..services.agents import orchestrator
    
    actions = orchestrator.get_approval_queue(loan_id)
    
    return {
        "queue_length": len(actions),
        "actions": [
            {
                "id": a.id,
                "action_type": a.action_type.value,
                "title": a.title,
                "description": a.description,
                "loan_id": a.loan_id,
                "priority": a.priority,
                "confidence": a.confidence,
                "created_at": a.created_at,
                "status": a.status.value,
                "has_draft": a.drafted_content is not None,
                "agent_reasoning": a.agent_reasoning,
                "auto_execute_eligible": a.auto_execute_eligible
            }
            for a in actions
        ]
    }


@router.get("/approval-queue/{action_id}/draft")
def get_action_draft(action_id: str):
    """Get the drafted content for an action."""
    from ..services.agents import _action_store
    
    action = _action_store.get(action_id)
    if not action:
        raise HTTPException(404, "Action not found")
    
    return {
        "action_id": action_id,
        "title": action.title,
        "drafted_content": action.drafted_content,
        "metadata": action.metadata,
        "agent_reasoning": action.agent_reasoning,
        "confidence": action.confidence
    }


@router.post("/approve/{action_id}")
def approve_action(action_id: str, user_id: int = 1):
    """Approve and execute a pending action."""
    from ..services.agents import orchestrator
    
    result = orchestrator.approve_action(action_id, user_id)
    
    if not result.get("success"):
        raise HTTPException(400, result.get("error"))
    
    return result


@router.post("/reject/{action_id}")
def reject_action(action_id: str, reason: str = None):
    """Reject a pending action."""
    from ..services.agents import orchestrator
    
    result = orchestrator.reject_action(action_id, reason)
    
    if not result.get("success"):
        raise HTTPException(400, result.get("error"))
    
    return result
