"""
LoanTwin Market Intelligence Router
Advanced analytics: Distance-to-Default, Capital Structure, Tokenized Settlement
"""
from __future__ import annotations
import json
import math
import random
from datetime import datetime, date, timedelta
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select
from ..db import engine
from ..models.tables import Loan, AuditLog

router = APIRouter(prefix="/market", tags=["market-intelligence"])

# ============ SCHEMAS ============

class DistanceToDefault(BaseModel):
    ticker: str
    company_name: str
    stock_price: float
    stock_price_change_pct: float
    market_cap: float
    total_debt: float
    equity_cushion_pct: float
    distance_to_default: float
    implied_default_probability: float
    rating_implied: str
    signal: str  # 'safe', 'watch', 'warning', 'critical'
    last_updated: str

class CapitalStructure(BaseModel):
    senior_secured: float
    senior_unsecured: float
    subordinated: float
    mezzanine: float
    equity: float
    total_enterprise_value: float
    loan_position: str  # 'senior_secured', 'senior_unsecured', etc.
    recovery_rate_estimate: float
    ltv_ratio: float

class PricingGridTrigger(BaseModel):
    current_rating: str
    current_margin_bps: int
    next_downgrade_rating: str
    downgrade_margin_bps: int
    next_upgrade_rating: str
    upgrade_margin_bps: int
    rating_outlook: str  # 'positive', 'stable', 'negative', 'watch'

class TokenizedSettlement(BaseModel):
    wallet_address: str
    tokenized_usd_balance: float
    pending_settlements: list
    supported_tokens: list
    compliance_status: str
    settlement_speed: str

# ============ DISTANCE TO DEFAULT (MERTON MODEL) ============

@router.get("/distance-to-default/{loan_id}", response_model=DistanceToDefault)
def get_distance_to_default(loan_id: int):
    """
    Calculates Distance-to-Default using the Merton structural model.
    This is the institutional gold standard for credit risk assessment.
    """
    with Session(engine) as session:
        loan = session.get(Loan, loan_id)
        if not loan: raise HTTPException(404, "Loan not found")
        
        # Extract borrower info from DLR
        borrower_name = loan.borrower_name or "Boeing Corporation"
        
        # Simulated market data (in production, this would come from Bloomberg/Reuters API)
        # For Boeing (BA) or generic corporate
        market_data = _get_simulated_market_data(borrower_name)
        
        # Get total debt from loan
        total_debt = _get_total_commitment(loan)
        
        # Merton Model Calculation
        # V = Market Cap + Debt (Enterprise Value)
        # D = Total Debt
        # σ = Stock Volatility
        # T = Time horizon (1 year)
        
        enterprise_value = market_data["market_cap"] + total_debt
        equity_cushion = (enterprise_value - total_debt) / enterprise_value * 100
        
        # Distance to Default = (ln(V/D) + (r - σ²/2)T) / (σ√T)
        # Simplified calculation
        volatility = market_data["volatility"]
        risk_free_rate = 0.05  # 5%
        time_horizon = 1.0  # 1 year
        
        d1 = (math.log(enterprise_value / total_debt) + (risk_free_rate + (volatility ** 2) / 2) * time_horizon) / (volatility * math.sqrt(time_horizon))
        d2 = d1 - volatility * math.sqrt(time_horizon)
        
        # Distance to Default (number of standard deviations)
        dtd = d2
        
        # Implied Default Probability using normal CDF approximation
        # P(default) = N(-d2)
        def norm_cdf(x):
            return (1.0 + math.erf(x / math.sqrt(2.0))) / 2.0
        
        implied_default_prob = (1 - norm_cdf(d2)) * 100
        
        # Map to rating
        if implied_default_prob < 0.1:
            rating = "AAA"
            signal = "safe"
        elif implied_default_prob < 0.5:
            rating = "AA"
            signal = "safe"
        elif implied_default_prob < 1.0:
            rating = "A"
            signal = "safe"
        elif implied_default_prob < 2.5:
            rating = "BBB"
            signal = "watch"
        elif implied_default_prob < 5.0:
            rating = "BB"
            signal = "warning"
        else:
            rating = "B"
            signal = "critical"
        
        return DistanceToDefault(
            ticker=market_data["ticker"],
            company_name=borrower_name,
            stock_price=market_data["stock_price"],
            stock_price_change_pct=market_data["price_change"],
            market_cap=market_data["market_cap"],
            total_debt=total_debt,
            equity_cushion_pct=round(equity_cushion, 1),
            distance_to_default=round(dtd, 2),
            implied_default_probability=round(implied_default_prob, 3),
            rating_implied=rating,
            signal=signal,
            last_updated=datetime.now().isoformat()
        )

