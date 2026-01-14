"""
LoanTwin Support Router
Context-aware support copilot and self-healing endpoints.
"""
from __future__ import annotations
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from ..services.support import (
    support_agent, self_healing, 
    UserContext, SupportResponse, SelfHealingResult, IssueType
)

router = APIRouter(prefix="/support", tags=["support"])


class ContextRequest(BaseModel):
    current_route: str
    loan_id: Optional[int] = None
    loan_name: Optional[str] = None
    active_errors: List[str] = []
    recent_actions: List[str] = []
    persona: Optional[str] = None
    visible_warnings: List[str] = []
    pending_recommendations: List[Dict] = []


class ChatRequest(BaseModel):
    message: str
    context: ContextRequest


class DiagnoseRequest(BaseModel):
    error_message: str
    error_type: Optional[str] = None
    file_path: Optional[str] = None
    additional_context: Dict[str, Any] = {}


@router.post("/analyze-context", response_model=SupportResponse)
def analyze_context(request: ContextRequest):
    """
    Analyze user's current context and generate proactive support response.
    This is called when the chat assistant opens to provide a personalized greeting.
    """
    context = UserContext(
        current_route=request.current_route,
        loan_id=request.loan_id,
        loan_name=request.loan_name,
        active_errors=request.active_errors,
        recent_actions=request.recent_actions,
        persona=request.persona,
        visible_warnings=request.visible_warnings,
        pending_recommendations=request.pending_recommendations
    )
    
    response = support_agent.analyze_context(context)
    
    return response


@router.post("/chat")
def context_aware_chat(request: ChatRequest):
    """
    Context-aware chat response that knows the user's current state.
    """
    context = UserContext(
        current_route=request.context.current_route,
        loan_id=request.context.loan_id,
        loan_name=request.context.loan_name,
        active_errors=request.context.active_errors,
        recent_actions=request.context.recent_actions,
        persona=request.context.persona
    )
    
    # Get AI response with context
    from ..services.voice import voice_ai, VoiceQuery
    
    query = VoiceQuery(
        text=request.message,
        loan_id=request.context.loan_id,
        context={
            "route": request.context.current_route,
            "errors": request.context.active_errors
        }
    )
    
    voice_response = voice_ai.process_query(query)
    
    return {
        "response": voice_response.text,
        "action_suggested": voice_response.action_suggested,
        "action_data": voice_response.action_data,
        "citations": voice_response.citations,
        "confidence": voice_response.confidence
    }


@router.get("/suggested-actions")
def get_suggested_actions(
    loan_id: Optional[int] = None,
    route: str = "/",
    persona: Optional[str] = None
):
    """
    Get AI-suggested actions based on current context.
    """
    context = UserContext(
        current_route=route,
        loan_id=loan_id,
        persona=persona
    )
    
    actions = support_agent.get_suggested_actions(context)
    
    return {
        "loan_id": loan_id,
        "route": route,
        "suggested_actions": actions
    }


@router.post("/diagnose")
def diagnose_issue(request: DiagnoseRequest):
    """
    Diagnose a technical issue and suggest fixes.
    """
    # Create exception from error message
    error = Exception(request.error_message)
    
    context = {
        "file_path": request.file_path,
        **request.additional_context
    }
    
    issue_type = self_healing.diagnose(error, context)
    
    return {
        "error_message": request.error_message,
        "diagnosed_type": issue_type.value,
        "description": _get_issue_description(issue_type),
        "auto_fix_available": issue_type != IssueType.UNKNOWN
    }


@router.post("/self-heal")
def attempt_self_heal(request: DiagnoseRequest):
    """
    Attempt to automatically fix an issue.
    """
    error = Exception(request.error_message)
    
    context = {
        "file_path": request.file_path,
        "retry_count": request.additional_context.get("retry_count", 0),
        "missing_fields": request.additional_context.get("missing_fields", []),
        **request.additional_context
    }
    
    issue_type = self_healing.diagnose(error, context)
    result = self_healing.attempt_fix(issue_type, context)
    
    return {
        "issue_type": result.issue_type.value,
        "status": result.status.value,
        "description": result.description,
        "action_taken": result.action_taken,
        "requires_user_action": result.requires_user_action,
        "user_action_prompt": result.user_action_prompt,
        "retry_available": result.retry_available
    }


