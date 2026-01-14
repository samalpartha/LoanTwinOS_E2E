"""
LoanTwin Voice AI Router
Voice-first interface endpoints for hands-free deal queries.
"""
from __future__ import annotations
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from ..services.voice import voice_ai, VoiceQuery, VoiceResponse

router = APIRouter(prefix="/voice", tags=["voice"])


class TextQueryRequest(BaseModel):
    text: str
    loan_id: Optional[int] = None
    context: Optional[Dict[str, Any]] = None


class VoiceQueryResponse(BaseModel):
    text: str
    action_suggested: Optional[str] = None
    action_data: Optional[Dict[str, Any]] = None
    citations: List[str] = []
    confidence: float = 0.9
    ssml: Optional[str] = None


@router.post("/query", response_model=VoiceQueryResponse)
def process_voice_query(request: TextQueryRequest):
    """
    Process a voice/text query and return an intelligent response.
    This endpoint handles the text after speech-to-text conversion.
    """
    query = VoiceQuery(
        text=request.text,
        loan_id=request.loan_id,
        context=request.context
    )
    
    response = voice_ai.process_query(query)
    
    return VoiceQueryResponse(
        text=response.text,
        action_suggested=response.action_suggested,
        action_data=response.action_data,
        citations=response.citations,
        confidence=response.confidence,
        ssml=voice_ai.generate_ssml(response.text) if response.text else None
    )


@router.post("/parse-command")
def parse_voice_command(text: str):
    """
    Parse a voice command to extract intent and entities.
    Useful for understanding what action the user wants.
    """
    command = voice_ai.parse_command(text)
    
    return {
        "command_type": command.command_type,
        "intent": command.intent,
        "entities": command.entities,
        "original_text": command.original_text
    }


@router.get("/capabilities")
def get_voice_capabilities():
    """
    Returns the voice AI capabilities and supported commands.
    """
    return {
        "version": "1.0",
        "supported_intents": [
            {"intent": "trade_readiness", "examples": ["What's the trade readiness score?", "Can I trade this loan?"]},
            {"intent": "covenant_status", "examples": ["How are the covenants?", "Any covenant breaches?"]},
            {"intent": "esg_status", "examples": ["What's the ESG status?", "How are the sustainability KPIs?"]},
            {"intent": "obligation_status", "examples": ["Any overdue obligations?", "What's due this week?"]},
            {"intent": "draft_waiver", "examples": ["Draft a waiver for BlackRock", "I need a transfer waiver"]},
            {"intent": "draft_letter", "examples": ["Draft an engagement letter for KPMG"]},
            {"intent": "explain_term", "examples": ["What is the Merton Model?", "Explain distance to default"]},
            {"intent": "summary", "examples": ["Give me a summary", "What's the status of this deal?"]}
        ],
        "features": {
            "speech_to_text": True,
            "text_to_speech": True,
            "action_execution": True,
            "context_aware": True,
            "wake_word": "Hey LoanTwin"
        }
    }


@router.get("/quick-actions")
def get_quick_voice_actions(loan_id: int):
    """
    Returns context-specific quick actions for the current loan.
    These are displayed as buttons in the voice interface.
    """
    return {
        "loan_id": loan_id,
        "quick_actions": [
            {"text": "What's the trade readiness?", "icon": "📊", "intent": "trade_readiness"},
            {"text": "Show covenant status", "icon": "📋", "intent": "covenant_status"},
            {"text": "Any overdue items?", "icon": "⚠️", "intent": "obligation_status"},
            {"text": "Summarize this deal", "icon": "📝", "intent": "summary"},
            {"text": "Draft a waiver", "icon": "✍️", "intent": "draft_waiver"},
        ]
    }
