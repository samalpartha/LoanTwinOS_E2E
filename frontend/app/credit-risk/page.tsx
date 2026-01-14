'use client';

import { useState, useEffect } from 'react';
import { 
  getPortfolioRisk, 
  getPredictedDefaults, 
  getLoanApplications,
  assessLoan,
  batchAssess,
  trainRiskModel,
  loadDemoPortfolio,
  getRiskHealth
} from '../../lib/api';
import { 
  AlertTriangle, 
  TrendingUp, 
  DollarSign, 
  PieChart, 
  Zap, 
  RefreshCw,
  CheckCircle,
  XCircle,
  Brain,
  Target,
  Activity,
  Loader2
} from 'lucide-react';

interface PortfolioRisk {
  total_applications: number;
  assessed_applications: number;
  unassessed_applications: number;
  risk_distribution: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  status_distribution: Record<string, number>;
  grade_distribution: Record<string, number>;
  portfolio_metrics: {
    average_risk_score: number;
    average_default_probability: number;
    total_exposure: number;
    at_risk_exposure: number;
    at_risk_percentage: number;
  };
}

interface LoanApplication {
  id: number;
  loan_amount: number;
  grade: string;
  risk_score: number | null;
  default_probability: number | null;
  risk_explanation: string | null;
  status: string;
  annual_income: number;
  dti: number;
  interest_rate: number;
}