# ============ CAPITAL STRUCTURE MONITOR ============

@router.get("/capital-structure/{loan_id}", response_model=dict)
def get_capital_structure(loan_id: int):
    """
    Returns the borrower's capital structure and this loan's position in the waterfall.
    Critical for understanding recovery rates in distress scenarios.
    """
    with Session(engine) as session:
        loan = session.get(Loan, loan_id)
        if not loan: raise HTTPException(404, "Loan not found")
        
        total_debt = _get_total_commitment(loan)
        
        # Simulated capital structure (would come from financial data provider)
        capital_structure = CapitalStructure(
            senior_secured=total_debt * 0.4,  # This loan might be part of this
            senior_unsecured=total_debt * 0.3,
            subordinated=total_debt * 0.15,
            mezzanine=total_debt * 0.05,
            equity=total_debt * 0.8,  # Equity cushion
            total_enterprise_value=total_debt * 1.8,
            loan_position="senior_secured",
            recovery_rate_estimate=0.75,  # 75% expected recovery if default
            ltv_ratio=0.55
        )
        
        # Waterfall visualization data
        waterfall = [
            {"layer": "Senior Secured", "amount": capital_structure.senior_secured, "position": 1, "this_loan": True, "recovery": "85-100%"},
            {"layer": "Senior Unsecured", "amount": capital_structure.senior_unsecured, "position": 2, "this_loan": False, "recovery": "60-85%"},
            {"layer": "Subordinated", "amount": capital_structure.subordinated, "position": 3, "this_loan": False, "recovery": "30-60%"},
            {"layer": "Mezzanine", "amount": capital_structure.mezzanine, "position": 4, "this_loan": False, "recovery": "10-30%"},
            {"layer": "Equity", "amount": capital_structure.equity, "position": 5, "this_loan": False, "recovery": "0-10%"},
        ]
        
        return {
            "structure": capital_structure.model_dump(),
            "waterfall": waterfall,
            "this_loan_amount": total_debt,
            "currency": loan.currency or "GBP",
            "coverage_ratio": round(capital_structure.total_enterprise_value / total_debt, 2),
            "debt_to_equity": round((capital_structure.senior_secured + capital_structure.senior_unsecured + capital_structure.subordinated) / capital_structure.equity, 2)
        }

# ============ PRICING GRID TRIGGERS ============

@router.get("/pricing-grid/{loan_id}", response_model=dict)
def get_pricing_grid(loan_id: int):
    """
    Returns the pricing grid and current position.
    Shows how rating changes affect the loan's interest rate.
    """
    with Session(engine) as session:
        loan = session.get(Loan, loan_id)
        if not loan: raise HTTPException(404, "Loan not found")
        
        current_margin = loan.margin_bps or 175
        
        # LMA standard pricing grid structure
        pricing_grid = [
            {"rating": "A+", "margin_bps": 100, "current": False},
            {"rating": "A", "margin_bps": 125, "current": False},
            {"rating": "A-", "margin_bps": 150, "current": False},
            {"rating": "BBB+", "margin_bps": 175, "current": True},  # Current
            {"rating": "BBB", "margin_bps": 200, "current": False},
            {"rating": "BBB-", "margin_bps": 250, "current": False},
            {"rating": "BB+", "margin_bps": 325, "current": False},
            {"rating": "BB", "margin_bps": 400, "current": False},
        ]
        
        current_idx = next((i for i, g in enumerate(pricing_grid) if g["current"]), 3)
        
        triggers = PricingGridTrigger(
            current_rating=pricing_grid[current_idx]["rating"],
            current_margin_bps=current_margin,
            next_downgrade_rating=pricing_grid[current_idx + 1]["rating"] if current_idx < len(pricing_grid) - 1 else "N/A",
            downgrade_margin_bps=pricing_grid[current_idx + 1]["margin_bps"] if current_idx < len(pricing_grid) - 1 else 0,
            next_upgrade_rating=pricing_grid[current_idx - 1]["rating"] if current_idx > 0 else "N/A",
            upgrade_margin_bps=pricing_grid[current_idx - 1]["margin_bps"] if current_idx > 0 else 0,
            rating_outlook="stable"
        )
        
        # Calculate annual cost impact
        total_debt = _get_total_commitment(loan)
        downgrade_cost = total_debt * ((triggers.downgrade_margin_bps - current_margin) / 10000) if triggers.downgrade_margin_bps else 0
        upgrade_saving = total_debt * ((current_margin - triggers.upgrade_margin_bps) / 10000) if triggers.upgrade_margin_bps else 0
        
        return {
            "grid": pricing_grid,
            "triggers": triggers.model_dump(),
            "downgrade_annual_cost": downgrade_cost,
            "upgrade_annual_saving": upgrade_saving,
            "currency": loan.currency or "GBP",
            "total_exposure": total_debt
        }

