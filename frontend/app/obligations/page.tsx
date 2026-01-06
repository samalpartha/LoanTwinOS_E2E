'use client';
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { getObligations } from "../../lib/api";

interface Obligation {
  id: number;
  role: string;
  title: string;
  details: string;
  due_hint: string;
  due_date: string | null;
  status: string;
}

function ObligationsContent() {
  const searchParams = useSearchParams();
  const loanId = Number(searchParams.get('loanId') || 1);
  const [items, setItems] = useState<Obligation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState<'list' | 'timeline' | 'board'>('timeline');

  useEffect(() => {
    (async () => {
      try {
        const data = await getObligations(loanId);
        setItems(data);
      } catch (e: any) {
        setError(e.message || String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [loanId]);

    if (loading) return <div className="card"><div className="loading-overlay"><div className="spinner" /><span>Loading obligations...</span></div></div>;

    if (error) return (
      <div className="card">
        <div className="empty-state">
          <div style={{ fontSize: 40, marginBottom: 16 }}>📅</div>
          <div className="h2">Unable to Load Obligations</div>
          <p className="small">{error}</p>
          <a href="/" className="btn primary mt-md">Go to Workspace</a>
        </div>
      </div>
    );

    const sortedItems = [...items].sort((a, b) => 
    (a.due_date || '').localeCompare(b.due_date || '')
  );

  const statusColors: any = {
    'open': 'warning',
    'complete': 'success',
    'overdue': 'danger'
  };

  return (
    <div className="slide-up">
      {/* Header & Controls */}
      <div className="card mb-md">
        <div className="flex justify-between items-center">
          <div>
            <div className="h2">Obligation Management</div>
            <h2 className="h3 mt-sm">Operational Lifecycle</h2>
          </div>
          <div className="nav" style={{ margin: 0, padding: 4 }}>
            <button className={`pill ${view === 'timeline' ? 'active' : ''}`} onClick={() => setView('timeline')}>📊 Timeline</button>
            <button className={`pill ${view === 'board' ? 'active' : ''}`} onClick={() => setView('board')}>📋 Status Board</button>
            <button className={`pill ${view === 'list' ? 'active' : ''}`} onClick={() => setView('list')}>≡ List</button>
          </div>
        </div>
      </div>

      {/* Timeline View */}
      {view === 'timeline' && (
        <div className="card">
          <div className="h2 mb-lg">Upcoming Reporting Windows</div>
          <div className="flex-col gap-lg" style={{ display: 'flex', paddingLeft: 20, borderLeft: '2px solid var(--border-subtle)' }}>
            {sortedItems.map((ob, idx) => (
              <div key={ob.id} className="slide-up" style={{ position: 'relative', animationDelay: `${idx * 50}ms` }}>
                {/* Timeline Dot */}
                <div style={{ 
                  position: 'absolute', left: -29, top: 0, width: 16, height: 16, 
                  borderRadius: '50%', background: ob.status === 'open' ? 'var(--accent-primary)' : 'var(--accent-success)',
                  border: '4px solid var(--bg-card)', zIndex: 2
                }} />
                
                <div className="flex justify-between items-start">
                  <div>
                    <div className="small mono" style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>
                      {ob.due_date ? new Date(ob.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'TBD'}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 16, marginTop: 4 }}>{ob.title}</div>
                    <div className="small mt-sm" style={{ maxWidth: 600 }}>{ob.details}</div>
                  </div>
                  <div className="flex-col items-end" style={{ display: 'flex' }}>
                    <span className={`tag ${statusColors[ob.status] || ''}`}>{ob.status.toUpperCase()}</span>
                    <span className="small mt-sm">{ob.role}</span>
                  </div>
                </div>
                <div className="divider" style={{ margin: '20px 0 0 0' }} />
              </div>
            ))}
            {items.length === 0 && <div className="empty-state">No active obligations for this loan.</div>}
          </div>
        </div>
      )}

      {/* Board View */}
      {view === 'board' && (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
          {['Open', 'Overdue', 'Complete'].map(status => (
            <div key={status} className="flex-col gap-md" style={{ display: 'flex' }}>
              <div className="h2 flex items-center justify-between" style={{ padding: '0 8px' }}>
                {status} 
                <span className="tag">{items.filter(i => i.status.toLowerCase() === status.toLowerCase()).length}</span>
              </div>
              <div style={{ minHeight: 400, background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-lg)', padding: 12 }}>
                {items.filter(i => i.status.toLowerCase() === status.toLowerCase()).map(ob => (
                  <div key={ob.id} className="card-inner mb-md" style={{ cursor: 'grab' }}>
                    <div className="small mono" style={{ opacity: 0.6 }}>{ob.due_date}</div>
                    <div style={{ fontWeight: 600, marginTop: 4 }}>{ob.title}</div>
                    <div className="flex justify-between items-center mt-md">
                      <span className="tag" style={{ fontSize: 10 }}>{ob.role}</span>
                      <button className="btn-icon btn" style={{ width: 24, height: 24, fontSize: 12 }}>→</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
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
                </tr>
              </thead>
              <tbody>
                {sortedItems.map((ob) => (
                  <tr key={ob.id}>
                    <td className="mono small">{ob.due_date || 'TBD'}</td>
                    <td><span className={`tag ${statusColors[ob.status] || ''}`}>{ob.status}</span></td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{ob.title}</div>
                      <div className="small">{ob.details}</div>
                    </td>
                    <td><span className="tag">{ob.role}</span></td>
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
