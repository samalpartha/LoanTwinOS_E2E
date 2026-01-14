"""
Risk Assessment Router - Credit Risk Analysis API
Provides ML-based default prediction with Groq AI explanations
"""
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from sqlmodel import Session, select
from datetime import datetime

from ..db import engine
from ..models.tables import LoanApplication
from ..services.risk_model import get_predictor
from ..services.feature_engineering import get_feature_engineer
from ..services.demo_data import load_demo_portfolio, get_demo_stats, clear_demo_data, seed_document_requirements

router = APIRouter(prefix="/risk", tags=["Credit Risk"])


class LoanAssessmentRequest(BaseModel):
    """Manual loan assessment request."""
    loan_amount: float
    term_months: int = 36
    interest_rate: float
    grade: str = "C"
    annual_income: float
    dti: float = 20.0
    home_ownership: str = "RENT"
    employment_length: Optional[str] = None
    purpose: str = "debt_consolidation"
    delinq_2yrs: int = 0
    pub_rec: int = 0
    revol_util: Optional[float] = None
    # Extended features for 97% accuracy
    cibil_score: Optional[float] = 700
    assets_value: Optional[float] = None


class WhatIfRequest(BaseModel):
    """What-if scenario analysis request."""
    application_id: int
    changes: Dict[str, Any]


class AssessmentResult(BaseModel):
    """Risk assessment result."""
    application_id: Optional[int]
    risk_score: float
    default_probability: float
    risk_factors: List[Dict[str, Any]]
    recommendation: str
    explanation: str
    assessed_at: str


@router.post("/assess", response_model=AssessmentResult)
def assess_loan(request: LoanAssessmentRequest):
    """Assess risk for a new loan application."""
    
    # Create loan application record
    with Session(engine) as session:
        loan = LoanApplication(
            loan_amount=request.loan_amount,
            term_months=request.term_months,
            interest_rate=request.interest_rate,
            grade=request.grade,
            annual_income=request.annual_income,
            dti=request.dti,
            home_ownership=request.home_ownership,
            employment_length=request.employment_length,
            purpose=request.purpose,
            delinq_2yrs=request.delinq_2yrs,
            pub_rec=request.pub_rec,
            revol_util=request.revol_util,
            cibil_score=request.cibil_score,
            assets_value=request.assets_value,
            source="manual",
            status="pending"
        )
        session.add(loan)
        session.commit()
        session.refresh(loan)
        
        # Run prediction
        predictor = get_predictor()
        risk_score, default_prob, risk_factors = predictor.predict(loan)
        explanation = predictor.explain_with_groq(loan, risk_score, default_prob, risk_factors)
        
        # Determine recommendation
        if risk_score < 30:
            recommendation = "APPROVE"
        elif risk_score < 50:
            recommendation = "REVIEW"
        elif risk_score < 70:
            recommendation = "CONDITIONAL"
        else:
            recommendation = "DECLINE"
        
        # Update loan with assessment
        loan.risk_score = risk_score
        loan.default_probability = default_prob
        loan.risk_explanation = explanation
        loan.assessed_at = datetime.utcnow()
        session.add(loan)
        session.commit()
        
        return AssessmentResult(
            application_id=loan.id,
            risk_score=risk_score,
            default_probability=default_prob,
            risk_factors=risk_factors,
            recommendation=recommendation,
            explanation=explanation,
            assessed_at=datetime.utcnow().isoformat()
        )


@router.post("/assess/{application_id}")
def assess_existing_application(application_id: int):
    """Run risk assessment on an existing loan application."""
    
    with Session(engine) as session:
        loan = session.get(LoanApplication, application_id)
        if not loan:
            raise HTTPException(404, "Application not found")
        
        # Run prediction
        predictor = get_predictor()
        risk_score, default_prob, risk_factors = predictor.predict(loan)
        explanation = predictor.explain_with_groq(loan, risk_score, default_prob, risk_factors)
        
        # Determine recommendation
        if risk_score < 30:
            recommendation = "APPROVE"
        elif risk_score < 50:
            recommendation = "REVIEW"
        elif risk_score < 70:
            recommendation = "CONDITIONAL"
        else:
            recommendation = "DECLINE"
        
        # Update loan with assessment
        loan.risk_score = risk_score
        loan.default_probability = default_prob
        loan.risk_explanation = explanation
        loan.assessed_at = datetime.utcnow()
        session.add(loan)
        session.commit()
        
        return {
            "application_id": loan.id,
            "risk_score": risk_score,
            "default_probability": default_prob,
            "risk_factors": risk_factors,
            "recommendation": recommendation,
            "explanation": explanation,
            "assessed_at": datetime.utcnow().isoformat()
        }


