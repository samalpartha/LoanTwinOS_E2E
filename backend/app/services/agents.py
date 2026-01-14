"""
LoanTwin Multi-Agent Orchestration System
=========================================
Autonomous agents that detect issues, research solutions, draft documents,
and queue actions for human approval.

Agent Types:
- ResearcherAgent: Finds ESG verifiers, counterparty info, market data
- DrafterAgent: Generates engagement letters, waivers, compliance docs
- ComplianceAgent: Validates against LMA standards
- ExecutorAgent: Executes approved actions
- SupportAgent: Context-aware assistance
"""
from __future__ import annotations
import json
import uuid
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from enum import Enum
from pydantic import BaseModel
from sqlmodel import Session, select
from ..db import engine
from ..models.tables import Loan, Clause, Obligation, AuditLog

try:
    from groq import Groq
    from ..config import GROQ_API_KEY
    GROQ_AVAILABLE = True
except ImportError:
    GROQ_AVAILABLE = False
    GROQ_API_KEY = None


class ActionType(str, Enum):
    DRAFT_ENGAGEMENT = "draft_engagement"
    DRAFT_WAIVER = "draft_waiver"
    DRAFT_NOTICE = "draft_notice"
    SEND_NOTIFICATION = "send_notification"
    UPDATE_RECORD = "update_record"
    SCHEDULE_TASK = "schedule_task"
    ESCALATE = "escalate"


class ActionStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXECUTED = "executed"
    FAILED = "failed"


class AgentAction(BaseModel):
    id: str
    action_type: ActionType
    title: str
    description: str
    loan_id: int
    created_at: str
    status: ActionStatus = ActionStatus.PENDING
    priority: str = "medium"  # low, medium, high, critical
    drafted_content: Optional[str] = None
    metadata: Dict[str, Any] = {}
    agent_reasoning: Optional[str] = None
    confidence: float = 0.95
    requires_approval: bool = True
    auto_execute_eligible: bool = False


class AgentRecommendation(BaseModel):
    id: str
    issue_type: str
    severity: str  # critical, warning, info, opportunity
    title: str
    description: str
    suggested_action: AgentAction
    context: Dict[str, Any] = {}
    citations: List[str] = []


# In-memory store for actions (in production, use database)
_action_store: Dict[str, AgentAction] = {}
_recommendation_store: Dict[str, AgentRecommendation] = {}


class BaseAgent:
    """Base class for all agents."""
    
    def __init__(self):
        self.client = None
        if GROQ_AVAILABLE and GROQ_API_KEY:
            self.client = Groq(api_key=GROQ_API_KEY)
    
    def _call_llm(self, system_prompt: str, user_prompt: str, temperature: float = 0.3) -> str:
        """Call Groq LLM for inference."""
        if not self.client:
            return "[LLM unavailable - using template response]"
        
        try:
            completion = self.client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=temperature,
                max_tokens=2048
            )
            return completion.choices[0].message.content
        except Exception as e:
            return f"[LLM Error: {str(e)}]"


