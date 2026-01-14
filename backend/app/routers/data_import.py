"""
Data Import Router - CSV Upload and URL Connector for LoanTwin OS
Supports bulk import of loan data from CSV files or remote URLs (Kaggle, S3, etc.)
"""
from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional, Dict, List, Any
from sqlmodel import Session, select
from datetime import datetime
import json
import io
import os
import zipfile

router = APIRouter(prefix="/import", tags=["Data Import"])

# Try to import pandas, gracefully handle if not installed
try:
    import pandas as pd
    PANDAS_AVAILABLE = True
except ImportError:
    PANDAS_AVAILABLE = False

try:
    import requests
    REQUESTS_AVAILABLE = True
except ImportError:
    REQUESTS_AVAILABLE = False

from ..db import engine
from ..models.tables import LoanApplication, DataImportJob

# ============================================================================
# Dataset Schema Mappings (Kaggle & Industry Standard)
# ============================================================================

# Lending Club column mapping to internal schema
LENDING_CLUB_MAPPING = {
    "loan_amnt": "loan_amount",
    "term": "term_months",
    "int_rate": "interest_rate",
    "grade": "grade",
    "sub_grade": "sub_grade",
    "emp_length": "employment_length",
    "emp_title": "employment_title",
    "home_ownership": "home_ownership",
    "annual_inc": "annual_income",
    "verification_status": "verification_status",
    "loan_status": "status",
    "purpose": "purpose",
    "dti": "dti",
    "delinq_2yrs": "delinq_2yrs",
    "inq_last_6mths": "inq_last_6mths",
    "open_acc": "open_acc",
    "pub_rec": "pub_rec",
    "revol_bal": "revol_bal",
    "revol_util": "revol_util",
    "total_acc": "total_acc"
}

# Kaggle Loan Eligible Dataset (https://www.kaggle.com/datasets/vikasukani/loan-eligible-dataset)
LOAN_ELIGIBLE_MAPPING = {
    "Loan_ID": None,  # Skip - internal ID
    "Gender": None,  # Skip - not used
    "Married": None,  # Skip
    "Dependents": None,  # Skip
    "Education": None,  # Skip - could add in future
    "Self_Employed": "employment_title",  # Map to employment
    "ApplicantIncome": "annual_income",
    "CoapplicantIncome": None,  # Could add to annual_income
    "LoanAmount": "loan_amount",  # In thousands - need to multiply
    "Loan_Amount_Term": "term_months",
    "Credit_History": "cibil_score",  # 1/0 -> map to score
    "Property_Area": "home_ownership",  # Map Urban/Rural/Semiurban
    "Loan_Status": "status"  # Y/N -> approved/rejected
}

# Kaggle Loan Status Prediction (https://www.kaggle.com/datasets/bhavikjikadara/loan-status-prediction)
LOAN_STATUS_PREDICTION_MAPPING = {
    "person_age": None,  # Skip
    "person_income": "annual_income",
    "person_home_ownership": "home_ownership",
    "person_emp_length": "employment_length",
    "loan_intent": "purpose",
    "loan_grade": "grade",
    "loan_amnt": "loan_amount",
    "loan_int_rate": "interest_rate",
    "loan_status": "status",  # 0/1 -> paid_off/defaulted
    "loan_percent_income": "dti",  # percent of income
    "cb_person_default_on_file": "delinq_2yrs",  # Y/N -> count
    "cb_person_cred_hist_length": "total_acc"  # credit history years
}

# Indian Credit Dataset (CIBIL-style)
INDIAN_CREDIT_MAPPING = {
    "cibil_score": "cibil_score",
    "loan_amount": "loan_amount",
    "loan_term": "term_months",
    "annual_income": "annual_income",
    "monthly_income": None,  # Calculate annual from this
    "assets_value": "assets_value",
    "property_value": "assets_value",
    "employment_status": "employment_length",
    "loan_status": "status",
    "default": "status"  # 0/1 -> paid_off/defaulted
}

# Kaggle Loan Payments Dataset (https://www.kaggle.com/datasets/zhijinzhai/loandata)
LOAN_PAYMENTS_MAPPING = {
    "Loan_ID": None,  # Skip - internal ID
    "loan_status": "status",  # PAIDOFF, COLLECTION, etc.
    "Principal": "loan_amount",
    "terms": "term_months",
    "effective_date": None,  # Skip
    "due_date": None,  # Skip
    "paid_off_time": None,  # Skip
    "past_due_days": "delinq_2yrs",  # Map to delinquency indicator
    "age": None,  # Skip
    "education": None,  # Skip
    "Gender": None  # Skip
}

