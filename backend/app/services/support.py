"""
LoanTwin Context-Aware Support Service
======================================
Omniscient support copilot that anticipates user needs,
provides context-aware assistance, and auto-fixes technical issues.
"""
from __future__ import annotations
import json
import re
from datetime import datetime
from typing import List, Dict, Any, Optional
from enum import Enum
from pydantic import BaseModel
from sqlmodel import Session, select
from ..db import engine
from ..models.tables import Loan, Clause, Obligation, TradeCheck

try:
    from groq import Groq
    from ..config import GROQ_API_KEY
    GROQ_AVAILABLE = True
except ImportError:
    GROQ_AVAILABLE = False
    GROQ_API_KEY = None


class IssueType(str, Enum):
    PASSWORD_PROTECTED = "password_protected"
    SCANNED_IMAGE = "scanned_image"
    CORRUPTED_FILE = "corrupted_file"
    MISSING_FIELDS = "missing_fields"
    API_TIMEOUT = "api_timeout"
    PARSE_ERROR = "parse_error"
    UNKNOWN = "unknown"


class FixStatus(str, Enum):
    ATTEMPTING = "attempting"
    RESOLVED = "resolved"
    PARTIAL = "partial"
    FAILED = "failed"
    NEEDS_USER_INPUT = "needs_user_input"


class UserContext(BaseModel):
    """Context from the user's current session."""
    current_route: str
    loan_id: Optional[int] = None
    loan_name: Optional[str] = None
    active_errors: List[str] = []
    recent_actions: List[str] = []
    persona: Optional[str] = None  # trader, legal, ops
    visible_warnings: List[str] = []
    pending_recommendations: List[Dict] = []


class SupportResponse(BaseModel):
    """Response from the support copilot."""
    greeting: str
    suggestions: List[Dict[str, Any]] = []
    quick_actions: List[Dict[str, Any]] = []
    context_understood: bool = True
    confidence: float = 0.9


class SelfHealingResult(BaseModel):
    """Result of a self-healing attempt."""
    issue_type: IssueType
    status: FixStatus
    description: str
    action_taken: str
    requires_user_action: bool = False
    user_action_prompt: Optional[str] = None
    retry_available: bool = False