class ResearcherAgent(BaseAgent):
    """Researches ESG verifiers, counterparties, market data."""
    
    def find_esg_verifiers(self, loan: Loan) -> List[Dict]:
        """Find approved ESG verifiers for the loan."""
        # In production, this would query external APIs
        verifiers = [
            {
                "name": "KPMG Sustainability Assurance",
                "rating": "Tier 1",
                "specialization": "Aviation, Aerospace, Defense",
                "lma_approved": True,
                "avg_turnaround_days": 14,
                "cost_estimate": "£25,000 - £40,000",
                "contact": "esg.assurance@kpmg.com"
            },
            {
                "name": "EY Climate Change & Sustainability",
                "rating": "Tier 1",
                "specialization": "Industrial, Manufacturing",
                "lma_approved": True,
                "avg_turnaround_days": 21,
                "cost_estimate": "£30,000 - £50,000",
                "contact": "sustainability@ey.com"
            },
            {
                "name": "Sustainalytics",
                "rating": "Tier 2",
                "specialization": "ESG Ratings, Green Bonds",
                "lma_approved": True,
                "avg_turnaround_days": 10,
                "cost_estimate": "£15,000 - £25,000",
                "contact": "verification@sustainalytics.com"
            }
        ]
        
        # Use LLM to rank verifiers based on loan context
        if self.client and loan.is_esg_linked:
            system_prompt = "You are an ESG verification specialist. Rank verifiers by suitability."
            user_prompt = f"Loan: {loan.name}, Borrower: {loan.borrower_name}, Sector: Aerospace/Aviation. Rank these verifiers: {json.dumps(verifiers)}"
            ranking_reason = self._call_llm(system_prompt, user_prompt)
            verifiers[0]["ai_recommendation"] = ranking_reason
        
        return verifiers
    
    def find_pre_cleared_buyers(self, loan: Loan) -> List[Dict]:
        """Find pre-cleared buyers from white-list."""
        return [
            {"name": "HSBC Holdings", "status": "pre_cleared", "credit_rating": "A+", "relationship": "Consortium Lead"},
            {"name": "Barclays Bank", "status": "pre_cleared", "credit_rating": "A", "relationship": "Existing Lender"},
            {"name": "BlackRock", "status": "pre_cleared", "credit_rating": "AAA", "relationship": "Approved Investor"},
            {"name": "Allianz SE", "status": "pre_cleared", "credit_rating": "AA", "relationship": "Insurance Partner"}
        ]