@router.get("/quick-help/{topic}")
def get_quick_help(topic: str):
    """
    Get quick help content for a specific topic.
    """
    help_topics = {
        "trade_readiness": {
            "title": "Trade Readiness Score",
            "summary": "Indicates how easily a loan can be transferred in the secondary market.",
            "details": [
                "Score is calculated based on transfer restrictions, consent requirements, and documentation completeness.",
                "A score of 100 means the deal is fully ready for trading.",
                "Common blockers include missing consents, white-list restrictions, and incomplete documentation."
            ],
            "related_actions": ["view_blockers", "enter_marketplace", "request_waiver"]
        },
        "covenant": {
            "title": "Covenants",
            "summary": "Financial and non-financial undertakings the borrower must maintain.",
            "details": [
                "Financial covenants typically include leverage ratio, interest coverage, and cash flow tests.",
                "Breaches can trigger events of default or margin step-ups.",
                "Headroom indicates how close current values are to the threshold."
            ],
            "related_actions": ["run_stress_test", "view_history", "draft_waiver"]
        },
        "esg": {
            "title": "ESG-Linked Features",
            "summary": "Sustainability-linked loan provisions that tie pricing to ESG performance.",
            "details": [
                "KPIs are tested periodically (usually annually).",
                "Meeting targets can reduce the margin by 5-10 basis points.",
                "Missing targets may increase the margin.",
                "Independent verification is typically required."
            ],
            "related_actions": ["view_kpis", "assign_verifier", "simulate_margin"]
        },
        "transfer": {
            "title": "Transfer & Assignment",
            "summary": "Mechanisms for trading loan participations.",
            "details": [
                "Assignment transfers legal ownership to the new lender.",
                "Participation creates a separate contract between seller and buyer.",
                "Novation involves a three-party agreement with the borrower.",
                "Consent requirements vary by facility type and specific terms."
            ],
            "related_actions": ["view_restrictions", "check_white_list", "initiate_trade"]
        },
        "merton_model": {
            "title": "Merton Model (Distance to Default)",
            "summary": "A mathematical model that estimates default probability using equity data.",
            "details": [
                "Treats equity as a call option on the firm's assets.",
                "Uses stock price and volatility to estimate asset value and default probability.",
                "Distance to Default (DTD) is measured in standard deviations.",
                "Higher DTD (e.g., 5+) indicates lower default risk."
            ],
            "related_actions": ["view_calculation", "compare_peers", "run_scenario"]
        }
    }
    
    if topic not in help_topics:
        raise HTTPException(404, f"Help topic '{topic}' not found")
    
    return help_topics[topic]


@router.get("/faq")
def get_faq():
    """
    Get frequently asked questions and answers.
    """
    return {
        "faqs": [
            {
                "question": "How is the Trade Readiness Score calculated?",
                "answer": "The score considers transfer restrictions (-40 for white-list), consent requirements (-15 for complex consents), documentation completeness, and ESG verification status. A score of 100 means fully ready to trade."
            },
            {
                "question": "What does 'Pre-Cleared Buyer' mean?",
                "answer": "A pre-cleared buyer is already on the approved transferee list or white-list for the facility. Trades with pre-cleared buyers can settle T+0 without additional consents."
            },
            {
                "question": "How does the AI Agent work?",
                "answer": "The LoanTwin Agent continuously monitors your deals for issues (missing data, approaching deadlines, blockers). When it finds something, it researches solutions, drafts documents, and queues them for your one-click approval."
            },
            {
                "question": "What is LMA Standard?",
                "answer": "LMA (Loan Market Association) provides standard documentation templates for syndicated loans. 'LMA Standard' means a clause matches the LMA template language. Non-standard clauses may need additional review."
            },
            {
                "question": "How do I enable Voice Commands?",
                "answer": "Click the microphone button in the Voice Assistant panel. You can also say 'Hey LoanTwin' if always-listening mode is enabled in Settings."
            }
        ]
    }


def _get_issue_description(issue_type: IssueType) -> str:
    """Get human-readable description for an issue type."""
    descriptions = {
        IssueType.PASSWORD_PROTECTED: "The document is password-protected and cannot be opened.",
        IssueType.SCANNED_IMAGE: "The document appears to be a scanned image and requires OCR processing.",
        IssueType.CORRUPTED_FILE: "The file appears to be corrupted or in an unsupported format.",
        IssueType.MISSING_FIELDS: "Some required fields could not be extracted from the document.",
        IssueType.API_TIMEOUT: "The request timed out. This may be a temporary issue.",
        IssueType.PARSE_ERROR: "Failed to parse the document structure.",
        IssueType.UNKNOWN: "An unknown error occurred."
    }
    return descriptions.get(issue_type, "Unknown issue")