class SupportAgent:
    """Context-aware support agent that anticipates user needs."""
    
    def __init__(self):
        self.client = None
        if GROQ_AVAILABLE and GROQ_API_KEY:
            self.client = Groq(api_key=GROQ_API_KEY)
        
        # Context-specific greeting templates
        self.context_greetings = {
            "/dlr": "I see you're viewing the Digital Loan Record for {loan_name}.",
            "/clauses": "Looking at the Clause Explorer for {loan_name}.",
            "/obligations": "Checking obligations for {loan_name}.",
            "/trade-pack": "Reviewing the Trade Pack for {loan_name}.",
            "/": "Welcome to your Dashboard. {loan_name} is your active workspace.",
            "/help": "You're in the Help Center. What can I explain?",
            "/settings": "Configuring your preferences."
        }
        
        # Error-specific suggestions
        self.error_suggestions = {
            "missing_esg_verifier": {
                "greeting": "I noticed the ESG Verifier is missing for {loan_name}.",
                "suggestion": "KPMG is recommended based on the deal size and sector. I've drafted an engagement letter.",
                "action": {"type": "view_draft", "label": "View Draft Letter"}
            },
            "trade_blocked": {
                "greeting": "I see the Trade Readiness score is blocked.",
                "suggestion": "The main blocker is the white-listed transferee restriction. 4 pre-cleared buyers are available for instant settlement.",
                "action": {"type": "view_marketplace", "label": "View Pre-Cleared Buyers"}
            },
            "covenant_warning": {
                "greeting": "A covenant is approaching its threshold.",
                "suggestion": "I can run a stress test to assess the risk, or draft a covenant reset proposal.",
                "action": {"type": "run_stress_test", "label": "Run Stress Test"}
            },
            "obligation_overdue": {
                "greeting": "There's an overdue obligation for {loan_name}.",
                "suggestion": "I've drafted a reminder notice to the Borrower. Would you like me to send it?",
                "action": {"type": "send_reminder", "label": "Send Reminder"}
            },
            "upload_failed": {
                "greeting": "I see the document upload failed.",
                "suggestion": "Let me diagnose the issue. It might be a scanned PDF or password protection.",
                "action": {"type": "diagnose", "label": "Diagnose Issue"}
            }
        }
    
    def analyze_context(self, context: UserContext) -> SupportResponse:
        """Analyze user context and generate proactive support response."""
        
        # Build base greeting
        route_greeting = self.context_greetings.get(
            context.current_route, 
            "I'm here to help."
        )
        
        # Fill in loan name
        greeting = route_greeting.format(
            loan_name=context.loan_name or "your active deal"
        )
        
        suggestions = []
        quick_actions = []
        
        # Check for active errors
        for error in context.active_errors:
            error_key = self._classify_error(error)
            if error_key in self.error_suggestions:
                err_config = self.error_suggestions[error_key]
                suggestions.append({
                    "type": error_key,
                    "message": err_config["suggestion"],
                    "action": err_config["action"]
                })
                greeting = err_config["greeting"].format(
                    loan_name=context.loan_name or "this deal"
                )
        
        # Check for pending recommendations
        if context.pending_recommendations:
            rec = context.pending_recommendations[0]
            suggestions.append({
                "type": "pending_action",
                "message": f"You have a pending Agent recommendation: {rec.get('title', 'Action needed')}",
                "action": {"type": "view_approval_queue", "label": "View Approval Queue"}
            })
        
        # Route-specific quick actions
        quick_actions = self._get_route_quick_actions(context.current_route, context.loan_id)
        
        # Use LLM for personalized greeting if available
        if self.client and context.active_errors:
            personalized = self._generate_llm_greeting(context)
            if personalized:
                greeting = personalized
        
        return SupportResponse(
            greeting=greeting,
            suggestions=suggestions,
            quick_actions=quick_actions,
            confidence=0.92 if suggestions else 0.85
        )
    
    def _classify_error(self, error: str) -> str:
        """Classify an error message into a known type."""
        error_lower = error.lower()
        
        if "esg" in error_lower and ("missing" in error_lower or "verifier" in error_lower):
            return "missing_esg_verifier"
        elif "trade" in error_lower and ("block" in error_lower or "readiness" in error_lower):
            return "trade_blocked"
        elif "covenant" in error_lower:
            return "covenant_warning"
        elif "overdue" in error_lower or "obligation" in error_lower:
            return "obligation_overdue"
        elif "upload" in error_lower or "failed" in error_lower:
            return "upload_failed"
        
        return "unknown"
    
    def _get_route_quick_actions(self, route: str, loan_id: Optional[int]) -> List[Dict]:
        """Get context-specific quick actions for the current route."""
        actions = []
        
        if route == "/dlr":
            actions = [
                {"label": "Run Stress Test", "action": "stress_test", "icon": "📊"},
                {"label": "Export DLR", "action": "export_dlr", "icon": "📤"},
                {"label": "View Audit Log", "action": "view_audit", "icon": "📋"}
            ]
        elif route == "/clauses":
            actions = [
                {"label": "Find Non-Standard", "action": "find_deviations", "icon": "🔍"},
                {"label": "Compare to LMA", "action": "compare_lma", "icon": "⚖️"},
                {"label": "Generate Redline", "action": "generate_redline", "icon": "📝"}
            ]
        elif route == "/obligations":
            actions = [
                {"label": "View Overdue", "action": "filter_overdue", "icon": "⚠️"},
                {"label": "Send Reminders", "action": "send_reminders", "icon": "📧"},
                {"label": "Export Calendar", "action": "export_calendar", "icon": "📅"}
            ]
        elif route == "/trade-pack":
            actions = [
                {"label": "View Marketplace", "action": "view_marketplace", "icon": "🏪"},
                {"label": "Generate Pack", "action": "generate_pack", "icon": "📦"},
                {"label": "Check Compliance", "action": "check_compliance", "icon": "✓"}
            ]
        elif route == "/":
            actions = [
                {"label": "Run Agent Analysis", "action": "run_agent", "icon": "🤖"},
                {"label": "View All Deals", "action": "view_deals", "icon": "📁"},
                {"label": "Export Report", "action": "export_report", "icon": "📊"}
            ]
        
        return actions
    
    def _generate_llm_greeting(self, context: UserContext) -> Optional[str]:
        """Generate a personalized greeting using LLM."""
        try:
            prompt = f"""Generate a brief, helpful greeting for a loan operations professional.
Context:
- They are on: {context.current_route}
- Active deal: {context.loan_name or 'None'}
- Errors visible: {', '.join(context.active_errors) if context.active_errors else 'None'}
- Recent actions: {', '.join(context.recent_actions[-3:]) if context.recent_actions else 'None'}

Generate a single sentence greeting that acknowledges their context and offers relevant help.
Be professional but friendly. Don't use emojis."""
            
            completion = self.client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": "You are LoanTwin, a helpful AI assistant for loan operations."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.4,
                max_tokens=100
            )
            return completion.choices[0].message.content.strip()
        except:
            return None
    
    def get_suggested_actions(self, context: UserContext) -> List[Dict]:
        """Get AI-suggested actions based on context."""
        actions = []
        
        if context.loan_id:
            with Session(engine) as session:
                loan = session.get(Loan, context.loan_id)
                if loan:
                    # Check for ESG-linked without verifier
                    if loan.is_esg_linked:
                        actions.append({
                            "priority": "high",
                            "type": "esg_verifier",
                            "title": "Assign ESG Verifier",
                            "description": "Sustainability-linked facility requires independent verification",
                            "action": "assign_verifier"
                        })
                    
                    # Check obligations
                    obligations = session.exec(
                        select(Obligation).where(Obligation.loan_id == context.loan_id)
                    ).all()
                    overdue = [o for o in obligations if o.status.lower() != "completed"]
                    if overdue:
                        actions.append({
                            "priority": "medium",
                            "type": "obligations",
                            "title": f"{len(overdue)} Pending Obligations",
                            "description": "Review and update compliance status",
                            "action": "view_obligations"
                        })
                    
                    # Check trade readiness
                    trade_checks = session.exec(
                        select(TradeCheck).where(TradeCheck.loan_id == context.loan_id)
                    ).all()
                    blockers = [t for t in trade_checks if t.risk_level.lower() == "high"]
                    if blockers:
                        actions.append({
                            "priority": "high",
                            "type": "trade_blocks",
                            "title": f"{len(blockers)} Trade Blockers",
                            "description": "Resolve to unlock secondary trading",
                            "action": "resolve_blockers"
                        })
        
        return actions