@router.post("/batch")
def batch_assess(background_tasks: BackgroundTasks, limit: int = 100):
    """Run batch risk assessment on unassessed applications."""
    
    with Session(engine) as session:
        unassessed = session.exec(
            select(LoanApplication)
            .where(LoanApplication.risk_score == None)
            .limit(limit)
        ).all()
        
        if not unassessed:
            return {"message": "No unassessed applications found", "count": 0}
        
        # Run in background for large batches
        if len(unassessed) > 10:
            background_tasks.add_task(run_batch_assessment, [a.id for a in unassessed])
            return {
                "message": f"Batch assessment started for {len(unassessed)} applications",
                "count": len(unassessed),
                "status": "processing"
            }
        
        # Run immediately for small batches
        predictor = get_predictor()
        results = []
        
        for loan in unassessed:
            risk_score, default_prob, risk_factors = predictor.predict(loan)
            explanation = predictor.explain_with_groq(loan, risk_score, default_prob, risk_factors)
            
            loan.risk_score = risk_score
            loan.default_probability = default_prob
            loan.risk_explanation = explanation
            loan.assessed_at = datetime.utcnow()
            session.add(loan)
            
            results.append({
                "id": loan.id,
                "risk_score": risk_score,
                "recommendation": "APPROVE" if risk_score < 30 else "REVIEW" if risk_score < 50 else "DECLINE"
            })
        
        session.commit()
        
        return {
            "message": f"Assessed {len(results)} applications",
            "count": len(results),
            "results": results
        }


def run_batch_assessment(application_ids: List[int]):
    """Background task for batch assessment."""
    predictor = get_predictor()
    
    with Session(engine) as session:
        for app_id in application_ids:
            loan = session.get(LoanApplication, app_id)
            if not loan:
                continue
            
            try:
                risk_score, default_prob, risk_factors = predictor.predict(loan)
                explanation = predictor.explain_with_groq(loan, risk_score, default_prob, risk_factors)
                
                loan.risk_score = risk_score
                loan.default_probability = default_prob
                loan.risk_explanation = explanation
                loan.assessed_at = datetime.utcnow()
                session.add(loan)
            except:
                continue
        
        session.commit()


@router.get("/portfolio")
def get_portfolio_risk():
    """Get portfolio-level risk summary."""
    
    with Session(engine) as session:
        all_apps = session.exec(select(LoanApplication)).all()
        
        if not all_apps:
            return {
                "total_applications": 0,
                "message": "No applications in portfolio"
            }
        
        assessed = [a for a in all_apps if a.risk_score is not None]
        
        # Risk distribution
        low_risk = sum(1 for a in assessed if a.risk_score < 30)
        medium_risk = sum(1 for a in assessed if 30 <= a.risk_score < 50)
        high_risk = sum(1 for a in assessed if 50 <= a.risk_score < 70)
        critical_risk = sum(1 for a in assessed if a.risk_score >= 70)
        
        # Status distribution
        status_dist = {}
        for app in all_apps:
            status_dist[app.status] = status_dist.get(app.status, 0) + 1
        
        # Grade distribution
        grade_dist = {}
        for app in all_apps:
            grade_dist[app.grade] = grade_dist.get(app.grade, 0) + 1
        
        # Averages
        avg_risk = sum(a.risk_score for a in assessed) / len(assessed) if assessed else 0
        avg_default_prob = sum(a.default_probability or 0 for a in assessed) / len(assessed) if assessed else 0
        total_exposure = sum(a.loan_amount for a in all_apps)
        at_risk_exposure = sum(a.loan_amount for a in assessed if a.risk_score and a.risk_score >= 50)
        
        return {
            "total_applications": len(all_apps),
            "assessed_applications": len(assessed),
            "unassessed_applications": len(all_apps) - len(assessed),
            "risk_distribution": {
                "low": low_risk,
                "medium": medium_risk,
                "high": high_risk,
                "critical": critical_risk
            },
            "status_distribution": status_dist,
            "grade_distribution": grade_dist,
            "portfolio_metrics": {
                "average_risk_score": round(avg_risk, 2),
                "average_default_probability": round(avg_default_prob * 100, 2),
                "total_exposure": round(total_exposure, 2),
                "at_risk_exposure": round(at_risk_exposure, 2),
                "at_risk_percentage": round((at_risk_exposure / total_exposure * 100) if total_exposure > 0 else 0, 2)
            }
        }


@router.get("/defaults")
def get_predicted_defaults(threshold: float = 50.0, limit: int = 50):
    """Get loans predicted to default (high risk)."""
    
    with Session(engine) as session:
        high_risk = session.exec(
            select(LoanApplication)
            .where(LoanApplication.risk_score >= threshold)
            .order_by(LoanApplication.risk_score.desc())
            .limit(limit)
        ).all()
        
        return {
            "threshold": threshold,
            "count": len(high_risk),
            "total_exposure": sum(a.loan_amount for a in high_risk),
            "applications": [
                {
                    "id": a.id,
                    "loan_amount": a.loan_amount,
                    "grade": a.grade,
                    "risk_score": a.risk_score,
                    "default_probability": a.default_probability,
                    "explanation": a.risk_explanation,
                    "status": a.status
                }
                for a in high_risk
            ]
        }


