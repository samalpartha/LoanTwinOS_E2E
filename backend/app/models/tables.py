from __future__ import annotations
from typing import Optional
from datetime import datetime, date
from sqlmodel import SQLModel, Field

class User(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    full_name: str
    email: str = Field(unique=True, index=True)
    hashed_password: Optional[str] = None
    picture_url: Optional[str] = None
    role: str = Field(default="Analyst")
    social_provider: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

class Loan(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    agreement_date: Optional[str] = None
    closing_date: Optional[date] = None
    governing_law: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    dlr_json: Optional[str] = None
    creator_id: Optional[int] = Field(default=None, foreign_key="user.id")

class Document(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    filename: str
    stored_path: str
    doc_type: str = Field(default="Credit Agreement")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    status: str = Field(default="uploaded")
    error: Optional[str] = None
    loan_id: Optional[int] = Field(default=None, foreign_key="loan.id")

class AuditLog(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    loan_id: int = Field(foreign_key="loan.id")
    user_id: int = Field(foreign_key="user.id")
    action: str
    details: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class Clause(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    loan_id: int = Field(foreign_key="loan.id")
    heading: str
    body: str
    page_start: int = 1
    page_end: int = 1
    source_doc_id: Optional[int] = Field(default=None, foreign_key="document.id")

class Obligation(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    loan_id: int = Field(foreign_key="loan.id")
    role: str
    title: str
    details: str
    due_hint: str
    due_date: Optional[date] = None
    status: str = Field(default="open")
    evidence_path: Optional[str] = None

class TradeCheck(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    loan_id: int = Field(foreign_key="loan.id")
    category: str
    item: str
    risk_level: str
    rationale: str
