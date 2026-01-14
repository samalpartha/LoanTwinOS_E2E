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
    governing_law: Optional[str] = Field(default="English Law")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    dlr_json: Optional[str] = None
    creator_id: Optional[int] = Field(default=None, foreign_key="user.id")
    # Canonical Dictionary Fields
    borrower_name: Optional[str] = None
    facility_type: Optional[str] = Field(default="Term Loan")
    margin_bps: Optional[int] = None
    currency: Optional[str] = Field(default="GBP")
    is_esg_linked: bool = Field(default=False)
    esg_score: Optional[float] = None
    transferability_mode: Optional[str] = Field(default="Consent required")
    version: int = Field(default=1)

class Document(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    filename: str
    stored_path: str
    doc_type: str = Field(default="Credit Agreement")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    status: str = Field(default="uploaded")
    error: Optional[str] = None
    loan_id: Optional[int] = Field(default=None, foreign_key="loan.id")
    file_hash: Optional[str] = None
    extraction_method: str = Field(default="LLM-Hybrid")

class AuditLog(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    loan_id: int = Field(foreign_key="loan.id")
    user_id: Optional[int] = Field(default=None, foreign_key="user.id")
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
    variance_score: Optional[float] = Field(default=0.0) # Similarity to template
    is_standard: bool = Field(default=True)
    citation_hash: Optional[str] = None

class Obligation(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    loan_id: int = Field(foreign_key="loan.id")
    role: str
    title: str
    details: str
    due_hint: str
    due_date: Optional[date] = None
    status: str = Field(default="Draft") # Draft -> Validated -> Evidence Uploaded -> Completed
    evidence_path: Optional[str] = None
    assigned_to: Optional[str] = None
    is_esg: bool = Field(default=False)
    confidence: float = Field(default=0.95)

class TradeCheck(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    loan_id: int = Field(foreign_key="loan.id")
    category: str
    item: str
    risk_level: str
    rationale: str


# ============================================================================
# Credit Risk & Vetting Module Tables
# ============================================================================

class LoanApplication(SQLModel, table=True):
    """Loan application for risk assessment and origination workflow."""
    id: Optional[int] = Field(default=None, primary_key=True)
    # Core loan attributes
    loan_amount: float
    term_months: int = Field(default=36)
    interest_rate: float
    grade: str = Field(default="C")  # A-G from Lending Club style
    sub_grade: Optional[str] = None
    # Borrower info
    employment_length: Optional[str] = None
    employment_title: Optional[str] = None
    home_ownership: str = Field(default="RENT")
    annual_income: float
    verification_status: str = Field(default="Not Verified")
    # Risk metrics
    dti: float = Field(default=0.0)  # Debt-to-income ratio
    delinq_2yrs: int = Field(default=0)
    inq_last_6mths: int = Field(default=0)
    open_acc: int = Field(default=0)
    pub_rec: int = Field(default=0)
    revol_bal: float = Field(default=0.0)
    revol_util: Optional[float] = None
    total_acc: int = Field(default=0)
    # Extended features for 97% accuracy RF model
    cibil_score: Optional[float] = Field(default=700)  # Credit score (300-900)
    assets_value: Optional[float] = None  # Total asset value for coverage ratio
    # AI Risk Assessment
    risk_score: Optional[float] = None  # 0-100, higher = riskier
    risk_explanation: Optional[str] = None
    default_probability: Optional[float] = None
    # Workflow
    purpose: str = Field(default="debt_consolidation")
    loan_type: str = Field(default="personal")  # personal, commercial, syndicated
    status: str = Field(default="pending")  # pending, approved, rejected, funded, defaulted, paid_off
    source: str = Field(default="manual")  # csv_import, manual, api, demo
    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    assessed_at: Optional[datetime] = None
    # Link to main Loan if converted
    converted_loan_id: Optional[int] = Field(default=None, foreign_key="loan.id")


class DocumentRequirement(SQLModel, table=True):
    """Pre-requisite document templates for loan types."""
    id: Optional[int] = Field(default=None, primary_key=True)
    loan_type: str  # personal, commercial, syndicated
    document_name: str
    description: str
    required: bool = Field(default=True)
    verification_type: str = Field(default="manual")  # manual, ai, external_api
    order: int = Field(default=0)  # Display order


class SubmittedDocument(SQLModel, table=True):
    """Documents submitted for loan application vetting."""
    id: Optional[int] = Field(default=None, primary_key=True)
    loan_application_id: int = Field(foreign_key="loanapplication.id")
    requirement_id: int = Field(foreign_key="documentrequirement.id")
    file_path: str
    original_filename: str
    file_size: int = Field(default=0)
    mime_type: Optional[str] = None
    # Verification status
    status: str = Field(default="pending")  # pending, verified, rejected
    verified_by: Optional[int] = Field(default=None, foreign_key="user.id")
    verified_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    ai_analysis: Optional[str] = None  # AI-extracted info from document
    # Timestamps
    submitted_at: datetime = Field(default_factory=datetime.utcnow)


class DataImportJob(SQLModel, table=True):
    """Track CSV/URL import jobs."""
    id: Optional[int] = Field(default=None, primary_key=True)
    source_type: str  # csv_upload, url_fetch
    source_path: str  # File path or URL
    original_filename: Optional[str] = None
    status: str = Field(default="pending")  # pending, mapping, importing, completed, failed
    total_rows: int = Field(default=0)
    imported_rows: int = Field(default=0)
    failed_rows: int = Field(default=0)
    column_mapping: Optional[str] = None  # JSON string of column mappings
    error_message: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None
    user_id: Optional[int] = Field(default=None, foreign_key="user.id")


# ============================================================================
# Expert Network Module Tables
# ============================================================================

class Expert(SQLModel, table=True):
    """Global expert directory for legal/compliance specialists."""
    id: Optional[int] = Field(default=None, primary_key=True)
    full_name: str
    firm_name: str
    category: str  # legal, compliance, valuer, auditor, esg
    specialties: str  # JSON array of specialties
    jurisdictions: str  # JSON array of country/state codes
    governing_laws: str = Field(default="English")  # English, NY, Delaware, etc.
    address: Optional[str] = None
    city: str
    country: str
    postal_code: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    email: str
    phone: Optional[str] = None
    bar_number: Optional[str] = None  # For legal
    regulatory_id: Optional[str] = None  # FCA, SRA, etc.
    rating: float = Field(default=4.0)  # 1-5 stars
    completed_engagements: int = Field(default=0)
    hourly_rate: Optional[float] = None
    currency: str = Field(default="USD")
    bio: Optional[str] = None
    verified: bool = Field(default=False)
    verified_date: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ExpertIssue(SQLModel, table=True):
    """Issues requiring expert assistance."""
    id: Optional[int] = Field(default=None, primary_key=True)
    loan_id: int = Field(foreign_key="loan.id")
    created_by: int = Field(foreign_key="user.id")
    category: str  # legal, compliance, valuer, auditor, esg
    severity: str = Field(default="medium")  # low, medium, high, critical
    title: str
    description: str
    ai_analysis: Optional[str] = None
    ai_category: Optional[str] = None
    ai_jurisdiction_match: Optional[str] = None
    status: str = Field(default="open")  # open, triaged, engaged, resolved, closed
    assigned_expert_id: Optional[int] = Field(default=None, foreign_key="expert.id")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    resolved_at: Optional[datetime] = None


class ExpertEngagement(SQLModel, table=True):
    """Engagement contracts with experts."""
    id: Optional[int] = Field(default=None, primary_key=True)
    issue_id: int = Field(foreign_key="expertissue.id")
    expert_id: int = Field(foreign_key="expert.id")
    drafted_letter: str  # AI-generated engagement letter
    scope_of_work: str
    estimated_hours: float
    estimated_cost: float
    status: str = Field(default="draft")  # draft, pending_approval, approved, active, completed, cancelled
    approved_by: Optional[int] = Field(default=None, foreign_key="user.id")
    approved_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)


# ============================================================================
# Covenant Monitoring Tables
# ============================================================================

class Covenant(SQLModel, table=True):
    """Financial and information covenants extracted from agreements."""
    id: Optional[int] = Field(default=None, primary_key=True)
    loan_id: int = Field(foreign_key="loan.id")
    covenant_type: str  # financial, information, affirmative, negative
    name: str  # e.g., "Leverage Ratio", "Interest Cover"
    description: str
    threshold: str  # e.g., "< 3.5x", "> 2.0x", "within 45 days"
    test_frequency: str = Field(default="quarterly")  # quarterly, semi-annual, annual, monthly
    cure_period_days: int = Field(default=30)
    source_page: Optional[int] = None
    source_clause: Optional[str] = None
    confidence: float = Field(default=0.9)
    is_active: bool = Field(default=True)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class CovenantTest(SQLModel, table=True):
    """Covenant test results and compliance status."""
    id: Optional[int] = Field(default=None, primary_key=True)
    covenant_id: int = Field(foreign_key="covenant.id")
    test_date: date
    reporting_period: str  # e.g., "Q3 2025"
    actual_value: str
    threshold_value: str
    is_compliant: bool
    breach_amount: Optional[str] = None
    cure_deadline: Optional[date] = None
    status: str = Field(default="pending")  # pending, compliant, breached, cured, waived
    notes: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    verified_by: Optional[int] = Field(default=None, foreign_key="user.id")
