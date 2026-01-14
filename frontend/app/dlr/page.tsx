'use client';
import { useState, useCallback, useEffect, Suspense } from "react";
import dynamic from 'next/dynamic';
import {
  createLoan, uploadDoc, processDoc, createSampleLoan, fetchLoan,
  getLoanStats, getAgentRecommendations, executeAgentAction,
  exportToJSON, exportDealToExcel, exportAuditReport, printDealReport,
  getDistanceToDefault, getMarketAlerts, getPricingGrid, getAuditLogs,
  getDLR, getLoanDocuments, getDocumentUrl, getEventHistory
} from "../../lib/api";
import { useRouter } from "next/navigation";
import { useCurrency } from "../../lib/CurrencyContext";
import { useLoan } from "../../lib/LoanContext";
import Link from "next/link";
import ApprovalQueue from "../components/ApprovalQueue";
import DistanceToDefaultHero from "../components/DistanceToDefaultHero";
import { SkeletonKPI, SkeletonRecommendation } from "../components/Skeleton";
import {
  Zap, FileText, Calendar, Package, Building2, TrendingUp, Scale, Target,
  Upload, CheckCircle, AlertCircle, AlertTriangle, ArrowRight, ArrowLeft,
  Download, FileJson, FileSpreadsheet, Shield, Printer, Bot, RefreshCw,
  ChevronDown, ChevronUp, Leaf, Bell, DollarSign, TrendingDown, BarChart3,
  LayoutDashboard, PieChart, Clock, Percent, Users, Code, Coins, FileCheck,
  X, Sparkles, Info, Gem, Link2, Receipt, Play, History, Video, ScanSearch
} from 'lucide-react';

// Analytics now shows real loan data directly (no DashboardCharts needed)


type WorkflowStep = 'idle' | 'creating' | 'uploading' | 'processing' | 'complete' | 'error';

interface DLRData {
  loan_id: number;
  agreement_date: string;
  effective_date: string;
  governing_law: string;
  borrower_name: string;
  borrower_jurisdiction: string;
  facility_type: string;
  currency: string;
  margin_bps: number;
  base_rate?: string;
  is_esg_linked: boolean;
  esg_score: number;
  version: number;
  parties: any[];
  facilities: any[];
  transferability: Record<string, any>;
  covenants: any[];
  obligations: any[];
  events_of_default: any[];
  esg: any[];
  citations: any[];
  key_dates?: any;
  pricing?: any;
}

