'use client';
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { getClauses, getLoanDocuments, getDocumentUrl } from "../../lib/api";

interface Clause {
  id: number;
  heading: string;
  body: string;
  page_start: number;
  page_end: number;
}

function ClausesContent() {
  const searchParams = useSearchParams();
  const loanId = Number(searchParams.get('loanId') || 1);
  const [query, setQuery] = useState("");
  const [clauses, setClauses] = useState<Clause[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [displayCount, setDisplayCount] = useState(20);
  
  // Collaboration State
  const [comments, setComments] = useState<Record<number, string[]>>({});
  const [activeCommentId, setActiveCommentId] = useState<number | null>(null);
  const [newComment, setNewComment] = useState("");

  // PDF Viewer State
  const [showPdf, setShowPdf] = useState(false);
  const [docId, setDocId] = useState<number | null>(null);
  const [pdfPage, setPdfPage] = useState(1);

  async function load(q?: string) {
    setError("");
    setSearching(!!q);
    try {
      const [clauseData, docData] = await Promise.all([
        getClauses(loanId, q && q.length ? q : undefined),
        getLoanDocuments(loanId)
      ]);
      setClauses(clauseData);
      if (docData && docData.length > 0) {
        setDocId(docData[0].id);
      }
      setDisplayCount(20);
    } catch (e: any) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
      setSearching(false);
    }
  }

  useEffect(() => { load(); }, [loanId]);

  const handleSearch = () => load(query);

  const highlightText = (text: string, searchQuery: string) => {
    if (!searchQuery) return text;
    const parts = text.split(new RegExp(`(${searchQuery})`, 'gi'));
    return parts.map((part, i) => 
      part.toLowerCase() === searchQuery.toLowerCase() 
        ? <mark key={i} style={{ background: 'var(--accent-warning-dim)', color: 'var(--accent-warning)', padding: '0 2px', borderRadius: 2 }}>{part}</mark>
        : part
    );
  };

  const jumpToPage = (page: number) => {
    setPdfPage(page);
    setShowPdf(true);
  };

  const addComment = (id: number) => {
    if (!newComment.trim()) return;
    setComments({ ...comments, [id]: [...(comments[id] || []), newComment] });
    setNewComment("");
    setActiveCommentId(null);
  };

    if (loading) return <div className="card"><div className="loading-overlay"><div className="spinner" /><span>Loading clauses...</span></div></div>;

    if (error) return (
      <div className="card">
        <div className="empty-state">
          <div style={{ fontSize: 40, marginBottom: 16 }}>🔍</div>
          <div className="h2">Unable to Load Clauses</div>
          <p className="small">{error}</p>
          <button className="btn primary mt-md" onClick={() => load()}>Retry Connection</button>
        </div>
      </div>
    );

    return (
    <div className={`slide-up ${showPdf ? 'split-view' : ''}`} style={{ display: 'flex', gap: 24, height: showPdf ? 'calc(100vh - 250px)' : 'auto' }}>
      <div style={{ flex: 1, overflowY: showPdf ? 'auto' : 'visible', paddingRight: showPdf ? 12 : 0 }}>
        <div className="card mb-md">
          <div className="flex justify-between items-center">
            <div>
              <div className="h2">Clause Explorer</div>
              <h2 className="h3 mt-sm">Search & Browse Agreement Clauses</h2>
            </div>
            {docId && (
              <button className={`btn ${showPdf ? 'primary' : ''}`} onClick={() => setShowPdf(!showPdf)}>
                {showPdf ? 'Close PDF' : 'View PDF Source'}
              </button>
            )}
          </div>

          <div className="search-box mt-lg">
            <input className="input" placeholder="Search clauses..." value={query} onChange={(e) => setQuery(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleSearch()} />
            <button className="btn primary" onClick={handleSearch} disabled={searching}>{searching ? '...' : 'Search'}</button>
          </div>
        </div>

        <div className="card">
          {clauses.length === 0 ? (
            <div className="empty-state">No clauses found.</div>
          ) : (
            <div className="flex-col gap-md" style={{ display: 'flex' }}>
              {clauses.slice(0, displayCount).map((clause) => (
                <div key={clause.id} className={`clause-card ${expandedId === clause.id ? 'active' : ''}`}>
                  <div className="clause-header">
                    <div className="clause-title">{query ? highlightText(clause.heading, query) : clause.heading}</div>
                    <div className="flex gap-sm">
                      <button className="tag primary" onClick={() => jumpToPage(clause.page_start)} style={{ cursor: 'pointer' }}>p. {clause.page_start}</button>
                      <button className="btn-icon btn" onClick={() => setActiveCommentId(activeCommentId === clause.id ? null : clause.id)}>💬</button>
                      <button className="btn-icon btn" onClick={() => setExpandedId(expandedId === clause.id ? null : clause.id)}>{expandedId === clause.id ? '−' : '+'}</button>
                    </div>
                  </div>
                  
                  <div className="clause-body" style={{ maxHeight: expandedId === clause.id ? 'none' : '80px', overflow: 'hidden' }}>
                    {query ? highlightText(clause.body, query) : clause.body}
                  </div>

                  {/* Comments Section */}
                  {(activeCommentId === clause.id || (comments[clause.id] && comments[clause.id].length > 0)) && (
                    <div className="mt-md pt-md" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                      {comments[clause.id]?.map((c, i) => (
                        <div key={i} className="small mb-sm" style={{ padding: '8px 12px', background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)' }}>
                          <span style={{ fontWeight: 600, color: 'var(--accent-primary)' }}>Legal Team:</span> {c}
                        </div>
                      ))}
                      {activeCommentId === clause.id && (
                        <div className="flex gap-sm mt-sm">
                          <input className="input" style={{ padding: '8px 12px', fontSize: 12 }} placeholder="Add a comment..." value={newComment} onChange={(e) => setNewComment(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && addComment(clause.id)} />
                          <button className="btn success" style={{ padding: '8px 12px' }} onClick={() => addComment(clause.id)}>Post</button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {displayCount < clauses.length && <button className="btn mt-lg" onClick={() => setDisplayCount(prev => prev + 20)}>Load More</button>}
            </div>
          )}
        </div>
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
    <Suspense fallback={<div className="card">Loading...</div>}>
      <ClausesContent />
    </Suspense>
  );
}
