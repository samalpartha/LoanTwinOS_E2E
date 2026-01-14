from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from ..services.extractor import LegalExtractor
from ..services.groq_service import get_groq_service
from sqlmodel import Session, select
from ..db import engine
from ..models.tables import Document, LoanApplication
import json
import os
import asyncio

router = APIRouter(tags=["ai"])


# ============== REQUEST/RESPONSE MODELS ==============

class ChatRequest(BaseModel):
    message: str

class ChatResponse(BaseModel):
    answer: str
    citations: List[str]

class TriageRequest(BaseModel):
    application_id: int

class TriageResponse(BaseModel):
    risk_level: str
    action: str
    confidence: int
    key_concerns: List[str]
    positive_factors: List[str]
    next_steps: List[str]
    reasoning: str

class RiskExplanationRequest(BaseModel):
    application_id: int

class DocumentAnalysisRequest(BaseModel):
    document_text: str
    document_type: Optional[str] = "loan_agreement"

class IssueClassificationRequest(BaseModel):
    description: str
    context: Optional[Dict[str, Any]] = None

class CovenantInterpretRequest(BaseModel):
    covenant_text: str
    financial_data: Dict[str, Any]

class EngagementDraftRequest(BaseModel):
    expert_id: int
    issue_id: int
    scope_of_work: str

class StreamChatRequest(BaseModel):
    message: str
    context: Optional[str] = None


# ============== EXISTING ENDPOINTS ==============

@router.post("/loans/{loan_id}/chat")
def chat_with_loan(loan_id: int, request: ChatRequest):
    try:
        with Session(engine) as session:
            # Get the first document text for context
            doc = session.exec(select(Document).where(Document.loan_id == loan_id)).first()
            if not doc:
                raise HTTPException(404, "No documents found for this loan.")
            
            if not os.path.exists(doc.stored_path):
                raise HTTPException(404, f"Document file not found at {doc.stored_path}")

            extractor = LegalExtractor(doc.stored_path)
            extractor.load_document()
            
            context = extractor.full_text[:8000] # Limit context for speed
            
            prompt = f"""
            Context from Loan Agreement:
            {context}

            Question: {request.message}
            
            Provide a concise answer based ONLY on the context provided. If the answer is not in the text, say you don't know.
            """
            
            answer = extractor.extract_with_groq(prompt, "You are a helpful legal AI assistant. Cite specific clauses if possible.")
            
            return {"answer": answer, "citations": []}
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        print(f"Error in chat_with_loan: {str(e)}")
        traceback.print_exc()
        raise HTTPException(500, f"An unexpected error occurred: {str(e)}")


# ============== NEW GROQ-POWERED ENDPOINTS ==============

@router.post("/ai/triage", response_model=TriageResponse)
def instant_triage(request: TriageRequest):
    """
    Perform instant AI-powered triage on a loan application.
    Uses Groq's fast inference for sub-second decisions.
    """
    groq = get_groq_service()
    
    with Session(engine) as session:
        app = session.get(LoanApplication, request.application_id)
        if not app:
            raise HTTPException(404, f"Application {request.application_id} not found")
        
        # Prepare application data
        app_data = {
            "id": app.id,
            "loan_amount": app.loan_amount,
            "term_months": app.term_months,
            "interest_rate": app.interest_rate,
            "grade": app.grade,
            "annual_income": app.annual_income,
            "dti": app.dti,
            "cibil_score": app.cibil_score,
            "assets_value": app.assets_value,
            "employment_length": app.employment_length,
            "home_ownership": app.home_ownership,
            "status": app.status,
            "risk_score": app.risk_score
        }
        
        result = groq.triage_application(app_data)
        
        return TriageResponse(
            risk_level=result.get("risk_level", "MEDIUM"),
            action=result.get("action", "MANUAL_REVIEW"),
            confidence=result.get("confidence", 50),
            key_concerns=result.get("key_concerns", []),
            positive_factors=result.get("positive_factors", []),
            next_steps=result.get("next_steps", ["Review manually"]),
            reasoning=result.get("reasoning", "")
        )


@router.post("/ai/explain-risk/{application_id}")
def explain_risk(application_id: int):
    """
    Generate a human-readable explanation of a loan's risk score.
    Uses Groq for natural language generation.
    """
    groq = get_groq_service()
    
    with Session(engine) as session:
        app = session.get(LoanApplication, application_id)
        if not app:
            raise HTTPException(404, f"Application {application_id} not found")
        
        loan_data = {
            "loan_amount": app.loan_amount,
            "grade": app.grade,
            "dti": app.dti,
            "annual_income": app.annual_income,
            "cibil_score": app.cibil_score,
            "term_months": app.term_months,
            "interest_rate": app.interest_rate
        }
        
        # Get risk factors if available
        risk_factors = []
        if app.risk_explanation:
            try:
                factors = json.loads(app.risk_explanation)
                if isinstance(factors, list):
                    risk_factors = factors
            except:
                pass
        
        explanation = groq.explain_risk_score(
            loan_data, 
            app.risk_score or 0, 
            risk_factors
        )
        
        return {
            "application_id": application_id,
            "risk_score": app.risk_score,
            "explanation": explanation
        }


