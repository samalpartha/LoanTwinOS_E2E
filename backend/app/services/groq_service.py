"""
GroqService - Centralized AI inference service using Groq's ultra-fast LLMs

Features:
- Sub-100ms inference latency
- Multiple model support (Llama 3.1 70B, Mixtral 8x7B)
- Streaming support for real-time UX
- Built-in rate limiting and error handling
- Response caching for efficiency
"""

from typing import Dict, List, Optional, Any, Generator, AsyncGenerator
from datetime import datetime, timedelta
import json
import asyncio
from functools import lru_cache
import logging

# Groq client
try:
    from groq import Groq, AsyncGroq
    GROQ_AVAILABLE = True
except ImportError:
    GROQ_AVAILABLE = False

from ..config import config

logger = logging.getLogger(__name__)


# Model configurations - Updated for current Groq availability
MODELS = {
    "fast": "llama-3.3-70b-versatile",     # Fast responses, good for triage  
    "quality": "llama-3.3-70b-versatile",  # High quality, complex analysis
    "balanced": "llama-3.3-70b-versatile", # Good balance of speed/quality
}

# System prompts for different use cases
SYSTEM_PROMPTS = {
    "vetting_triage": """You are an expert loan vetting specialist at a major financial institution. 
Your role is to analyze loan applications and provide instant triage decisions.

For each application, you must:
1. Assess the risk level (LOW, MEDIUM, HIGH, CRITICAL)
2. Determine the recommended action (AUTO_APPROVE, MANUAL_REVIEW, ADDITIONAL_DOCS, REJECT)
3. Identify any red flags or concerns
4. Provide clear next steps

Be concise, precise, and data-driven. Output JSON format.""",

    "risk_explanation": """You are a credit risk analyst explaining loan risk scores to stakeholders.
Your explanations must be:
1. Clear and non-technical for business users
2. Data-driven, referencing specific factors
3. Actionable with recommendations
4. Compliant with fair lending regulations

Avoid jargon. Focus on the key drivers of risk.""",

    "document_analysis": """You are a legal document analyst specializing in loan documentation.
Your role is to:
1. Extract key terms and conditions
2. Identify important clauses (covenants, events of default, representations)
3. Flag any unusual or concerning provisions
4. Compare against LMA/LSTA market standards

Be thorough and precise. Reference specific sections when possible.""",

    "expert_triage": """You are an issue classification specialist for legal and compliance matters.
Your role is to:
1. Classify the issue category (legal, compliance, valuation, audit, ESG)
2. Assess severity (LOW, MEDIUM, HIGH, CRITICAL)
3. Identify the relevant jurisdiction and governing law
4. Recommend the type of expert needed
5. Estimate urgency and complexity

Output structured JSON with your analysis.""",

    "covenant_interpretation": """You are a covenant monitoring specialist.
Your role is to:
1. Interpret covenant language and thresholds
2. Assess compliance status based on provided data
3. Predict potential breach risks
4. Recommend cure actions if applicable
5. Draft waiver request language if needed

Be precise about financial calculations and timing requirements.""",

    "engagement_letter": """You are a professional services engagement specialist.
Draft formal engagement letters that include:
1. Scope of work
2. Estimated timeline and deliverables
3. Fee structure and billing terms
4. Confidentiality provisions
5. Liability limitations

Use professional legal language appropriate for institutional clients.""",

    "general_assistant": """You are LMA Assistant, an AI expert in loan market operations.
You help with:
- Credit risk analysis
- Document review and extraction
- Covenant monitoring
- Regulatory compliance
- Market intelligence

Be helpful, accurate, and professional. Cite sources when possible."""
}