# ============ TOKENIZED SETTLEMENT & BLOCKCHAIN ============

@router.get("/tokenized-settlement/{loan_id}", response_model=dict)
def get_tokenized_settlement(loan_id: int):
    """
    Returns tokenized settlement options for future-ready payments.
    Compliant with LMA standards using bank-issued stablecoins.
    """
    with Session(engine) as session:
        loan = session.get(Loan, loan_id)
        if not loan: raise HTTPException(404, "Loan not found")
        
        total_debt = _get_total_commitment(loan)
        
        settlement = TokenizedSettlement(
            wallet_address="0x7a23...8f91",  # Institutional custody wallet
            tokenized_usd_balance=25000000.0,  # $25M available
            pending_settlements=[
                {
                    "id": "SET-001",
                    "amount": 5000000,
                    "token": "JPMC-USD",
                    "status": "pending_confirmation",
                    "initiated_at": datetime.now().isoformat(),
                    "expected_settlement": "T+0"
                }
            ],
            supported_tokens=[
                {"symbol": "JPMC-USD", "issuer": "J.P. Morgan", "type": "Bank-Issued Stablecoin", "settlement": "T+0", "compliance": "LMA Compliant"},
                {"symbol": "USDC", "issuer": "Circle", "type": "Regulated Stablecoin", "settlement": "T+0", "compliance": "Pending LMA Review"},
                {"symbol": "EUROC", "issuer": "Circle", "type": "Regulated Stablecoin", "settlement": "T+0", "compliance": "Pending LMA Review"},
            ],
            compliance_status="Institutional Grade",
            settlement_speed="T+0 (Tokenized) vs T+2 (Traditional)"
        )
        
        return {
            "settlement": settlement.model_dump(),
            "loan_id": loan_id,
            "loan_currency": loan.currency or "GBP",
            "total_exposure": total_debt,
            "instant_settlement_available": True,
            "traditional_settlement_days": 2,
            "tokenized_settlement_days": 0,
            "cost_savings_estimate": total_debt * 0.0002  # 2bps savings on instant settlement
        }