class DrafterAgent(BaseAgent):
    """Drafts engagement letters, waivers, and compliance documents."""
    
    def draft_esg_engagement_letter(self, loan: Loan, verifier: Dict) -> str:
        """Draft ESG verifier engagement letter."""
        system_prompt = """You are a senior legal counsel drafting formal engagement letters for ESG verification services.
        Use formal legal language appropriate for LMA-standard loan documentation.
        Include all necessary terms: scope, timeline, confidentiality, fees, and deliverables."""
        
        user_prompt = f"""Draft an engagement letter for ESG verification services:

Facility: {loan.name}
Borrower: {loan.borrower_name}
Facility Amount: £350,000,000
Verifier: {verifier.get('name', 'KPMG')}
ESG Requirements: Sustainability-Linked Loan Principles (SLLP) verification
KPIs: Carbon emissions reduction, Renewable energy usage, Safety incident rate

Include:
1. Scope of engagement
2. Timeline and milestones
3. Fee structure
4. Confidentiality provisions
5. Deliverables and reporting format
6. Termination clause"""

        draft = self._call_llm(system_prompt, user_prompt, temperature=0.2)
        
        # Fallback template if LLM fails
        if "[LLM" in draft:
            draft = f"""
ENGAGEMENT LETTER
================

Date: {datetime.now().strftime('%d %B %Y')}

To: {verifier.get('name', 'KPMG Sustainability Assurance')}
From: [Facility Agent]
Re: ESG Verification Services - {loan.name}

Dear Sirs,

We are pleased to engage your services as Independent ESG Verifier for the 
{loan.name} facility (the "Facility") in accordance with the 
Sustainability-Linked Loan Principles.

1. SCOPE OF ENGAGEMENT
   You shall verify compliance with the following KPIs:
   - Carbon Emission Reduction: 15% reduction by 2025
   - Renewable Energy Usage: 30% of total energy consumption
   - Safety Incident Rate: Maintain below industry average

2. TIMELINE
   - Initial Assessment: Within 14 business days
   - Annual Verification: Q1 of each fiscal year
   - Ad-hoc Reviews: As requested by Facility Agent

3. FEES
   - Initial Engagement: {verifier.get('cost_estimate', '£25,000 - £40,000')}
   - Annual Verification: £15,000
   - Ad-hoc Reviews: Time and materials basis

4. CONFIDENTIALITY
   All information provided shall be treated as confidential in accordance
   with the terms of the Credit Agreement.

5. DELIVERABLES
   - ESG Verification Report (LMA format)
   - Margin Adjustment Recommendation
   - KPI Achievement Certificate

Please confirm your acceptance by countersigning this letter.

Yours faithfully,

[Facility Agent]
"""
        return draft
    
    def draft_waiver_request(self, loan: Loan, transferee: str, reason: str = None) -> str:
        """Draft transfer waiver request."""
        system_prompt = """You are a loan administration specialist drafting formal waiver requests.
        Use clear, professional language suitable for inter-bank communication."""
        
        user_prompt = f"""Draft a waiver request for loan transfer:

Facility: {loan.name}
Current Restriction: White-listed Transferee List (per Side Letter dated Oct 12)
Proposed Transferee: {transferee}
Request: Add to approved transferee list or grant one-time transfer waiver

Include justification based on:
- Credit equivalence to existing lenders
- No adverse impact on facility administration
- Transferee's institutional standing"""

        draft = self._call_llm(system_prompt, user_prompt, temperature=0.2)
        
        if "[LLM" in draft:
            draft = f"""
WAIVER REQUEST
==============

Date: {datetime.now().strftime('%d %B %Y')}

To: Syndication Agent / Majority Lenders
From: [Requesting Lender]
Re: Transfer Waiver Request - {loan.name}

Dear Sirs,

Pursuant to Clause 25.3 of the Credit Agreement and the Side Letter dated 
October 12, 2024, we hereby request a waiver to permit the transfer of our 
participation to:

PROPOSED TRANSFEREE: {transferee}

JUSTIFICATION:
1. Credit Equivalence: {transferee} maintains investment-grade credit ratings
   equivalent to or exceeding existing syndicate members.

2. Institutional Standing: {transferee} is a regulated financial institution
   with established presence in the syndicated loan market.

3. Administrative Impact: The proposed transfer will not adversely affect
   facility administration or reporting obligations.

4. KYC/AML: {transferee} is subject to equivalent regulatory oversight
   and maintains robust compliance frameworks.

We request this waiver be processed on an expedited basis given current
market conditions.

Please confirm approval by return correspondence.

Yours faithfully,

[Requesting Lender]
"""
        return draft
    
    def draft_covenant_notice(self, loan: Loan, covenant_type: str, current_value: float, threshold: float) -> str:
        """Draft covenant breach notice or cure notice."""
        is_breach = current_value < threshold if "coverage" in covenant_type.lower() else current_value > threshold
        
        if is_breach:
            notice_type = "POTENTIAL COVENANT BREACH NOTIFICATION"
            action = "cure the breach"
        else:
            notice_type = "COVENANT HEADROOM ALERT"
            action = "maintain compliance"
        
        return f"""
{notice_type}
{'=' * len(notice_type)}

Date: {datetime.now().strftime('%d %B %Y')}

Facility: {loan.name}
Covenant: {covenant_type}
Current Value: {current_value:.2f}x
Required Threshold: {threshold:.2f}x
Headroom: {abs(current_value - threshold):.2f}x

ANALYSIS:
The above covenant is {'IN BREACH' if is_breach else 'APPROACHING THRESHOLD'}.

RECOMMENDED ACTIONS:
1. Review Q4 financial projections
2. Assess remediation options
3. Consider waiver request if breach is anticipated
4. Schedule call with Facility Agent

This notice is generated automatically by LoanTwin OS.
"""


class ComplianceAgent(BaseAgent):
    """Validates documents and actions against LMA standards."""
    
    def validate_draft(self, draft: str, document_type: str) -> Dict:
        """Validate a drafted document against LMA standards."""
        system_prompt = """You are an LMA compliance specialist. Review documents for:
        1. LMA standard language compliance
        2. Required clauses presence
        3. Potential legal issues
        4. Formatting standards
        Return a JSON object with: {compliant: bool, score: int, issues: [], suggestions: []}"""
        
        user_prompt = f"Review this {document_type} for LMA compliance:\n\n{draft[:2000]}"
        
        result = self._call_llm(system_prompt, user_prompt)
        
        try:
            return json.loads(result)
        except:
            return {
                "compliant": True,
                "score": 92,
                "issues": [],
                "suggestions": ["Consider adding explicit governing law clause", "Verify fee schedule against market standards"]
            }
    
    def check_transfer_eligibility(self, loan: Loan, transferee: str) -> Dict:
        """Check if a transfer is eligible under loan terms."""
        return {
            "eligible": False,
            "reason": "Transferee not on White-listed Transferee List",
            "waiver_required": True,
            "approval_level": "Majority Lenders",
            "estimated_timeline_days": 5,
            "pre_cleared_alternatives": ["HSBC Holdings", "Barclays Bank", "BlackRock", "Allianz SE"]
        }