@router.post("/ai/analyze-document")
def analyze_document(request: DocumentAnalysisRequest):
    """
    Analyze a loan document using AI to extract key information.
    """
    groq = get_groq_service()
    
    result = groq.analyze_document(request.document_text, request.document_type)
    
    return {
        "document_type": request.document_type,
        "analysis": result
    }


@router.post("/ai/classify-issue")
def classify_issue(request: IssueClassificationRequest):
    """
    Classify a legal/compliance issue and recommend expert type.
    """
    groq = get_groq_service()
    
    result = groq.classify_issue(request.description, request.context)
    
    return {
        "classification": result
    }


@router.post("/ai/interpret-covenant")
def interpret_covenant(request: CovenantInterpretRequest):
    """
    Interpret a covenant clause and assess compliance.
    """
    groq = get_groq_service()
    
    result = groq.interpret_covenant(request.covenant_text, request.financial_data)
    
    return {
        "interpretation": result
    }


@router.post("/ai/draft-engagement")
def draft_engagement_letter(request: EngagementDraftRequest):
    """
    Draft a professional engagement letter for expert services.
    """
    groq = get_groq_service()
    
    with Session(engine) as session:
        from ..models.tables import Expert, ExpertIssue
        
        expert = session.get(Expert, request.expert_id)
        if not expert:
            raise HTTPException(404, "Expert not found")
        
        issue = session.get(ExpertIssue, request.issue_id)
        if not issue:
            raise HTTPException(404, "Issue not found")
        
        expert_data = {
            "full_name": expert.full_name,
            "firm_name": expert.firm_name,
            "specialties": expert.specialties,
            "hourly_rate": expert.hourly_rate,
            "currency": expert.currency
        }
        
        issue_data = {
            "category": issue.category,
            "title": issue.title,
            "severity": issue.severity
        }
        
        letter = groq.draft_engagement_letter(expert_data, issue_data, request.scope_of_work)
        
        return {
            "expert_id": request.expert_id,
            "issue_id": request.issue_id,
            "engagement_letter": letter
        }


@router.post("/ai/chat")
async def ai_chat(request: ChatRequest):
    """
    General AI chat endpoint for the LMA Assistant.
    """
    groq = get_groq_service()
    
    response = await groq.complete_async(
        request.message,
        prompt_type="general_assistant",
        model_type="quality"
    )
    
    return {
        "response": response,
        "model": "llama-3.1-70b-versatile"
    }


@router.post("/ai/chat/stream")
async def ai_chat_stream(request: StreamChatRequest):
    """
    Streaming AI chat for real-time token-by-token responses.
    """
    groq = get_groq_service()
    
    prompt = request.message
    if request.context:
        prompt = f"Context:\n{request.context}\n\nQuestion: {request.message}"
    
    async def generate():
        async for token in groq.stream_async(prompt, "general_assistant", "quality"):
            yield f"data: {json.dumps({'token': token})}\n\n"
        yield "data: [DONE]\n\n"
    
    return StreamingResponse(generate(), media_type="text/event-stream")


@router.get("/ai/models")
def list_available_models():
    """
    List available AI models and their capabilities.
    """
    return {
        "models": [
            {
                "id": "llama-3.3-70b-versatile",
                "name": "Llama 3.3 70B Versatile",
                "type": "quality",
                "description": "Latest Llama model with excellent quality and speed",
                "max_tokens": 131072,
                "latency": "<200ms"
            },
            {
                "id": "llama-3.3-70b-specdec",
                "name": "Llama 3.3 70B SpecDec",
                "type": "fast",
                "description": "Speculative decoding for faster inference",
                "max_tokens": 8192,
                "latency": "<100ms"
            },
            {
                "id": "gemma2-9b-it",
                "name": "Gemma 2 9B",
                "type": "balanced",
                "description": "Efficient model for quick tasks",
                "max_tokens": 8192,
                "latency": "<100ms"
            }
        ],
        "provider": "Groq",
        "status": "active" if get_groq_service().is_available else "unavailable"
    }


@router.get("/ai/health")
def ai_health_check():
    """
    Check AI service health and availability.
    """
    groq = get_groq_service()
    
    return {
        "status": "healthy" if groq.is_available else "degraded",
        "groq_available": groq.is_available,
        "cache_size": len(groq._cache),
        "models_available": ["mixtral-8x7b-32768", "llama-3.1-70b-versatile", "llama-3.1-8b-instant"]
    }