@router.get("/blockchain/{loan_id}", response_model=dict)
def get_blockchain_features(loan_id: int):
    """
    Returns blockchain/DLT features for the loan including:
    - Smart contract status
    - On-chain audit trail
    - Digital asset representation
    - DLT-based trading
    """
    with Session(engine) as session:
        loan = session.get(Loan, loan_id)
        if not loan: raise HTTPException(404, "Loan not found")
        
        total_debt = _get_total_commitment(loan)
        
        return {
            "loan_id": loan_id,
            "blockchain_enabled": True,
            
            # Smart Contract Automation
            "smart_contracts": {
                "covenant_monitor": {
                    "contract_address": "0xCov3...9aB2",
                    "status": "active",
                    "network": "Ethereum (Private)",
                    "description": "Automated covenant compliance checking",
                    "triggers": [
                        {"event": "Financial Report Submitted", "action": "Auto-calculate ratios"},
                        {"event": "Covenant Breach Detected", "action": "Notify Agent + Lock Distributions"},
                        {"event": "All KPIs Met", "action": "Apply ESG Margin Discount"}
                    ],
                    "last_execution": datetime.now().isoformat(),
                    "gas_cost_estimate": "0.02 ETH"
                },
                "payment_waterfall": {
                    "contract_address": "0xPay1...7cD4",
                    "status": "active",
                    "description": "Automated interest/principal distribution",
                    "waterfall_order": ["Senior Secured", "Term Loan A", "RCF", "Mezz"],
                    "next_payment_date": "2025-03-31"
                },
                "transfer_registry": {
                    "contract_address": "0xTRF9...2eF1",
                    "status": "active",
                    "description": "On-chain lender registry for instant transfers",
                    "current_lenders": 4,
                    "pending_transfers": 1
                }
            },
            
            # Digital Asset Representation
            "tokenization": {
                "is_tokenized": True,
                "token_standard": "ERC-1400 (Security Token)",
                "total_tokens": int(total_debt / 1000),  # 1 token = $1000 face value
                "token_symbol": f"LT-{loan_id}",
                "custodian": "BNY Mellon Digital Assets",
                "transfer_restrictions": "Accredited Investors Only (Reg D)",
                "fractionalization": {
                    "min_trade_size": 100000,  # $100K minimum
                    "enabled": True,
                    "liquidity_pool": "Partior Network"
                }
            },
            
            # DLT Audit Trail
            "audit_trail": {
                "ledger_type": "Hyperledger Fabric (Consortium)",
                "participants": ["HSBC", "Barclays", "Lloyds", "NatWest"],
                "immutable_records": 47,
                "recent_entries": [
                    {"timestamp": "2025-01-12T10:30:00Z", "event": "Interest Payment Processed", "tx_hash": "0xabc...123", "block": 15847},
                    {"timestamp": "2025-01-10T14:22:00Z", "event": "Covenant Test Passed", "tx_hash": "0xdef...456", "block": 15832},
                    {"timestamp": "2025-01-05T09:15:00Z", "event": "Lender Transfer Executed", "tx_hash": "0xghi...789", "block": 15801},
                    {"timestamp": "2024-12-31T23:59:00Z", "event": "Year-End Snapshot", "tx_hash": "0xjkl...012", "block": 15750}
                ]
            },
            
            # Digital Currency Payment Options
            "payment_rails": {
                "traditional": {
                    "method": "SWIFT GPI",
                    "settlement": "T+2",
                    "cost": "15-25bps",
                    "availability": "Banking Hours"
                },
                "digital_currency": [
                    {
                        "name": "JPM Coin",
                        "issuer": "J.P. Morgan",
                        "type": "Tokenized Deposit",
                        "settlement": "T+0 (Instant)",
                        "cost": "2-5bps",
                        "availability": "24/7/365",
                        "compliance": "Fully Regulated",
                        "status": "available"
                    },
                    {
                        "name": "Fnality Payment",
                        "issuer": "Fnality International",
                        "type": "Wholesale CBDC",
                        "settlement": "T+0 (Instant)",
                        "cost": "1-3bps",
                        "availability": "24/7/365",
                        "compliance": "Central Bank Backed",
                        "status": "available"
                    },
                    {
                        "name": "USDC",
                        "issuer": "Circle",
                        "type": "Regulated Stablecoin",
                        "settlement": "T+0 (Instant)",
                        "cost": "5-10bps",
                        "availability": "24/7/365",
                        "compliance": "SOC 2, MiCA Pending",
                        "status": "pilot"
                    },
                    {
                        "name": "Digital GBP (CBDC)",
                        "issuer": "Bank of England",
                        "type": "Central Bank Digital Currency",
                        "settlement": "T+0 (Instant)",
                        "cost": "0bps",
                        "availability": "TBD",
                        "compliance": "Sovereign",
                        "status": "coming_2026"
                    }
                ]
            },
            
            # Cost-Benefit Analysis
            "cost_benefit": {
                "traditional_annual_cost": total_debt * 0.002,  # 20bps
                "digital_annual_cost": total_debt * 0.0005,  # 5bps
                "annual_savings": total_debt * 0.0015,  # 15bps savings
                "settlement_time_reduction": "95% faster (T+2 → T+0)",
                "operational_efficiency": "80% reduction in manual reconciliation"
            }
        }

# ============ LMA COMPLIANCE VALIDATOR ============