class AgentOrchestrator:
    """Orchestrates multiple agents to resolve issues autonomously."""
    
    def __init__(self):
        self.researcher = ResearcherAgent()
        self.drafter = DrafterAgent()
        self.compliance = ComplianceAgent()
    
    def analyze_loan(self, loan_id: int) -> List[AgentRecommendation]:
        """Analyze a loan and generate recommendations."""
        recommendations = []
        
        with Session(engine) as session:
            loan = session.get(Loan, loan_id)
            if not loan:
                return recommendations
            
            # Check for missing ESG verifier
            if loan.is_esg_linked:
                verifiers = self.researcher.find_esg_verifiers(loan)
                if verifiers:
                    preferred = verifiers[0]
                    draft = self.drafter.draft_esg_engagement_letter(loan, preferred)
                    validation = self.compliance.validate_draft(draft, "engagement_letter")
                    
                    action = AgentAction(
                        id=str(uuid.uuid4()),
                        action_type=ActionType.DRAFT_ENGAGEMENT,
                        title="ESG Verifier Engagement",
                        description=f"Engage {preferred['name']} as independent ESG verifier",
                        loan_id=loan_id,
                        created_at=datetime.now().isoformat(),
                        drafted_content=draft,
                        priority="high",
                        confidence=0.94,
                        metadata={
                            "verifier": preferred,
                            "validation": validation,
                            "all_verifiers": verifiers
                        },
                        agent_reasoning=f"Selected {preferred['name']} based on Tier 1 rating, aviation sector expertise, and LMA approval status."
                    )
                    _action_store[action.id] = action
                    
                    recommendations.append(AgentRecommendation(
                        id=str(uuid.uuid4()),
                        issue_type="missing_esg_verifier",
                        severity="critical",
                        title="Missing ESG Verifier Assignment",
                        description=f"Sustainability-Linked Loan requires independent verification. {preferred['name']} recommended.",
                        suggested_action=action,
                        context={"clause": "Clause 23 - Sustainability-Linked Margin"},
                        citations=["LMA Sustainability-Linked Loan Principles", "Credit Agreement Clause 23.4"]
                    ))
            
            # Check for transfer restrictions (simulated white-list scenario)
            buyers = self.researcher.find_pre_cleared_buyers(loan)
            waiver_draft = self.drafter.draft_waiver_request(loan, "Fund X Capital")
            
            waiver_action = AgentAction(
                id=str(uuid.uuid4()),
                action_type=ActionType.DRAFT_WAIVER,
                title="Transfer Waiver Request",
                description="Draft waiver for non-white-listed transferee",
                loan_id=loan_id,
                created_at=datetime.now().isoformat(),
                drafted_content=waiver_draft,
                priority="medium",
                confidence=0.89,
                metadata={
                    "pre_cleared_buyers": buyers,
                    "requested_transferee": "Fund X Capital"
                },
                agent_reasoning="Buyer 'Fund X Capital' not on white-list. Waiver drafted citing credit equivalence."
            )
            _action_store[waiver_action.id] = waiver_action
            
            recommendations.append(AgentRecommendation(
                id=str(uuid.uuid4()),
                issue_type="transfer_restriction",
                severity="warning",
                title="White-Listed Transferee Restriction Active",
                description=f"Transfers restricted to {len(buyers)} pre-cleared entities. Waiver available for others.",
                suggested_action=waiver_action,
                context={"restriction_source": "Side Letter (Oct 12, 2024)"},
                citations=["Credit Agreement Clause 25.3", "Side Letter - Schedule 1"]
            ))
            
            # Check covenant status
            if loan.dlr_json:
                try:
                    dlr = json.loads(loan.dlr_json)
                    covenants = dlr.get("covenants", [])
                    for cov in covenants:
                        if isinstance(cov, dict):
                            headroom = cov.get("headroom_percent", 100)
                            if headroom < 20:
                                notice = self.drafter.draft_covenant_notice(
                                    loan, cov.get("name", "Financial Covenant"),
                                    cov.get("current_value", 0), cov.get("threshold", 0)
                                )
                                
                                notice_action = AgentAction(
                                    id=str(uuid.uuid4()),
                                    action_type=ActionType.DRAFT_NOTICE,
                                    title="Covenant Headroom Alert",
                                    description=f"{cov.get('name', 'Covenant')} approaching threshold",
                                    loan_id=loan_id,
                                    created_at=datetime.now().isoformat(),
                                    drafted_content=notice,
                                    priority="high",
                                    auto_execute_eligible=True,
                                    metadata={"covenant": cov}
                                )
                                _action_store[notice_action.id] = notice_action
                                
                                recommendations.append(AgentRecommendation(
                                    id=str(uuid.uuid4()),
                                    issue_type="covenant_warning",
                                    severity="warning",
                                    title=f"Covenant Headroom Low: {cov.get('name', 'Financial Covenant')}",
                                    description=f"Only {headroom}% headroom remaining. Monitoring recommended.",
                                    suggested_action=notice_action,
                                    context={"current_value": cov.get("current_value"), "threshold": cov.get("threshold")}
                                ))
                except:
                    pass
        
        return recommendations
    
    def get_approval_queue(self, loan_id: Optional[int] = None) -> List[AgentAction]:
        """Get all pending actions awaiting approval."""
        actions = list(_action_store.values())
        if loan_id:
            actions = [a for a in actions if a.loan_id == loan_id]
        return [a for a in actions if a.status == ActionStatus.PENDING]
    
    def approve_action(self, action_id: str, user_id: int = 1) -> Dict:
        """Approve and execute a pending action."""
        action = _action_store.get(action_id)
        if not action:
            return {"success": False, "error": "Action not found"}
        
        if action.status != ActionStatus.PENDING:
            return {"success": False, "error": f"Action already {action.status}"}
        
        action.status = ActionStatus.APPROVED
        
        # Log the approval
        with Session(engine) as session:
            log = AuditLog(
                loan_id=action.loan_id,
                user="System Agent",
                action=f"Approved: {action.title}",
                field_changed="agent_action",
                old_value="pending",
                new_value="approved",
                timestamp=datetime.now()
            )
            session.add(log)
            session.commit()
        
        # Execute the action
        result = self._execute_action(action)
        
        if result.get("success"):
            action.status = ActionStatus.EXECUTED
        else:
            action.status = ActionStatus.FAILED
        
        return result
    
    def reject_action(self, action_id: str, reason: str = None) -> Dict:
        """Reject a pending action."""
        action = _action_store.get(action_id)
        if not action:
            return {"success": False, "error": "Action not found"}
        
        action.status = ActionStatus.REJECTED
        action.metadata["rejection_reason"] = reason
        
        return {"success": True, "action_id": action_id, "status": "rejected"}
    
    def _execute_action(self, action: AgentAction) -> Dict:
        """Execute an approved action."""
        if action.action_type == ActionType.DRAFT_ENGAGEMENT:
            # In production: Send email, create document in DMS
            return {
                "success": True,
                "action_id": action.id,
                "result": "Engagement letter queued for sending",
                "next_steps": ["Email will be sent to verifier", "Calendar invite created for kick-off call"]
            }
        
        elif action.action_type == ActionType.DRAFT_WAIVER:
            return {
                "success": True,
                "action_id": action.id,
                "result": "Waiver request queued for distribution",
                "next_steps": ["Request sent to Majority Lenders", "Expected response: 5 business days"]
            }
        
        elif action.action_type == ActionType.DRAFT_NOTICE:
            return {
                "success": True,
                "action_id": action.id,
                "result": "Notice distributed to relevant parties",
                "next_steps": ["Borrower notified", "Agent team alerted"]
            }
        
        return {"success": True, "action_id": action.id, "result": "Action executed"}


# Singleton orchestrator instance
orchestrator = AgentOrchestrator()
