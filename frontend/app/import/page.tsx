'use client';

import { useState, useCallback, useEffect } from 'react';
import { 
  uploadCSV, 
  fetchFromURL, 
  getImportFields, 
  executeImport, 
  getImportJobs, 
  getImportJob,
  loadDemoPortfolio,
  getDemoStats
} from '../../lib/api';
import { Upload, Link, FileSpreadsheet, CheckCircle, AlertCircle, Loader2, Database, Zap, ArrowRight } from 'lucide-react';

interface SchemaDetection {
  columns: string[];
  sample_data: Record<string, any>[];
  row_count: number;
  suggested_mapping: Record<string, string>;
}

interface InternalField {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

interface ImportJob {
  id: number;
  source_type: string;
  original_filename: string;
  status: string;
  total_rows: number;
  imported_rows: number;
  failed_rows: number;
  created_at: string;
}

export default function DataImportPage() {
  // State
  const [activeTab, setActiveTab] = useState<'upload' | 'url' | 'demo'>('upload');
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Schema mapping state
  const [jobId, setJobId] = useState<number | null>(null);
  const [schema, setSchema] = useState<SchemaDetection | null>(null);
  const [internalFields, setInternalFields] = useState<InternalField[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  
  // URL input
  const [urlInput, setUrlInput] = useState('');
  
  // Jobs history
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [showJobs, setShowJobs] = useState(false);
  
  // Demo data
  const [demoStats, setDemoStats] = useState<any>(null);
  const [loadingDemo, setLoadingDemo] = useState(false);

  // Load internal fields on mount
  useEffect(() => {
    loadInternalFields();
    loadJobs();
    loadDemoStatsData();
  }, []);

  const loadInternalFields = async () => {
    try {
      const data = await getImportFields();
      setInternalFields(data.fields || []);
    } catch (e) {
      console.error('Failed to load fields:', e);
    }
  };

  const loadJobs = async () => {
    try {
      const data = await getImportJobs();
      setJobs(data.jobs || []);
    } catch (e) {
      console.error('Failed to load jobs:', e);
    }
  };

  const loadDemoStatsData = async () => {
    try {
      const data = await getDemoStats();
      setDemoStats(data);
    } catch (e) {
      console.error('Failed to load demo stats:', e);
    }
  };

  // Handle file drop
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const files = e.dataTransfer.files;
    if (files && files[0]) {
      await handleFileUpload(files[0]);
    }
  }, []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      await handleFileUpload(files[0]);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!file.name.endsWith('.csv')) {
      setError('Only CSV files are supported');
      return;
    }
    
    setUploading(true);
    setError(null);
    
    try {
      const result = await uploadCSV(file);
      setJobId(result.job_id);
      setSchema(result.schema);
      setMapping(result.schema.suggested_mapping || {});
      window.dispatchEvent(new CustomEvent('loantwin-toast', { 
        detail: { message: `Detected ${result.schema.row_count} rows in ${file.name}`, type: 'success' } 
      }));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };

