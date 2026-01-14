from __future__ import annotations
from typing import Optional, List
from pydantic import BaseModel, ConfigDict
from datetime import date, datetime

class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    full_name: str
    email: str
    picture_url: Optional[str] = None
    role: str
    social_provider: Optional[str] = None

class UserCreate(BaseModel):
    full_name: str
    email: str
    social_provider: Optional[str] = None
    password: Optional[str] = None

class UserLogin(BaseModel):
    email: str
    password: str

class DocumentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    filename: str
    doc_type: str
    status: str
    error: Optional[str] = None
    loan_id: Optional[int] = None
    extraction_method: str

class LoanCreate(BaseModel):
    name: str
    creator_id: Optional[int] = None

class LoanOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    agreement_date: Optional[str] = None
    closing_date: Optional[date] = None
    governing_law: Optional[str] = None
    creator_id: Optional[int] = None
    # Canonical Fields
    borrower_name: Optional[str] = None
    facility_type: Optional[str] = None
    margin_bps: Optional[int] = None
    currency: Optional[str] = None
    is_esg_linked: bool = False
    esg_score: Optional[float] = None
    transferability_mode: Optional[str] = None
    version: int = 1

class DLR(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    loan_id: int
    agreement_date: Optional[str] = None
    governing_law: Optional[str] = None
    borrower_name: Optional[str] = None
    facility_type: Optional[str] = None
    margin_bps: Optional[int] = None
    currency: Optional[str] = None
    parties: List[dict] = []
    facilities: List[dict] = []
    transferability: dict = {}
    covenants: List[dict] = []
    obligations: List[dict] = []
    events_of_default: List[dict] = []
    esg: List[dict] = []
    citations: List[dict] = []

class ClauseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    heading: str
    body: str
    page_start: int
    page_end: int
    source_doc_id: Optional[int] = None
    variance_score: float = 0.0
    is_standard: bool = True

class ObligationOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    role: str
    title: str
    details: str
    due_hint: str
    due_date: Optional[date] = None
    status: str
    evidence_path: Optional[str] = None
    assigned_to: Optional[str] = None
    is_esg: bool = False
    confidence: float = 0.95

class TradeCheckOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    category: str
    item: str
    risk_level: str
    rationale: str

class AuditLogOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    action: str
    details: str
    timestamp: datetime
    user_id: int
