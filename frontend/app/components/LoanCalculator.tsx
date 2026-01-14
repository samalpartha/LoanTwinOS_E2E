'use client';
import { useState, useMemo } from 'react';
import { 
  Calculator, DollarSign, Percent, Calendar, TrendingUp,
  CheckCircle, AlertTriangle, XCircle, Info, Sparkles,
  Building2, User, Briefcase, CreditCard, PiggyBank
} from 'lucide-react';

interface LoanParams {
  loanAmount: number;
  interestRate: number;
  loanTermMonths: number;
  annualIncome: number;
  monthlyExpenses: number;
  creditScore: number;
  employmentYears: number;
  existingDebt: number;
}

interface EligibilityResult {
  eligible: boolean;
  maxLoanAmount: number;
  monthlyPayment: number;
  totalInterest: number;
  totalPayment: number;
  dti: number;
  score: number;
  factors: { name: string; status: 'pass' | 'warning' | 'fail'; detail: string }[];
}

const COLORS = {
  primary: '#00F5D4',
  secondary: '#00BBF9',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
};

export default function LoanCalculator() {
  const [params, setParams] = useState<LoanParams>({
    loanAmount: 500000,
    interestRate: 6.5,
    loanTermMonths: 60,
    annualIncome: 150000,
    monthlyExpenses: 3500,
    creditScore: 720,
    employmentYears: 5,
    existingDebt: 15000
  });

  const [showAdvanced, setShowAdvanced] = useState(false);

  const result = useMemo((): EligibilityResult => {
    const { loanAmount, interestRate, loanTermMonths, annualIncome, monthlyExpenses, creditScore, employmentYears, existingDebt } = params;
    
    // Monthly interest rate
    const monthlyRate = interestRate / 100 / 12;
    
    // Monthly payment (PMT formula)
    const monthlyPayment = monthlyRate > 0
      ? (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, loanTermMonths)) / 
        (Math.pow(1 + monthlyRate, loanTermMonths) - 1)
      : loanAmount / loanTermMonths;
    
    // Total payment and interest
    const totalPayment = monthlyPayment * loanTermMonths;
    const totalInterest = totalPayment - loanAmount;
    
    // Monthly income
    const monthlyIncome = annualIncome / 12;
    
    // Debt-to-Income ratio
    const totalMonthlyDebt = monthlyPayment + monthlyExpenses + (existingDebt / 12);
    const dti = (totalMonthlyDebt / monthlyIncome) * 100;
    
    // Max loan based on 43% DTI rule
    const maxDTI = 0.43;
    const availableForDebt = (monthlyIncome * maxDTI) - monthlyExpenses - (existingDebt / 12);
    const maxLoanAmount = availableForDebt > 0 
      ? (availableForDebt * (Math.pow(1 + monthlyRate, loanTermMonths) - 1)) / 
        (monthlyRate * Math.pow(1 + monthlyRate, loanTermMonths))
      : 0;
    
    // Eligibility factors
    const factors: EligibilityResult['factors'] = [];
    let score = 0;
    
    // Credit Score Check
    if (creditScore >= 750) {
      factors.push({ name: 'Credit Score', status: 'pass', detail: `Excellent (${creditScore})` });
      score += 25;
    } else if (creditScore >= 670) {
      factors.push({ name: 'Credit Score', status: 'pass', detail: `Good (${creditScore})` });
      score += 20;
    } else if (creditScore >= 580) {
      factors.push({ name: 'Credit Score', status: 'warning', detail: `Fair (${creditScore}) - Higher rates may apply` });
      score += 10;
    } else {
      factors.push({ name: 'Credit Score', status: 'fail', detail: `Poor (${creditScore}) - Improvement needed` });
    }
    
    // DTI Check
    if (dti <= 36) {
      factors.push({ name: 'Debt-to-Income', status: 'pass', detail: `${dti.toFixed(1)}% - Healthy ratio` });
      score += 25;
    } else if (dti <= 43) {
      factors.push({ name: 'Debt-to-Income', status: 'warning', detail: `${dti.toFixed(1)}% - Acceptable but high` });
      score += 15;
    } else {
      factors.push({ name: 'Debt-to-Income', status: 'fail', detail: `${dti.toFixed(1)}% - Exceeds limit` });
    }
    
    // Employment Check
    if (employmentYears >= 2) {
      factors.push({ name: 'Employment History', status: 'pass', detail: `${employmentYears} years - Stable` });
      score += 25;
    } else if (employmentYears >= 1) {
      factors.push({ name: 'Employment History', status: 'warning', detail: `${employmentYears} year(s) - Short history` });
      score += 10;
    } else {
      factors.push({ name: 'Employment History', status: 'fail', detail: `Less than 1 year - Too short` });
    }
    
    // Loan Amount vs Income
    const loanToIncome = loanAmount / annualIncome;
    if (loanToIncome <= 3) {
      factors.push({ name: 'Loan-to-Income', status: 'pass', detail: `${loanToIncome.toFixed(1)}x income - Conservative` });
      score += 25;
    } else if (loanToIncome <= 5) {
      factors.push({ name: 'Loan-to-Income', status: 'warning', detail: `${loanToIncome.toFixed(1)}x income - Moderate` });
      score += 15;
    } else {
      factors.push({ name: 'Loan-to-Income', status: 'fail', detail: `${loanToIncome.toFixed(1)}x income - High risk` });
    }
    
    const eligible = score >= 60 && dti <= 43;
    
    return {
      eligible,
      maxLoanAmount: Math.max(0, maxLoanAmount),
      monthlyPayment,
      totalInterest,
      totalPayment,
      dti,
      score,
      factors
    };
  }, [params]);

  const handleChange = (field: keyof LoanParams, value: number) => {
    setParams(prev => ({ ...prev, [field]: value }));
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  return (
    <div className="space-y-lg">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="h2 gradient-text-cyan mb-xs flex items-center gap-sm">
            <Calculator size={28} /> Loan Eligibility Calculator
          </h2>
          <p className="body opacity-70">Estimate your loan eligibility and monthly payments</p>
        </div>
        <button 
          className="btn secondary"
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          {showAdvanced ? 'Simple View' : 'Advanced Options'}
        </button>
      </div>

      <div className="grid gap-lg" style={{ gridTemplateColumns: '1fr 1fr' }}>
        {/* Input Section */}
        <div className="space-y-md">
          {/* Basic Loan Details */}
          <div className="card">
            <h3 className="h3 mb-md flex items-center gap-sm">
              <DollarSign size={20} style={{ color: COLORS.primary }} />
              Loan Details
            </h3>
            
            <div className="space-y-md">
              <div>
                <div className="flex justify-between items-center mb-xs">
                  <label className="small opacity-70">Loan Amount</label>
                  <span className="font-mono font-semibold" style={{ color: COLORS.primary }}>
                    {formatCurrency(params.loanAmount)}
                  </span>
                </div>
                <input
                  type="range"
                  min="10000"
                  max="5000000"
                  step="10000"
                  value={params.loanAmount}
                  onChange={(e) => handleChange('loanAmount', Number(e.target.value))}
                  className="w-full"
                  style={{ accentColor: COLORS.primary }}
                />
                <div className="flex justify-between text-xs opacity-50 mt-xs">
                  <span>$10K</span>
                  <span>$5M</span>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-xs">
                  <label className="small opacity-70">Interest Rate (APR)</label>
                  <span className="font-mono font-semibold" style={{ color: COLORS.secondary }}>
                    {params.interestRate}%
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="20"
                  step="0.25"
                  value={params.interestRate}
                  onChange={(e) => handleChange('interestRate', Number(e.target.value))}
                  className="w-full"
                  style={{ accentColor: COLORS.secondary }}
                />
                <div className="flex justify-between text-xs opacity-50 mt-xs">
                  <span>1%</span>
                  <span>20%</span>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-xs">
                  <label className="small opacity-70">Loan Term</label>
                  <span className="font-mono font-semibold">
                    {params.loanTermMonths} months ({(params.loanTermMonths / 12).toFixed(1)} years)
                  </span>
                </div>
                <input
                  type="range"
                  min="12"
                  max="360"
                  step="12"
                  value={params.loanTermMonths}
                  onChange={(e) => handleChange('loanTermMonths', Number(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs opacity-50 mt-xs">
                  <span>1 year</span>
                  <span>30 years</span>
                </div>
              </div>
            </div>
          </div>

          {/* Financial Details */}
          <div className="card">
            <h3 className="h3 mb-md flex items-center gap-sm">
              <Briefcase size={20} style={{ color: COLORS.success }} />
              Financial Profile
            </h3>
            
            <div className="space-y-md">
              <div>
                <div className="flex justify-between items-center mb-xs">
                  <label className="small opacity-70">Annual Income</label>
                  <span className="font-mono font-semibold" style={{ color: COLORS.success }}>
                    {formatCurrency(params.annualIncome)}
                  </span>
                </div>
                <input
                  type="range"
                  min="30000"
                  max="1000000"
                  step="5000"
                  value={params.annualIncome}
                  onChange={(e) => handleChange('annualIncome', Number(e.target.value))}
                  className="w-full"
                  style={{ accentColor: COLORS.success }}
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-xs">
                  <label className="small opacity-70">Credit Score</label>
                  <span className="font-mono font-semibold" style={{ 
                    color: params.creditScore >= 750 ? COLORS.success : 
                           params.creditScore >= 670 ? COLORS.primary : 
                           params.creditScore >= 580 ? COLORS.warning : COLORS.danger 
                  }}>
                    {params.creditScore}
                  </span>
                </div>
                <input
                  type="range"
                  min="300"
                  max="850"
                  step="10"
                  value={params.creditScore}
                  onChange={(e) => handleChange('creditScore', Number(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs opacity-50 mt-xs">
                  <span>Poor (300)</span>
                  <span>Excellent (850)</span>
                </div>
              </div>

              {showAdvanced && (
                <>
                  <div>
                    <div className="flex justify-between items-center mb-xs">
                      <label className="small opacity-70">Monthly Expenses</label>
                      <span className="font-mono font-semibold">
                        {formatCurrency(params.monthlyExpenses)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="500"
                      max="20000"
                      step="100"
                      value={params.monthlyExpenses}
                      onChange={(e) => handleChange('monthlyExpenses', Number(e.target.value))}
                      className="w-full"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-xs">
                      <label className="small opacity-70">Employment Years</label>
                      <span className="font-mono font-semibold">
                        {params.employmentYears} years
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="30"
                      step="1"
                      value={params.employmentYears}
                      onChange={(e) => handleChange('employmentYears', Number(e.target.value))}
                      className="w-full"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-xs">
                      <label className="small opacity-70">Existing Debt</label>
                      <span className="font-mono font-semibold">
                        {formatCurrency(params.existingDebt)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="200000"
                      step="1000"
                      value={params.existingDebt}
                      onChange={(e) => handleChange('existingDebt', Number(e.target.value))}
                      className="w-full"
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Results Section */}
        <div className="space-y-md">
          {/* Eligibility Status */}
          <div 
            className="card"
            style={{ 
              background: result.eligible 
                ? `linear-gradient(135deg, var(--bg-card) 0%, ${COLORS.success}15 100%)`
                : `linear-gradient(135deg, var(--bg-card) 0%, ${COLORS.danger}15 100%)`,
              borderLeft: `4px solid ${result.eligible ? COLORS.success : COLORS.danger}`
            }}
          >
            <div className="flex items-center justify-between mb-md">
              <div className="flex items-center gap-md">
                {result.eligible ? (
                  <div style={{ background: `${COLORS.success}20`, padding: 12, borderRadius: 12 }}>
                    <CheckCircle size={28} style={{ color: COLORS.success }} />
                  </div>
                ) : (
                  <div style={{ background: `${COLORS.danger}20`, padding: 12, borderRadius: 12 }}>
                    <XCircle size={28} style={{ color: COLORS.danger }} />
                  </div>
                )}
                <div>
                  <h3 className="h3" style={{ color: result.eligible ? COLORS.success : COLORS.danger }}>
                    {result.eligible ? 'Likely Eligible' : 'May Need Adjustment'}
                  </h3>
                  <p className="small opacity-70">Based on provided information</p>
                </div>
              </div>
              <div className="text-right">
                <p className="h2 font-mono" style={{ color: result.eligible ? COLORS.success : COLORS.warning }}>
                  {result.score}%
                </p>
                <p className="small opacity-50">Score</p>
              </div>
            </div>

            {/* Eligibility Factors */}
            <div className="space-y-sm">
              {result.factors.map((factor, i) => (
                <div key={i} className="flex items-center justify-between p-sm rounded-lg" style={{ background: 'var(--bg-primary)' }}>
                  <div className="flex items-center gap-sm">
                    {factor.status === 'pass' && <CheckCircle size={16} style={{ color: COLORS.success }} />}
                    {factor.status === 'warning' && <AlertTriangle size={16} style={{ color: COLORS.warning }} />}
                    {factor.status === 'fail' && <XCircle size={16} style={{ color: COLORS.danger }} />}
                    <span className="font-medium">{factor.name}</span>
                  </div>
                  <span className="small opacity-70">{factor.detail}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Payment Summary */}
          <div className="card">
            <h3 className="h3 mb-md flex items-center gap-sm">
              <PiggyBank size={20} style={{ color: COLORS.secondary }} />
              Payment Summary
            </h3>
            
            <div className="grid grid-cols-2 gap-md">
              <div className="p-md rounded-lg" style={{ background: 'var(--bg-primary)' }}>
                <p className="small opacity-50 mb-xs">Monthly Payment</p>
                <p className="h2 font-mono" style={{ color: COLORS.primary }}>
                  {formatCurrency(result.monthlyPayment)}
                </p>
              </div>
              <div className="p-md rounded-lg" style={{ background: 'var(--bg-primary)' }}>
                <p className="small opacity-50 mb-xs">Total Interest</p>
                <p className="h2 font-mono" style={{ color: COLORS.warning }}>
                  {formatCurrency(result.totalInterest)}
                </p>
              </div>
            </div>
            
            <div className="mt-md p-md rounded-lg" style={{ background: 'var(--bg-primary)' }}>
              <div className="flex justify-between items-center">
                <span className="opacity-70">Total Payment</span>
                <span className="h3 font-mono">{formatCurrency(result.totalPayment)}</span>
              </div>
              <div className="flex justify-between items-center mt-sm">
                <span className="opacity-70">Debt-to-Income Ratio</span>
                <span className="font-mono" style={{ 
                  color: result.dti <= 36 ? COLORS.success : result.dti <= 43 ? COLORS.warning : COLORS.danger 
                }}>
                  {result.dti.toFixed(1)}%
                </span>
              </div>
              <div className="flex justify-between items-center mt-sm">
                <span className="opacity-70">Max Eligible Amount</span>
                <span className="font-mono" style={{ color: COLORS.success }}>
                  {formatCurrency(result.maxLoanAmount)}
                </span>
              </div>
            </div>
          </div>

          {/* AI Recommendation */}
          <div className="card" style={{ background: 'linear-gradient(135deg, var(--bg-card) 0%, var(--accent-primary-dim) 100%)' }}>
            <div className="flex items-center gap-sm mb-sm">
              <Sparkles size={20} style={{ color: COLORS.primary }} />
              <h3 className="h3">AI Recommendation</h3>
            </div>
            <p className="small opacity-80">
              {result.eligible ? (
                result.score >= 80 ? 
                  "Your financial profile is strong. You may qualify for competitive rates. Consider comparing offers from multiple lenders." :
                  "You appear eligible, but improving your credit score or reducing debt could help secure better terms."
              ) : (
                result.dti > 43 ?
                  "Your debt-to-income ratio is high. Consider paying down existing debt or reducing the loan amount." :
                  "Focus on improving your credit score and building a longer employment history before applying."
              )}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