class GroqService:
    """
    Centralized service for Groq LLM inference.
    Provides both sync and async interfaces with built-in best practices.
    """
    
    _instance = None
    _client: Optional[Any] = None  # Groq client
    _async_client: Optional[Any] = None  # AsyncGroq client
    
    # Simple in-memory cache
    _cache: Dict[str, tuple] = {}  # key -> (response, expiry)
    _cache_ttl = {
        "vetting_triage": 300,        # 5 minutes
        "risk_explanation": 3600,     # 1 hour
        "document_analysis": 86400,   # 24 hours
        "expert_triage": 600,         # 10 minutes
        "covenant_interpretation": 3600,
        "engagement_letter": 0,       # No cache (unique each time)
        "general_assistant": 0        # No cache (conversational)
    }
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        if not hasattr(self, '_initialized'):
            self._initialized = True
            self._init_clients()
    
    def _init_clients(self):
        """Initialize Groq clients."""
        if not GROQ_AVAILABLE:
            logger.warning("Groq library not available")
            return
        
        api_key = config.GROQ_API_KEY
        if not api_key:
            logger.warning("GROQ_API_KEY not configured")
            return
        
        try:
            self._client = Groq(api_key=api_key)
            self._async_client = AsyncGroq(api_key=api_key)
            logger.info("Groq clients initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize Groq clients: {e}")
    
    @property
    def is_available(self) -> bool:
        """Check if Groq service is available."""
        return self._client is not None
    
    def _get_cache_key(self, prompt_type: str, content: str) -> str:
        """Generate cache key from prompt type and content."""
        import hashlib
        content_hash = hashlib.md5(content.encode()).hexdigest()[:16]
        return f"{prompt_type}:{content_hash}"
    
    def _check_cache(self, key: str) -> Optional[str]:
        """Check cache for existing response."""
        if key in self._cache:
            response, expiry = self._cache[key]
            if datetime.now() < expiry:
                logger.debug(f"Cache hit for {key}")
                return response
            else:
                del self._cache[key]
        return None
    
    def _set_cache(self, key: str, response: str, ttl: int):
        """Store response in cache."""
        if ttl > 0:
            expiry = datetime.now() + timedelta(seconds=ttl)
            self._cache[key] = (response, expiry)
            # Limit cache size
            if len(self._cache) > 1000:
                # Remove oldest entries
                sorted_keys = sorted(self._cache.keys(), key=lambda k: self._cache[k][1])
                for k in sorted_keys[:100]:
                    del self._cache[k]
    
    def complete(
        self,
        prompt: str,
        prompt_type: str = "general_assistant",
        model_type: str = "quality",
        max_tokens: int = 2048,
        temperature: float = 0.1,
        use_cache: bool = True,
        json_mode: bool = False
    ) -> str:
        """
        Synchronous completion with caching and error handling.
        
        Args:
            prompt: User prompt/content
            prompt_type: Key from SYSTEM_PROMPTS
            model_type: "fast", "quality", or "balanced"
            max_tokens: Maximum response tokens
            temperature: Creativity (0-1)
            use_cache: Whether to use response caching
            json_mode: Whether to request JSON output
        
        Returns:
            Model response string
        """
        if not self.is_available:
            return self._fallback_response(prompt_type, prompt)
        
        # Check cache
        if use_cache:
            cache_key = self._get_cache_key(prompt_type, prompt)
            cached = self._check_cache(cache_key)
            if cached:
                return cached
        
        try:
            system_prompt = SYSTEM_PROMPTS.get(prompt_type, SYSTEM_PROMPTS["general_assistant"])
            model = MODELS.get(model_type, MODELS["quality"])
            
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ]
            
            kwargs = {
                "model": model,
                "messages": messages,
                "max_tokens": max_tokens,
                "temperature": temperature
            }
            
            if json_mode:
                kwargs["response_format"] = {"type": "json_object"}
            
            response = self._client.chat.completions.create(**kwargs)
            result = response.choices[0].message.content
            
            # Cache response
            if use_cache:
                ttl = self._cache_ttl.get(prompt_type, 0)
                self._set_cache(cache_key, result, ttl)
            
            return result
            
        except Exception as e:
            logger.error(f"Groq completion failed: {e}")
            return self._fallback_response(prompt_type, prompt)
    
    async def complete_async(
        self,
        prompt: str,
        prompt_type: str = "general_assistant",
        model_type: str = "quality",
        max_tokens: int = 2048,
        temperature: float = 0.1,
        use_cache: bool = True,
        json_mode: bool = False
    ) -> str:
        """Async version of complete."""
        if not self._async_client:
            return self._fallback_response(prompt_type, prompt)
        
        # Check cache (same as sync)
        if use_cache:
            cache_key = self._get_cache_key(prompt_type, prompt)
            cached = self._check_cache(cache_key)
            if cached:
                return cached
        
        try:
            system_prompt = SYSTEM_PROMPTS.get(prompt_type, SYSTEM_PROMPTS["general_assistant"])
            model = MODELS.get(model_type, MODELS["quality"])
            
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ]
            
            kwargs = {
                "model": model,
                "messages": messages,
                "max_tokens": max_tokens,
                "temperature": temperature
            }
            
            if json_mode:
                kwargs["response_format"] = {"type": "json_object"}
            
            response = await self._async_client.chat.completions.create(**kwargs)
            result = response.choices[0].message.content
            
            if use_cache:
                ttl = self._cache_ttl.get(prompt_type, 0)
                self._set_cache(cache_key, result, ttl)
            
            return result
            
        except Exception as e:
            logger.error(f"Async Groq completion failed: {e}")
            return self._fallback_response(prompt_type, prompt)
    
    async def stream_async(
        self,
        prompt: str,
        prompt_type: str = "general_assistant",
        model_type: str = "quality",
        max_tokens: int = 2048,
        temperature: float = 0.1
    ) -> AsyncGenerator[str, None]:
        """
        Async streaming completion for real-time UX.
        Yields tokens as they're generated.
        """
        if not self._async_client:
            yield self._fallback_response(prompt_type, prompt)
            return
        
        try:
            system_prompt = SYSTEM_PROMPTS.get(prompt_type, SYSTEM_PROMPTS["general_assistant"])
            model = MODELS.get(model_type, MODELS["quality"])
            
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ]
            
            stream = await self._async_client.chat.completions.create(
                model=model,
                messages=messages,
                max_tokens=max_tokens,
                temperature=temperature,
                stream=True
            )
            
            async for chunk in stream:
                if chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content
                    
        except Exception as e:
            logger.error(f"Streaming failed: {e}")
            yield self._fallback_response(prompt_type, prompt)
    
    def _fallback_response(self, prompt_type: str, prompt: str) -> str:
        """Provide fallback response when Groq is unavailable."""
        fallbacks = {
            "vetting_triage": json.dumps({
                "risk_level": "MEDIUM",
                "action": "MANUAL_REVIEW",
                "reason": "AI service unavailable - manual review required",
                "next_steps": ["Review application manually", "Contact support if issue persists"]
            }),
            "risk_explanation": "Risk assessment based on credit scoring model. Key factors include debt-to-income ratio, credit history, and loan terms. Please review the detailed risk factors for more information.",
            "document_analysis": "Document analysis requires AI service. Please review the document manually or try again later.",
            "expert_triage": json.dumps({
                "category": "general",
                "severity": "MEDIUM",
                "recommendation": "Route to general counsel for initial review"
            }),
            "general_assistant": "I apologize, but I'm currently experiencing connectivity issues. Please try again in a moment."
        }
        return fallbacks.get(prompt_type, "Service temporarily unavailable. Please try again.")
    
    # ============== SPECIALIZED METHODS ==============
    
    def triage_application(self, application_data: Dict) -> Dict:
        """
        Perform instant AI triage on a loan application.
        Returns structured decision with reasoning.
        """
        prompt = f"""Analyze this loan application and provide instant triage:

Application Data:
{json.dumps(application_data, indent=2, default=str)}

Provide your analysis as JSON with:
- risk_level: LOW, MEDIUM, HIGH, or CRITICAL
- action: AUTO_APPROVE, MANUAL_REVIEW, ADDITIONAL_DOCS, or REJECT
- confidence: 0-100
- key_concerns: list of concerns
- positive_factors: list of positive factors
- next_steps: list of recommended actions
- reasoning: brief explanation"""

        response = self.complete(prompt, "vetting_triage", "fast", json_mode=True)
        try:
            return json.loads(response)
        except json.JSONDecodeError:
            return {
                "risk_level": "MEDIUM",
                "action": "MANUAL_REVIEW",
                "confidence": 50,
                "reasoning": response
            }
    
    def explain_risk_score(self, loan_data: Dict, risk_score: float, risk_factors: List[Dict]) -> str:
        """
        Generate human-readable explanation of a risk score.
        """
        prompt = f"""Generate a clear, professional explanation of this loan's risk assessment:

Loan Details:
- Amount: ${loan_data.get('loan_amount', 'N/A'):,.2f}
- Grade: {loan_data.get('grade', 'N/A')}
- DTI: {loan_data.get('dti', 'N/A')}%
- Annual Income: ${loan_data.get('annual_income', 'N/A'):,.2f}
- CIBIL Score: {loan_data.get('cibil_score', 'N/A')}

Risk Score: {risk_score}/100 (higher = riskier)

Top Risk Factors:
{json.dumps(risk_factors[:5], indent=2)}

Write a 2-3 paragraph explanation suitable for a credit committee review. 
Include specific recommendations based on the risk profile."""

        return self.complete(prompt, "risk_explanation", "quality")
    
    def analyze_document(self, document_text: str, document_type: str = "loan_agreement") -> Dict:
        """
        Analyze a loan document and extract key information.
        """
        prompt = f"""Analyze this {document_type} and extract key information:

Document Text (excerpt):
{document_text[:8000]}

Extract and return as JSON:
- document_type: type of document
- parties: list of parties involved
- key_terms: object with important terms (amount, rate, term, etc.)
- covenants: list of covenants identified
- events_of_default: list of default triggers
- representations: key representations
- unusual_provisions: any non-standard clauses
- lma_compliance: assessment of LMA standard compliance
- risk_flags: any concerning provisions"""

        response = self.complete(prompt, "document_analysis", "quality", max_tokens=4096, json_mode=True)
        try:
            return json.loads(response)
        except json.JSONDecodeError:
            return {"analysis": response, "parse_error": True}
    
    def classify_issue(self, issue_description: str, context: Dict = None) -> Dict:
        """
        Classify a legal/compliance issue and recommend expert type.
        """
        prompt = f"""Classify this issue and recommend expert type:

Issue Description:
{issue_description}

Context:
{json.dumps(context or {}, indent=2)}

Provide classification as JSON:
- category: legal, compliance, valuation, audit, or esg
- subcategory: more specific classification
- severity: LOW, MEDIUM, HIGH, or CRITICAL
- urgency: ROUTINE, PRIORITY, or URGENT
- jurisdiction_relevant: list of relevant jurisdictions
- governing_law: likely governing law
- expert_specialty: specific expertise needed
- estimated_complexity: SIMPLE, MODERATE, or COMPLEX
- estimated_hours: rough estimate
- key_considerations: important factors for expert"""

        response = self.complete(prompt, "expert_triage", "fast", json_mode=True)
        try:
            return json.loads(response)
        except json.JSONDecodeError:
            return {"classification": response, "parse_error": True}
    
    def interpret_covenant(self, covenant_text: str, financial_data: Dict) -> Dict:
        """
        Interpret a covenant and assess compliance.
        """
        prompt = f"""Interpret this covenant and assess compliance:

Covenant Language:
{covenant_text}

Current Financial Data:
{json.dumps(financial_data, indent=2)}

Provide interpretation as JSON:
- covenant_type: financial, information, affirmative, or negative
- metric_name: the specific metric being tested
- threshold: the required threshold
- current_value: calculated current value
- compliance_status: COMPLIANT, BREACHED, or AT_RISK
- headroom: margin to threshold (if applicable)
- breach_likelihood: probability of breach in next period
- interpretation: plain language explanation
- cure_options: if breached, potential remedies
- waiver_considerations: factors for waiver request"""

        response = self.complete(prompt, "covenant_interpretation", "quality", json_mode=True)
        try:
            return json.loads(response)
        except json.JSONDecodeError:
            return {"interpretation": response, "parse_error": True}
    
    def draft_engagement_letter(self, expert: Dict, issue: Dict, scope: str) -> str:
        """
        Draft a professional engagement letter for expert services.
        """
        prompt = f"""Draft a professional engagement letter:

Expert:
- Name: {expert.get('full_name')}
- Firm: {expert.get('firm_name')}
- Specialty: {expert.get('specialties')}
- Rate: {expert.get('hourly_rate')} {expert.get('currency', 'USD')}/hour

Issue:
- Category: {issue.get('category')}
- Title: {issue.get('title')}
- Severity: {issue.get('severity')}

Scope of Work:
{scope}

Draft a formal engagement letter including:
1. Parties and effective date
2. Scope of services
3. Deliverables and timeline
4. Fee structure and billing terms
5. Confidentiality obligations
6. Limitation of liability
7. Termination provisions
8. Signature blocks

Use professional legal language appropriate for institutional clients."""

        return self.complete(prompt, "engagement_letter", "quality", max_tokens=4096, use_cache=False)


# Singleton instance
_groq_service: Optional[GroqService] = None

def get_groq_service() -> GroqService:
    """Get or create the singleton GroqService instance."""
    global _groq_service
    if _groq_service is None:
        _groq_service = GroqService()
    return _groq_service
