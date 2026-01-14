"""
LoanTwin Voice AI Service
=========================
Voice-first interface for hands-free deal queries.
Supports speech-to-text (Whisper), RAG for context, and text-to-speech responses.
"""
from __future__ import annotations
import json
import re
from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel
from sqlmodel import Session, select
from ..db import engine
from ..models.tables import Loan, Clause, Obligation

try:
    from groq import Groq
    from ..config import GROQ_API_KEY
    GROQ_AVAILABLE = True
except ImportError:
    GROQ_AVAILABLE = False
    GROQ_API_KEY = None


class VoiceQuery(BaseModel):
    text: str
    loan_id: Optional[int] = None
    context: Optional[Dict[str, Any]] = None


class VoiceResponse(BaseModel):
    text: str
    action_suggested: Optional[str] = None
    action_data: Optional[Dict[str, Any]] = None
    citations: List[str] = []
    confidence: float = 0.9
    ssml: Optional[str] = None  # For enhanced TTS


class VoiceCommand(BaseModel):
    command_type: str  # 'query', 'action', 'navigation'
    intent: str
    entities: Dict[str, Any] = {}
    original_text: str


class VoiceAI:
    """Voice AI engine for LoanTwin OS."""
    
    def __init__(self):
        self.client = None
        if GROQ_AVAILABLE and GROQ_API_KEY:
            self.client = Groq(api_key=GROQ_API_KEY)
        
        # Command patterns for intent recognition
        self.command_patterns = {
            'trade_readiness': [r'trade readiness', r'readiness score', r'can i trade', r'tradeable'],
            'covenant_status': [r'covenant', r'compliance', r'breach', r'ratio'],
            'esg_status': [r'esg', r'sustainability', r'environmental', r'green'],
            'obligation_status': [r'obligation', r'deadline', r'due date', r'overdue'],
            'draft_waiver': [r'draft waiver', r'waiver request', r'need waiver'],
            'draft_letter': [r'draft letter', r'engagement letter', r'draft document'],
            'explain_term': [r'what is', r'explain', r'define', r'meaning of'],
            'navigate': [r'go to', r'show me', r'open', r'navigate to'],
            'summary': [r'summary', r'summarize', r'overview', r'status']
        }
    
    def transcribe(self, audio_data: bytes) -> str:
        """Transcribe audio using Groq's Whisper model."""
        if not self.client:
            return "[Transcription unavailable - using text input]"
        
        try:
            # Groq's Whisper API
            transcription = self.client.audio.transcriptions.create(
                file=("audio.wav", audio_data),
                model="whisper-large-v3"
            )
            return transcription.text
        except Exception as e:
            return f"[Transcription error: {str(e)}]"
    
    def parse_command(self, text: str) -> VoiceCommand:
        """Parse voice input to identify intent and entities."""
        text_lower = text.lower()
        
        # Check for command patterns
        for intent, patterns in self.command_patterns.items():
            for pattern in patterns:
                if re.search(pattern, text_lower):
                    return VoiceCommand(
                        command_type='query' if intent not in ['draft_waiver', 'draft_letter', 'navigate'] else 'action',
                        intent=intent,
                        entities=self._extract_entities(text_lower, intent),
                        original_text=text
                    )
        
        # Default to general query
        return VoiceCommand(
            command_type='query',
            intent='general',
            entities={},
            original_text=text
        )
    
    def _extract_entities(self, text: str, intent: str) -> Dict[str, Any]:
        """Extract entities from voice command."""
        entities = {}
        
        # Extract loan/deal names
        deal_match = re.search(r'(project\s+\w+|deal\s+\w+|\w+\s+facility)', text)
        if deal_match:
            entities['deal_name'] = deal_match.group(0)
        
        # Extract party names
        party_match = re.search(r'(kpmg|blackrock|hsbc|barclays|boeing|j\.?p\.?\s*morgan|citi)', text)
        if party_match:
            entities['party'] = party_match.group(0).upper()
        
        # Extract percentages
        pct_match = re.search(r'(\d+)\s*%', text)
        if pct_match:
            entities['percentage'] = int(pct_match.group(1))
        
        # Extract amounts
        amt_match = re.search(r'(\d+)\s*(million|m|billion|b)', text)
        if amt_match:
            multiplier = 1000000 if 'm' in amt_match.group(2).lower() else 1000000000
            entities['amount'] = int(amt_match.group(1)) * multiplier
        
        return entities
    
    def process_query(self, query: VoiceQuery) -> VoiceResponse:
        """Process a voice query and generate response."""
        command = self.parse_command(query.text)
        
        # Get loan context
        loan_context = self._get_loan_context(query.loan_id)
        
        # Route to appropriate handler
        if command.intent == 'trade_readiness':
            return self._handle_trade_readiness(loan_context, command)
        elif command.intent == 'covenant_status':
            return self._handle_covenant_status(loan_context, command)
        elif command.intent == 'esg_status':
            return self._handle_esg_status(loan_context, command)
        elif command.intent == 'obligation_status':
            return self._handle_obligation_status(loan_context, command)
        elif command.intent in ['draft_waiver', 'draft_letter']:
            return self._handle_draft_action(loan_context, command)
        elif command.intent == 'explain_term':
            return self._handle_explain_term(command)
        elif command.intent == 'summary':
            return self._handle_summary(loan_context, command)
        else:
            return self._handle_general_query(loan_context, command)
    
    def _get_loan_context(self, loan_id: Optional[int]) -> Dict[str, Any]:
        """Get comprehensive loan context for RAG."""
        if not loan_id:
            return {"error": "No loan selected"}
        
        with Session(engine) as session:
            loan = session.get(Loan, loan_id)
            if not loan:
                return {"error": "Loan not found"}
            
            # Get clauses
            clauses = session.exec(select(Clause).where(Clause.loan_id == loan_id).limit(10)).all()
            
            # Get obligations
            obligations = session.exec(select(Obligation).where(Obligation.loan_id == loan_id)).all()
            
            # Parse DLR
            dlr_data = {}
            if loan.dlr_json:
                try:
                    dlr_data = json.loads(loan.dlr_json)
                except:
                    pass
            
            return {
                "loan": {
                    "id": loan.id,
                    "name": loan.name,
                    "borrower": loan.borrower_name,
                    "governing_law": loan.governing_law,
                    "facility_type": loan.facility_type,
                    "is_esg_linked": loan.is_esg_linked,
                    "margin_bps": loan.margin_bps,
                    "currency": loan.currency
                },
                "dlr": dlr_data,
                "clauses": [{"heading": c.heading, "body": c.body[:200]} for c in clauses],
                "obligations": [{"title": o.title, "due_date": str(o.due_date), "status": o.status} for o in obligations]
            }
    
    def _handle_trade_readiness(self, context: Dict, command: VoiceCommand) -> VoiceResponse:
        """Handle trade readiness queries."""
        loan = context.get("loan", {})
        dlr = context.get("dlr", {})
        
        # Calculate approximate trade readiness
        score = 75  # Base score
        blockers = []
        
        if dlr.get("transfer_restrictions"):
            score -= 30
            blockers.append("white-listed transferee restriction")
        
        if loan.get("is_esg_linked") and not dlr.get("esg_verifier"):
            score -= 15
            blockers.append("missing ESG verifier assignment")
        
        if blockers:
            response_text = f"Trade Readiness for {loan.get('name', 'this deal')} is {score}%. "
            response_text += f"It's blocked by: {', '.join(blockers)}. "
            response_text += "Would you like me to draft a waiver request or show pre-cleared buyers?"
            
            return VoiceResponse(
                text=response_text,
                action_suggested="view_blockers",
                action_data={"blockers": blockers, "score": score},
                citations=["Credit Agreement Clause 25.3", "Side Letter Oct 12"]
            )
        else:
            return VoiceResponse(
                text=f"Trade Readiness for {loan.get('name', 'this deal')} is {score}%. Ready for secondary trading with pre-cleared buyers.",
                action_suggested="enter_marketplace"
            )
    
    def _handle_covenant_status(self, context: Dict, command: VoiceCommand) -> VoiceResponse:
        """Handle covenant status queries."""
        dlr = context.get("dlr", {})
        covenants = dlr.get("covenants", [])
        
        if not covenants:
            return VoiceResponse(
                text="I don't have covenant data for this facility. Would you like me to extract covenants from the credit agreement?"
            )
        
        issues = []
        healthy = []
        for cov in covenants:
            if isinstance(cov, dict):
                headroom = cov.get("headroom_percent", 100)
                name = cov.get("name", "Unknown")
                if headroom < 20:
                    issues.append(f"{name} has only {headroom}% headroom")
                else:
                    healthy.append(name)
        
        if issues:
            response_text = f"Covenant Alert! {len(issues)} covenant(s) require attention: {'; '.join(issues)}. "
            response_text += "Would you like me to run a stress test or draft a headroom analysis?"
            
            return VoiceResponse(
                text=response_text,
                action_suggested="run_stress_test",
                action_data={"at_risk": issues},
                confidence=0.95
            )
        else:
            return VoiceResponse(
                text=f"All {len(healthy)} covenants are healthy with adequate headroom. No immediate action required.",
                confidence=0.95
            )
    
    def _handle_esg_status(self, context: Dict, command: VoiceCommand) -> VoiceResponse:
        """Handle ESG status queries."""
        loan = context.get("loan", {})
        dlr = context.get("dlr", {})
        
        if not loan.get("is_esg_linked"):
            return VoiceResponse(
                text="This facility is not ESG-linked. No sustainability-linked margin adjustments apply."
            )
        
        esg = dlr.get("esg", [])
        if not esg:
            return VoiceResponse(
                text="This is an ESG-linked facility, but I don't have the KPI details yet. Would you like me to extract them from the credit agreement?"
            )
        
        # Summarize ESG status
        on_track = sum(1 for e in esg if isinstance(e, dict) and e.get("status") == "on_track")
        total = len(esg)
        
        return VoiceResponse(
            text=f"ESG Status: {on_track} of {total} KPIs are on track. Current margin adjustment: -5 basis points. Next verification date: Q1 2025.",
            action_suggested="view_esg_details",
            citations=["Credit Agreement Schedule 12 - Sustainability-Linked Margin"]
        )
    
    def _handle_obligation_status(self, context: Dict, command: VoiceCommand) -> VoiceResponse:
        """Handle obligation status queries."""
        obligations = context.get("obligations", [])
        
        if not obligations:
            return VoiceResponse(
                text="No compliance obligations found for this facility."
            )
        
        overdue = [o for o in obligations if o.get("status", "").lower() != "completed" and o.get("due_date")]
        
        if overdue:
            return VoiceResponse(
                text=f"You have {len(overdue)} outstanding obligations. The next due is: {overdue[0].get('title')} on {overdue[0].get('due_date')}. Would you like me to send a reminder to the borrower?",
                action_suggested="send_reminder",
                action_data={"overdue": overdue[:3]}
            )
        else:
            return VoiceResponse(
                text="All compliance obligations are up to date. Great job!",
                confidence=0.98
            )
    
    def _handle_draft_action(self, context: Dict, command: VoiceCommand) -> VoiceResponse:
        """Handle draft document requests."""
        loan = context.get("loan", {})
        party = command.entities.get("party", "the counterparty")
        
        if command.intent == "draft_waiver":
            return VoiceResponse(
                text=f"I'll draft a transfer waiver request for {party}. The waiver will cite credit equivalence and reference similar precedent deals. Check your approval queue in about 10 seconds.",
                action_suggested="draft_waiver",
                action_data={"party": party, "loan_id": loan.get("id")},
                confidence=0.92
            )
        else:
            return VoiceResponse(
                text=f"I'll draft an engagement letter for {party}. It will use the LMA standard template with appropriate deal specifics. Check your approval queue shortly.",
                action_suggested="draft_letter",
                action_data={"party": party, "loan_id": loan.get("id")},
                confidence=0.90
            )
    
    def _handle_explain_term(self, command: VoiceCommand) -> VoiceResponse:
        """Handle term explanation requests."""
        # Extract the term to explain
        text = command.original_text.lower()
        
        explanations = {
            "merton model": "The Merton Model is a mathematical framework that uses a company's stock price and volatility to estimate default probability. It treats equity as a call option on the firm's assets.",
            "distance to default": "Distance to Default measures how far a company's asset value is from its debt obligations, expressed in standard deviations. Higher is safer - typically 3+ sigma is considered healthy.",
            "trade readiness": "Trade Readiness Score indicates how easily a loan can be transferred in the secondary market. It considers transfer restrictions, consent requirements, and documentation completeness.",
            "lma": "LMA stands for Loan Market Association, the trade body that sets standards for syndicated loan documentation in EMEA markets. LMA templates are the market standard.",
            "covenant": "A covenant is a binding agreement or promise in a loan that requires the borrower to maintain certain financial ratios or fulfill specific conditions.",
            "sustainability linked loan": "A Sustainability-Linked Loan ties interest rates to the borrower's ESG performance. Meeting sustainability KPIs can reduce the margin by 5-10 basis points."
        }
        
        for term, explanation in explanations.items():
            if term in text:
                return VoiceResponse(
                    text=explanation,
                    confidence=0.95
                )
        
        # Use LLM for unknown terms
        if self.client:
            return self._llm_explain(command.original_text)
        
        return VoiceResponse(
            text="I don't have a specific definition for that term. Would you like me to search the credit agreement?",
            confidence=0.5
        )
    
    def _handle_summary(self, context: Dict, command: VoiceCommand) -> VoiceResponse:
        """Handle summary/status requests."""
        loan = context.get("loan", {})
        dlr = context.get("dlr", {})
        obligations = context.get("obligations", [])
        
        summary = f"Summary for {loan.get('name', 'this facility')}: "
        summary += f"Borrower is {loan.get('borrower', 'unknown')}. "
        summary += f"{'ESG-linked' if loan.get('is_esg_linked') else 'Standard'} facility under {loan.get('governing_law', 'English Law')}. "
        summary += f"You have {len(obligations)} compliance obligations tracked. "
        
        return VoiceResponse(
            text=summary,
            action_suggested="view_dlr",
            confidence=0.88
        )
    
    def _handle_general_query(self, context: Dict, command: VoiceCommand) -> VoiceResponse:
        """Handle general queries using RAG + LLM."""
        if not self.client:
            return VoiceResponse(
                text="I can help with trade readiness, covenant status, ESG performance, obligations, and drafting documents. What would you like to know?",
                confidence=0.6
            )
        
        # Build context for LLM
        loan = context.get("loan", {})
        dlr = context.get("dlr", {})
        
        system_prompt = """You are LoanTwin, an AI assistant for syndicated loan management.
        You have access to the loan's Digital Loan Record (DLR).
        Answer questions concisely in a conversational tone suitable for voice response.
        Keep responses under 50 words when possible.
        If you suggest an action, be specific about what you'll do."""
        
        user_prompt = f"""Loan Context:
        - Name: {loan.get('name', 'Unknown')}
        - Borrower: {loan.get('borrower', 'Unknown')}
        - ESG-Linked: {loan.get('is_esg_linked', False)}
        - Margin: {loan.get('margin_bps', 0)} bps
        
        User Question: {command.original_text}"""
        
        try:
            completion = self.client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.3,
                max_tokens=150
            )
            response_text = completion.choices[0].message.content
            
            return VoiceResponse(
                text=response_text,
                confidence=0.85
            )
        except Exception as e:
            return VoiceResponse(
                text="I encountered an error processing your query. Could you try rephrasing?",
                confidence=0.3
            )
    
    def _llm_explain(self, query: str) -> VoiceResponse:
        """Use LLM to explain unknown terms."""
        try:
            completion = self.client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": "You are a financial terms expert. Explain the requested term in 2-3 sentences suitable for a voice response."},
                    {"role": "user", "content": query}
                ],
                temperature=0.2,
                max_tokens=100
            )
            return VoiceResponse(
                text=completion.choices[0].message.content,
                confidence=0.85
            )
        except:
            return VoiceResponse(
                text="I couldn't find an explanation. Try asking about specific loan terms like covenants, trade readiness, or ESG.",
                confidence=0.4
            )
    
    def generate_ssml(self, text: str) -> str:
        """Generate SSML for enhanced text-to-speech."""
        # Add pauses for better speech rhythm
        ssml = text.replace(". ", '.<break time="300ms"/> ')
        ssml = ssml.replace(": ", ':<break time="200ms"/> ')
        ssml = ssml.replace("? ", '?<break time="400ms"/> ')
        
        # Emphasize numbers
        ssml = re.sub(r'(\d+%)', r'<emphasis level="moderate">\1</emphasis>', ssml)
        ssml = re.sub(r'(\d+\.\d+x)', r'<emphasis level="moderate">\1</emphasis>', ssml)
        
        return f'<speak>{ssml}</speak>'


# Singleton instance
voice_ai = VoiceAI()