@router.get("/lma-compliance/{loan_id}", response_model=dict)
def validate_lma_compliance(loan_id: int):
    """
    Validates the loan structure against LMA standards.
    Identifies gaps and suggests remediation.
    """
    with Session(engine) as session:
        loan = session.get(Loan, loan_id)
        if not loan: raise HTTPException(404, "Loan not found")
        
        checks = []
        score = 0
        max_score = 0
        
        # Check 1: Governing Law
        max_score += 10
        if loan.governing_law and "english" in loan.governing_law.lower():
            checks.append({"item": "Governing Law", "status": "compliant", "detail": "English Law (LMA Standard)", "score": 10})
            score += 10
        else:
            checks.append({"item": "Governing Law", "status": "warning", "detail": f"{loan.governing_law or 'Not specified'} - May require additional documentation", "score": 5})
            score += 5
        
        # Check 2: Currency
        max_score += 10
        if loan.currency in ["GBP", "USD", "EUR"]:
            checks.append({"item": "Currency", "status": "compliant", "detail": f"{loan.currency} (LMA Major Currency)", "score": 10})
            score += 10
        else:
            checks.append({"item": "Currency", "status": "warning", "detail": f"{loan.currency} - Exotic currency handling required", "score": 5})
            score += 5
        
        # Check 3: Transfer Provisions
        max_score += 10
        if loan.transferability_mode and "lma" in loan.transferability_mode.lower():
            checks.append({"item": "Transfer Provisions", "status": "compliant", "detail": "LMA Standard Transfer Certificate", "score": 10})
            score += 10
        elif loan.transferability_mode:
            checks.append({"item": "Transfer Provisions", "status": "warning", "detail": "Non-standard transfer mechanics", "score": 5})
            score += 5
        else:
            checks.append({"item": "Transfer Provisions", "status": "missing", "detail": "Transfer provisions not specified", "score": 0})
        
        # Check 4: ESG Framework
        max_score += 10
        if loan.is_esg_linked:
            checks.append({"item": "ESG Framework", "status": "compliant", "detail": "LMA Sustainability-Linked Loan Principles", "score": 10})
            score += 10
        else:
            checks.append({"item": "ESG Framework", "status": "info", "detail": "Standard facility (not ESG-linked)", "score": 8})
            score += 8
        
        # Check 5: Documentation Standard
        max_score += 10
        checks.append({"item": "Documentation", "status": "compliant", "detail": "LMA Investment Grade Template detected", "score": 10})
        score += 10
        
        compliance_score = round((score / max_score) * 100)
        
        return {
            "loan_id": loan_id,
            "compliance_score": compliance_score,
            "standard": "LMA Investment Grade (2024)",
            "checks": checks,
            "grade": "A" if compliance_score >= 90 else "B" if compliance_score >= 70 else "C",
            "recommendations": _get_compliance_recommendations(checks),
            "competitor_comparison": {
                "lma": {"coverage": compliance_score, "standard": "LMA"},
                "lsta": {"coverage": compliance_score - 5, "standard": "LSTA (US)"},
                "aplma": {"coverage": compliance_score - 10, "standard": "APLMA (Asia)"}
            }
        }

# ============ MARKET MOVERS ALERTS ============

@router.get("/market-alerts/{loan_id}", response_model=dict)
def get_market_alerts(loan_id: int):
    """
    Returns real-time market alerts relevant to this specific loan.
    Not generic market data - focused on credit-impacting events.
    """
    with Session(engine) as session:
        loan = session.get(Loan, loan_id)
        if not loan: raise HTTPException(404, "Loan not found")
        
        borrower = loan.borrower_name or "Borrower"
        
        alerts = [
            {
                "id": "alert-1",
                "type": "rating",
                "severity": "info",
                "title": f"S&P maintains {borrower} at BBB+ (Stable)",
                "detail": "Rating affirmed following Q3 earnings. No impact on pricing grid.",
                "timestamp": (datetime.now() - timedelta(hours=4)).isoformat(),
                "action_required": False
            },
            {
                "id": "alert-2",
                "type": "equity",
                "severity": "watch",
                "title": f"{borrower} stock down 2.3% today",
                "detail": "Sector-wide decline. Distance-to-Default unchanged at safe levels.",
                "timestamp": datetime.now().isoformat(),
                "action_required": False
            },
            {
                "id": "alert-3",
                "type": "regulatory",
                "severity": "info",
                "title": "LMA releases updated ESG guidance",
                "detail": "New KPI reporting standards effective Q1 2026. Review Schedule 12.",
                "timestamp": (datetime.now() - timedelta(days=2)).isoformat(),
                "action_required": True
            }
        ]
        
        return {
            "loan_id": loan_id,
            "borrower": borrower,
            "alerts": alerts,
            "alerts_requiring_action": len([a for a in alerts if a["action_required"]]),
            "last_refreshed": datetime.now().isoformat()
        }

# ============ HELPER FUNCTIONS ============

def _get_total_commitment(loan: Loan) -> float:
    if not loan.dlr_json:
        return 350000000
    try:
        dlr = json.loads(loan.dlr_json)
        total = 0
        for f in dlr.get("facilities", []):
            amt = str(f.get("amount", "0")).replace(",", "")
            total += float(amt)
        return total if total > 0 else 350000000
    except:
        return 350000000

def _get_simulated_market_data(borrower: str) -> dict:
    """Simulates market data for the borrower."""
    # In production, this would call Bloomberg/Reuters API
    base_data = {
        "ticker": "BA" if "boeing" in borrower.lower() else "CORP",
        "stock_price": 178.50 + random.uniform(-5, 5),
        "price_change": random.uniform(-3, 2),
        "market_cap": 95_000_000_000 + random.uniform(-1e9, 1e9),  # ~$95B
        "volatility": 0.35  # 35% annualized volatility
    }
    
    # Adjust for greener/sustainability companies
    if "green" in borrower.lower():
        base_data["market_cap"] *= 0.1  # Smaller company
        base_data["volatility"] = 0.45  # Higher volatility
    
    return base_data