@router.post("/train")
def train_model():
    """Train/retrain the risk model on historical data."""
    
    with Session(engine) as session:
        # Get completed loans for training
        completed = session.exec(
            select(LoanApplication)
            .where(LoanApplication.status.in_(["paid_off", "defaulted"]))
        ).all()
        
        if len(completed) < 50:
            return {
                "status": "insufficient_data",
                "message": f"Need at least 50 completed loans, have {len(completed)}",
                "suggestion": "Load demo data first with POST /api/risk/demo/load"
            }
        
        predictor = get_predictor()
        result = predictor.train(completed)
        
        return result


# Demo Data Endpoints
@router.post("/demo/load")
def load_demo_data(count: int = 500):
    """Load demo Lending Club data for testing."""
    result = load_demo_portfolio(count)
    
    # Also seed document requirements
    seed_result = seed_document_requirements()
    result["document_requirements"] = seed_result
    
    return result


@router.get("/demo/stats")
def demo_stats():
    """Get statistics about loaded demo data."""
    return get_demo_stats()


@router.delete("/demo/clear")
def clear_demo():
    """Clear all demo data."""
    return clear_demo_data()


@router.get("/health")
def risk_health():
    """Health check for risk assessment service."""
    predictor = get_predictor()
    
    return {
        "status": "healthy",
        "model_loaded": predictor.model is not None,
        "groq_available": predictor.groq_client is not None,
        "features": predictor.FEATURES
    }


# ============================================================================
# Random Forest + SHAP Explainability Endpoints
# ============================================================================

@router.get("/model/stats")
def get_model_stats():
    """Get current model statistics and performance metrics."""
    predictor = get_predictor()
    return predictor.get_model_stats()


@router.get("/shap/{application_id}")
def get_shap_waterfall(application_id: int):
    """
    Get SHAP waterfall data for a specific loan application.
    Returns feature contributions for visualization.
    """
    with Session(engine) as session:
        loan = session.get(LoanApplication, application_id)
        if not loan:
            raise HTTPException(404, "Application not found")
        
        predictor = get_predictor()
        return predictor.get_shap_waterfall(loan)


@router.post("/what-if")
def run_what_if_analysis(request: WhatIfRequest):
    """
    Run what-if scenario analysis.
    Changes parameter values and shows impact on risk score.
    """
    with Session(engine) as session:
        loan = session.get(LoanApplication, request.application_id)
        if not loan:
            raise HTTPException(404, "Application not found")
        
        predictor = get_predictor()
        return predictor.what_if_analysis(loan, request.changes)


# ============================================================================
# Feature Engineering Endpoints
# ============================================================================

@router.get("/features/validate")
def validate_features():
    """
    Run Chi-Square and ANOVA tests to validate feature significance.
    Returns statistical validation results for all features.
    """
    with Session(engine) as session:
        loans = session.exec(
            select(LoanApplication)
            .where(LoanApplication.status.in_(["paid_off", "defaulted", "fully_paid", "charged_off"]))
        ).all()
        
        if len(loans) < 30:
            return {
                "error": "Need at least 30 completed loans for validation",
                "available": len(loans)
            }
        
        engineer = get_feature_engineer()
        return engineer.validate_features(loans)


@router.get("/features/statistics")
def get_feature_statistics():
    """Get descriptive statistics for all features in the portfolio."""
    with Session(engine) as session:
        loans = session.exec(select(LoanApplication)).all()
        
        if not loans:
            return {"error": "No loans in portfolio"}
        
        engineer = get_feature_engineer()
        return engineer.get_feature_statistics(loans)


@router.get("/features/outliers/{feature}")
def detect_outliers(feature: str, method: str = "iqr"):
    """
    Detect outliers in a specific feature.
    Methods: 'iqr' (Interquartile Range) or 'zscore' (Z-Score)
    """
    valid_features = [
        'loan_amount', 'interest_rate', 'annual_income', 'dti',
        'delinq_2yrs', 'inq_last_6mths', 'open_acc', 'pub_rec',
        'revol_bal', 'revol_util', 'total_acc', 'cibil_score'
    ]
    
    if feature not in valid_features:
        raise HTTPException(400, f"Invalid feature. Choose from: {valid_features}")
    
    with Session(engine) as session:
        loans = session.exec(select(LoanApplication)).all()
        
        if not loans:
            return {"error": "No loans in portfolio"}
        
        engineer = get_feature_engineer()
        return engineer.detect_outliers(loans, feature, method)


@router.get("/features/report")
def get_feature_report():
    """Generate comprehensive feature engineering report."""
    with Session(engine) as session:
        loans = session.exec(select(LoanApplication)).all()
        
        if not loans:
            return {"error": "No loans in portfolio"}
        
        engineer = get_feature_engineer()
        return engineer.create_feature_report(loans)


@router.post("/features/engineer/{application_id}")
def engineer_loan_features(application_id: int):
    """Apply feature engineering transformations to a specific loan."""
    with Session(engine) as session:
        loan = session.get(LoanApplication, application_id)
        if not loan:
            raise HTTPException(404, "Application not found")
        
        engineer = get_feature_engineer()
        return {
            "application_id": application_id,
            "engineered_features": engineer.engineer_features(loan)
        }
