'use client';
import { useEffect, useState, Suspense, useCallback } from "react";
import { getObligations, exportToJSON, fetchLoan, updateObligation } from "../../lib/api";
import { useLoan } from "../../lib/LoanContext";

interface Obligation {
  id: number;
  role: string;
  title: string;
  details: string;
  due_hint: string;
  due_date: string | null;
  status: string;
  is_esg: boolean;
  confidence: number;
  assigned_to?: string;
  evidence_path?: string;
}

interface ComplianceFeedItem {
  id: number;
  doc: string;
  status: 'extracted' | 'pending' | 'verified';
  details: string;
  confidence: number;
  obligation_id?: number;
}

function ObligationsContent() {
  const { activeLoanId } = useLoan();
  const loanId = activeLoanId || 1;
  const [items, setItems] = useState<Obligation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState<'list' | 'timeline' | 'board'>('board');
  const [roleFilter, setRoleFilter] = useState('All');
  const [loanName, setLoanName] = useState("");

  // Dynamic compliance feed based on obligations
  const [complianceFeed, setComplianceFeed] = useState<ComplianceFeedItem[]>([]);

  const loadData = useCallback(async () => {
    try {
      const [data, loan] = await Promise.all([
        getObligations(loanId),
        fetchLoan(loanId).catch(() => null)
      ]);
      setItems(data);
      if (loan) setLoanName(loan.name);
      
      // Generate dynamic compliance feed from obligations
      const feed: ComplianceFeedItem[] = data
        .filter((o: Obligation) => o.status.toLowerCase() !== 'completed')
        .slice(0, 4)
        .map((o: Obligation, idx: number) => ({
          id: idx + 1,
          doc: o.is_esg ? `ESG_Report_${o.title.replace(/\s+/g, '_')}.pdf` : `Compliance_${o.title.replace(/\s+/g, '_')}.pdf`,
          status: o.status.toLowerCase() === 'validated' ? 'extracted' : o.status.toLowerCase() === 'evidence uploaded' ? 'verified' : 'pending',
          details: o.details.substring(0, 60) + (o.details.length > 60 ? '...' : ''),
          confidence: o.confidence,
          obligation_id: o.id
        }));
      setComplianceFeed(feed);
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [loanId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Status update handler - now persists to backend
  const updateObligationStatus = async (obligationId: number, newStatus: string) => {
    try {
      await updateObligation(loanId, obligationId, { status: newStatus });
      setItems(prev => prev.map(item => 
        item.id === obligationId ? { ...item, status: newStatus } : item
      ));
      window.dispatchEvent(new CustomEvent('loantwin-toast', { 
        detail: { message: `Obligation status updated to "${newStatus}"`, type: 'success' } 
      }));
    } catch (e: any) {
      window.dispatchEvent(new CustomEvent('loantwin-toast', { 
        detail: { message: `Failed to update: ${e.message}`, type: 'error' } 
      }));
    }
  };

  // Evidence upload - persists to backend
  const handleEvidenceUpload = async (obligationId: number) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf,.doc,.docx,.xlsx';
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (file) {
        try {
          await updateObligation(loanId, obligationId, { 
            status: 'Evidence Uploaded', 
            evidence_path: file.name 
          });
          setItems(prev => prev.map(item => 
            item.id === obligationId ? { ...item, status: 'Evidence Uploaded', evidence_path: file.name } : item
          ));
          window.dispatchEvent(new CustomEvent('loantwin-toast', { 
            detail: { message: `Evidence "${file.name}" attached successfully`, type: 'success' } 
          }));
        } catch (err: any) {
          window.dispatchEvent(new CustomEvent('loantwin-toast', { 
            detail: { message: `Failed to upload: ${err.message}`, type: 'error' } 
          }));
        }
      }
    };
    input.click();
  };

  // Move to next status
  const moveToNextStatus = async (obligation: Obligation) => {
    const statusFlow = ['Draft', 'Validated', 'Evidence Uploaded', 'Completed'];
    const currentIdx = statusFlow.findIndex(s => s.toLowerCase() === obligation.status.toLowerCase());
    if (currentIdx < statusFlow.length - 1) {
      await updateObligationStatus(obligation.id, statusFlow[currentIdx + 1]);
    }
  };

  // Export obligations
  const handleExport = () => {
    exportToJSON({
      loan_id: loanId,
      loan_name: loanName,
      obligations: items,
      exported_at: new Date().toISOString()
    }, `loantwin_obligations_${loanId}.json`);
    window.dispatchEvent(new CustomEvent('loantwin-toast', { 
      detail: { message: "Obligations exported successfully", type: 'success' } 
    }));
  };

  // Forward certs email
  const handleForwardCerts = () => {
    const email = `compliance+loan${loanId}@loantwin.os`;
    navigator.clipboard.writeText(email);
    window.dispatchEvent(new CustomEvent('loantwin-toast', { 
      detail: { message: `Email copied: ${email}`, type: 'success' } 
    }));
  };

  // Approve compliance feed item - persists to backend
  const approveComplianceItem = async (itemId: number) => {
    const feedItem = complianceFeed.find(f => f.id === itemId);
    if (feedItem?.obligation_id) {
      try {
        await updateObligation(loanId, feedItem.obligation_id, { status: 'Validated' });
        setItems(prev => prev.map(item => 
          item.id === feedItem.obligation_id ? { ...item, status: 'Validated' } : item
        ));
      } catch (e) {
        console.error('Failed to update obligation:', e);
      }
    }
    setComplianceFeed(prev => prev.map(item =>
      item.id === itemId ? { ...item, status: 'verified' } : item
    ));
    window.dispatchEvent(new CustomEvent('loantwin-toast', { 
      detail: { message: "Compliance item approved", type: 'success' } 
    }));
  };

  if (loading) return <div className="card"><div className="loading-overlay"><div className="spinner" /><span>Loading obligations...</span></div></div>;

  const filteredItems = items.filter(i => roleFilter === 'All' || i.role === roleFilter);
  const sortedItems = [...filteredItems].sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''));

  const statusColors: any = {
    'draft': 'warning',
    'validated': 'primary',
    'evidence uploaded': 'success',
    'completed': 'ready',
    'overdue': 'danger'
  };

  // Calculate stats
  const totalCount = items.length;
  const completedCount = items.filter(i => i.status.toLowerCase() === 'completed').length;
  const overdueCount = items.filter(i => i.due_date && new Date(i.due_date) < new Date() && i.status.toLowerCase() !== 'completed').length;
  const esgCount = items.filter(i => i.is_esg).length;

  return (
    <div className="slide-up">
      {/* Header & Controls */}
      <div className="card mb-md">
        <div className="flex justify-between items-center flex-mobile-wrap gap-md">
          <div>
            <div className="h2">Obligation Operations Cockpit</div>
            <h2 className="h3 mt-sm">Post-Trade Compliance Lifecycle</h2>
          </div>
          <div className="flex gap-md items-center flex-wrap">
            <button className="btn" onClick={handleExport} style={{ fontSize: 12 }}>📥 Export</button>
            <div className="flex gap-sm items-center">
              <span className="small">Filter:</span>
              <select className="input" style={{ padding: '4px 8px', fontSize: 12, width: 120 }} value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
                <option>All</option>
                <option>Borrower</option>
                <option>Lender</option>
                <option>Agent</option>
              </select>
            </div>
            <div className="nav" style={{ margin: 0, padding: 4 }}>
              <button className={`pill ${view === 'timeline' ? 'active' : ''}`} onClick={() => setView('timeline')}>📊 Timeline</button>
              <button className={`pill ${view === 'board' ? 'active' : ''}`} onClick={() => setView('board')}>📋 Status Board</button>
              <button className={`pill ${view === 'list' ? 'active' : ''}`} onClick={() => setView('list')}>≡ List</button>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="dashboard-grid mt-lg">
          <div className="card-inner flex-col gap-xs" style={{ borderLeft: '3px solid var(--accent-primary)' }}>
            <span className="small opacity-60">Total</span>
            <span className="h3">{totalCount}</span>
          </div>
          <div className="card-inner flex-col gap-xs" style={{ borderLeft: '3px solid var(--accent-success)' }}>
            <span className="small opacity-60">Completed</span>
            <span className="h3" style={{ color: 'var(--accent-success)' }}>{completedCount}</span>
          </div>
          <div className="card-inner flex-col gap-xs" style={{ borderLeft: '3px solid var(--accent-danger)' }}>
            <span className="small opacity-60">Overdue</span>
            <span className="h3" style={{ color: overdueCount > 0 ? 'var(--accent-danger)' : 'var(--text-muted)' }}>{overdueCount}</span>
          </div>
          <div className="card-inner flex-col gap-xs" style={{ borderLeft: '3px solid var(--accent-success)' }}>
            <span className="small opacity-60">ESG-Linked</span>
            <span className="h3">🌱 {esgCount}</span>
          </div>
        </div>
      </div>

      {/* Smart Compliance Feed */}
      <div className="card mb-md" style={{ border: '1px solid var(--accent-primary-dim)', background: 'rgba(41, 121, 255, 0.02)' }}>
        <div className="flex justify-between items-center mb-md flex-mobile-wrap gap-sm">
          <div className="h2" style={{ margin: 0 }}>Smart Compliance Feed (AI Ingestion)</div>
          <button className="btn success" style={{ padding: '4px 12px', fontSize: 11 }} onClick={handleForwardCerts}>
            📧 Forward Certs
          </button>
        </div>
        {complianceFeed.length === 0 ? (
          <div className="card-inner text-center py-lg">
            <span className="small opacity-50">No pending compliance items</span>
          </div>
        ) : (
          <div className="flex gap-md overflow-x-auto pb-sm">
            {complianceFeed.map(item => (
              <div key={item.id} className="card-inner" style={{ flex: '0 0 300px', borderLeft: `3px solid ${item.status === 'verified' ? 'var(--accent-success)' : item.status === 'extracted' ? 'var(--accent-primary)' : 'var(--accent-warning)'}` }}>
                <div className="flex justify-between items-center mb-xs">
                  <span className="small mono truncate" style={{ fontSize: 10, maxWidth: 180 }}>{item.doc}</span>
                  <span className={`tag ${item.status === 'verified' ? 'success' : item.status === 'extracted' ? 'primary' : 'warning'}`} style={{ fontSize: 9 }}>{item.status.toUpperCase()}</span>
                </div>
                <div className="small mb-sm" style={{ fontWeight: 600 }}>{item.details}</div>
                <div className="flex justify-between items-center">
                  <span className="small opacity-50" style={{ fontSize: 9 }}>Confidence: {Math.round(item.confidence * 100)}%</span>
                  {item.status !== 'verified' && (
                    <button className="btn primary" style={{ padding: '2px 8px', fontSize: 9 }} onClick={() => approveComplianceItem(item.id)}>
                      Approve
                    </button>
                  )}
                  {item.status === 'verified' && (
                    <span className="small" style={{ color: 'var(--accent-success)', fontSize: 9 }}>✓ Verified</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Board View */}
      {view === 'board' && (
        <div className="grid obligations-board" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {['Draft', 'Validated', 'Evidence Uploaded', 'Completed'].map(status => (
            <div key={status} className="flex-col gap-md obligations-column" style={{ display: 'flex' }}>
              <div className="h2 flex items-center justify-between" style={{ padding: '0 8px', fontSize: 11 }}>
                {status.toUpperCase()} 
                <span className="tag" style={{ borderRadius: 4 }}>{filteredItems.filter(i => i.status.toLowerCase() === status.toLowerCase()).length}</span>
              </div>
              <div style={{ minHeight: 400, background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: 12 }}>
                {filteredItems.filter(i => i.status.toLowerCase() === status.toLowerCase()).map(ob => (
                  <div key={ob.id} className="card-inner mb-md" style={{ borderLeft: ob.is_esg ? '3px solid var(--accent-success)' : '1px solid var(--border-subtle)' }}>
                    <div className="flex justify-between items-start mb-sm">
                      <span className="small mono opacity-50">{ob.due_date}</span>
                      {ob.is_esg && <span className="tag success" style={{ fontSize: 9 }}>🌱 ESG</span>}
                    </div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{ob.title}</div>
                    <div className="small mt-sm opacity-70" style={{ fontSize: 11, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{ob.details}</div>
                    {ob.evidence_path && (
                      <div className="small mt-sm" style={{ color: 'var(--accent-success)', fontSize: 10 }}>📎 {ob.evidence_path}</div>
                    )}
                    <div className="flex justify-between items-center mt-md">
                      <span className="tag" style={{ fontSize: 9 }}>{ob.role}</span>
                      <div className="flex gap-sm">
                        <button 
                          className="btn-icon btn" 
                          style={{ width: 24, height: 24, fontSize: 12 }} 
                          title="Upload Evidence"
                          onClick={() => handleEvidenceUpload(ob.id)}
                        >
                          📎
                        </button>
                        {status.toLowerCase() !== 'completed' && (
                          <button 
                            className="btn-icon btn" 
                            style={{ width: 24, height: 24, fontSize: 12, border: '1px solid var(--accent-primary)' }} 
                            title="Move to Next Status"
                            onClick={() => moveToNextStatus(ob)}
                          >
                            →
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {filteredItems.filter(i => i.status.toLowerCase() === status.toLowerCase()).length === 0 && (
                   <div className="small opacity-30 text-center mt-lg">Empty</div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Timeline View */}
      {view === 'timeline' && (
        <div className="card">
          <div className="h2 mb-lg">Institutional Compliance Timeline</div>
          <div className="flex-col gap-lg" style={{ display: 'flex', paddingLeft: 20, borderLeft: '2px solid var(--border-subtle)' }}>
            {sortedItems.map((ob, idx) => (
              <div key={ob.id} className="slide-up" style={{ position: 'relative', animationDelay: `${idx * 50}ms` }}>
                <div style={{ 
                  position: 'absolute', left: -29, top: 0, width: 16, height: 16, 
                  borderRadius: '50%', background: ob.is_esg ? 'var(--accent-success)' : 'var(--accent-primary)',
                  border: '4px solid var(--bg-card)', zIndex: 2
                }} />
                
                <div className="flex justify-between items-start flex-mobile-wrap gap-md">
                  <div style={{ flex: 1 }}>
                    <div className="small mono" style={{ color: ob.is_esg ? 'var(--accent-success)' : 'var(--accent-primary)', fontWeight: 600 }}>
                      {ob.due_date ? new Date(ob.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'TBD'}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 16, marginTop: 4 }}>
                      {ob.title} 
                      {ob.is_esg && <span className="tag success ml-sm" style={{ marginLeft: 8 }}>🌱 LMA ESG KPI</span>}
                    </div>
                    <div className="small mt-sm" style={{ maxWidth: 700 }}>{ob.details}</div>
                    <div className="mt-md flex gap-sm flex-wrap">
                      <button className="btn" style={{ padding: '4px 12px', fontSize: 11 }} onClick={() => {
                        if (ob.evidence_path) {
                          window.dispatchEvent(new CustomEvent('loantwin-toast', { detail: { message: `Evidence: ${ob.evidence_path}`, type: 'success' } }));
                        } else {
                          window.dispatchEvent(new CustomEvent('loantwin-toast', { detail: { message: "No evidence uploaded yet", type: 'error' } }));
                        }
                      }}>
                        View Artifacts ({ob.evidence_path ? 1 : 0})
                      </button>
                      <button className="btn action" style={{ padding: '4px 12px', fontSize: 11 }} onClick={() => handleEvidenceUpload(ob.id)}>
                        Upload Compliance Proof
                      </button>
                    </div>
                  </div>
                  <div className="flex-col items-end" style={{ display: 'flex' }}>
                    <span className={`tag ${statusColors[ob.status.toLowerCase()] || ''}`}>{ob.status.toUpperCase()}</span>
                    <span className="small mt-sm">{ob.role}</span>
                    <span className="small mono mt-xs opacity-50" style={{ fontSize: 10 }}>{Math.round(ob.confidence * 100)}% conf</span>
                  </div>
                </div>
                <div className="divider" style={{ margin: '24px 0 0 0' }} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* List View */}
      {view === 'list' && (
        <div className="card">
          <div className="table-wrapper">
            <table className="table">
              <thead>
                <tr>
                  <th>Due Date</th>
                  <th>Status</th>
                  <th>Obligation</th>
                  <th>Entity</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedItems.map((ob) => (
                  <tr key={ob.id}>
                    <td className="mono small">{ob.due_date || 'TBD'}</td>
                    <td><span className={`tag ${statusColors[ob.status.toLowerCase()] || ''}`}>{ob.status}</span></td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{ob.title} {ob.is_esg && '🌱'}</div>
                      <div className="small" style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ob.details}</div>
                    </td>
                    <td><span className="tag">{ob.role}</span></td>
                    <td>
                      <div className="flex gap-sm">
                        <button className="btn" style={{ padding: '2px 8px', fontSize: 10 }} onClick={() => handleEvidenceUpload(ob.id)}>📎</button>
                        {ob.status.toLowerCase() !== 'completed' && (
                          <button className="btn primary" style={{ padding: '2px 8px', fontSize: 10 }} onClick={() => moveToNextStatus(ob)}>→</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="card">Loading...</div>}>
      <ObligationsContent />
    </Suspense>
  );
}
