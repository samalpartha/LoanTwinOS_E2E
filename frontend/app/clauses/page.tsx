'use client';
import { useEffect, useState } from "react";
import { getClauses } from "../../lib/api";
import { useLoan } from "../../lib/LoanContext";

export default function Page() {
  const { activeLoanId } = useLoan();
  const loanId = activeLoanId || 1;
  const [query, setQuery] = useState("");
  const [clauses, setClauses] = useState<any[]>([]);
  const [err, setErr] = useState("");

  async function load(q?: string) {
    setErr("");
    try {
      const data = await getClauses(loanId, q && q.length ? q : undefined);
      setClauses(data);
    } catch (e:any) {
      setErr(e.message || String(e));
    }
  }

  useEffect(() => { load(); }, [loanId]);

  return (
    <div className="card">
      <div className="h2">Clause Explorer</div>
      <div style={{display:"flex", gap:10, marginTop:10}}>
        <input className="input" placeholder="Search clauses (e.g., governing law, assignment, covenant)" value={query} onChange={(e)=>setQuery(e.target.value)} />
        <button className="btn primary" onClick={()=>load(query)}>Search</button>
      </div>

      {err && <div className="small" style={{color:"#ffb4b4", marginTop:10}}>{err}</div>}

      <div className="small" style={{marginTop:10}}>Showing {clauses.length} clauses (top 30 rendered).</div>

      <div style={{display:"grid", gap:12, marginTop:12}}>
        {clauses.slice(0, 30).map(c => (
          <div key={c.id} className="card" style={{background:"rgba(255,255,255,0.02)"}}>
            <div style={{display:"flex", justifyContent:"space-between", gap:10}}>
              <div style={{fontWeight:750}}>{c.heading}</div>
              <span className="tag">pp. {c.page_start}-{c.page_end}</span>
            </div>
            <div className="small" style={{marginTop:8, whiteSpace:"pre-wrap"}}>{c.body.slice(0, 700)}{c.body.length>700 ? "…" : ""}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