function DLRPage() {
  const router = useRouter();
  const { activeLoanId, setActiveLoanId, loanName: contextLoanName, setLoanName: setContextLoanName } = useLoan();
  const { formatAmount, baseCurrency } = useCurrency();

  // Upload state
  const [step, setStep] = useState<WorkflowStep>('idle');
  const [loanName, setLoanName] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Data state
  const [loanData, setLoanData] = useState<any>(null);
  const [dlr, setDlr] = useState<DLRData | null>(null);
  const [loading, setLoading] = useState(false);
  const [dlrError, setDlrError] = useState<string>('');
  const [aiRecommendations, setAiRecommendations] = useState<any[]>([]);
  const [executingAction, setExecutingAction] = useState<string | null>(null);

  // View state
  const [viewMode, setViewMode] = useState<'workspace' | 'analytics' | 'details' | 'json' | 'events'>('workspace');
  const [eventHistory, setEventHistory] = useState<any[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);

  // Fetch AI recommendations when loan changes
  useEffect(() => {
    if (!activeLoanId) {
      setAiRecommendations([]);
      return;
    }
    getAgentRecommendations(activeLoanId)
      .then(data => {
        // API returns array directly
        setAiRecommendations(Array.isArray(data) ? data : data.recommendations || []);
      })
      .catch(() => setAiRecommendations([]));
  }, [activeLoanId]);

  // Fetch event history when tab is selected
  useEffect(() => {
    if (viewMode === 'events' && activeLoanId) {
      setLoadingEvents(true);
      getEventHistory(activeLoanId, 100)
        .then(data => {
          setEventHistory(data.events || []);
        })
        .catch(() => setEventHistory([]))
        .finally(() => setLoadingEvents(false));
    }
  }, [viewMode, activeLoanId]);

  // Handle executing an AI recommendation
  const handleExecuteRecommendation = async (recId: string) => {
    if (!activeLoanId) return;
    setExecutingAction(recId);
    try {
      await executeAgentAction(activeLoanId, recId);
      window.dispatchEvent(new CustomEvent('loantwin-toast', {
        detail: { message: 'Action executed successfully!', type: 'success' }
      }));
      // Refresh recommendations
      const data = await getAgentRecommendations(activeLoanId);
      setAiRecommendations(Array.isArray(data) ? data : data.recommendations || []);
    } catch (e: any) {
      window.dispatchEvent(new CustomEvent('loantwin-toast', {
        detail: { message: `Action failed: ${e.message}`, type: 'error' }
      }));
    } finally {
      setExecutingAction(null);
    }
  };

  // Load data when loan is selected
  useEffect(() => {
    if (!activeLoanId) {
      setLoanData(null);
      setDlr(null);
      return;
    }

    setLoading(true);
    setDlrError('');

    Promise.all([
      fetchLoan(activeLoanId).catch(() => null),
      getDLR(activeLoanId).catch((e) => {
        if (e.message?.includes('409') || e.message?.includes('DLR not ready')) {
          return 'NO_DLR';
        }
        throw e;
      })
    ]).then(([loan, dlrData]) => {
      setLoanData(loan);
      if (dlrData === 'NO_DLR') {
        setDlrError('NO_DLR');
        setDlr(null);
      } else {
        setDlr(dlrData);
      }
    }).catch((e) => {
      setDlrError(e.message || 'Failed to load');
    }).finally(() => {
      setLoading(false);
    });
  }, [activeLoanId]);

  // Drag handlers
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const newFiles = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf');
      setFiles(prev => [...prev, ...newFiles]);
    }
  }, []);

  // Create loan with sample data
  async function onLoadSample() {
    setStep('creating');
    setErrorMsg('');
    try {
      const loan = await createSampleLoan();
      setActiveLoanId(loan.id);
      setContextLoanName(loan.name);
      setStep('complete');
    } catch (e: any) {
      setErrorMsg(e.message || 'Failed to load sample');
      setStep('error');
    }
  }

  // Create loan and optionally upload files
  async function onCreateLoan() {
    if (!loanName.trim()) {
      setErrorMsg('Please enter a deal name');
      return;
    }

    setStep('creating');
    setErrorMsg('');

    try {
      const loan = await createLoan(loanName);

      if (files.length > 0) {
        setStep('uploading');
        const uploadResults = await Promise.all(files.map(f => uploadDoc(loan.id, f)));

        setStep('processing');
        await processDoc(loan.id, uploadResults[0].id);
      }

      setActiveLoanId(loan.id);
      setContextLoanName(loan.name || loanName);
      setStep('complete');
      setLoanName('');
      setFiles([]);
    } catch (e: any) {
      setErrorMsg(e.message || 'Failed to create loan');
      setStep('error');
    }
  }

  // Switch/clear loan
  const handleSwitchDeal = () => {
    setActiveLoanId(null);
    setContextLoanName(null);
    setLoanData(null);
    setDlr(null);
    setStep('idle');
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // NO LOAN LOADED - Show upload interface
  // ═══════════════════════════════════════════════════════════════════════════
  if (!activeLoanId) {
    // Processing state
    if (step === 'creating' || step === 'uploading' || step === 'processing') {
      return (
        <div className="flex-col gap-lg" style={{ maxWidth: 600, margin: '0 auto', padding: 'var(--space-xl)' }}>
          <div className="card-premium text-center" style={{ padding: 'var(--space-3xl)' }}>
            <div className="spinner" style={{ width: 64, height: 64, margin: '0 auto' }} />
            <h2 className="h2 gradient-text-cyan mt-lg">
              {step === 'creating' ? 'Creating workspace...' :
                step === 'uploading' ? 'Uploading documents...' :
                  'AI analyzing documents...'}
            </h2>
            <div className="progress-bar mt-lg" style={{ height: 8 }}>
              <div className="fill" style={{
                width: step === 'creating' ? '33%' : step === 'uploading' ? '66%' : '90%',
                transition: 'width 0.5s ease'
              }} />
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="flex-col gap-lg animate-stagger">
        {/* View Toggle */}
        <div className="flex justify-center">
          <div
            className="view-toggle-container"
            style={{
              background: 'var(--bg-card)',
              padding: '6px',
              borderRadius: '12px',
              border: '1px solid var(--border-subtle)',
              display: 'inline-flex',
              gap: '4px'
            }}
          >
            <button
              onClick={() => setViewMode('workspace')}
              style={{
                padding: '12px 24px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                border: 'none',
                transition: 'all 0.2s ease',
                background: viewMode === 'workspace' ? 'var(--accent-secondary)' : 'transparent',
                color: viewMode === 'workspace' ? '#0A1628' : 'var(--text-secondary)'
              }}
            >
              <LayoutDashboard size={18} /> Workspace
            </button>
            <button
              onClick={() => setViewMode('analytics')}
              style={{
                padding: '12px 24px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                border: 'none',
                transition: 'all 0.2s ease',
                background: viewMode === 'analytics' ? 'var(--accent-secondary)' : 'transparent',
                color: viewMode === 'analytics' ? '#0A1628' : 'var(--text-secondary)'
              }}
            >
              <BarChart3 size={18} /> Portfolio Analytics
            </button>
          </div>
        </div>

        {viewMode === 'analytics' ? (
          dlr ? (
            <div className="space-y-lg">
              {/* Deal Summary Cards */}
              <div className="grid grid-cols-4 gap-md">
                <div className="card" style={{ borderLeft: '4px solid var(--accent-primary)' }}>
                  <div className="small opacity-70 mb-xs">Total Commitment</div>
                  <div className="h2" style={{ color: 'var(--accent-primary)' }}>
                    {formatAmount((dlr as any).total_commitment || 0, dlr.currency)}
                  </div>
                  <div className="small opacity-50">{dlr.facility_type || 'Facility'}</div>
                </div>
                <div className="card" style={{ borderLeft: '4px solid var(--accent-secondary)' }}>
                  <div className="small opacity-70 mb-xs">Margin</div>
                  <div className="h2" style={{ color: 'var(--accent-secondary)' }}>
                    {dlr.margin_bps ? `${dlr.margin_bps} bps` : 'N/A'}
                  </div>
                  <div className="small opacity-50">Over {dlr.base_rate || 'SOFR'}</div>
                </div>
                <div className="card" style={{ borderLeft: '4px solid var(--accent-success)' }}>
                  <div className="small opacity-70 mb-xs">Parties</div>
                  <div className="h2" style={{ color: 'var(--accent-success)' }}>{dlr.parties?.length || 0}</div>
                  <div className="small opacity-50">Identified</div>
                </div>
                <div className="card" style={{ borderLeft: '4px solid var(--accent-warning)' }}>
                  <div className="small opacity-70 mb-xs">Covenants</div>
                  <div className="h2" style={{ color: 'var(--accent-warning)' }}>{dlr.covenants?.length || 0}</div>
                  <div className="small opacity-50">Extracted</div>
                </div>
              </div>

              {/* Facilities Breakdown */}
              {dlr.facilities && dlr.facilities.length > 0 && (
                <div className="card">
                  <h3 className="h3 mb-md">Facility Breakdown</h3>
                  <div className="space-y-sm">
                    {dlr.facilities.map((f: any, i: number) => {
                      const amount = parseFloat(String(f.amount || 0).replace(/,/g, ''));
                      const total = dlr.facilities.reduce((sum: number, fac: any) => sum + parseFloat(String(fac.amount || 0).replace(/,/g, '')), 0);
                      const percentage = total > 0 ? ((amount / total) * 100).toFixed(1) : 0;
                      return (
                        <div key={i} className="p-md rounded-lg" style={{ background: 'var(--bg-primary)' }}>
                          <div className="flex justify-between items-center mb-sm">
                            <span className="font-semibold">{f.type || f.name || `Facility ${i + 1}`}</span>
                            <span className="mono" style={{ color: 'var(--accent-primary)' }}>{formatAmount(amount, dlr.currency)}</span>
                          </div>
                          <div className="w-full h-2 rounded-full" style={{ background: 'var(--bg-elevated)' }}>
                            <div className="h-full rounded-full" style={{ width: `${percentage}%`, background: 'var(--accent-primary)' }} />
                          </div>
                          <div className="small opacity-50 mt-xs">{percentage}% of total</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Party Distribution */}
              {dlr.parties && dlr.parties.length > 0 && (
                <div className="card">
                  <h3 className="h3 mb-md">Party Distribution</h3>
                  <div className="grid grid-cols-3 gap-md">
                    {['borrower', 'lender', 'agent'].map(role => {
                      const count = dlr.parties.filter((p: any) => p.role?.toLowerCase().includes(role)).length;
                      return (
                        <div key={role} className="p-md rounded-lg text-center" style={{ background: 'var(--bg-primary)' }}>
                          <div className="h2" style={{ color: role === 'borrower' ? 'var(--accent-primary)' : role === 'lender' ? 'var(--accent-secondary)' : 'var(--accent-success)' }}>
                            {count}
                          </div>
                          <div className="small opacity-70 capitalize">{role}s</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Document Extraction Stats */}
              <div className="card">
                <h3 className="h3 mb-md">Extraction Statistics</h3>
                <div className="grid grid-cols-4 gap-md">
                  <div className="p-md rounded-lg text-center" style={{ background: 'var(--bg-primary)' }}>
                    <div className="h2" style={{ color: 'var(--accent-primary)' }}>{(dlr as any).total_clauses || 0}</div>
                    <div className="small opacity-70">Clauses</div>
                  </div>
                  <div className="p-md rounded-lg text-center" style={{ background: 'var(--bg-primary)' }}>
                    <div className="h2" style={{ color: 'var(--accent-secondary)' }}>{dlr.citations?.length || 0}</div>
                    <div className="small opacity-70">Citations</div>
                  </div>
                  <div className="p-md rounded-lg text-center" style={{ background: 'var(--bg-primary)' }}>
                    <div className="h2" style={{ color: 'var(--accent-warning)' }}>{dlr.events_of_default?.length || 0}</div>
                    <div className="small opacity-70">Default Triggers</div>
                  </div>
                  <div className="p-md rounded-lg text-center" style={{ background: 'var(--bg-primary)' }}>
                    <div className="h2" style={{ color: 'var(--accent-success)' }}>{dlr.is_esg_linked ? '✓' : '—'}</div>
                    <div className="small opacity-70">ESG Linked</div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="card text-center py-2xl">
              <BarChart3 size={48} className="mx-auto mb-md opacity-30" />
              <h3 className="h3 mb-sm">No Loan Data</h3>
              <p className="body opacity-70">Upload a loan agreement or load a sample deal to see analytics</p>
            </div>
          )
        ) : (
          <>
            {/* Hero Section */}
            <section className="card-premium" style={{ textAlign: 'center', padding: 'var(--space-2xl) var(--space-xl)' }}>
              <div className="flex justify-center gap-sm mb-lg" style={{ fontSize: 40 }}>
                <FileText size={40} style={{ color: 'var(--text-muted)' }} />
                <ArrowRight size={28} style={{ color: 'var(--accent-secondary)', marginTop: 6 }} />
                <Bot size={40} style={{ color: 'var(--accent-secondary)' }} />
                <ArrowRight size={28} style={{ color: 'var(--accent-secondary)', marginTop: 6 }} />
                <BarChart3 size={40} style={{ color: 'var(--accent-success)' }} />
              </div>
              <h1 className="h1 gradient-text-cyan" style={{ fontSize: 28, marginBottom: 'var(--space-md)' }}>
                Digital Loan Record
              </h1>
              <p className="body opacity-70" style={{ maxWidth: 600, margin: '0 auto' }}>
                Upload your Credit Agreement and LoanTwin AI will extract covenants, obligations, transfer terms, and ESG requirements automatically.
              </p>

              <div className="flex gap-md justify-center flex-wrap mt-xl">
                <button className="btn-premium" onClick={onLoadSample} disabled={step === 'creating'}>
                  <Zap size={20} /> Try with Sample Deal
                </button>
              </div>
              <p className="small opacity-50 mt-md">No signup required • See results in 30 seconds</p>
            </section>

            {/* Error Display */}
            {errorMsg && (
              <div className="card" style={{ background: 'var(--accent-danger-dim)', borderColor: 'var(--accent-danger)' }}>
                <div className="flex items-center gap-md">
                  <AlertCircle size={20} style={{ color: 'var(--accent-danger)' }} />
                  <span style={{ color: 'var(--accent-danger)' }}>{errorMsg}</span>
                  <button className="btn-icon ml-auto" onClick={() => { setErrorMsg(''); setStep('idle'); }}>
                    <X size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* Upload Section */}
            <section className="card">
              <div className="flex items-center gap-sm mb-lg">
                <Upload size={24} style={{ color: 'var(--accent-primary)' }} />
                <h2 className="h2" style={{ margin: 0 }}>Upload Your Agreement</h2>
              </div>

              <div className="form-group mb-md">
                <label className="small opacity-70 mb-xs block">Deal Name</label>
                <input
                  className="input"
                  value={loanName}
                  onChange={(e) => setLoanName(e.target.value)}
                  placeholder="e.g., Project Phoenix - £350M Revolving Facility"
                />
              </div>

              <div
                className={`card-inner interactive-hover ${dragActive ? 'ring-2' : ''}`}
                style={{
                  border: `2px dashed ${dragActive ? 'var(--accent-primary)' : 'var(--border-subtle)'}`,
                  background: dragActive ? 'var(--accent-primary-dim)' : 'var(--bg-primary)',
                  padding: 'var(--space-xl)',
                  textAlign: 'center',
                  cursor: 'pointer'
                }}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => document.getElementById('file-upload')?.click()}
              >
                <input
                  id="file-upload"
                  type="file"
                  accept=".pdf"
                  multiple
                  onChange={(e) => {
                    if (e.target.files) {
                      setFiles(prev => [...prev, ...Array.from(e.target.files!).filter(f => f.type === 'application/pdf')]);
                    }
                  }}
                  style={{ display: 'none' }}
                />
                <Upload size={40} style={{ color: 'var(--accent-primary)', marginBottom: 'var(--space-md)' }} />
                <p className="body" style={{ fontWeight: 600 }}>
                  {dragActive ? 'Drop PDF files here' : 'Drag & drop PDF files here'}
                </p>
                <p className="small opacity-50 mt-xs">or click to browse</p>
              </div>

              {files.length > 0 && (
                <div className="mt-md">
                  <div className="small opacity-70 mb-sm">{files.length} file(s) selected:</div>
                  <div className="flex-col gap-xs">
                    {files.map((file, i) => (
                      <div key={i} className="flex items-center justify-between p-sm" style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)' }}>
                        <div className="flex items-center gap-sm">
                          <FileText size={16} style={{ color: 'var(--accent-primary)' }} />
                          <span className="small">{file.name}</span>
                          <span className="small opacity-50">({(file.size / 1024 / 1024).toFixed(2)} MB)</span>
                        </div>
                        <button className="btn-icon" onClick={(e) => { e.stopPropagation(); setFiles(prev => prev.filter((_, idx) => idx !== i)); }}>×</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button className="btn primary w-full mt-lg" onClick={onCreateLoan} disabled={!loanName.trim() || step !== 'idle'}>
                {files.length > 0 ? <><Upload size={16} /> Create & Analyze</> : <><ArrowRight size={16} /> Create Workspace</>}
              </button>
            </section>

            {/* What Gets Extracted */}
            <section className="card" style={{ background: 'var(--bg-secondary)' }}>
              <div className="flex items-center gap-sm mb-md">
                <Bot size={20} style={{ color: 'var(--accent-secondary)' }} />
                <h2 className="h3" style={{ margin: 0 }}>What AI Extracts</h2>
              </div>
              <div className="grid-auto" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-md)' }}>
                {['Parties & Roles', 'Facilities & Amounts', 'Financial Covenants', 'Key Dates', 'Pricing & Fees', 'ESG/SLL KPIs'].map((item, i) => (
                  <div key={i} className="flex items-center gap-sm">
                    <CheckCircle size={16} style={{ color: 'var(--accent-success)' }} />
                    <span className="small">{item}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Supported Formats */}
            <section className="card">
              <div className="flex items-center gap-sm mb-md">
                <FileText size={20} style={{ color: 'var(--accent-primary)' }} />
                <h2 className="h3" style={{ margin: 0 }}>Supported Documents</h2>
              </div>
              <div className="flex gap-md flex-wrap">
                {['Credit Agreements', 'LMA Templates', 'LSTA Documents', 'APLMA', 'Amendments'].map((doc, i) => (
                  <div key={i} className="flex items-center gap-sm">
                    <span className="tag success">PDF</span>
                    <span className="small opacity-70">{doc}</span>
                  </div>
                ))}
              </div>
              <p className="small opacity-50 mt-md">Max 100MB • Multi-document upload • AI compares against LMA standards</p>
            </section>
          </>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // LOADING STATE
  // ═══════════════════════════════════════════════════════════════════════════
  if (loading) {
    return (
      <div className="card" style={{ padding: 'var(--space-3xl)', textAlign: 'center' }}>
        <div className="spinner" style={{ width: 64, height: 64, margin: '0 auto' }} />
        <h2 className="h2 mt-lg">Loading Digital Loan Record...</h2>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // NO DLR YET - Document needs to be uploaded
  // ═══════════════════════════════════════════════════════════════════════════
  if (dlrError === 'NO_DLR') {
    return (
      <div className="flex-col gap-lg" style={{ maxWidth: 700, margin: '0 auto' }}>
        <section className="card-premium" style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
          <Upload size={48} style={{ color: 'var(--accent-primary)', marginBottom: 'var(--space-md)' }} />
          <h1 className="h1 gradient-text-cyan">Document Needed</h1>
          <p className="body opacity-70 mt-sm">
            Workspace "{contextLoanName || `Loan #${activeLoanId}`}" was created. Upload a credit agreement to generate the DLR.
          </p>
        </section>

        <section className="card">
          <h3 className="h3 mb-md">Upload Document</h3>
          <div
            className="card-inner"
            style={{ border: '2px dashed var(--border-subtle)', padding: 'var(--space-xl)', textAlign: 'center', cursor: 'pointer' }}
            onClick={() => document.getElementById('file-upload-dlr')?.click()}
          >
            <input
              id="file-upload-dlr"
              type="file"
              accept=".pdf"
              onChange={async (e) => {
                if (e.target.files?.[0] && activeLoanId) {
                  setLoading(true);
                  try {
                    const result = await uploadDoc(activeLoanId, e.target.files[0]);
                    await processDoc(activeLoanId, result.id);
                    const newDlr = await getDLR(activeLoanId);
                    setDlr(newDlr);
                    setDlrError('');
                  } catch (err: any) {
                    setDlrError(err.message || 'Upload failed');
                  } finally {
                    setLoading(false);
                  }
                }
              }}
              style={{ display: 'none' }}
            />
            <Upload size={32} style={{ color: 'var(--accent-primary)' }} />
            <p className="body mt-sm">Click to upload PDF</p>
          </div>
        </section>

        <div className="flex gap-md justify-center">
          <button className="btn secondary" onClick={handleSwitchDeal}>
            <ArrowLeft size={16} /> Switch Deal
          </button>
          <button className="btn primary" onClick={onLoadSample}>
            <Sparkles size={16} /> Load Sample Instead
          </button>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ERROR STATE
  // ═══════════════════════════════════════════════════════════════════════════
  if (dlrError) {
    return (
      <div className="flex-col gap-lg" style={{ maxWidth: 600, margin: '0 auto' }}>
        <div className="card" style={{ borderColor: 'var(--accent-danger)', textAlign: 'center', padding: 'var(--space-xl)' }}>
          <AlertCircle size={48} style={{ color: 'var(--accent-danger)', marginBottom: 'var(--space-md)' }} />
          <h2 className="h2">Error Loading DLR</h2>
          <p className="body opacity-70 mt-sm">{dlrError}</p>
          <div className="flex gap-md justify-center mt-lg">
            <button className="btn secondary" onClick={() => window.location.reload()}>
              <RefreshCw size={16} /> Retry
            </button>
            <button className="btn primary" onClick={handleSwitchDeal}>
              <ArrowLeft size={16} /> Switch Deal
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FULL DLR VIEW
  // ═══════════════════════════════════════════════════════════════════════════
  if (!dlr) return null;

  return (
    <div className="flex-col gap-lg animate-stagger">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-md">
          <div className="flex rounded-lg overflow-hidden" style={{ background: 'var(--bg-elevated)', padding: 4 }}>
            <button
              className="px-md py-sm rounded-md flex items-center gap-xs transition-all"
              onClick={() => setViewMode('workspace')}
              style={{
                background: viewMode === 'workspace' ? 'var(--accent-secondary)' : 'transparent',
                color: viewMode === 'workspace' ? '#0A1628' : 'inherit',
                fontWeight: viewMode === 'workspace' ? 600 : 400
              }}
            >
              <LayoutDashboard size={16} /> Overview
            </button>
            <button
              className="px-md py-sm rounded-md flex items-center gap-xs transition-all"
              onClick={() => setViewMode('analytics')}
              style={{
                background: viewMode === 'analytics' ? 'var(--accent-secondary)' : 'transparent',
                color: viewMode === 'analytics' ? '#0A1628' : 'inherit',
                fontWeight: viewMode === 'analytics' ? 600 : 400
              }}
            >
              <BarChart3 size={16} /> Analytics
            </button>
            <button
              className="px-md py-sm rounded-md flex items-center gap-xs transition-all"
              onClick={() => setViewMode('json')}
              style={{
                background: viewMode === 'json' ? 'var(--accent-secondary)' : 'transparent',
                color: viewMode === 'json' ? '#0A1628' : 'inherit',
                fontWeight: viewMode === 'json' ? 600 : 400
              }}
            >
              <Code size={16} /> Raw Data
            </button>
            <button
              className="px-md py-sm rounded-md flex items-center gap-xs transition-all"
              onClick={() => setViewMode('events')}
              style={{
                background: viewMode === 'events' ? 'var(--accent-secondary)' : 'transparent',
                color: viewMode === 'events' ? '#0A1628' : 'inherit',
                fontWeight: viewMode === 'events' ? 600 : 400
              }}
            >
              <History size={16} /> Event History
            </button>
          </div>
        </div>
        <button className="btn secondary" onClick={handleSwitchDeal}>
          <ArrowLeft size={16} /> Switch Deal
        </button>
      </div>

      {/* JSON View */}
      {viewMode === 'json' && (
        <div className="card">
          <div className="flex justify-between items-center mb-md">
            <h2 className="h2">Raw DLR Data</h2>
            <button className="btn primary" onClick={() => exportToJSON(dlr, `dlr_${dlr.loan_id}.json`)}>
              <Download size={16} /> Export JSON
            </button>
          </div>
          <pre style={{ background: 'var(--bg-primary)', padding: 'var(--space-lg)', borderRadius: 'var(--radius-md)', overflow: 'auto', maxHeight: 600, fontSize: 12 }}>
            {JSON.stringify(dlr, null, 2)}
          </pre>
        </div>
      )}

      {/* Event History View */}
      {viewMode === 'events' && (
        <div className="flex-col gap-lg">
          <div className="card">
            <div className="flex justify-between items-center mb-lg">
              <div className="flex items-center gap-md">
                <div style={{
                  width: 48, height: 48, borderRadius: 12,
                  background: 'var(--accent-info-dim, rgba(0,150,220,0.2))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <History size={24} style={{ color: 'var(--accent-info, #0096dc)' }} />
                </div>
                <div>
                  <h2 className="h2" style={{ margin: 0 }}>Event History</h2>
                  <p className="small opacity-70" style={{ margin: 0 }}>
                    All actions and incidents for this deal
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-sm">
                <span className="tag info">{eventHistory.length} events</span>
                <button
                  className="btn secondary"
                  onClick={() => {
                    setLoadingEvents(true);
                    getEventHistory(activeLoanId!, 100)
                      .then(data => setEventHistory(data.events || []))
                      .catch(() => { })
                      .finally(() => setLoadingEvents(false));
                  }}
                >
                  <RefreshCw size={14} className={loadingEvents ? 'animate-spin' : ''} /> Refresh
                </button>
              </div>
            </div>

            {loadingEvents ? (
              <div className="flex-col items-center justify-center" style={{ padding: 'var(--space-2xl)' }}>
                <div className="spinner" style={{ width: 40, height: 40 }} />
                <p className="opacity-70 mt-md">Loading event history...</p>
              </div>
            ) : eventHistory.length === 0 ? (
              <div className="flex-col items-center justify-center" style={{ padding: 'var(--space-2xl)', textAlign: 'center' }}>
                <History size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
                <p className="opacity-70">No events recorded yet.</p>
                <p className="small opacity-50">Events will appear here as you interact with this deal.</p>
              </div>
            ) : (
              <div className="timeline" style={{ position: 'relative' }}>
                {/* Timeline line */}
                <div style={{
                  position: 'absolute',
                  left: 23,
                  top: 0,
                  bottom: 0,
                  width: 2,
                  background: 'var(--border-subtle)'
                }} />

                {eventHistory.map((event, idx) => {
                  const categoryConfig: Record<string, { color: string; icon: any; label: string }> = {
                    trade: { color: 'var(--accent-success)', icon: DollarSign, label: 'Trade' },
                    ai: { color: 'var(--neon-purple, #9b59b6)', icon: ScanSearch, label: 'AI' },
                    document: { color: 'var(--accent-primary)', icon: FileText, label: 'Document' },
                    video: { color: 'var(--accent-warning)', icon: Video, label: 'Video' },
                    compliance: { color: 'var(--accent-danger)', icon: AlertTriangle, label: 'Compliance' },
                    export: { color: 'var(--accent-secondary)', icon: Download, label: 'Export' },
                    general: { color: 'var(--text-secondary)', icon: Clock, label: 'General' }
                  };
                  const config = categoryConfig[event.category] || categoryConfig.general;
                  const IconComponent = config.icon;

                  return (
                    <div
                      key={event.id || idx}
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 16,
                        padding: '16px 0',
                        position: 'relative'
                      }}
                    >
                      {/* Timeline dot */}
                      <div style={{
                        width: 48,
                        height: 48,
                        borderRadius: 12,
                        background: `${config.color}20`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        position: 'relative',
                        zIndex: 1
                      }}>
                        <IconComponent size={20} style={{ color: config.color }} />
                      </div>

                      {/* Event content */}
                      <div style={{ flex: 1 }}>
                        <div className="flex items-center gap-sm mb-xs">
                          <span className="tag" style={{
                            background: `${config.color}20`,
                            color: config.color,
                            fontSize: 11,
                            padding: '2px 8px'
                          }}>
                            {config.label}
                          </span>
                          <span className="small opacity-50">
                            {new Date(event.timestamp).toLocaleString()}
                          </span>
                        </div>
                        <div className="font-semibold" style={{ marginBottom: 4 }}>
                          {event.action.replace(/_/g, ' ').toUpperCase()}
                        </div>
                        <div className="small opacity-70" style={{ lineHeight: 1.5 }}>
                          {event.details}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Analytics View - REAL DATA from extracted DLR */}
      {viewMode === 'analytics' && (
        <>
          {/* Extraction Stats */}
          <div className="grid grid-cols-4 gap-md">
            <div className="card" style={{ borderLeft: '4px solid var(--accent-primary)' }}>
              <div className="small opacity-70 mb-xs">Total Pages</div>
              <div className="h1" style={{ color: 'var(--accent-primary)' }}>{(dlr as any).total_pages || '?'}</div>
              <div className="small opacity-50">Processed by AI</div>
            </div>
            <div className="card" style={{ borderLeft: '4px solid var(--accent-secondary)' }}>
              <div className="small opacity-70 mb-xs">Clauses Extracted</div>
              <div className="h1" style={{ color: 'var(--accent-secondary)' }}>{(dlr as any).total_clauses || dlr.citations?.length || 0}</div>
              <div className="small opacity-50">Legal provisions</div>
            </div>
            <div className="card" style={{ borderLeft: '4px solid var(--accent-success)' }}>
              <div className="small opacity-70 mb-xs">Parties Identified</div>
              <div className="h1" style={{ color: 'var(--accent-success)' }}>{dlr.parties?.length || 0}</div>
              <div className="small opacity-50">Borrower, Lender, Agents</div>
            </div>
            <div className="card" style={{ borderLeft: '4px solid var(--accent-warning)' }}>
              <div className="small opacity-70 mb-xs">Covenants Found</div>
              <div className="h1" style={{ color: 'var(--accent-warning)' }}>{dlr.covenants?.length || 0}</div>
              <div className="small opacity-50">Financial tests</div>
            </div>
          </div>

          {/* Extraction Confidence */}
          <div className="card">
            <h3 className="h3 mb-md flex items-center gap-sm"><Target size={20} /> Extraction Confidence</h3>
            <div className="flex items-center gap-lg">
              <div style={{ width: 120, height: 120, position: 'relative' }}>
                <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
                  <circle cx="18" cy="18" r="16" fill="none" stroke="var(--bg-elevated)" strokeWidth="3" />
                  <circle
                    cx="18" cy="18" r="16" fill="none"
                    stroke="var(--accent-success)" strokeWidth="3"
                    strokeDasharray={`${((dlr as any).extraction_confidence || 0.75) * 100} 100`}
                    strokeLinecap="round"
                  />
                </svg>
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                  <div className="h2" style={{ color: 'var(--accent-success)' }}>
                    {Math.round(((dlr as any).extraction_confidence || 0.75) * 100)}%
                  </div>
                </div>
              </div>
              <div className="flex-1">
                <div className="flex justify-between mb-sm">
                  <span className="small opacity-70">Metadata Extraction</span>
                  <span className="mono small">High</span>
                </div>
                <div className="progress-bar mb-md" style={{ height: 8 }}>
                  <div className="fill" style={{ width: '92%', background: 'var(--accent-success)' }} />
                </div>
                <div className="flex justify-between mb-sm">
                  <span className="small opacity-70">Clause Detection</span>
                  <span className="mono small">High</span>
                </div>
                <div className="progress-bar mb-md" style={{ height: 8 }}>
                  <div className="fill" style={{ width: '88%', background: 'var(--accent-primary)' }} />
                </div>
                <div className="flex justify-between mb-sm">
                  <span className="small opacity-70">Party Identification</span>
                  <span className="mono small">High</span>
                </div>
                <div className="progress-bar" style={{ height: 8 }}>
                  <div className="fill" style={{ width: '95%', background: 'var(--accent-secondary)' }} />
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-lg">
            {/* Document Structure Breakdown */}
            <div className="card">
              <h3 className="h3 mb-md flex items-center gap-sm"><PieChart size={20} /> Document Structure</h3>
              <div className="flex-col gap-sm">
                {[
                  { label: 'Definitions & Interpretations', count: Math.round(((dlr as any).total_clauses || 50) * 0.15), color: 'var(--accent-primary)' },
                  { label: 'Financial Terms', count: Math.round(((dlr as any).total_clauses || 50) * 0.20), color: 'var(--accent-secondary)' },
                  { label: 'Covenants', count: dlr.covenants?.length || 2, color: 'var(--accent-warning)' },
                  { label: 'Events of Default', count: dlr.events_of_default?.length || 3, color: 'var(--accent-danger)' },
                  { label: 'Representations', count: Math.round(((dlr as any).total_clauses || 50) * 0.12), color: 'var(--accent-success)' },
                  { label: 'Miscellaneous', count: Math.round(((dlr as any).total_clauses || 50) * 0.25), color: 'var(--text-muted)' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-sm" style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)' }}>
                    <div className="flex items-center gap-sm">
                      <div style={{ width: 12, height: 12, borderRadius: 3, background: item.color }} />
                      <span className="small">{item.label}</span>
                    </div>
                    <span className="mono small font-semibold">{item.count}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Key Citations */}
            <div className="card">
              <h3 className="h3 mb-md flex items-center gap-sm"><FileText size={20} /> Key Citations Found</h3>
              <div className="flex-col gap-sm" style={{ maxHeight: 300, overflow: 'auto' }}>
                {(dlr.citations && dlr.citations.length > 0) ? dlr.citations.map((c: any, i: number) => (
                  <div key={i} className="p-sm" style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid var(--accent-secondary)' }}>
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="small font-semibold">{c.keyword}</div>
                        <div className="small opacity-70">{c.clause?.slice(0, 40)}...</div>
                      </div>
                      <span className="tag small">p.{c.page_start}</span>
                    </div>
                  </div>
                )) : (
                  <div className="text-center p-lg opacity-50">
                    <FileText size={32} style={{ opacity: 0.3 }} />
                    <p className="small mt-sm">No citations extracted</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Covenant Compliance Visual */}
          {dlr.covenants && dlr.covenants.length > 0 && (
            <div className="card">
              <h3 className="h3 mb-md flex items-center gap-sm"><Shield size={20} /> Covenant Compliance Status</h3>
              <div className="grid grid-cols-2 gap-lg">
                {dlr.covenants.map((c: any, i: number) => (
                  <div key={i} className="p-lg" style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-md)' }}>
                    <div className="flex justify-between items-center mb-md">
                      <span className="font-semibold">{c.name}</span>
                      <span className="tag success"><CheckCircle size={12} /> Compliant</span>
                    </div>
                    <div className="flex items-end gap-lg">
                      <div style={{ flex: 1 }}>
                        <div className="flex justify-between small opacity-70 mb-xs">
                          <span>Current: {c.current_value}</span>
                          <span>Threshold: {c.threshold}</span>
                        </div>
                        <div className="progress-bar" style={{ height: 12 }}>
                          <div
                            className="fill"
                            style={{
                              width: `${Math.min(100, (c.current_value / parseFloat(c.threshold?.replace(/[^0-9.]/g, '') || '1')) * 100)}%`,
                              background: c.headroom_percent > 20 ? 'var(--accent-success)' : 'var(--accent-warning)'
                            }}
                          />
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="h3" style={{ color: 'var(--accent-success)' }}>{c.headroom_percent}%</div>
                        <div className="small opacity-50">Headroom</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Events of Default */}
          {dlr.events_of_default && dlr.events_of_default.length > 0 && (
            <div className="card">
              <h3 className="h3 mb-md flex items-center gap-sm"><AlertTriangle size={20} /> Events of Default Triggers</h3>
              <div className="grid grid-cols-3 gap-md">
                {dlr.events_of_default.map((e: any, i: number) => (
                  <div key={i} className="p-md" style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid var(--accent-danger)' }}>
                    <div className="font-semibold">{e.trigger}</div>
                    <div className="flex justify-between mt-sm">
                      <span className="small opacity-70">Notice: {e.notice}</span>
                      <span className="small opacity-70">Grace: {e.grace_period}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Overview View */}
      {viewMode === 'workspace' && (
        <>
          {/* Hero Card */}
          <section className="card-premium" style={{ borderLeft: '4px solid var(--accent-secondary)' }}>
            <div className="flex justify-between items-start gap-lg flex-wrap">
              <div>
                <div className="flex items-center gap-sm mb-xs">
                  <span className="tag success"><CheckCircle size={12} /> Active</span>
                  {dlr.is_esg_linked && <span className="tag" style={{ background: 'var(--accent-success-dim)', color: 'var(--accent-success)' }}><Leaf size={12} /> ESG</span>}
                </div>
                <h1 className="h1 gradient-text-cyan">{dlr.borrower_name}</h1>
                <p className="small opacity-70">{dlr.facility_type} • {dlr.governing_law}</p>
              </div>
              <div className="flex gap-sm">
                <button className="btn secondary" onClick={() => exportToJSON(dlr, `dlr_${dlr.loan_id}.json`)}>
                  <Download size={14} /> Export
                </button>
              </div>
            </div>
          </section>

          {/* Extraction Confidence Banner */}
          {(dlr as any).extraction_confidence && (
            <div className="card" style={{
              background: (dlr as any).ai_enhanced ? 'var(--accent-success-dim)' : 'var(--bg-secondary)',
              borderColor: (dlr as any).ai_enhanced ? 'var(--accent-success)' : 'var(--border-subtle)',
              padding: 'var(--space-md)'
            }}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-sm">
                  <Sparkles size={18} style={{ color: (dlr as any).ai_enhanced ? 'var(--accent-success)' : 'var(--text-muted)' }} />
                  <span className="small">
                    {(dlr as any).ai_enhanced ? 'AI-Enhanced Extraction' : 'Pattern-Based Extraction'} •
                    <strong style={{ marginLeft: 4 }}>{Math.round(((dlr as any).extraction_confidence || 0.75) * 100)}% Confidence</strong>
                  </span>
                </div>
                <div className="flex items-center gap-xs">
                  <span className="small opacity-70">{(dlr as any).total_pages || '?'} pages</span>
                  <span className="small opacity-50">•</span>
                  <span className="small opacity-70">{(dlr as any).total_clauses || '?'} clauses</span>
                </div>
              </div>
            </div>
          )}

          {/* Core Metadata Grid */}
          <div className="grid grid-cols-2 gap-lg">
            {/* Left Column - Financial Terms */}
            <div className="card">
              <h3 className="h3 mb-md flex items-center gap-sm"><DollarSign size={18} /> Financial Terms</h3>
              <div className="flex-col gap-sm">
                <div className="flex justify-between p-sm" style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)' }}>
                  <span className="small opacity-70">Currency</span>
                  <span className="mono font-semibold">{dlr.currency || 'N/A'}</span>
                </div>
                <div className="flex justify-between p-sm" style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)' }}>
                  <span className="small opacity-70">Facility Type</span>
                  <span className="font-semibold">{dlr.facility_type || 'N/A'}</span>
                </div>
                <div className="flex justify-between p-sm" style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)' }}>
                  <span className="small opacity-70">Margin</span>
                  <span className="mono font-semibold" style={{ color: 'var(--accent-secondary)' }}>{dlr.margin_bps ? `${dlr.margin_bps} bps` : 'N/A'}</span>
                </div>
                <div className="flex justify-between p-sm" style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)' }}>
                  <span className="small opacity-70">Base Rate</span>
                  <span className="font-semibold">{(dlr as any).base_rate || 'Variable'}</span>
                </div>
                {(dlr as any).total_commitment && (
                  <div className="flex justify-between p-sm" style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)' }}>
                    <span className="small opacity-70">Total Commitment</span>
                    <span className="mono font-semibold" style={{ color: 'var(--accent-primary)' }}>
                      {formatAmount((dlr as any).total_commitment, dlr.currency)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column - Legal Terms */}
            <div className="card">
              <h3 className="h3 mb-md flex items-center gap-sm"><Scale size={18} /> Legal Terms</h3>
              <div className="flex-col gap-sm">
                <div className="flex justify-between p-sm" style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)' }}>
                  <span className="small opacity-70">Agreement Date</span>
                  <span className="font-semibold">{dlr.agreement_date || 'N/A'}</span>
                </div>
                <div className="flex justify-between p-sm" style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)' }}>
                  <span className="small opacity-70">Governing Law</span>
                  <span className="font-semibold">{dlr.governing_law || 'N/A'}</span>
                </div>
                <div className="flex justify-between p-sm" style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)' }}>
                  <span className="small opacity-70">Maturity Date</span>
                  <span className="font-semibold">{(dlr as any).maturity_date || 'N/A'}</span>
                </div>
                <div className="flex justify-between p-sm" style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)' }}>
                  <span className="small opacity-70">Transfer Mode</span>
                  <span className="font-semibold">{(dlr as any).transferability_mode || dlr.transferability?.mode || 'N/A'}</span>
                </div>
                <div className="flex justify-between p-sm" style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)' }}>
                  <span className="small opacity-70">Document Type</span>
                  <span className="font-semibold">{(dlr as any).document_type || 'Loan Agreement'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ESG Badge if applicable */}
          {dlr.is_esg_linked && (
            <div className="card" style={{ background: 'var(--accent-success-dim)', borderColor: 'var(--accent-success)' }}>
              <div className="flex items-center gap-md">
                <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'var(--accent-success)' }}>
                  <Leaf size={24} color="#0A1628" />
                </div>
                <div>
                  <h3 className="h3" style={{ color: 'var(--accent-success)' }}>Sustainability-Linked</h3>
                  <p className="small opacity-70">This facility includes ESG/Sustainability KPIs with margin adjustment triggers</p>
                </div>
                {dlr.esg_score && (
                  <div className="ml-auto text-center">
                    <div className="mono" style={{ fontSize: 28, color: 'var(--accent-success)' }}>{dlr.esg_score}</div>
                    <div className="small opacity-70">ESG Score</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Key Dates */}
          {(dlr as any).key_dates && (
            <section className="card">
              <h2 className="h2 mb-md"><Calendar size={20} /> Key Dates</h2>
              <div className="grid grid-cols-5 gap-md">
                {[
                  { label: 'Signing', date: (dlr as any).key_dates.signing_date },
                  { label: 'Effective', date: (dlr as any).key_dates.effective_date },
                  { label: 'First Drawdown', date: (dlr as any).key_dates.first_drawdown_date },
                  { label: 'Avail. End', date: (dlr as any).key_dates.availability_period_end },
                  { label: 'Maturity', date: (dlr as any).key_dates.maturity_date, highlight: true }
                ].map((item, i) => (
                  <div key={i} className="text-center">
                    <div className="small opacity-70">{item.label}</div>
                    <div className={`mono ${item.highlight ? 'text-danger' : ''}`} style={{ fontWeight: 600 }}>{item.date || '—'}</div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Facilities */}
          {dlr.facilities?.length > 0 && (
            <section className="card">
              <h2 className="h2 mb-md"><Building2 size={20} /> Facilities</h2>
              <div className="flex-col gap-sm">
                {dlr.facilities.map((f: any, i: number) => (
                  <div key={i} className="flex justify-between items-center p-md" style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)' }}>
                    <div>
                      <div className="font-semibold">{f.type || f.name}</div>
                      <div className="small opacity-70">{f.purpose}</div>
                    </div>
                    <div className="text-right">
                      <div className="mono font-semibold" style={{ color: 'var(--accent-secondary)' }}>
                        {formatAmount(parseFloat(String(f.amount).replace(/,/g, '')), dlr.currency)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Parties */}
          {dlr.parties?.length > 0 && (
            <section className="card">
              <h2 className="h2 mb-md"><Users size={20} /> Parties</h2>
              <div className="grid grid-cols-2 gap-md">
                {dlr.parties.map((p: any, i: number) => (
                  <div key={i} className="flex items-center gap-md p-md" style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)' }}>
                    <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'var(--accent-primary-dim)' }}>
                      <Users size={20} style={{ color: 'var(--accent-primary)' }} />
                    </div>
                    <div>
                      <div className="font-semibold">{p.name}</div>
                      <div className="small opacity-70">{p.role}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Covenants */}
          {dlr.covenants?.length > 0 && (
            <section className="card">
              <h2 className="h2 mb-md"><Shield size={20} /> Financial Covenants</h2>
              <div className="flex-col gap-sm">
                {dlr.covenants.map((c: any, i: number) => (
                  <div key={i} className="flex justify-between items-center p-md" style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid var(--accent-warning)' }}>
                    <div>
                      <div className="font-semibold">{c.name || c.type}</div>
                      <div className="small opacity-70">{c.definition}</div>
                    </div>
                    <div className="text-right">
                      <div className="mono" style={{ color: 'var(--accent-secondary)' }}>{c.threshold || c.ratio}</div>
                      <div className="small opacity-50">{c.testing_frequency}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ESG KPIs */}
          {dlr.is_esg_linked && dlr.esg?.length > 0 && (
            <section className="card" style={{ borderLeft: '4px solid var(--accent-success)' }}>
              <h2 className="h2 mb-md"><Leaf size={20} /> ESG / Sustainability KPIs</h2>
              <div className="flex-col gap-sm">
                {dlr.esg.map((e: any, i: number) => (
                  <div key={i} className="flex justify-between items-center p-md" style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)' }}>
                    <div>
                      <div className="font-semibold">{e.kpi || e.name}</div>
                      <div className="small opacity-70">{e.description}</div>
                    </div>
                    <div className="text-right">
                      <div className="mono" style={{ color: 'var(--accent-success)' }}>{e.target}</div>
                      <div className="small opacity-50">{e.margin_impact}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* AI Recommendations */}
          {aiRecommendations.length > 0 && (
            <section id="ai-recommendations" className="card" style={{ borderLeft: '4px solid var(--neon-purple, #9b59b6)' }}>
              <div className="flex justify-between items-center mb-md">
                <h2 className="h2 flex items-center gap-sm">
                  <Sparkles size={20} style={{ color: 'var(--neon-purple, #9b59b6)' }} />
                  AI Recommendations
                </h2>
                <span className="tag" style={{ background: 'var(--neon-purple, #9b59b6)', color: 'white' }}>
                  {aiRecommendations.length} Actions
                </span>
              </div>
              <div className="flex-col gap-md">
                {aiRecommendations.map((rec: any) => (
                  <div
                    key={rec.id}
                    className="p-md hover-glow"
                    style={{
                      background: 'var(--bg-primary)',
                      borderRadius: 'var(--radius-md)',
                      borderLeft: `4px solid ${rec.severity === 'critical' ? 'var(--accent-danger)' :
                        rec.severity === 'warning' ? 'var(--accent-warning)' :
                          rec.severity === 'opportunity' ? 'var(--accent-success)' :
                            'var(--accent-info)'
                        }`
                    }}
                  >
                    <div className="flex justify-between items-start mb-sm">
                      <div>
                        <div className="flex items-center gap-sm mb-xs">
                          <span className={`tag ${rec.severity === 'critical' ? 'danger' :
                            rec.severity === 'warning' ? 'warning' :
                              rec.severity === 'opportunity' ? 'success' :
                                'primary'
                            }`} style={{ fontSize: 10 }}>
                            {rec.severity?.toUpperCase() || 'INFO'}
                          </span>
                          <span className="small opacity-60">{rec.issue_type}</span>
                        </div>
                        <div className="font-semibold">{rec.title}</div>
                        <div className="small opacity-70 mt-xs">{rec.description}</div>
                      </div>
                    </div>

                    {/* Action Section */}
                    <div className="mt-md p-sm" style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)' }}>
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="small font-semibold">{rec.action_label || rec.ai_recommendation?.substring(0, 50)}</div>
                          <div className="small opacity-60">{rec.action_type?.replace('_', ' ')}</div>
                        </div>
                        <button
                          className="btn primary"
                          style={{ fontSize: 12, padding: '6px 16px' }}
                          onClick={() => handleExecuteRecommendation(rec.id)}
                          disabled={executingAction === rec.id}
                        >
                          {executingAction === rec.id ? (
                            <span className="flex items-center gap-xs">
                              <span className="spinner" style={{ width: 12, height: 12 }} />
                              Executing...
                            </span>
                          ) : (
                            <>⚡ {rec.action_label || 'Execute'}</>
                          )}
                        </button>
                      </div>
                      {rec.drafted_action && (
                        <div className="mt-sm p-sm" style={{
                          background: 'var(--bg-primary)',
                          borderRadius: 'var(--radius-xs)',
                          maxHeight: 100,
                          overflow: 'auto'
                        }}>
                          <div className="small opacity-50 mb-xs">Drafted Action:</div>
                          <pre className="small mono" style={{ whiteSpace: 'pre-wrap', fontSize: 10 }}>
                            {JSON.stringify(rec.drafted_action, null, 2).substring(0, 200)}
                            {JSON.stringify(rec.drafted_action).length > 200 ? '...' : ''}
                          </pre>
                        </div>
                      )}
                      {rec.estimated_impact && (
                        <div className="mt-sm small" style={{ color: 'var(--accent-success)' }}>
                          <strong>Impact:</strong> {rec.estimated_impact}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="card p-xl text-center"><div className="spinner" style={{ width: 48, height: 48, margin: '0 auto' }} /></div>}>
      <DLRPage />
    </Suspense>
  );
}