# Kaggle Loan Approval Dataset (https://www.kaggle.com/datasets/architsharma01/loan-approval-prediction-dataset)
LOAN_APPROVAL_MAPPING = {
    "loan_id": None,  # Skip - internal ID
    " no_of_dependents": None,  # Skip for now
    "no_of_dependents": None,  # Skip for now
    " education": None,  # Skip
    "education": None,  # Skip
    " self_employed": "employment_title",  # Yes/No
    "self_employed": "employment_title",
    " income_annum": "annual_income",
    "income_annum": "annual_income",
    " loan_amount": "loan_amount",
    "loan_amount": "loan_amount",
    " loan_term": "term_months",
    "loan_term": "term_months",
    " cibil_score": "cibil_score",
    "cibil_score": "cibil_score",
    " residential_assets_value": "assets_value",
    "residential_assets_value": "assets_value",
    " commercial_assets_value": None,  # Could add these
    "commercial_assets_value": None,
    " luxury_assets_value": None,
    "luxury_assets_value": None,
    " bank_asset_value": None,
    "bank_asset_value": None,
    " loan_status": "status",
    "loan_status": "status"
}

# Combined mapping for auto-detection
ALL_MAPPINGS = {
    **LENDING_CLUB_MAPPING,
    **LOAN_ELIGIBLE_MAPPING,
    **LOAN_STATUS_PREDICTION_MAPPING,
    **INDIAN_CREDIT_MAPPING,
    **LOAN_APPROVAL_MAPPING,
    **LOAN_PAYMENTS_MAPPING
}

# Internal field definitions for schema mapping UI
INTERNAL_FIELDS = [
    {"name": "loan_amount", "type": "float", "required": True, "description": "Total loan amount"},
    {"name": "term_months", "type": "int", "required": True, "description": "Loan term in months"},
    {"name": "interest_rate", "type": "float", "required": True, "description": "Interest rate (%)"},
    {"name": "grade", "type": "str", "required": False, "description": "Credit grade (A-G)"},
    {"name": "annual_income", "type": "float", "required": True, "description": "Annual income"},
    {"name": "dti", "type": "float", "required": False, "description": "Debt-to-income ratio"},
    {"name": "home_ownership", "type": "str", "required": False, "description": "RENT, OWN, MORTGAGE"},
    {"name": "employment_length", "type": "str", "required": False, "description": "Employment length"},
    {"name": "purpose", "type": "str", "required": False, "description": "Loan purpose"},
    {"name": "status", "type": "str", "required": False, "description": "Loan status"},
    # Extended features for 97% RF model accuracy
    {"name": "cibil_score", "type": "float", "required": False, "description": "CIBIL/Credit score (300-900)"},
    {"name": "assets_value", "type": "float", "required": False, "description": "Total assets value"}
]


class SchemaDetectionResult(BaseModel):
    columns: List[str]
    sample_data: List[Dict[str, Any]]
    row_count: int
    suggested_mapping: Dict[str, str]


class ColumnMapping(BaseModel):
    mapping: Dict[str, str]  # source_column -> target_field


class ImportResult(BaseModel):
    job_id: int
    status: str
    total_rows: int
    imported_rows: int
    failed_rows: int
    message: str


class URLImportRequest(BaseModel):
    url: str
    source_name: Optional[str] = None


@router.get("/fields")
def get_internal_fields():
    """Get list of internal fields available for mapping."""
    return {"fields": INTERNAL_FIELDS}


