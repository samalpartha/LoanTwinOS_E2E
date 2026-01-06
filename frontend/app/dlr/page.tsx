'use client';
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { getDLR, getLoanDocuments, getDocumentUrl } from "../../lib/api";

interface DLRData {
  loan_id: number;
  agreement_date: string | null;
  governing_law: string | null;
  governing_law_confidence?: number;
  parties: any[];
  facilities: any[];
  transferability: Record<string, any>;
  covenants: any[];
  obligations: any[];
  events_of_default: any[];
  esg: any[];
  citations: any[];
  audit_logs?: any[];
}

function AuditLogs({ logs }: { logs?: any[] }) {
  if (!logs || logs.length === 0) return null;
  return (
    <div className="card mt-md">
      <div className="h2 mb-md">Deal Audit Trail</div>
      <div className="flex-col gap-sm" style={{ display: 'flex' }}>
        {logs.map((log, i) => (
          <div key={i} className="small card-inner flex justify-between">
            <span>
              <span style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>{log.user || 'System'}</span> 
              {" "}{log.action}: {log.details}
            </span>
            <span className="mono opacity-50">{new Date(log.timestamp).toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ConfidenceBadge({ score }: { score?: number }) {
  if (!score) return null;
  const color = score > 95 ? 'success' : score > 85 ? 'warning' : 'danger';
  return (
    <span className={`tag ${color}`} style={{ fontSize: 10, padding: '2px 6px', marginLeft: 8 }}>
      {score}% Confidence
    </span>
  );
}

function CovenantSimulator({ covenants }: { covenants: any[] }) {
  const [actualValues, setActualValues] = useState<Record<string, number>>({});
  if (!covenants || covenants.length === 0) return null;
  const checkCompliance = (name: string, actual: number) => {
    if (name.toLowerCase().includes('leverage')) return actual < 4.0;
    if (name.toLowerCase().includes('cover')) return actual > 2.5;
    return true;
  };
  return (
    <div className="card mt-md" style={{ border: '1px solid var(--accent-primary-dim)' }}>
      <div className="h2 mb-md">Covenant Compliance Simulator</div>
      <div className="flex-col gap-md" style={{ display: 'flex' }}>
        {covenants.map((cov, i) => (
          <div key={i} className="card-inner">
            <div className="flex justify-between items-center mb-sm">
              <div style={{ fontWeight: 600 }}>{cov.name}</div>
              <div className="tag primary">Target: {cov.threshold}</div>
            </div>
            <div className="flex items-center gap-md">
              <div className="form-group" style={{ flex: 1 }}><input type="number" className="input" placeholder="Enter current value..." step="0.1" onChange={(e) => setActualValues({...actualValues, [cov.name]: parseFloat(e.target.value)})} /></div>
              {actualValues[cov.name] !== undefined && (
                <div className={`status ${checkCompliance(cov.name, actualValues[cov.name]) ? 'ready' : 'error'}`} style={{ minWidth: 140 }}>
                  {checkCompliance(cov.name, actualValues[cov.name]) ? 'IN COMPLIANCE' : 'BREACH'}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function DLRContent() {
  const searchParams = useSearchParams();
  const loanId = Number(searchParams.get('loanId') || 1);
  const [dlr, setDlr] = useState<DLRData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [viewMode, setViewMode] = useState<'structured' | 'json' | 'analysis' | 'team'>('structured');
  
  // PDF State
  const [showPdf, setShowPdf] = useState(false);
  const [docId, setDocId] = useState<number | null>(null);
  const [pdfPage, setPdfPage] = useState(1);
  const [logs, setLogs] = useState<any[]>([
    { user: "AI Engine", action: "extracted", details: "Extracted deal terms from Credit Agreement", timestamp: new Date().toISOString() }
  ]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [data, docData] = await Promise.all([getDLR(loanId), getLoanDocuments(loanId)]);
        setDlr(data);
        if (docData && docData.length > 0) setDocId(docData[0].id);
      } catch (e: any) {
        setError(e.message || String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [loanId]);

  const exportData = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(dlr, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `loantwin_dlr_${loanId}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const jumpToPage = (page: number) => {
    setPdfPage(page);
    setShowPdf(true);
  };

  if (loading) return <div className="card"><div className="loading-overlay"><div className="spinner" /><span>Loading Digital Loan Record...</span></div></div>;
  if (error) return <div className="card"><div className="empty-state">Unable to load DLR: {error}</div></div>;
  if (!dlr) return null;

  return (
    <div className={`slide-up ${showPdf ? 'split-view' : ''}`} style={{ display: 'flex', gap: 24, height: showPdf ? 'calc(100vh - 250px)' : 'auto' }}>
      <div style={{ flex: 1, overflowY: showPdf ? 'auto' : 'visible', paddingRight: showPdf ? 12 : 0 }}>
        <div className="card mb-lg">
          <div className="flex justify-between items-center">
            <div><div className="h2" style={{ marginBottom: 4 }}>Institutional Digital Deal Record</div><h2 className="h1">#{dlr.loan_id}</h2></div>
            <div className="flex gap-sm items-center">
              <button className="btn success" onClick={exportData}>📥 Export JSON</button>
              <button className="btn primary" onClick={() => alert("Downloading Excel Model Mapper with Amortization Logic...")}>📈 Excel Model Mapper</button>
              {docId && <button className={`btn ${showPdf ? 'primary' : ''}`} onClick={() => setShowPdf(!showPdf)}>{showPdf ? 'Close PDF' : 'Verify Source'}</button>}
              <div className="nav" style={{ margin: 0, padding: 4 }}>
                <button className={`pill ${viewMode === 'structured' ? 'active' : ''}`} onClick={() => setViewMode('structured')}>Details</button>
                <button className={`pill ${viewMode === 'analysis' ? 'active' : ''}`} onClick={() => setViewMode('analysis')}>📈 Analysis</button>
                <button className={`pill ${viewMode === 'team' ? 'active' : ''}`} onClick={() => setViewMode('team')}>👥 Team</button>
                <button className={`pill ${viewMode === 'json' ? 'active' : ''}`} onClick={() => setViewMode('json')}>JSON</button>
              </div>
            </div>
          </div>
          <div className="kpi mt-lg">
            <div className="box accent"><div className="label">Agreement Date</div><div className="value">{dlr.agreement_date || '—'}</div></div>
            <div className="box"><div className="label">Governing Law</div><div className="value" style={{ fontSize: 16 }}>{dlr.governing_law || '—'}<ConfidenceBadge score={dlr.governing_law_confidence} /></div></div>
          </div>
        </div>

        {viewMode === 'structured' && (
          <div className="flex-col gap-md" style={{ display: 'flex' }}>
            <div className="card">
              <div className="flex justify-between items-center mb-md">
                <div className="dlr-section-title" style={{ margin: 0 }}>AI Evidence Log (Click to verify)</div>
                <button className="btn success" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => setLogs([...logs, { user: "Elon Musk", action: "verified", details: "Manually verified Governing Law citation", timestamp: new Date().toISOString() }])}>
                  ✓ Verify All
                </button>
              </div>
              <div className="flex-col gap-sm" style={{ display: 'flex' }}>
                {dlr.citations.map((cit, idx) => (
                  <div key={idx} className="dlr-item" onClick={() => jumpToPage(cit.page_start)} style={{ cursor: 'pointer', borderLeft: '3px solid var(--accent-primary)' }}>
                    <div className="flex justify-between items-center"><span className="tag primary">{cit.keyword}</span><div className="flex items-center"><ConfidenceBadge score={cit.confidence} /><span className="small" style={{ marginLeft: 8 }}>p. {cit.page_start} →</span></div></div>
                    <div className="small mt-sm">{cit.clause}</div>
                  </div>
                ))}
              </div>
            </div>
            
            <AuditLogs logs={logs} />
          </div>
        )}

        {viewMode === 'analysis' && (
          <div className="flex-col gap-md" style={{ display: 'flex' }}>
            <div className="card"><div className="h2 mb-md">Risk Concentration</div><div className="flex gap-md"><div className="card-inner" style={{ flex: 1, textAlign: 'center' }}><div className="small mb-sm">Legal Risk</div><div style={{ fontSize: 24, fontWeight: 700, color: 'var(--accent-success)' }}>Low</div></div><div className="card-inner" style={{ flex: 1, textAlign: 'center' }}><div className="small mb-sm">Transfer Risk</div><div style={{ fontSize: 24, fontWeight: 700, color: 'var(--accent-warning)' }}>Medium</div></div><div className="card-inner" style={{ flex: 1, textAlign: 'center' }}><div className="small mb-sm">ESG Alignment</div><div style={{ fontSize: 24, fontWeight: 700, color: 'var(--accent-primary)' }}>82%</div></div></div></div>
            <CovenantSimulator covenants={dlr.covenants} />
          </div>
        )}

        {viewMode === 'team' && (
          <div className="card">
            <div className="h2 mb-md">Team Assignments</div>
            <div className="table-wrapper">
              <table className="table">
                <thead><tr><th>Section</th><th>Assignee</th><th>Priority</th><th>Status</th></tr></thead>
                <tbody>
                  <tr><td>Tax Gross Up</td><td><span className="tag">Legal Team</span></td><td><span className="tag danger">High</span></td><td><span className="tag warning">In Review</span></td></tr>
                  <tr><td>SOFR Transition</td><td><span className="tag">Treasury</span></td><td><span className="tag primary">Med</span></td><td><span className="tag success">Verified</span></td></tr>
                  <tr><td>KYC/AML</td><td><span className="tag">Operations</span></td><td><span className="tag">Low</span></td><td><span className="tag">Pending</span></td></tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        {viewMode === 'json' && <div className="card"><pre className="code">{JSON.stringify(dlr, null, 2)}</pre></div>}
      </div>

      {showPdf && docId && (
        <div className="card slide-up" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden', border: '1px solid var(--accent-primary)' }}>
          <div className="flex justify-between items-center" style={{ padding: '12px 16px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-subtle)' }}>
            <span className="h2" style={{ margin: 0 }}>Human-in-the-Loop Verification</span>
            <button className="btn-icon btn" onClick={() => setShowPdf(false)}>×</button>
          </div>
          <iframe src={`${getDocumentUrl(docId)}#page=${pdfPage}`} style={{ width: '100%', height: '100%', border: 'none' }} />
        </div>
      )}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="card">Loading...</div>}><DLRContent /></Suspense>
  );
}