  const handleURLFetch = async () => {
    if (!urlInput.trim()) {
      setError('Please enter a URL');
      return;
    }
    
    setUploading(true);
    setError(null);
    
    try {
      const result = await fetchFromURL(urlInput);
      setJobId(result.job_id);
      setSchema(result.schema);
      setMapping(result.schema.suggested_mapping || {});
      window.dispatchEvent(new CustomEvent('loantwin-toast', { 
        detail: { message: `Fetched ${result.schema.row_count} rows from URL`, type: 'success' } 
      }));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };

  const handleMappingChange = (sourceCol: string, targetField: string) => {
    setMapping(prev => ({
      ...prev,
      [sourceCol]: targetField
    }));
  };

  const handleExecuteImport = async () => {
    if (!jobId) return;
    
    setImporting(true);
    setError(null);
    
    try {
      const result = await executeImport(jobId, mapping);
      window.dispatchEvent(new CustomEvent('loantwin-toast', { 
        detail: { message: result.message || 'Import started', type: 'success' } 
      }));
      
      // Poll for completion
      if (result.status === 'importing') {
        const pollInterval = setInterval(async () => {
          try {
            const job = await getImportJob(jobId);
            if (job.status === 'completed') {
              clearInterval(pollInterval);
              setImporting(false);
              window.dispatchEvent(new CustomEvent('loantwin-toast', { 
                detail: { message: `Imported ${job.imported_rows} loans successfully`, type: 'success' } 
              }));
              resetState();
              loadJobs();
              loadDemoStatsData();
            } else if (job.status === 'failed') {
              clearInterval(pollInterval);
              setImporting(false);
              setError(job.error_message || 'Import failed');
            }
          } catch (e) {
            console.error('Poll error:', e);
          }
        }, 2000);
      } else {
        setImporting(false);
        resetState();
        loadJobs();
      }
    } catch (e: any) {
      setError(e.message);
      setImporting(false);
    }
  };

  const handleLoadDemo = async () => {
    setLoadingDemo(true);
    setError(null);
    
    try {
      const result = await loadDemoPortfolio(500);
      window.dispatchEvent(new CustomEvent('loantwin-toast', { 
        detail: { message: result.message, type: 'success' } 
      }));
      loadDemoStatsData();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoadingDemo(false);
    }
  };

  const resetState = () => {
    setJobId(null);
    setSchema(null);
    setMapping({});
    setUrlInput('');
  };

  return (
    <div className="space-y-lg">
      {/* Header */}
      <div className="flex justify-between items-center flex-mobile-wrap gap-md">
        <div>
          <h1 className="h1 flex items-center gap-md">
            <Database size={32} className="text-accent-primary" />
            Data Import Center
          </h1>
          <p className="body opacity-70">Import loan portfolios from CSV files, URLs, or use demo data</p>
        </div>
        <button className="btn" onClick={() => setShowJobs(!showJobs)}>
          <FileSpreadsheet size={16} />
          {showJobs ? 'Hide History' : 'Import History'} ({jobs.length})
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="card" style={{ borderColor: 'var(--accent-danger)', background: 'var(--accent-danger-dim)' }}>
          <div className="flex items-center gap-sm">
            <AlertCircle size={20} style={{ color: 'var(--accent-danger)' }} />
            <span>{error}</span>
            <button className="btn small ml-auto" onClick={() => setError(null)}>Dismiss</button>
          </div>
        </div>
      )}