export default function CreditRiskPage() {
  // State
  const [portfolio, setPortfolio] = useState<PortfolioRisk | null>(null);
  const [applications, setApplications] = useState<LoanApplication[]>([]);
  const [highRisk, setHighRisk] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [healthStatus, setHealthStatus] = useState<any>(null);
  
  // Actions state
  const [assessing, setAssessing] = useState(false);
  const [training, setTraining] = useState(false);
  
  // New Assessment Form
  const [showAssessForm, setShowAssessForm] = useState(false);
  const [assessmentResult, setAssessmentResult] = useState<any>(null);
  const [formData, setFormData] = useState({
    loan_amount: 15000,
    term_months: 36,
    interest_rate: 12.5,
    grade: 'C',
    annual_income: 60000,
    dti: 25,
    home_ownership: 'RENT',
    employment_length: '5 years',
    purpose: 'debt_consolidation',
    delinq_2yrs: 0,
    pub_rec: 0
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [portfolioData, appsData, defaultsData, health] = await Promise.all([
        getPortfolioRisk(),
        getLoanApplications(50),
        getPredictedDefaults(50, 20),
        getRiskHealth()
      ]);
      
      setPortfolio(portfolioData);
      setApplications(appsData.applications || []);
      setHighRisk(defaultsData.applications || []);
      setHealthStatus(health);
    } catch (e) {
      console.error('Failed to load data:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleBatchAssess = async () => {
    setAssessing(true);
    try {
      const result = await batchAssess(100);
      const count = result.count || 0;
      window.dispatchEvent(new CustomEvent('loantwin-toast', { 
        detail: { message: `⚡ ${result.message || `Assessing ${count} applications...`}`, type: 'success' } 
      }));
      // Poll for completion if processing in background
      if (result.status === 'processing') {
        setTimeout(() => loadData(), 5000); // Refresh after 5s
      } else {
        loadData();
      }
    } catch (e: any) {
      window.dispatchEvent(new CustomEvent('loantwin-toast', { 
        detail: { message: e.message, type: 'error' } 
      }));
    } finally {
      setAssessing(false);
    }
  };

  const handleTrainModel = async () => {
    setTraining(true);
    try {
      const result = await trainRiskModel();
      const samples = result.metrics?.samples || result.samples || 0;
      const accuracy = result.metrics?.accuracy || result.accuracy || 0;
      window.dispatchEvent(new CustomEvent('loantwin-toast', { 
        detail: { message: `✅ ML Model trained on ${samples.toLocaleString()} samples with ${accuracy.toFixed(1)}% accuracy`, type: 'success' } 
      }));
      loadData();
    } catch (e: any) {
      window.dispatchEvent(new CustomEvent('loantwin-toast', { 
        detail: { message: e.message, type: 'error' } 
      }));
    } finally {
      setTraining(false);
    }
  };

  const handleAssessNew = async () => {
    setAssessing(true);
    try {
      const result = await assessLoan(formData);
      setAssessmentResult(result);
      window.dispatchEvent(new CustomEvent('loantwin-toast', { 
        detail: { message: `Assessment complete: ${result.recommendation}`, type: 'success' } 
      }));
      loadData();
    } catch (e: any) {
      window.dispatchEvent(new CustomEvent('loantwin-toast', { 
        detail: { message: e.message, type: 'error' } 
      }));
    } finally {
      setAssessing(false);
    }
  };

  const handleLoadDemo = async () => {
    try {
      await loadDemoPortfolio(500);
      window.dispatchEvent(new CustomEvent('loantwin-toast', { 
        detail: { message: 'Demo portfolio loaded', type: 'success' } 
      }));
      loadData();
    } catch (e: any) {
      window.dispatchEvent(new CustomEvent('loantwin-toast', { 
        detail: { message: e.message, type: 'error' } 
      }));
    }
  };

  const getRiskColor = (score: number | null) => {
    if (score === null) return 'var(--text-muted)';
    if (score < 30) return 'var(--accent-success)';
    if (score < 50) return 'var(--accent-warning)';
    if (score < 70) return 'var(--accent-warning)';
    return 'var(--accent-danger)';
  };

  const getRiskLabel = (score: number | null) => {
    if (score === null) return 'Pending';
    if (score < 30) return 'Low';
    if (score < 50) return 'Medium';
    if (score < 70) return 'High';
    return 'Critical';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: 400 }}>
        <div className="text-center">
          <Loader2 size={48} className="animate-spin mx-auto mb-md" style={{ color: 'var(--accent-primary)' }} />
          <p>Loading risk analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-lg">
      {/* Header */}
      <div className="flex justify-between items-center flex-mobile-wrap gap-md">
        <div>
          <h1 className="h1 flex items-center gap-md">
            <AlertTriangle size={32} style={{ color: 'var(--accent-danger)' }} />
            Credit Risk Dashboard
          </h1>
          <p className="body opacity-70">ML-powered default prediction with Groq AI explanations</p>
        </div>
        <div className="flex gap-sm flex-wrap">
          <button className="btn" onClick={loadData}>
            <RefreshCw size={16} /> Refresh
          </button>
          <button 
            className="btn" 
            onClick={handleBatchAssess}
            disabled={assessing || (portfolio?.unassessed_applications || 0) === 0}
          >
            {assessing ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
            Assess All ({portfolio?.unassessed_applications || 0})
          </button>
          <button 
            className="btn"
            onClick={handleTrainModel}
            disabled={training}
          >
            {training ? <Loader2 size={16} className="animate-spin" /> : <Brain size={16} />}
            Train Model
          </button>
          <button className="btn primary" onClick={() => setShowAssessForm(!showAssessForm)}>
            <Target size={16} /> New Assessment
          </button>
        </div>
      </div>

      {/* Model Health Status */}
      {healthStatus && (
        <div className="card-inner flex items-center gap-md flex-wrap">
          <div className="flex items-center gap-sm">
            {healthStatus.model_loaded ? (
              <CheckCircle size={16} style={{ color: 'var(--accent-success)' }} />
            ) : (
              <XCircle size={16} style={{ color: 'var(--accent-danger)' }} />
            )}
            <span className="small">ML Model: {healthStatus.model_loaded ? 'Loaded' : 'Not Trained'}</span>
          </div>
          <div className="flex items-center gap-sm">
            {healthStatus.groq_available ? (
              <CheckCircle size={16} style={{ color: 'var(--accent-success)' }} />
            ) : (
              <XCircle size={16} style={{ color: 'var(--accent-warning)' }} />
            )}
            <span className="small">Groq AI: {healthStatus.groq_available ? 'Connected' : 'Unavailable'}</span>
          </div>
          {!portfolio?.total_applications && (
            <button className="btn small ml-auto" onClick={handleLoadDemo}>
              Load Demo Data
            </button>
          )}
        </div>
      )}

      {/* KPI Cards */}
      {portfolio && portfolio.total_applications > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-md">
          <div className="card">
            <div className="flex items-center gap-sm mb-sm">
              <PieChart size={20} style={{ color: 'var(--accent-primary)' }} />
              <span className="small opacity-70">Total Applications</span>
            </div>
            <div className="h1" style={{ color: 'var(--accent-primary)' }}>
              {portfolio.total_applications.toLocaleString()}
            </div>
            <div className="small opacity-50">
              {portfolio.assessed_applications} assessed
            </div>
          </div>
          
          <div className="card">
            <div className="flex items-center gap-sm mb-sm">
              <Activity size={20} style={{ color: 'var(--accent-warning)' }} />
              <span className="small opacity-70">Avg Risk Score</span>
            </div>
            <div className="h1" style={{ color: getRiskColor(portfolio.portfolio_metrics.average_risk_score) }}>
              {portfolio.portfolio_metrics.average_risk_score.toFixed(1)}
            </div>
            <div className="small opacity-50">
              {getRiskLabel(portfolio.portfolio_metrics.average_risk_score)} risk
            </div>
          </div>
          
          <div className="card">
            <div className="flex items-center gap-sm mb-sm">
              <TrendingUp size={20} style={{ color: 'var(--accent-danger)' }} />
              <span className="small opacity-70">Default Probability</span>
            </div>
            <div className="h1" style={{ color: 'var(--accent-danger)' }}>
              {portfolio.portfolio_metrics.average_default_probability.toFixed(1)}%
            </div>
            <div className="small opacity-50">
              Portfolio average
            </div>
          </div>
          
          <div className="card">
            <div className="flex items-center gap-sm mb-sm">
              <DollarSign size={20} style={{ color: 'var(--accent-success)' }} />
              <span className="small opacity-70">At Risk Exposure</span>
            </div>
            <div className="h1">
              ${(portfolio.portfolio_metrics.at_risk_exposure / 1000000).toFixed(2)}M
            </div>
            <div className="small opacity-50">
              {portfolio.portfolio_metrics.at_risk_percentage.toFixed(1)}% of total
            </div>
          </div>
        </div>
      )}

      {/* New Assessment Form */}
      {showAssessForm && (
        <div className="card">
          <h3 className="h3 mb-md">Assess New Loan Application</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-md mb-lg">
            <div>
              <label className="small font-bold block mb-xs">Loan Amount ($)</label>
              <input 
                type="number" 
                className="input w-full"
                value={formData.loan_amount}
                onChange={(e) => setFormData({...formData, loan_amount: Number(e.target.value)})}
              />
            </div>
            <div>
              <label className="small font-bold block mb-xs">Term (months)</label>
              <select 
                className="input w-full"
                value={formData.term_months}
                onChange={(e) => setFormData({...formData, term_months: Number(e.target.value)})}
              >
                <option value={36}>36 months</option>
                <option value={60}>60 months</option>
              </select>
            </div>
            <div>
              <label className="small font-bold block mb-xs">Interest Rate (%)</label>
              <input 
                type="number" 
                step="0.1"
                className="input w-full"
                value={formData.interest_rate}
                onChange={(e) => setFormData({...formData, interest_rate: Number(e.target.value)})}
              />
            </div>
            <div>
              <label className="small font-bold block mb-xs">Grade</label>
              <select 
                className="input w-full"
                value={formData.grade}
                onChange={(e) => setFormData({...formData, grade: e.target.value})}
              >
                {['A', 'B', 'C', 'D', 'E', 'F', 'G'].map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="small font-bold block mb-xs">Annual Income ($)</label>
              <input 
                type="number" 
                className="input w-full"
                value={formData.annual_income}
                onChange={(e) => setFormData({...formData, annual_income: Number(e.target.value)})}
              />
            </div>
            <div>
              <label className="small font-bold block mb-xs">DTI (%)</label>
              <input 
                type="number" 
                step="0.1"
                className="input w-full"
                value={formData.dti}
                onChange={(e) => setFormData({...formData, dti: Number(e.target.value)})}
              />
            </div>
            <div>
              <label className="small font-bold block mb-xs">Home Ownership</label>
              <select 
                className="input w-full"
                value={formData.home_ownership}
                onChange={(e) => setFormData({...formData, home_ownership: e.target.value})}
              >
                <option value="RENT">Rent</option>
                <option value="MORTGAGE">Mortgage</option>
                <option value="OWN">Own</option>
              </select>
            </div>
            <div>
              <label className="small font-bold block mb-xs">Purpose</label>
              <select 
                className="input w-full"
                value={formData.purpose}
                onChange={(e) => setFormData({...formData, purpose: e.target.value})}
              >
                <option value="debt_consolidation">Debt Consolidation</option>
                <option value="credit_card">Credit Card</option>
                <option value="home_improvement">Home Improvement</option>
                <option value="major_purchase">Major Purchase</option>
                <option value="small_business">Small Business</option>
                <option value="car">Car</option>
                <option value="medical">Medical</option>
              </select>
            </div>
          </div>
          
          <div className="flex gap-md">
            <button 
              className="btn primary"
              onClick={handleAssessNew}
              disabled={assessing}
            >
              {assessing ? <Loader2 size={16} className="animate-spin" /> : <Target size={16} />}
              Run Assessment
            </button>
            <button className="btn" onClick={() => setShowAssessForm(false)}>Cancel</button>
          </div>
          
          {/* Assessment Result */}
          {assessmentResult && (
            <div className="mt-lg p-md" style={{ 
              background: 'var(--bg-elevated)', 
              borderRadius: 'var(--radius-md)',
              borderLeft: `4px solid ${getRiskColor(assessmentResult.risk_score)}`
            }}>
              <div className="flex items-center justify-between mb-md">
                <h4 className="h3">Assessment Result</h4>
                <span className={`tag ${
                  assessmentResult.recommendation === 'APPROVE' ? 'success' :
                  assessmentResult.recommendation === 'DECLINE' ? 'danger' : 'warning'
                }`}>
                  {assessmentResult.recommendation}
                </span>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-md mb-md">
                <div>
                  <span className="small opacity-70">Risk Score</span>
                  <div className="h2" style={{ color: getRiskColor(assessmentResult.risk_score) }}>
                    {assessmentResult.risk_score}
                  </div>
                </div>
                <div>
                  <span className="small opacity-70">Default Probability</span>
                  <div className="h2">{(assessmentResult.default_probability * 100).toFixed(1)}%</div>
                </div>
                <div>
                  <span className="small opacity-70">Risk Level</span>
                  <div className="h2">{getRiskLabel(assessmentResult.risk_score)}</div>
                </div>
                <div>
                  <span className="small opacity-70">Application ID</span>
                  <div className="h2">#{assessmentResult.application_id}</div>
                </div>
              </div>
              
              {assessmentResult.risk_factors?.length > 0 && (
                <div className="mb-md">
                  <span className="small font-bold">Risk Factors</span>
                  <div className="flex gap-sm flex-wrap mt-sm">
                    {assessmentResult.risk_factors.map((f: any, idx: number) => (
                      <span key={idx} className={`tag ${f.impact === 'high' ? 'danger' : f.impact === 'medium' ? 'warning' : ''}`}>
                        {f.factor}: {f.value}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              {assessmentResult.explanation && (
                <div className="p-md" style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-sm)' }}>
                  <span className="small font-bold block mb-sm">AI Explanation (Groq)</span>
                  <p className="body">{assessmentResult.explanation}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Risk Distribution */}
      {portfolio && portfolio.risk_distribution && (
        <div className="card">
          <h3 className="h3 mb-md">Risk Distribution</h3>
          <div className="grid grid-cols-4 gap-md">
            <div className="text-center p-md" style={{ background: 'var(--accent-success-dim)', borderRadius: 'var(--radius-md)' }}>
              <div className="h1" style={{ color: 'var(--accent-success)' }}>{portfolio.risk_distribution.low}</div>
              <div className="small">Low Risk (&lt;30)</div>
            </div>
            <div className="text-center p-md" style={{ background: 'rgba(255,193,7,0.1)', borderRadius: 'var(--radius-md)' }}>
              <div className="h1" style={{ color: '#ffc107' }}>{portfolio.risk_distribution.medium}</div>
              <div className="small">Medium (30-50)</div>
            </div>
            <div className="text-center p-md" style={{ background: 'var(--accent-warning-dim)', borderRadius: 'var(--radius-md)' }}>
              <div className="h1" style={{ color: 'var(--accent-warning)' }}>{portfolio.risk_distribution.high}</div>
              <div className="small">High (50-70)</div>
            </div>
            <div className="text-center p-md" style={{ background: 'var(--accent-danger-dim)', borderRadius: 'var(--radius-md)' }}>
              <div className="h1" style={{ color: 'var(--accent-danger)' }}>{portfolio.risk_distribution.critical}</div>
              <div className="small">Critical (&gt;70)</div>
            </div>
          </div>
        </div>
      )}

      {/* High Risk Applications */}
      {highRisk.length > 0 && (
        <div className="card">
          <div className="flex justify-between items-center mb-md">
            <h3 className="h3">High Risk Applications</h3>
            <span className="tag danger">{highRisk.length} flagged</span>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-default)' }}>
                  <th className="text-left p-sm">ID</th>
                  <th className="text-left p-sm">Amount</th>
                  <th className="text-left p-sm">Grade</th>
                  <th className="text-left p-sm">Risk Score</th>
                  <th className="text-left p-sm">Default Prob</th>
                  <th className="text-left p-sm">Status</th>
                  <th className="text-left p-sm">AI Explanation</th>
                </tr>
              </thead>
              <tbody>
                {highRisk.map((app) => (
                  <tr key={app.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td className="p-sm">#{app.id}</td>
                    <td className="p-sm">${app.loan_amount.toLocaleString()}</td>
                    <td className="p-sm">
                      <span className="tag">{app.grade}</span>
                    </td>
                    <td className="p-sm">
                      <span style={{ color: getRiskColor(app.risk_score), fontWeight: 600 }}>
                        {app.risk_score?.toFixed(1) || '-'}
                      </span>
                    </td>
                    <td className="p-sm">{app.default_probability ? `${(app.default_probability * 100).toFixed(1)}%` : '-'}</td>
                    <td className="p-sm">
                      <span className={`tag ${app.status === 'defaulted' ? 'danger' : app.status === 'paid_off' ? 'success' : ''}`}>
                        {app.status}
                      </span>
                    </td>
                    <td className="p-sm small opacity-70" style={{ maxWidth: 300 }}>
                      {app.explanation?.slice(0, 100)}...
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent Applications */}
      {applications.length > 0 && (
        <div className="card">
          <h3 className="h3 mb-md">Recent Applications</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-default)' }}>
                  <th className="text-left p-sm">ID</th>
                  <th className="text-left p-sm">Amount</th>
                  <th className="text-left p-sm">Grade</th>
                  <th className="text-left p-sm">Income</th>
                  <th className="text-left p-sm">DTI</th>
                  <th className="text-left p-sm">Rate</th>
                  <th className="text-left p-sm">Risk</th>
                  <th className="text-left p-sm">Status</th>
                </tr>
              </thead>
              <tbody>
                {applications.slice(0, 20).map((app) => (
                  <tr key={app.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td className="p-sm">#{app.id}</td>
                    <td className="p-sm">${app.loan_amount.toLocaleString()}</td>
                    <td className="p-sm"><span className="tag">{app.grade}</span></td>
                    <td className="p-sm">${app.annual_income?.toLocaleString()}</td>
                    <td className="p-sm">{app.dti?.toFixed(1)}%</td>
                    <td className="p-sm">{app.interest_rate?.toFixed(2)}%</td>
                    <td className="p-sm">
                      {app.risk_score !== null ? (
                        <span style={{ color: getRiskColor(app.risk_score), fontWeight: 600 }}>
                          {app.risk_score.toFixed(1)}
                        </span>
                      ) : (
                        <span className="opacity-50">-</span>
                      )}
                    </td>
                    <td className="p-sm">
                      <span className={`tag ${
                        app.status === 'defaulted' ? 'danger' : 
                        app.status === 'paid_off' ? 'success' : 
                        app.status === 'funded' ? 'primary' : ''
                      }`}>
                        {app.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty State */}
      {(!portfolio || portfolio.total_applications === 0) && !loading && (
        <div className="card text-center py-xl">
          <AlertTriangle size={64} className="mx-auto mb-md opacity-30" />
          <h3 className="h3 mb-sm">No Applications Yet</h3>
          <p className="body opacity-70 mb-lg">Import loan data or load demo portfolio to get started</p>
          <div className="flex gap-md justify-center">
            <a href="/import" className="btn primary">Import Data</a>
            <button className="btn" onClick={handleLoadDemo}>Load Demo Portfolio</button>
          </div>
        </div>
      )}
    </div>
  );
}