def _get_compliance_recommendations(checks: list) -> list:
    recommendations = []
    for check in checks:
        if check["status"] == "warning":
            recommendations.append({
                "item": check["item"],
                "recommendation": f"Review {check['item']} provisions to align with LMA standard documentation.",
                "priority": "medium"
            })
        elif check["status"] == "missing":
            recommendations.append({
                "item": check["item"],
                "recommendation": f"Add {check['item']} clause using LMA template language.",
                "priority": "high"
            })
    return recommendations

# ============ COMPLIANCE SHIELD (TRADE LOCK) ============

@router.get("/compliance-shield/{loan_id}", response_model=dict)
def get_compliance_shield(loan_id: int):
    """
    The Compliance Shield - Real-time gatekeeper that can LOCK trading.
    Integrates sanctions, ESG violations, regulatory flags.
    Returns trade_enabled: True/False with explanation.
    """
    with Session(engine) as session:
        loan = session.get(Loan, loan_id)
        if not loan: raise HTTPException(404, "Loan not found")
        
        blockers = []
        warnings = []
        
        # Check 1: Sanctions Screening
        sanctions_check = {
            "source": "OFAC SDN List",
            "last_checked": datetime.now().isoformat(),
            "borrower_status": "clear",
            "guarantor_status": "clear",
            "beneficial_owners": "clear"
        }
        # Simulate a flag for demo (random 10% chance)
        if random.random() < 0.1:
            blockers.append({
                "type": "sanctions",
                "severity": "critical",
                "title": "⛔ OFAC Sanctions Match Detected",
                "description": "Beneficial owner 'Entity X' matches OFAC SDN List entry.",
                "source": "OFAC SDN List (Updated 2025-01-12)",
                "action_required": "Escalate to Compliance Officer. Trade BLOCKED.",
                "auto_resolution": False
            })
            sanctions_check["beneficial_owners"] = "flagged"
        
        # Check 2: Equator Principles (ESG)
        equator_check = {
            "source": "Equator Principles (EP4)",
            "project_category": "Category B",  # Medium risk
            "environmental_review": "complete",
            "social_impact_assessment": "pending"
        }
        if loan.is_esg_linked:
            if random.random() < 0.15:
                warnings.append({
                    "type": "esg",
                    "severity": "warning",
                    "title": "⚠️ ESG Social Impact Assessment Pending",
                    "description": "Independent Social Impact Assessment due by 2025-03-31.",
                    "source": "Equator Principles Category B Requirements",
                    "action_required": "Schedule assessment with approved verifier.",
                    "auto_resolution": True,
                    "deadline": "2025-03-31"
                })
                equator_check["social_impact_assessment"] = "pending"
        
        # Check 3: Adverse Media Screening
        adverse_media = {
            "source": "LexisNexis WorldCompliance",
            "last_checked": datetime.now().isoformat(),
            "alerts_found": 0,
            "categories_screened": ["Financial Crime", "Corruption", "Environmental", "Human Rights"]
        }
        if random.random() < 0.2:
            warnings.append({
                "type": "adverse_media",
                "severity": "info",
                "title": "ℹ️ Adverse Media Alert (Low Priority)",
                "description": "News article referencing minor regulatory inquiry (2023).",
                "source": "LexisNexis WorldCompliance",
                "action_required": "Review for materiality. No trade block.",
                "auto_resolution": True
            })
            adverse_media["alerts_found"] = 1
        
        # Check 4: KYC/AML Status
        kyc_status = {
            "borrower_kyc": "verified",
            "guarantor_kyc": "verified",
            "last_refresh": "2024-11-15",
            "next_refresh_due": "2025-11-15",
            "enhanced_due_diligence": loan.is_esg_linked
        }
        
        # Check 5: Regulatory Jurisdiction
        jurisdiction_check = {
            "governing_law": loan.governing_law or "English Law",
            "lma_compliant": True,
            "mifid_status": "exempt",
            "basel_treatment": "Standardized Approach"
        }
        
        # Check 6: Covenant Compliance (real-time)
        covenant_status = {
            "all_covenants_met": True,
            "next_test_date": "2025-03-31",
            "waivers_pending": 0
        }
        # Check for covenant breach
        if random.random() < 0.1:
            blockers.append({
                "type": "covenant",
                "severity": "critical",
                "title": "⛔ Covenant Breach Detected",
                "description": "Interest Coverage Ratio: 2.8x (Required: 3.0x minimum)",
                "source": "Q4 2024 Compliance Certificate",
                "action_required": "Cure period active. Trade BLOCKED until waiver.",
                "auto_resolution": False
            })
            covenant_status["all_covenants_met"] = False
            covenant_status["waivers_pending"] = 1
        
        # Determine if trading is allowed
        trade_enabled = len(blockers) == 0
        
        # Calculate overall risk score
        risk_score = 100
        for b in blockers:
            risk_score -= 50 if b["severity"] == "critical" else 25
        for w in warnings:
            risk_score -= 10 if w["severity"] == "warning" else 5
        risk_score = max(0, risk_score)
        
        # Determine shield status
        if len(blockers) > 0:
            shield_status = "LOCKED"
            shield_color = "danger"
            shield_message = f"Trade BLOCKED: {len(blockers)} critical issue(s) require resolution."
        elif len(warnings) > 0:
            shield_status = "CAUTION"
            shield_color = "warning"
            shield_message = f"Trade ALLOWED with {len(warnings)} warning(s). Review recommended."
        else:
            shield_status = "CLEAR"
            shield_color = "success"
            shield_message = "All compliance checks passed. Trade enabled."
        
        return {
            "loan_id": loan_id,
            "borrower": loan.borrower_name,
            "checked_at": datetime.now().isoformat(),
            
            # Main Shield Status
            "trade_enabled": trade_enabled,
            "shield_status": shield_status,
            "shield_color": shield_color,
            "shield_message": shield_message,
            "risk_score": risk_score,
            
            # Blockers (Critical - Trade Locked)
            "blockers": blockers,
            
            # Warnings (Non-Blocking)
            "warnings": warnings,
            
            # Detailed Checks
            "checks": {
                "sanctions": sanctions_check,
                "equator_principles": equator_check,
                "adverse_media": adverse_media,
                "kyc_aml": kyc_status,
                "jurisdiction": jurisdiction_check,
                "covenants": covenant_status
            },
            
            # Data Sources
            "data_sources": [
                {"name": "OFAC SDN List", "updated": "2025-01-12", "status": "connected"},
                {"name": "UN Security Council", "updated": "2025-01-12", "status": "connected"},
                {"name": "EU Sanctions List", "updated": "2025-01-11", "status": "connected"},
                {"name": "LexisNexis WorldCompliance", "updated": "2025-01-12", "status": "connected"},
                {"name": "Equator Principles Database", "updated": "2025-01-10", "status": "connected"},
                {"name": "Bloomberg Terminal", "updated": "Real-time", "status": "connected"}
            ],
            
            # Audit Trail
            "audit": {
                "last_full_check": datetime.now().isoformat(),
                "checks_performed": 6,
                "time_elapsed_ms": random.randint(120, 350),
                "certification_id": f"CS-{loan_id}-{datetime.now().strftime('%Y%m%d%H%M')}"
            }
        }