class SelfHealingEngine:
    """Auto-fixes technical issues without user intervention."""
    
    def __init__(self):
        self.fix_handlers = {
            IssueType.PASSWORD_PROTECTED: self._handle_password_protected,
            IssueType.SCANNED_IMAGE: self._handle_scanned_image,
            IssueType.CORRUPTED_FILE: self._handle_corrupted_file,
            IssueType.MISSING_FIELDS: self._handle_missing_fields,
            IssueType.API_TIMEOUT: self._handle_api_timeout,
            IssueType.PARSE_ERROR: self._handle_parse_error,
        }
    
    def diagnose(self, error: Exception, context: Dict[str, Any]) -> IssueType:
        """Diagnose the type of issue from an error."""
        error_str = str(error).lower()
        
        if "password" in error_str or "encrypted" in error_str:
            return IssueType.PASSWORD_PROTECTED
        elif "ocr" in error_str or "scanned" in error_str or "image" in error_str:
            return IssueType.SCANNED_IMAGE
        elif "corrupt" in error_str or "invalid" in error_str:
            return IssueType.CORRUPTED_FILE
        elif "missing" in error_str or "required" in error_str:
            return IssueType.MISSING_FIELDS
        elif "timeout" in error_str or "connection" in error_str:
            return IssueType.API_TIMEOUT
        elif "parse" in error_str or "json" in error_str:
            return IssueType.PARSE_ERROR
        
        return IssueType.UNKNOWN
    
    def attempt_fix(self, issue_type: IssueType, context: Dict[str, Any]) -> SelfHealingResult:
        """Attempt to automatically fix an issue."""
        handler = self.fix_handlers.get(issue_type)
        
        if handler:
            return handler(context)
        
        return SelfHealingResult(
            issue_type=issue_type,
            status=FixStatus.FAILED,
            description="Unknown issue type",
            action_taken="No automatic fix available",
            requires_user_action=True,
            user_action_prompt="Please contact support or try again."
        )
    
    def _handle_password_protected(self, context: Dict) -> SelfHealingResult:
        """Handle password-protected PDF."""
        return SelfHealingResult(
            issue_type=IssueType.PASSWORD_PROTECTED,
            status=FixStatus.NEEDS_USER_INPUT,
            description="The document is password-protected",
            action_taken="Detected password protection on the document",
            requires_user_action=True,
            user_action_prompt="Please enter the document password to continue.",
            retry_available=True
        )
    
    def _handle_scanned_image(self, context: Dict) -> SelfHealingResult:
        """Handle scanned/image PDF by routing to OCR."""
        file_path = context.get("file_path")
        
        # In production, trigger OCR pipeline
        return SelfHealingResult(
            issue_type=IssueType.SCANNED_IMAGE,
            status=FixStatus.ATTEMPTING,
            description="Document appears to be a scanned image",
            action_taken="Routing to OCR Vision Pipeline for text extraction",
            requires_user_action=False,
            retry_available=True
        )
    
    def _handle_corrupted_file(self, context: Dict) -> SelfHealingResult:
        """Handle corrupted file."""
        return SelfHealingResult(
            issue_type=IssueType.CORRUPTED_FILE,
            status=FixStatus.FAILED,
            description="The file appears to be corrupted",
            action_taken="Unable to repair file automatically",
            requires_user_action=True,
            user_action_prompt="Please re-upload the document. If the issue persists, try opening it in a PDF reader first.",
            retry_available=True
        )
    
    def _handle_missing_fields(self, context: Dict) -> SelfHealingResult:
        """Handle missing required fields by using AI inference."""
        missing_fields = context.get("missing_fields", [])
        
        # In production, use LLM to infer missing values
        return SelfHealingResult(
            issue_type=IssueType.MISSING_FIELDS,
            status=FixStatus.PARTIAL,
            description=f"Missing fields: {', '.join(missing_fields)}",
            action_taken="AI is inferring values from document context",
            requires_user_action=True,
            user_action_prompt="Please review the AI-inferred values in the DLR and confirm or correct them."
        )
    
    def _handle_api_timeout(self, context: Dict) -> SelfHealingResult:
        """Handle API timeout with retry logic."""
        retry_count = context.get("retry_count", 0)
        
        if retry_count < 3:
            return SelfHealingResult(
                issue_type=IssueType.API_TIMEOUT,
                status=FixStatus.ATTEMPTING,
                description="Request timed out",
                action_taken=f"Retrying request (attempt {retry_count + 1}/3)",
                requires_user_action=False,
                retry_available=True
            )
        
        return SelfHealingResult(
            issue_type=IssueType.API_TIMEOUT,
            status=FixStatus.FAILED,
            description="Request failed after multiple attempts",
            action_taken="Exhausted retry attempts",
            requires_user_action=True,
            user_action_prompt="The service may be temporarily unavailable. Please try again in a few minutes."
        )
    
    def _handle_parse_error(self, context: Dict) -> SelfHealingResult:
        """Handle parse errors with fallback extraction."""
        return SelfHealingResult(
            issue_type=IssueType.PARSE_ERROR,
            status=FixStatus.ATTEMPTING,
            description="Failed to parse document structure",
            action_taken="Falling back to simplified extraction mode",
            requires_user_action=False,
            retry_available=True
        )


# Singleton instances
support_agent = SupportAgent()
self_healing = SelfHealingEngine()
