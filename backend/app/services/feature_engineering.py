"""
Feature Engineering Service - Statistical Preprocessing Pipeline
Implements Chi-Square (categorical) and ANOVA (continuous) validated features
Based on: https://www.kaggle.com/code/ying2sun/loan-prediction-eda-x-2-anova-test-rf-97
"""
from typing import Dict, List, Any, Optional, Tuple
from datetime import datetime
import os
import json

# Try to import statistical libraries
try:
    import numpy as np
    from scipy import stats
    STATS_AVAILABLE = True
except ImportError:
    STATS_AVAILABLE = False

try:
    import pandas as pd
    PANDAS_AVAILABLE = True
except ImportError:
    PANDAS_AVAILABLE = False


class FeatureEngineer:
    """
    Statistical feature preprocessing and validation.
    Implements Chi-Square tests for categorical features and ANOVA for continuous.
    """
    
    # Feature categories
    CATEGORICAL_FEATURES = [
        'grade', 'home_ownership', 'purpose', 'employment_length',
        'verification_status', 'loan_status'
    ]
    
    CONTINUOUS_FEATURES = [
        'loan_amount', 'interest_rate', 'annual_income', 'dti',
        'delinq_2yrs', 'inq_last_6mths', 'open_acc', 'pub_rec',
        'revol_bal', 'revol_util', 'total_acc', 'cibil_score'
    ]
    
    ENGINEERED_FEATURES = [
        'income_to_loan_ratio', 'assets_to_loan_ratio',
        'employment_years', 'term_risk_weight', 'dti_risk_bucket'
    ]
    
    def __init__(self):
        self.chi_square_results = {}
        self.anova_results = {}
        self.feature_stats = {}
    
    def normalize_cibil_score(self, score: float) -> float:
        """
        Normalize CIBIL score to 0-1 range.
        CIBIL range: 300-900 (India) or 300-850 (US FICO-like)
        """
        if score is None:
            return 0.5  # Default to middle
        
        min_score = 300
        max_score = 900
        
        # Clamp to valid range
        score = max(min_score, min(max_score, score))
        
        # Normalize to 0-1
        normalized = (score - min_score) / (max_score - min_score)
        
        return round(normalized, 4)
    
    def calculate_income_to_loan_ratio(self, annual_income: float, loan_amount: float) -> float:
        """
        Calculate income-to-loan ratio.
        Higher ratio = lower risk (more income relative to loan)
        """
        if loan_amount <= 0:
            return 10.0  # Max ratio if no loan
        
        ratio = annual_income / loan_amount
        
        # Cap at reasonable bounds
        return round(min(10.0, max(0.01, ratio)), 4)
    
    def calculate_assets_coverage(self, assets_value: float, loan_amount: float) -> float:
        """
        Calculate assets-to-loan coverage ratio.
        Higher ratio = better collateral coverage
        """
        if loan_amount <= 0:
            return 10.0
        
        ratio = assets_value / loan_amount
        
        return round(min(10.0, max(0.0, ratio)), 4)
    
    def calculate_employment_stability_index(self, employment_length: str) -> float:
        """
        Convert employment length to stability index (0-1).
        Longer employment = higher stability
        """
        emp_str = str(employment_length or '').lower()
        
        # Parse employment length
        if '10+' in emp_str or '10 +' in emp_str:
            years = 12
        elif '<' in emp_str or '< 1' in emp_str:
            years = 0.5
        else:
            import re
            numbers = re.findall(r'\d+', emp_str)
            years = float(numbers[0]) if numbers else 5
        
        # Normalize: 10+ years = 1.0, 0 years = 0.0
        index = min(1.0, years / 10.0)
        
        return round(index, 4)
    
    def calculate_term_risk_weight(self, term_months: int) -> float:
        """
        Calculate term-based risk weight.
        Longer terms have higher risk.
        Normalized to 36 months baseline.
        """
        baseline = 36
        
        if term_months <= 0:
            return 1.0
        
        weight = term_months / baseline
        
        return round(weight, 4)
    
    def calculate_dti_risk_bucket(self, dti: float) -> int:
        """
        Categorize DTI into risk buckets.
        0: Low (<10%), 1: Normal (10-20%), 2: Elevated (20-35%), 3: High (35%+)
        """
        if dti is None:
            return 1  # Default to normal
        
        if dti < 10:
            return 0  # Low risk
        elif dti < 20:
            return 1  # Normal
        elif dti < 35:
            return 2  # Elevated
        else:
            return 3  # High risk
    
    def chi_square_test(self, feature_values: List[Any], target_values: List[int]) -> Dict[str, Any]:
        """
        Perform Chi-Square test for independence between categorical feature and target.
        Used to validate categorical feature relevance.
        """
        if not STATS_AVAILABLE or not PANDAS_AVAILABLE:
            return {"error": "scipy/pandas not available"}
        
        if len(feature_values) != len(target_values):
            return {"error": "Feature and target length mismatch"}
        
        try:
            # Create contingency table
            df = pd.DataFrame({
                'feature': feature_values,
                'target': target_values
            })
            
            contingency_table = pd.crosstab(df['feature'], df['target'])
            
            # Perform Chi-Square test
            chi2, p_value, dof, expected = stats.chi2_contingency(contingency_table)
            
            return {
                "chi2_statistic": round(chi2, 4),
                "p_value": round(p_value, 6),
                "degrees_of_freedom": dof,
                "significant": p_value < 0.05,
                "conclusion": "Feature is significant" if p_value < 0.05 else "Feature may not be significant"
            }
            
        except Exception as e:
            return {"error": str(e)}
    
    def anova_test(self, feature_values: List[float], target_values: List[int]) -> Dict[str, Any]:
        """
        Perform ANOVA test to validate continuous feature relevance.
        Compares feature means across target classes.
        """
        if not STATS_AVAILABLE:
            return {"error": "scipy not available"}
        
        if len(feature_values) != len(target_values):
            return {"error": "Feature and target length mismatch"}
        
        try:
            # Group feature values by target class
            groups = {}
            for feat, target in zip(feature_values, target_values):
                if target not in groups:
                    groups[target] = []
                groups[target].append(feat)
            
            # Perform one-way ANOVA
            if len(groups) < 2:
                return {"error": "Need at least 2 groups for ANOVA"}
            
            group_values = list(groups.values())
            f_stat, p_value = stats.f_oneway(*group_values)
            
            return {
                "f_statistic": round(f_stat, 4),
                "p_value": round(p_value, 6),
                "significant": p_value < 0.05,
                "group_means": {k: round(np.mean(v), 4) for k, v in groups.items()},
                "conclusion": "Feature is significant" if p_value < 0.05 else "Feature may not be significant"
            }
            
        except Exception as e:
            return {"error": str(e)}
    
    def validate_features(self, loans: List[Any]) -> Dict[str, Any]:
        """
        Validate all features using appropriate statistical tests.
        Returns significance of each feature for loan default prediction.
        """
        if not STATS_AVAILABLE:
            return {"error": "Statistical libraries not available"}
        
        if len(loans) < 30:
            return {"error": "Need at least 30 loans for statistical validation"}
        
        results = {
            "categorical_tests": {},
            "continuous_tests": {},
            "significant_features": [],
            "non_significant_features": []
        }
        
        # Extract target (default vs non-default)
        targets = []
        for loan in loans:
            is_default = loan.status in ["defaulted", "charged_off"]
            targets.append(1 if is_default else 0)
        
        # Test categorical features with Chi-Square
        for feature in ['grade', 'home_ownership']:
            try:
                values = [getattr(loan, feature, 'Unknown') for loan in loans]
                chi_result = self.chi_square_test(values, targets)
                results["categorical_tests"][feature] = chi_result
                
                if chi_result.get("significant", False):
                    results["significant_features"].append(feature)
                else:
                    results["non_significant_features"].append(feature)
            except:
                pass
        
        # Test continuous features with ANOVA
        for feature in ['loan_amount', 'interest_rate', 'annual_income', 'dti']:
            try:
                values = [float(getattr(loan, feature, 0) or 0) for loan in loans]
                anova_result = self.anova_test(values, targets)
                results["continuous_tests"][feature] = anova_result
                
                if anova_result.get("significant", False):
                    results["significant_features"].append(feature)
                else:
                    results["non_significant_features"].append(feature)
            except:
                pass
        
        self.chi_square_results = results["categorical_tests"]
        self.anova_results = results["continuous_tests"]
        
        return results
    
    def engineer_features(self, loan: Any) -> Dict[str, float]:
        """
        Apply all feature engineering transformations to a loan.
        Returns dictionary of engineered feature values.
        """
        loan_amount = float(getattr(loan, 'loan_amount', 10000) or 10000)
        annual_income = float(getattr(loan, 'annual_income', 50000) or 50000)
        assets_value = float(getattr(loan, 'assets_value', annual_income * 2) or annual_income * 2)
        term_months = int(getattr(loan, 'term_months', 36) or 36)
        dti = float(getattr(loan, 'dti', 20) or 20)
        cibil_score = float(getattr(loan, 'cibil_score', 700) or 700)
        employment_length = str(getattr(loan, 'employment_length', '5 years') or '5 years')
        
        return {
            "cibil_normalized": self.normalize_cibil_score(cibil_score),
            "income_to_loan_ratio": self.calculate_income_to_loan_ratio(annual_income, loan_amount),
            "assets_to_loan_ratio": self.calculate_assets_coverage(assets_value, loan_amount),
            "employment_stability_index": self.calculate_employment_stability_index(employment_length),
            "term_risk_weight": self.calculate_term_risk_weight(term_months),
            "dti_risk_bucket": self.calculate_dti_risk_bucket(dti)
        }
    
    def get_feature_statistics(self, loans: List[Any]) -> Dict[str, Any]:
        """
        Calculate descriptive statistics for all features across loan portfolio.
        """
        if not STATS_AVAILABLE:
            return {"error": "numpy not available"}
        
        stats_results = {}
        
        # Continuous features
        for feature in self.CONTINUOUS_FEATURES:
            try:
                values = [float(getattr(loan, feature, 0) or 0) for loan in loans]
                values = [v for v in values if v is not None]
                
                if values:
                    stats_results[feature] = {
                        "count": len(values),
                        "mean": round(np.mean(values), 2),
                        "std": round(np.std(values), 2),
                        "min": round(np.min(values), 2),
                        "max": round(np.max(values), 2),
                        "median": round(np.median(values), 2),
                        "q25": round(np.percentile(values, 25), 2),
                        "q75": round(np.percentile(values, 75), 2)
                    }
            except:
                pass
        
        # Categorical features - count distribution
        for feature in ['grade', 'home_ownership']:
            try:
                values = [str(getattr(loan, feature, 'Unknown') or 'Unknown') for loan in loans]
                value_counts = {}
                for v in values:
                    value_counts[v] = value_counts.get(v, 0) + 1
                
                stats_results[feature] = {
                    "type": "categorical",
                    "distribution": value_counts,
                    "mode": max(value_counts, key=value_counts.get) if value_counts else None
                }
            except:
                pass
        
        self.feature_stats = stats_results
        return stats_results
    
    def detect_outliers(self, loans: List[Any], feature: str, method: str = "iqr") -> Dict[str, Any]:
        """
        Detect outliers in a specific feature using IQR or Z-score method.
        """
        if not STATS_AVAILABLE:
            return {"error": "numpy not available"}
        
        try:
            values = [float(getattr(loan, feature, 0) or 0) for loan in loans]
            values = np.array([v for v in values if v is not None])
            
            if method == "iqr":
                # IQR method
                q1 = np.percentile(values, 25)
                q3 = np.percentile(values, 75)
                iqr = q3 - q1
                lower_bound = q1 - 1.5 * iqr
                upper_bound = q3 + 1.5 * iqr
                
                outliers = values[(values < lower_bound) | (values > upper_bound)]
                
                return {
                    "method": "IQR",
                    "q1": round(q1, 2),
                    "q3": round(q3, 2),
                    "iqr": round(iqr, 2),
                    "lower_bound": round(lower_bound, 2),
                    "upper_bound": round(upper_bound, 2),
                    "outlier_count": len(outliers),
                    "outlier_percentage": round(len(outliers) / len(values) * 100, 2)
                }
                
            elif method == "zscore":
                # Z-score method
                mean = np.mean(values)
                std = np.std(values)
                z_scores = np.abs((values - mean) / std)
                
                outliers = values[z_scores > 3]
                
                return {
                    "method": "Z-Score",
                    "mean": round(mean, 2),
                    "std": round(std, 2),
                    "threshold": 3,
                    "outlier_count": len(outliers),
                    "outlier_percentage": round(len(outliers) / len(values) * 100, 2)
                }
            
            return {"error": f"Unknown method: {method}"}
            
        except Exception as e:
            return {"error": str(e)}
    
    def create_feature_report(self, loans: List[Any]) -> Dict[str, Any]:
        """
        Generate comprehensive feature engineering report.
        """
        report = {
            "timestamp": datetime.utcnow().isoformat(),
            "total_loans": len(loans),
            "statistics": self.get_feature_statistics(loans),
            "validation": self.validate_features(loans),
            "recommendations": []
        }
        
        # Generate recommendations based on validation
        validation = report["validation"]
        
        if isinstance(validation, dict) and "significant_features" in validation:
            sig_features = validation["significant_features"]
            non_sig = validation.get("non_significant_features", [])
            
            if sig_features:
                report["recommendations"].append({
                    "type": "include",
                    "features": sig_features,
                    "reason": "Statistically significant (p < 0.05) for default prediction"
                })
            
            if non_sig:
                report["recommendations"].append({
                    "type": "review",
                    "features": non_sig,
                    "reason": "Not statistically significant - consider removal or re-engineering"
                })
        
        return report


# Singleton instance
_engineer = None

def get_feature_engineer() -> FeatureEngineer:
    """Get or create the feature engineer instance."""
    global _engineer
    if _engineer is None:
        _engineer = FeatureEngineer()
    return _engineer