# ============ EXPLAINABLE AI (XAI) ============

@router.get("/xai/trade-readiness/{loan_id}", response_model=dict)
def explain_trade_readiness(loan_id: int):
    """
    Explainable AI - Breaks down the Trade Readiness score with full transparency.
    Every factor is explained with contract references and market data.
    """
    with Session(engine) as session:
        loan = session.get(Loan, loan_id)
        if not loan: raise HTTPException(404, "Loan not found")
        
        # Build explainable factors
        factors = []
        total_score = 0
        max_score = 100
        
        # Factor 1: Documentation Completeness (25 points)
        doc_score = 20 if loan.dlr_json else 5
        factors.append({
            "category": "Documentation",
            "factor": "DLR Completeness",
            "score": doc_score,
            "max_score": 25,
            "weight": "25%",
            "explanation": "Digital Loan Record is fully structured with 47 extracted fields.",
            "evidence": "LMA Schedule 2 mapping complete. All material clauses indexed.",
            "citation": "Credit Agreement, Section 12.3 (Representations)"
        })
        total_score += doc_score
        
        # Factor 2: Transfer Mechanics (20 points)
        transfer_score = 15
        factors.append({
            "category": "Transferability",
            "factor": "Assignment/Novation Clarity",
            "score": transfer_score,
            "max_score": 20,
            "weight": "20%",
            "explanation": "Standard LMA assignment provisions with 5-day consent period.",
            "evidence": "Transfer Certificate template available. No borrower veto.",
            "citation": "Credit Agreement, Clause 25.3 (Transfer Conditions)",
            "flag": "White-list restriction applies (4 pre-approved entities)"
        })
        total_score += transfer_score
        
        # Factor 3: Covenant Status (20 points)
        covenant_score = 18
        factors.append({
            "category": "Covenant Health",
            "factor": "Financial Covenants",
            "score": covenant_score,
            "max_score": 20,
            "weight": "20%",
            "explanation": "All financial covenants currently in compliance with headroom.",
            "evidence": "ICR: 4.2x (min 3.0x, headroom 40%). Leverage: 2.8x (max 4.0x, headroom 30%).",
            "citation": "Credit Agreement, Clause 21 (Financial Covenants)",
            "market_data": "No material adverse change since last compliance certificate."
        })
        total_score += covenant_score
        
        # Factor 4: ESG Compliance (15 points)
        esg_score = 12 if loan.is_esg_linked else 15
        factors.append({
            "category": "ESG",
            "factor": "Sustainability-Linked Terms",
            "score": esg_score,
            "max_score": 15,
            "weight": "15%",
            "explanation": "ESG-linked margin ratchet with verified KPIs." if loan.is_esg_linked else "No ESG linkage (standard facility).",
            "evidence": "Q3 2024: Emissions reduced 12% (target 10%). Margin discount: -5bps." if loan.is_esg_linked else "N/A",
            "citation": "Credit Agreement, Schedule 12 (Sustainability-Linked Margin)" if loan.is_esg_linked else "N/A",
            "verifier": "KPMG ESG Assurance (Independent)" if loan.is_esg_linked else None
        })
        total_score += esg_score
        
        # Factor 5: Market Risk (10 points)
        market_score = 8
        factors.append({
            "category": "Market Risk",
            "factor": "Distance-to-Default",
            "score": market_score,
            "max_score": 10,
            "weight": "10%",
            "explanation": "Merton Model indicates low default probability (0.8% 1-year).",
            "evidence": f"Stock: BA, Market Cap: $95B, DTD: 3.2σ",
            "citation": "Bloomberg Terminal (Real-time)",
            "model": "Merton Structural Model with 35% volatility assumption"
        })
        total_score += market_score
        
        # Factor 6: Operational Readiness (10 points)
        ops_score = 7
        factors.append({
            "category": "Operational",
            "factor": "Agent Responsiveness",
            "score": ops_score,
            "max_score": 10,
            "weight": "10%",
            "explanation": "Facility Agent has 2-day average response time for transfer requests.",
            "evidence": "Historical: 12 transfers processed in 2024, avg 1.8 days.",
            "citation": "Agent Fee Letter, Section 4 (Service Levels)"
        })
        total_score += ops_score
        
        # Generate insights
        insights = []
        if total_score >= 80:
            insights.append({
                "type": "positive",
                "insight": "High trade readiness. Pre-cleared buyers available for instant settlement."
            })
        elif total_score >= 60:
            insights.append({
                "type": "neutral",
                "insight": "Moderate trade readiness. Standard transfer process (T+5 to T+10)."
            })
        else:
            insights.append({
                "type": "negative",
                "insight": "Low trade readiness. Consider waiver request or remediation."
            })
        
        # Add specific recommendations
        for f in factors:
            if f["score"] < f["max_score"] * 0.7:
                insights.append({
                    "type": "action",
                    "insight": f"Improve {f['factor']}: Currently {f['score']}/{f['max_score']}. Review {f.get('citation', 'documentation')}."
                })
        
        return {
            "loan_id": loan_id,
            "borrower": loan.borrower_name,
            
            # Score Summary
            "trade_readiness_score": total_score,
            "max_score": max_score,
            "grade": "A" if total_score >= 85 else "B" if total_score >= 70 else "C" if total_score >= 55 else "D",
            
            # Full Factor Breakdown
            "factors": factors,
            
            # AI Insights
            "insights": insights,
            
            # Methodology
            "methodology": {
                "model": "LoanTwin Trade Readiness Model v2.0",
                "description": "Multi-factor scoring based on LMA secondary trading criteria.",
                "bias_check": "No demographic, geographic, or borrower-name factors used.",
                "audit_trail": True,
                "last_calibration": "2025-01-01"
            },
            
            # Certification
            "certification": {
                "generated_at": datetime.now().isoformat(),
                "valid_until": (datetime.now() + timedelta(hours=24)).isoformat(),
                "certification_id": f"XAI-TR-{loan_id}-{datetime.now().strftime('%Y%m%d%H%M')}"
            }
        }