@router.post("/csv/upload")
async def upload_csv(file: UploadFile = File(...)):
    """Upload a CSV file and detect its schema."""
    if not PANDAS_AVAILABLE:
        raise HTTPException(500, "pandas not installed. Run: pip install pandas")
    
    if not file.filename.endswith('.csv'):
        raise HTTPException(400, "Only CSV files are supported")
    
    # Read CSV into memory
    contents = await file.read()
    
    try:
        df = pd.read_csv(io.BytesIO(contents), nrows=100)  # Read first 100 rows for preview
    except Exception as e:
        raise HTTPException(400, f"Failed to parse CSV: {str(e)}")
    
    # Save file temporarily
    upload_dir = os.path.join(os.path.dirname(__file__), "..", "..", "data", "imports")
    os.makedirs(upload_dir, exist_ok=True)
    file_path = os.path.join(upload_dir, f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{file.filename}")
    
    with open(file_path, 'wb') as f:
        f.write(contents)
    
    # Create import job
    with Session(engine) as session:
        # Count total rows
        full_df = pd.read_csv(io.BytesIO(contents))
        total_rows = len(full_df)
        
        job = DataImportJob(
            source_type="csv_upload",
            source_path=file_path,
            original_filename=file.filename,
            status="mapping",
            total_rows=total_rows
        )
        session.add(job)
        session.commit()
        session.refresh(job)
        job_id = job.id
    
    # Detect schema and suggest mapping using all known dataset mappings
    columns = df.columns.tolist()
    suggested_mapping = {}
    detected_dataset = "unknown"
    
    for col in columns:
        col_lower = col.lower().replace(" ", "_")
        
        # Check all known mappings
        if col in ALL_MAPPINGS and ALL_MAPPINGS[col] is not None:
            suggested_mapping[col] = ALL_MAPPINGS[col]
        elif col_lower in ALL_MAPPINGS and ALL_MAPPINGS.get(col_lower) is not None:
            suggested_mapping[col] = ALL_MAPPINGS[col_lower]
        elif col_lower in [f["name"] for f in INTERNAL_FIELDS]:
            suggested_mapping[col] = col_lower
    
    # Detect dataset type based on columns
    col_lower_set = set([c.lower().strip() for c in columns])
    if "ApplicantIncome" in columns or "Property_Area" in columns:
        detected_dataset = "kaggle_loan_eligible"
    elif "person_income" in columns or "loan_intent" in columns:
        detected_dataset = "kaggle_loan_status_prediction"
    elif "loan_amnt" in columns or "int_rate" in columns:
        detected_dataset = "lending_club"
    elif " cibil_score" in columns or "cibil_score" in columns or "income_annum" in col_lower_set:
        detected_dataset = "kaggle_loan_approval"
    
    # Get sample data
    sample_data = df.head(5).to_dict(orient='records')
    # Clean NaN values
    for row in sample_data:
        for key, value in row.items():
            if pd.isna(value):
                row[key] = None
    
    return {
        "job_id": job_id,
        "detected_dataset": detected_dataset,
        "schema": SchemaDetectionResult(
            columns=columns,
            sample_data=sample_data,
            row_count=total_rows,
            suggested_mapping=suggested_mapping
        )
    }


@router.post("/url/fetch")
async def fetch_from_url(request: URLImportRequest):
    """Fetch CSV data from a URL (Kaggle, S3, Dropbox, etc.). Handles ZIP files from Kaggle API."""
    if not PANDAS_AVAILABLE:
        raise HTTPException(500, "pandas not installed")
    if not REQUESTS_AVAILABLE:
        raise HTTPException(500, "requests not installed")
    
    url = request.url
    
    try:
        # Use verify=False for Kaggle API (sometimes has SSL issues)
        response = requests.get(url, timeout=120, stream=True, verify=False, allow_redirects=True)
        response.raise_for_status()
    except Exception as e:
        raise HTTPException(400, f"Failed to fetch URL: {str(e)}")
    
    content = response.content
    content_type = response.headers.get('Content-Type', '')
    csv_content = None
    filename = request.source_name or url.split('/')[-1].split('?')[0] or "url_import.csv"
    
    # Check if response is a ZIP file (Kaggle API returns ZIP archives)
    is_zip = (
        'zip' in content_type.lower() or 
        url.endswith('.zip') or 
        (len(content) > 4 and content[:4] == b'PK\x03\x04')  # ZIP magic bytes
    )
    
    if is_zip:
        try:
            # Extract CSV from ZIP
            with zipfile.ZipFile(io.BytesIO(content)) as zf:
                csv_files = [f for f in zf.namelist() if f.endswith('.csv')]
                if not csv_files:
                    raise HTTPException(400, "ZIP file contains no CSV files")
                # Use first CSV found
                csv_filename = csv_files[0]
                csv_content = zf.read(csv_filename)
                filename = csv_filename
                print(f"[IMPORT] Extracted {csv_filename} from ZIP archive")
        except zipfile.BadZipFile:
            raise HTTPException(400, "Invalid ZIP file received")
    else:
        csv_content = content
    
    try:
        df = pd.read_csv(io.BytesIO(csv_content), nrows=100)
    except Exception as e:
        raise HTTPException(400, f"Failed to parse CSV from URL: {str(e)}")
    
    # Save file
    upload_dir = os.path.join(os.path.dirname(__file__), "..", "..", "data", "imports")
    os.makedirs(upload_dir, exist_ok=True)
    if not filename.endswith('.csv'):
        filename = filename + '.csv'
    file_path = os.path.join(upload_dir, f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{filename}")
    
    with open(file_path, 'wb') as f:
        f.write(csv_content)
    
    # Create import job
    with Session(engine) as session:
        full_df = pd.read_csv(io.BytesIO(csv_content))
        total_rows = len(full_df)
        
        job = DataImportJob(
            source_type="url_fetch",
            source_path=file_path,
            original_filename=filename,
            status="mapping",
            total_rows=total_rows
        )
        session.add(job)
        session.commit()
        session.refresh(job)
        job_id = job.id
    
    # Detect schema and suggest mapping using all known dataset mappings
    columns = df.columns.tolist()
    suggested_mapping = {}
    detected_dataset = "unknown"
    
    for col in columns:
        col_lower = col.lower().replace(" ", "_")
        # Check all known mappings
        if col in ALL_MAPPINGS and ALL_MAPPINGS[col] is not None:
            suggested_mapping[col] = ALL_MAPPINGS[col]
        elif col_lower in ALL_MAPPINGS and ALL_MAPPINGS.get(col_lower) is not None:
            suggested_mapping[col] = ALL_MAPPINGS[col_lower]
        elif col_lower in [f["name"] for f in INTERNAL_FIELDS]:
            suggested_mapping[col] = col_lower
    
    # Detect dataset type based on columns
    col_set = set(columns)
    if "Principal" in col_set and "terms" in col_set:
        detected_dataset = "kaggle_loan_payments"
    elif "ApplicantIncome" in col_set or "Property_Area" in col_set:
        detected_dataset = "kaggle_loan_eligible"
    elif "person_income" in col_set or "loan_intent" in col_set:
        detected_dataset = "kaggle_loan_status_prediction"
    elif "loan_amnt" in col_set or "int_rate" in col_set:
        detected_dataset = "lending_club"
    elif "cibil_score" in col_set or " cibil_score" in col_set:
        detected_dataset = "kaggle_loan_approval"
    
    sample_data = df.head(5).to_dict(orient='records')
    for row in sample_data:
        for key, value in row.items():
            if pd.isna(value):
                row[key] = None
    
    return {
        "job_id": job_id,
        "detected_dataset": detected_dataset,
        "schema": SchemaDetectionResult(
            columns=columns,
            sample_data=sample_data,
            row_count=total_rows,
            suggested_mapping=suggested_mapping
        )
    }


@router.post("/execute/{job_id}")
async def execute_import(job_id: int, mapping: ColumnMapping, background_tasks: BackgroundTasks):
    """Execute the import with the provided column mapping."""
    if not PANDAS_AVAILABLE:
        raise HTTPException(500, "pandas not installed")
    
    with Session(engine) as session:
        job = session.get(DataImportJob, job_id)
        if not job:
            raise HTTPException(404, "Import job not found")
        
        if job.status not in ["mapping", "failed"]:
            raise HTTPException(400, f"Job is already {job.status}")
        
        # Store mapping and update status
        job.column_mapping = json.dumps(mapping.mapping)
        job.status = "importing"
        session.add(job)
        session.commit()
    
    # Run import in background
    background_tasks.add_task(run_import, job_id, mapping.mapping)
    
    return {"job_id": job_id, "status": "importing", "message": "Import started in background"}


def run_import(job_id: int, mapping: Dict[str, str]):
    """Background task to run the actual import."""
    with Session(engine) as session:
        job = session.get(DataImportJob, job_id)
        if not job:
            return
        
        try:
            df = pd.read_csv(job.source_path)
            imported = 0
            failed = 0
            
            for _, row in df.iterrows():
                try:
                    loan_data = {"source": "csv_import"}
                    
                    for source_col, target_field in mapping.items():
                        if source_col in row.index:
                            value = row[source_col]
                            if pd.isna(value):
                                continue
                            
                            # Parse term (e.g., "36 months" -> 36)
                            if target_field == "term_months" and isinstance(value, str):
                                value = int(value.replace(" months", "").strip())
                            
                            # Parse interest rate (e.g., "10.5%" -> 10.5)
                            if target_field == "interest_rate" and isinstance(value, str):
                                value = float(value.replace("%", "").strip())
                            
                            # Map loan status from various dataset formats
                            if target_field == "status":
                                # Normalize value - strip whitespace
                                if isinstance(value, str):
                                    value = value.strip().upper()
                                status_map = {
                                    # Lending Club
                                    "FULLY PAID": "paid_off",
                                    "Fully Paid": "paid_off",
                                    "CHARGED OFF": "defaulted",
                                    "Charged Off": "defaulted",
                                    "CURRENT": "funded",
                                    "Current": "funded",
                                    "LATE (31-120 DAYS)": "funded",
                                    "Late (31-120 days)": "funded",
                                    "IN GRACE PERIOD": "funded",
                                    "In Grace Period": "funded",
                                    "LATE (16-30 DAYS)": "funded",
                                    "Late (16-30 days)": "funded",
                                    "DEFAULT": "defaulted",
                                    "Default": "defaulted",
                                    # Kaggle Loan Payments Dataset
                                    "PAIDOFF": "paid_off",
                                    "COLLECTION": "defaulted",
                                    "COLLECTION_PAIDOFF": "paid_off",
                                    # Kaggle Loan Eligible
                                    "Y": "approved",
                                    "N": "rejected",
                                    # Kaggle Loan Approval Dataset
                                    "APPROVED": "approved",
                                    "Approved": "approved",
                                    "REJECTED": "rejected",
                                    "Rejected": "rejected",
                                    # Kaggle Loan Status Prediction (0/1)
                                    "0": "paid_off",
                                    "1": "defaulted",
                                    0: "paid_off",
                                    1: "defaulted"
                                }
                                value = status_map.get(value, status_map.get(str(value).strip(), "pending"))
                            
                            # Handle CIBIL score from Credit_History (0/1 -> score)
                            if target_field == "cibil_score":
                                if value in [0, 1, "0", "1"]:
                                    # Credit_History: 1 = good (750+), 0 = bad (600-)
                                    value = 750 if str(value) == "1" else 550
                            
                            # Handle Loan Amount in thousands (Kaggle Loan Eligible)
                            if target_field == "loan_amount" and source_col in ["LoanAmount"]:
                                value = float(value) * 1000  # Convert from thousands
                            
                            # Handle home ownership mapping
                            if target_field == "home_ownership":
                                ownership_map = {
                                    "Urban": "RENT",
                                    "Rural": "OWN",
                                    "Semiurban": "MORTGAGE",
                                    "RENT": "RENT",
                                    "OWN": "OWN",
                                    "MORTGAGE": "MORTGAGE",
                                    "OTHER": "OTHER"
                                }
                                value = ownership_map.get(str(value).upper(), str(value).upper())
                            
                            loan_data[target_field] = value
                    
                    # Ensure required fields have defaults
                    if "loan_amount" not in loan_data:
                        loan_data["loan_amount"] = 0
                    if "term_months" not in loan_data:
                        loan_data["term_months"] = 36
                    if "interest_rate" not in loan_data:
                        loan_data["interest_rate"] = 10.0
                    if "annual_income" not in loan_data:
                        loan_data["annual_income"] = 50000
                    
                    # Set default extended features if not provided
                    if "cibil_score" not in loan_data:
                        loan_data["cibil_score"] = 700  # Default middle score
                    if "assets_value" not in loan_data:
                        # Estimate assets as 2x annual income
                        loan_data["assets_value"] = loan_data.get("annual_income", 50000) * 2
                    
                    loan = LoanApplication(**loan_data)
                    session.add(loan)
                    imported += 1
                    
                except Exception as e:
                    failed += 1
                    continue
            
            session.commit()
            
            job.imported_rows = imported
            job.failed_rows = failed
            job.status = "completed"
            job.completed_at = datetime.utcnow()
            session.add(job)
            session.commit()
            
        except Exception as e:
            job.status = "failed"
            job.error_message = str(e)
            session.add(job)
            session.commit()


@router.get("/jobs")
def list_import_jobs():
    """List all import jobs."""
    with Session(engine) as session:
        jobs = session.exec(select(DataImportJob).order_by(DataImportJob.created_at.desc())).all()
        return {"jobs": [job.model_dump() for job in jobs]}


@router.get("/jobs/{job_id}")
def get_import_job(job_id: int):
    """Get status of a specific import job."""
    with Session(engine) as session:
        job = session.get(DataImportJob, job_id)
        if not job:
            raise HTTPException(404, "Job not found")
        return job.model_dump()


@router.get("/applications")
def list_loan_applications(limit: int = 100, offset: int = 0, status: Optional[str] = None):
    """List imported loan applications."""
    with Session(engine) as session:
        query = select(LoanApplication).offset(offset).limit(limit)
        if status:
            query = query.where(LoanApplication.status == status)
        query = query.order_by(LoanApplication.created_at.desc())
        applications = session.exec(query).all()
        
        total = session.exec(select(LoanApplication)).all()
        
        return {
            "applications": [app.model_dump() for app in applications],
            "total": len(total),
            "limit": limit,
            "offset": offset
        }


@router.get("/applications/{app_id}")
def get_loan_application(app_id: int):
    """Get a specific loan application."""
    with Session(engine) as session:
        app = session.get(LoanApplication, app_id)
        if not app:
            raise HTTPException(404, "Application not found")
        return app.model_dump()
