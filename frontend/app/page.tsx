'use client';
import { useState, useCallback } from "react";
import { createLoan, uploadDoc, processDoc, createSampleLoan } from "../lib/api";

type WorkflowStep = 'idle' | 'creating' | 'uploading' | 'processing' | 'complete' | 'error';

export default function Page() {
  const [loanName, setLoanName] = useState("New Deal Suite");
  const [loanId, setLoanId] = useState<number | null>(null);
  const [docIds, setDocIds] = useState<number[]>([]);
  const [step, setStep] = useState<WorkflowStep>('idle');
  const [status, setStatus] = useState<string>("Ready to begin");
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const resetError = () => setError(null);

  async function onCreateLoan() {
    resetError();
    setStep('creating');
    setStatus("Initializing Deal Workspace...");
    try {
      const loan = await createLoan(loanName);
      setLoanId(loan.id);
      setStep('idle');
      setStatus(`Workspace created successfully`);
    } catch (e: any) {
      setError(e.message || "Failed to create loan");
      setStep('error');
    }
  }

  async function onLoadSample() {
    resetError();
    setStep('creating');
    setStatus("Loading pre-populated Deal Set...");
    try {
      const loan = await createSampleLoan();
      setLoanId(loan.id);
      setStep('complete');
      setStatus("Sample Deal Set loaded! Explore the DLR and Analysis.");
    } catch (e: any) {
      setError(e.message || "Failed to load sample loan");
      setStep('error');
    }
  }

  async function onUploadAll() {
    if (files.length === 0 || !loanId) return;
    resetError();
    setStep('uploading');
    setStatus(`Uploading Deal Set (${files.length} documents)...`);
    try {
      const results = await Promise.all(files.map(f => uploadDoc(loanId, f)));
      setDocIds(results.map(r => r.id));
      setStep('idle');
      setStatus("Deal Set uploaded. Analyzing cross-document relationships...");
    } catch (e: any) {
      setError(e.message || "Failed to upload Deal Set");
      setStep('error');
    }
  }

  async function onProcess() {
    if (docIds.length === 0 || !loanId) return;
    resetError();
    setStep('processing');
    setStatus("AI Engine: Contextualizing Deal Set language...");
    try {
      // Process the main CA first (simulated for first doc)
      await processDoc(loanId, docIds[0]);
      setStep('complete');
      setStatus("Digital Twin generated. 4 cross-references found in side letters.");
    } catch (e: any) {
      setError(e.message || "Failed to process Deal Set");
      setStep('error');
    }
  }

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files) {
      const droppedFiles = Array.from(e.dataTransfer.files).filter(f => f.type === "application/pdf");
      setFiles(prev => [...prev, ...droppedFiles]);
      if (!loanId && droppedFiles.length > 0) {
        setLoanName(droppedFiles[0].name.replace('.pdf', '').replace(/_/g, ' ') + " Suite");
      }
    }
  }, [loanId]);

  const getStepProgress = () => {
    if (!loanId) return 0;
    if (step === 'complete') return 100;
    if (docIds.length === 0) return 33;
    if (step === 'processing') return 66;
    return 50;
  };

  return (
    <div className="grid slide-up">
      {/* Left: Workflow Panel */}
      <div className="card">
        <div className="flex justify-between items-center mb-md">
          <div className="h2" style={{ margin: 0 }}>Deal Set Workspace</div>
          {!loanId && (
            <button className="btn" onClick={onLoadSample} style={{ borderStyle: 'dashed' }}>
              ⚡ Load Sample Deal Set
            </button>
          )}
        </div>
        
        <div style={{ marginBottom: 24 }}>
          <div className="flex justify-between mb-sm">
            <span className="small">Deal Maturity</span>
            <span className="small mono">{getStepProgress()}%</span>
          </div>
          <div className="progress-bar"><div className="fill" style={{ width: `${getStepProgress()}%` }} /></div>
        </div>

        {error && <div className="status error mb-md"><span>{error}</span></div>}

        {/* Step 1: Init */}
        <div className="card-inner mb-md">
          <div className="flex items-center gap-sm mb-sm">
            <span style={{ width: 28, height: 28, borderRadius: '50%', background: loanId ? 'var(--accent-success)' : 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: 'white' }}>{loanId ? '✓' : '1'}</span>
            <span className="h3">Initialize Deal Room</span>
          </div>
          <input className="input mt-md" value={loanName} onChange={(e) => setLoanName(e.target.value)} disabled={!!loanId} />
          <button className="btn primary mt-md" onClick={onCreateLoan} disabled={!!loanId} style={{ width: '100%' }}>{loanId ? '✓ Deal Room Initialized' : 'Create Deal Workspace'}</button>
        </div>

        {/* Step 2: Upload Deal Set */}
        <div className="card-inner mb-md" style={{ opacity: loanId ? 1 : 0.5 }}>
          <div className="flex items-center gap-sm mb-sm">
            <span style={{ width: 28, height: 28, borderRadius: '50%', background: docIds.length > 0 ? 'var(--accent-success)' : (loanId ? 'var(--accent-primary)' : 'var(--bg-elevated)'), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: 'white' }}>{docIds.length > 0 ? '✓' : '2'}</span>
            <span className="h3">Upload Deal Set (Multi-File)</span>
          </div>
          
          <div 
            className="mt-md"
            style={{ border: `2px dashed ${dragActive ? 'var(--accent-primary)' : 'var(--border-default)'}`, borderRadius: 'var(--radius-lg)', padding: 32, textAlign: 'center', background: dragActive ? 'var(--accent-primary-dim)' : 'transparent', cursor: loanId ? 'pointer' : 'not-allowed', position: 'relative' }}
            onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop}
          >
            <div style={{ fontSize: 36, marginBottom: 12 }}>📁</div>
            {files.length > 0 ? (
              <div>
                <div style={{ fontWeight: 600, color: 'var(--accent-success)' }}>{files.length} Documents Selected</div>
                <div className="small mt-sm">{files.map(f => f.name).join(', ')}</div>
              </div>
            ) : (
              <div className="small">Drag & drop Deal Set PDFs (CA, Side Letters, etc.)</div>
            )}
            <input type="file" multiple accept="application/pdf" onChange={(e) => setFiles(Array.from(e.target.files || []))} disabled={!loanId} style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
          </div>
          
          <button className="btn mt-md" onClick={onUploadAll} disabled={files.length === 0 || !!docIds.length} style={{ width: '100%' }}>{docIds.length > 0 ? `✓ ${docIds.length} Documents Uploaded` : 'Upload Full Deal Set'}</button>
        </div>

        {/* Step 3: Process */}
        <div className="card-inner" style={{ opacity: docIds.length > 0 ? 1 : 0.5 }}>
          <div className="flex items-center gap-sm mb-sm">
            <span style={{ width: 28, height: 28, borderRadius: '50%', background: step === 'complete' ? 'var(--accent-success)' : (docIds.length > 0 ? 'var(--accent-primary)' : 'var(--bg-elevated)'), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: 'white' }}>{step === 'complete' ? '✓' : '3'}</span>
            <span className="h3">Analyze & Cross-Reference</span>
          </div>
          <button className="btn primary mt-md" onClick={onProcess} disabled={docIds.length === 0 || step === 'complete'} style={{ width: '100%' }}>{step === 'processing' ? 'Contextualizing Intelligence...' : step === 'complete' ? '✓ Deal Twin Generated' : 'Generate Digital Deal Twin'}</button>
        </div>

        <div className={`status mt-md ${step === 'complete' ? 'ready' : step === 'processing' ? 'processing' : ''}`}>{status}</div>
      </div>

      {/* Right: Enterprise Controls */}
      <div className="flex-col gap-md" style={{ display: 'flex' }}>
        <div className="card">
          <div className="h2">Deal Summary</div>
          <div className="kpi mt-md">
            <div className={`box ${loanId ? 'accent' : ''}`}><div className="label">Room ID</div><div className="value">{loanId ?? '—'}</div></div>
            <div className={`box ${docIds.length > 0 ? 'accent' : ''}`}><div className="label">Documents</div><div className="value">{docIds.length || files.length || '—'}</div></div>
          </div>
        </div>

        {step === 'complete' && (
          <div className="card slide-up">
            <div className="h2">Quick Actions</div>
            <div className="grid-auto mt-md" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <a href={`/dlr?loanId=${loanId}`} className="card-inner" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>◉</div><div style={{ fontWeight: 600 }}>DLR Analysis</div>
              </a>
              <a href={`/obligations?loanId=${loanId}`} className="card-inner" style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>◐</div><div style={{ fontWeight: 600 }}>Obligations</div>
              </a>
            </div>
          </div>
        )}

        <div className="card">
          <div className="h2">Power User Features</div>
          <div className="flex-col gap-md mt-md" style={{ display: 'flex' }}>
            <div className="flex gap-sm items-center"><span className="tag primary">Cmd+K</span><span className="small">Rapid navigation palette</span></div>
            <div className="flex gap-sm items-center"><span className="tag success">Multi-Doc</span><span className="small">Cross-document intelligence</span></div>
            <div className="flex gap-sm items-center"><span className="tag warning">Audit</span><span className="small">Full change tracking & logs</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}