      {/* Import History */}
      {showJobs && jobs.length > 0 && (
        <div className="card">
          <h3 className="h3 mb-md">Import History</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-default)' }}>
                  <th className="text-left p-sm">File</th>
                  <th className="text-left p-sm">Source</th>
                  <th className="text-left p-sm">Status</th>
                  <th className="text-right p-sm">Rows</th>
                  <th className="text-right p-sm">Imported</th>
                  <th className="text-left p-sm">Date</th>
                </tr>
              </thead>
              <tbody>
                {jobs.slice(0, 10).map(job => (
                  <tr key={job.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td className="p-sm">{job.original_filename || 'Unknown'}</td>
                    <td className="p-sm">
                      <span className="tag">{job.source_type}</span>
                    </td>
                    <td className="p-sm">
                      <span className={`tag ${job.status === 'completed' ? 'success' : job.status === 'failed' ? 'danger' : 'warning'}`}>
                        {job.status}
                      </span>
                    </td>
                    <td className="p-sm text-right">{job.total_rows.toLocaleString()}</td>
                    <td className="p-sm text-right">{job.imported_rows.toLocaleString()}</td>
                    <td className="p-sm small opacity-70">{new Date(job.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Main Content - Show either import form or schema mapping */}
      {!schema ? (
        <>
          {/* Tab Navigation */}
          <div className="flex gap-sm" style={{ borderBottom: '1px solid var(--border-default)', paddingBottom: 'var(--space-sm)' }}>
            <button 
              className={`btn ${activeTab === 'upload' ? 'primary' : ''}`}
              onClick={() => setActiveTab('upload')}
            >
              <Upload size={16} /> CSV Upload
            </button>
            <button 
              className={`btn ${activeTab === 'url' ? 'primary' : ''}`}
              onClick={() => setActiveTab('url')}
            >
              <Link size={16} /> URL Connector
            </button>
            <button 
              className={`btn ${activeTab === 'demo' ? 'primary' : ''}`}
              onClick={() => setActiveTab('demo')}
            >
              <Zap size={16} /> Demo Data
            </button>
          </div>

          {/* CSV Upload Tab */}
          {activeTab === 'upload' && (
            <div 
              className={`card ${dragActive ? 'ring-2' : ''}`}
              style={{ 
                border: dragActive ? '2px dashed var(--accent-primary)' : '2px dashed var(--border-default)',
                background: dragActive ? 'var(--accent-primary-dim)' : 'transparent',
                transition: 'all 0.2s',
                cursor: 'pointer'
              }}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => document.getElementById('file-input')?.click()}
            >
              <div className="text-center py-xl">
                {uploading ? (
                  <>
                    <Loader2 size={48} className="mx-auto mb-md animate-spin" style={{ color: 'var(--accent-primary)' }} />
                    <p className="body">Analyzing CSV structure...</p>
                  </>
                ) : (
                  <>
                    <Upload size={48} className="mx-auto mb-md opacity-50" />
                    <h3 className="h3 mb-sm">Drop CSV file here or click to browse</h3>
                    <p className="small opacity-70">Supports Lending Club format and custom schemas</p>
                    <p className="small opacity-50 mt-sm">Max file size: 50MB</p>
                  </>
                )}
              </div>
              <input 
                id="file-input"
                type="file" 
                accept=".csv"
                onChange={handleFileSelect}
                style={{ display: 'none' }}
              />
            </div>
          )}

          {/* URL Connector Tab */}
          {activeTab === 'url' && (
            <div className="card">
              <h3 className="h3 mb-md">Fetch from URL</h3>
              <p className="small opacity-70 mb-lg">
                Enter a direct link to a CSV file. Supports public URLs from Kaggle (download links), S3, Dropbox, etc.
              </p>
              
              <div className="flex gap-md flex-mobile-wrap">
                <input
                  type="url"
                  className="input flex-1"
                  placeholder="https://example.com/data.csv"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  disabled={uploading}
                />
                <button 
                  className="btn primary"
                  onClick={handleURLFetch}
                  disabled={uploading || !urlInput.trim()}
                >
                  {uploading ? <Loader2 size={16} className="animate-spin" /> : <Link size={16} />}
                  Fetch Data
                </button>
              </div>
              
              <div className="mt-lg p-md" style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)' }}>
                <p className="small font-bold mb-sm">Example URLs:</p>
                <ul className="small opacity-70 space-y-xs">
                  <li>• Kaggle: Use "Download" button URL (requires authentication)</li>
                  <li>• S3: Use pre-signed URL for private buckets</li>
                  <li>• Dropbox: Change "dl=0" to "dl=1" in share link</li>
                </ul>
              </div>
            </div>
          )}

          {/* Demo Data Tab */}
          {activeTab === 'demo' && (
            <div className="card">
              <div className="flex justify-between items-start flex-mobile-wrap gap-lg">
                <div>
                  <h3 className="h3 mb-sm">Lending Club Demo Portfolio</h3>
                  <p className="body opacity-70 mb-lg">
                    Load a synthetic dataset of 500 loans modeled on Lending Club patterns. 
                    Perfect for testing risk assessment and exploring platform features.
                  </p>
                  
                  <button 
                    className="btn primary"
                    onClick={handleLoadDemo}
                    disabled={loadingDemo}
                  >
                    {loadingDemo ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
                    Load Demo Portfolio
                  </button>
                </div>
                
                {demoStats?.loaded && (
                  <div className="card-inner" style={{ minWidth: 280 }}>
                    <h4 className="small font-bold mb-md">Current Demo Data</h4>
                    <div className="space-y-sm small">
                      <div className="flex justify-between">
                        <span className="opacity-70">Total Loans</span>
                        <span className="font-bold">{demoStats.count?.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="opacity-70">Default Rate</span>
                        <span className="font-bold" style={{ color: 'var(--accent-danger)' }}>{demoStats.default_rate}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="opacity-70">Avg Loan Amount</span>
                        <span className="font-bold">${demoStats.averages?.loan_amount?.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="opacity-70">Avg Interest Rate</span>
                        <span className="font-bold">{demoStats.averages?.interest_rate}%</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              {demoStats?.loaded && (
                <div className="mt-lg">
                  <h4 className="small font-bold mb-md">Grade Distribution</h4>
                  <div className="flex gap-sm flex-wrap">
                    {Object.entries(demoStats.grade_distribution || {}).sort().map(([grade, count]) => (
                      <div key={grade} className="card-inner text-center" style={{ minWidth: 60 }}>
                        <div className="h2" style={{ color: 'var(--accent-primary)' }}>{grade}</div>
                        <div className="small opacity-70">{(count as number).toLocaleString()}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        /* Schema Mapping Interface */
        <div className="card">
          <div className="flex justify-between items-center mb-lg">
            <div>
              <h3 className="h3">Map Columns to Fields</h3>
              <p className="small opacity-70">
                Detected {schema.row_count.toLocaleString()} rows with {schema.columns.length} columns
              </p>
            </div>
            <div className="flex gap-sm">
              <button className="btn" onClick={resetState}>Cancel</button>
              <button 
                className="btn primary"
                onClick={handleExecuteImport}
                disabled={importing}
              >
                {importing ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
                Execute Import
              </button>
            </div>
          </div>

          {/* Data Preview */}
          <div className="mb-lg">
            <h4 className="small font-bold mb-sm">Data Preview</h4>
            <div className="overflow-x-auto" style={{ maxHeight: 200 }}>
              <table className="w-full small">
                <thead>
                  <tr style={{ background: 'var(--bg-elevated)' }}>
                    {schema.columns.map(col => (
                      <th key={col} className="p-xs text-left whitespace-nowrap">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {schema.sample_data.slice(0, 3).map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      {schema.columns.map(col => (
                        <td key={col} className="p-xs whitespace-nowrap" style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {row[col] !== null ? String(row[col]) : '-'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Column Mapping */}
          <h4 className="small font-bold mb-md">Column Mapping</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-md">
            {schema.columns.map(col => (
              <div key={col} className="card-inner">
                <label className="small font-bold block mb-xs">{col}</label>
                <select 
                  className="input w-full"
                  value={mapping[col] || ''}
                  onChange={(e) => handleMappingChange(col, e.target.value)}
                >
                  <option value="">-- Skip --</option>
                  {internalFields.map(field => (
                    <option key={field.name} value={field.name}>
                      {field.name} {field.required ? '*' : ''} ({field.type})
                    </option>
                  ))}
                </select>
                {mapping[col] && (
                  <p className="small opacity-50 mt-xs">
                    {internalFields.find(f => f.name === mapping[col])?.description}
                  </p>
                )}
              </div>
            ))}
          </div>

          {/* Required Fields Check */}
          <div className="mt-lg p-md" style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)' }}>
            <h4 className="small font-bold mb-sm">Required Fields</h4>
            <div className="flex gap-md flex-wrap">
              {internalFields.filter(f => f.required).map(field => {
                const isMapped = Object.values(mapping).includes(field.name);
                return (
                  <div key={field.name} className="flex items-center gap-xs">
                    {isMapped ? (
                      <CheckCircle size={16} style={{ color: 'var(--accent-success)' }} />
                    ) : (
                      <AlertCircle size={16} style={{ color: 'var(--accent-warning)' }} />
                    )}
                    <span className={`small ${isMapped ? '' : 'opacity-50'}`}>{field.name}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="card">
        <h3 className="h3 mb-md">Next Steps</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-md">
          <a href="/credit-risk" className="card-inner hover:scale-102 transition-transform">
            <div className="flex items-center gap-sm mb-sm">
              <div style={{ background: 'var(--accent-danger-dim)', padding: 8, borderRadius: 'var(--radius-sm)' }}>
                <AlertCircle size={20} style={{ color: 'var(--accent-danger)' }} />
              </div>
              <span className="font-bold">Credit Risk</span>
            </div>
            <p className="small opacity-70">Analyze default probability and risk factors</p>
          </a>
          
          <a href="/vetting" className="card-inner hover:scale-102 transition-transform">
            <div className="flex items-center gap-sm mb-sm">
              <div style={{ background: 'var(--accent-warning-dim)', padding: 8, borderRadius: 'var(--radius-sm)' }}>
                <FileSpreadsheet size={20} style={{ color: 'var(--accent-warning)' }} />
              </div>
              <span className="font-bold">Vetting Center</span>
            </div>
            <p className="small opacity-70">Verify documents and complete due diligence</p>
          </a>
          
          <a href="/" className="card-inner hover:scale-102 transition-transform">
            <div className="flex items-center gap-sm mb-sm">
              <div style={{ background: 'var(--accent-success-dim)', padding: 8, borderRadius: 'var(--radius-sm)' }}>
                <CheckCircle size={20} style={{ color: 'var(--accent-success)' }} />
              </div>
              <span className="font-bold">Dashboard</span>
            </div>
            <p className="small opacity-70">View portfolio overview and analytics</p>
          </a>
        </div>
      </div>
    </div>
  );
}
