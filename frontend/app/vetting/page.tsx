'use client';

import { useState, useEffect } from 'react';
import { 
  getAllChecklists,
  getVettingStatus,
  getVerificationQueue,
  verifyDocument,
  aiVerifyDocument,
  getLoanApplications,
  submitVettingDocument,
  seedDocumentRequirements
} from '../../lib/api';
import { 
  ClipboardCheck, 
  FileCheck, 
  Upload, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertCircle,
  RefreshCw,
  Brain,
  Eye,
  Loader2,
  FileText,
  Building,
  Briefcase
} from 'lucide-react';

interface DocumentRequirement {
  id: number;
  loan_type: string;
  document_name: string;
  description: string;
  required: boolean;
  verification_type: string;
  order: number;
}

interface VettingItem {
  requirement_id: number;
  document_name: string;
  description: string;
  required: boolean;
  verification_type: string;
  status: string;
  submission_id?: number;
  filename?: string;
  submitted_at?: string;
  rejection_reason?: string;
  ai_analysis?: string;
}

interface PendingVerification {
  submission_id: number;
  application_id: number;
  requirement_id: number;
  document_name: string;
  filename: string;
  file_size: number;
  submitted_at: string;
  loan_amount: number;
  grade: string;
  verification_type: string;
}

interface Application {
  id: number;
  loan_amount: number;
  grade: string;
  loan_type: string;
  status: string;
}

export default function VettingCenterPage() {
  // State
  const [checklists, setChecklists] = useState<Record<string, DocumentRequirement[]>>({});
  const [applications, setApplications] = useState<Application[]>([]);
  const [selectedApp, setSelectedApp] = useState<number | null>(null);
  const [vettingStatus, setVettingStatus] = useState<any>(null);
  const [queue, setQueue] = useState<PendingVerification[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'applications' | 'queue' | 'checklists'>('applications');
  
  // Actions
  const [verifying, setVerifying] = useState<number | null>(null);
  const [uploading, setUploading] = useState<number | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedApp) {
      loadVettingStatus(selectedApp);
    }
  }, [selectedApp]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [checklistData, appsData, queueData] = await Promise.all([
        getAllChecklists(),
        getLoanApplications(50),
        getVerificationQueue()
      ]);
      
      setChecklists(checklistData.checklists || {});
      setApplications(appsData.applications || []);
      setQueue(queueData.verifications || []);
      
      // If no checklists, seed them
      if (Object.keys(checklistData.checklists || {}).length === 0) {
        await seedDocumentRequirements();
        const refreshed = await getAllChecklists();
        setChecklists(refreshed.checklists || {});
      }
    } catch (e) {
      console.error('Failed to load data:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadVettingStatus = async (appId: number) => {
    try {
      const status = await getVettingStatus(appId);
      setVettingStatus(status);
    } catch (e) {
      console.error('Failed to load vetting status:', e);
      setVettingStatus(null);
    }
  };

  const handleVerify = async (submissionId: number, verified: boolean, reason?: string) => {
    setVerifying(submissionId);
    try {
      await verifyDocument(submissionId, verified, reason);
      window.dispatchEvent(new CustomEvent('loantwin-toast', { 
        detail: { message: verified ? 'Document verified' : 'Document rejected', type: verified ? 'success' : 'info' } 
      }));
      loadData();
      if (selectedApp) loadVettingStatus(selectedApp);
    } catch (e: any) {
      window.dispatchEvent(new CustomEvent('loantwin-toast', { 
        detail: { message: e.message, type: 'error' } 
      }));
    } finally {
      setVerifying(null);
    }
  };

  const handleAIVerify = async (submissionId: number) => {
    setVerifying(submissionId);
    try {
      const result = await aiVerifyDocument(submissionId);
      window.dispatchEvent(new CustomEvent('loantwin-toast', { 
        detail: { message: `AI recommends: ${result.recommendation}`, type: 'success' } 
      }));
      loadData();
      if (selectedApp) loadVettingStatus(selectedApp);
    } catch (e: any) {
      window.dispatchEvent(new CustomEvent('loantwin-toast', { 
        detail: { message: e.message, type: 'error' } 
      }));
    } finally {
      setVerifying(null);
    }
  };

  const handleFileUpload = async (appId: number, reqId: number, file: File) => {
    setUploading(reqId);
    try {
      await submitVettingDocument(appId, reqId, file);
      window.dispatchEvent(new CustomEvent('loantwin-toast', { 
        detail: { message: 'Document uploaded for verification', type: 'success' } 
      }));
      loadVettingStatus(appId);
      loadData();
    } catch (e: any) {
      window.dispatchEvent(new CustomEvent('loantwin-toast', { 
        detail: { message: e.message, type: 'error' } 
      }));
    } finally {
      setUploading(null);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'verified': return <CheckCircle size={16} style={{ color: 'var(--accent-success)' }} />;
      case 'rejected': return <XCircle size={16} style={{ color: 'var(--accent-danger)' }} />;
      case 'pending': return <Clock size={16} style={{ color: 'var(--accent-warning)' }} />;
      default: return <AlertCircle size={16} style={{ color: 'var(--text-muted)' }} />;
    }
  };

  const getLoanTypeIcon = (type: string) => {
    switch (type) {
      case 'personal': return <FileText size={20} />;
      case 'commercial': return <Building size={20} />;
      case 'syndicated': return <Briefcase size={20} />;
      default: return <FileCheck size={20} />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center" style={{ minHeight: 400 }}>
        <div className="text-center">
          <Loader2 size={48} className="animate-spin mx-auto mb-md" style={{ color: 'var(--accent-primary)' }} />
          <p>Loading vetting center...</p>
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
            <ClipboardCheck size={32} style={{ color: 'var(--accent-warning)' }} />
            Vetting Center
          </h1>
          <p className="body opacity-70">Document verification and due diligence workflow</p>
        </div>
        <div className="flex gap-sm">
          <button className="btn" onClick={loadData}>
            <RefreshCw size={16} /> Refresh
          </button>
          {queue.length > 0 && (
            <span className="tag warning">{queue.length} pending verification</span>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-sm" style={{ borderBottom: '1px solid var(--border-default)', paddingBottom: 'var(--space-sm)' }}>
        <button 
          className={`btn ${activeTab === 'applications' ? 'primary' : ''}`}
          onClick={() => setActiveTab('applications')}
        >
          <FileCheck size={16} /> Applications ({applications.length})
        </button>
        <button 
          className={`btn ${activeTab === 'queue' ? 'primary' : ''}`}
          onClick={() => setActiveTab('queue')}
        >
          <Clock size={16} /> Verification Queue ({queue.length})
        </button>
        <button 
          className={`btn ${activeTab === 'checklists' ? 'primary' : ''}`}
          onClick={() => setActiveTab('checklists')}
        >
          <ClipboardCheck size={16} /> Checklists
        </button>
      </div>

      {/* Applications Tab */}
      {activeTab === 'applications' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg">
          {/* Application List */}
          <div className="card">
            <h3 className="h3 mb-md">Loan Applications</h3>
            {applications.length === 0 ? (
              <div className="text-center py-lg opacity-50">
                <FileCheck size={48} className="mx-auto mb-md opacity-30" />
                <p>No applications yet</p>
                <a href="/import" className="btn primary mt-md">Import Data</a>
              </div>
            ) : (
              <div className="space-y-sm" style={{ maxHeight: 500, overflowY: 'auto' }}>
                {applications.map(app => (
                  <div 
                    key={app.id}
                    className={`card-inner cursor-pointer transition-all ${selectedApp === app.id ? 'ring-2' : ''}`}
                    style={{ 
                      borderLeft: selectedApp === app.id ? '3px solid var(--accent-primary)' : '3px solid transparent',
                      cursor: 'pointer'
                    }}
                    onClick={() => setSelectedApp(app.id)}
                  >
                    <div className="flex justify-between items-center">
                      <div>
                        <span className="font-bold">#{app.id}</span>
                        <span className="small opacity-70 ml-sm">${app.loan_amount.toLocaleString()}</span>
                      </div>
                      <div className="flex gap-xs">
                        <span className="tag">{app.grade}</span>
                        <span className="tag">{app.loan_type}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Vetting Status */}
          <div className="lg:col-span-2">
            {selectedApp && vettingStatus ? (
              <div className="card">
                <div className="flex justify-between items-center mb-lg">
                  <div>
                    <h3 className="h3">Application #{selectedApp}</h3>
                    <p className="small opacity-70">
                      Type: {vettingStatus.loan_type} • Status: {vettingStatus.overall_status}
                    </p>
                  </div>
                  <div className="flex items-center gap-md">
                    <div className="text-center">
                      <div className="h2" style={{ color: vettingStatus.ready_for_approval ? 'var(--accent-success)' : 'var(--accent-warning)' }}>
                        {vettingStatus.completion_percentage.toFixed(0)}%
                      </div>
                      <div className="small opacity-70">Complete</div>
                    </div>
                    {vettingStatus.ready_for_approval && (
                      <span className="tag success">Ready for Approval</span>
                    )}
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mb-lg">
                  <div style={{ 
                    height: 8, 
                    background: 'var(--bg-elevated)', 
                    borderRadius: 'var(--radius-full)',
                    overflow: 'hidden'
                  }}>
                    <div style={{ 
                      width: `${vettingStatus.completion_percentage}%`,
                      height: '100%',
                      background: vettingStatus.ready_for_approval ? 'var(--accent-success)' : 'var(--accent-primary)',
                      transition: 'width 0.3s'
                    }} />
                  </div>
                  <div className="flex justify-between mt-sm small opacity-70">
                    <span>{vettingStatus.verified_documents}/{vettingStatus.required_documents} required docs verified</span>
                    <span>{vettingStatus.rejected_documents > 0 ? `${vettingStatus.rejected_documents} rejected` : ''}</span>
                  </div>
                </div>

                {/* Document Checklist */}
                <div className="space-y-md">
                  {vettingStatus.checklist?.map((item: VettingItem) => (
                    <div 
                      key={item.requirement_id}
                      className="card-inner"
                      style={{ 
                        borderLeft: `3px solid ${
                          item.status === 'verified' ? 'var(--accent-success)' :
                          item.status === 'rejected' ? 'var(--accent-danger)' :
                          item.status === 'pending' ? 'var(--accent-warning)' : 'var(--border-default)'
                        }`
                      }}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-sm mb-xs">
                            {getStatusIcon(item.status)}
                            <span className="font-bold">{item.document_name}</span>
                            {item.required && <span className="tag danger small">Required</span>}
                            <span className="tag small">{item.verification_type}</span>
                          </div>
                          <p className="small opacity-70">{item.description}</p>
                          
                          {item.filename && (
                            <p className="small mt-sm">
                              <FileText size={12} className="inline mr-xs" />
                              {item.filename}
                              {item.submitted_at && (
                                <span className="opacity-50 ml-sm">
                                  Submitted: {new Date(item.submitted_at).toLocaleDateString()}
                                </span>
                              )}
                            </p>
                          )}
                          
                          {item.rejection_reason && (
                            <p className="small mt-sm" style={{ color: 'var(--accent-danger)' }}>
                              Rejection: {item.rejection_reason}
                            </p>
                          )}
                        </div>
                        
                        <div className="flex gap-sm">
                          {item.status === 'not_submitted' && (
                            <label className="btn small primary cursor-pointer">
                              <Upload size={14} />
                              {uploading === item.requirement_id ? 'Uploading...' : 'Upload'}
                              <input 
                                type="file" 
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleFileUpload(selectedApp!, item.requirement_id, file);
                                }}
                                disabled={uploading === item.requirement_id}
                              />
                            </label>
                          )}
                          
                          {item.status === 'pending' && item.submission_id && (
                            <>
                              <button 
                                className="btn small success"
                                onClick={() => handleVerify(item.submission_id!, true)}
                                disabled={verifying === item.submission_id}
                              >
                                <CheckCircle size={14} /> Verify
                              </button>
                              <button 
                                className="btn small danger"
                                onClick={() => {
                                  const reason = prompt('Rejection reason:');
                                  if (reason) handleVerify(item.submission_id!, false, reason);
                                }}
                                disabled={verifying === item.submission_id}
                              >
                                <XCircle size={14} /> Reject
                              </button>
                              <button 
                                className="btn small"
                                onClick={() => handleAIVerify(item.submission_id!)}
                                disabled={verifying === item.submission_id}
                              >
                                <Brain size={14} /> AI Check
                              </button>
                            </>
                          )}
                          
                          {item.status === 'rejected' && (
                            <label className="btn small warning cursor-pointer">
                              <RefreshCw size={14} /> Re-upload
                              <input 
                                type="file" 
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0];
                                  if (file) handleFileUpload(selectedApp!, item.requirement_id, file);
                                }}
                              />
                            </label>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="card text-center py-xl">
                <Eye size={64} className="mx-auto mb-md opacity-30" />
                <h3 className="h3 mb-sm">Select an Application</h3>
                <p className="body opacity-70">Choose an application from the list to view its vetting status</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Verification Queue Tab */}
      {activeTab === 'queue' && (
        <div className="card">
          <h3 className="h3 mb-md">Pending Verifications</h3>
          
          {queue.length === 0 ? (
            <div className="text-center py-xl">
              <CheckCircle size={64} className="mx-auto mb-md opacity-30" style={{ color: 'var(--accent-success)' }} />
              <h3 className="h3 mb-sm">All Caught Up!</h3>
              <p className="body opacity-70">No documents pending verification</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-default)' }}>
                    <th className="text-left p-sm">Application</th>
                    <th className="text-left p-sm">Document</th>
                    <th className="text-left p-sm">File</th>
                    <th className="text-left p-sm">Type</th>
                    <th className="text-left p-sm">Submitted</th>
                    <th className="text-right p-sm">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {queue.map(item => (
                    <tr key={item.submission_id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td className="p-sm">
                        <div>
                          <span className="font-bold">#{item.application_id}</span>
                          <span className="small opacity-70 block">
                            ${item.loan_amount.toLocaleString()} • Grade {item.grade}
                          </span>
                        </div>
                      </td>
                      <td className="p-sm">{item.document_name}</td>
                      <td className="p-sm">
                        <span className="small">{item.filename}</span>
                        <span className="small opacity-50 block">
                          {(item.file_size / 1024).toFixed(1)} KB
                        </span>
                      </td>
                      <td className="p-sm">
                        <span className="tag">{item.verification_type}</span>
                      </td>
                      <td className="p-sm small opacity-70">
                        {new Date(item.submitted_at).toLocaleString()}
                      </td>
                      <td className="p-sm text-right">
                        <div className="flex gap-xs justify-end">
                          <button 
                            className="btn small success"
                            onClick={() => handleVerify(item.submission_id, true)}
                            disabled={verifying === item.submission_id}
                          >
                            {verifying === item.submission_id ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
                          </button>
                          <button 
                            className="btn small danger"
                            onClick={() => {
                              const reason = prompt('Rejection reason:');
                              if (reason) handleVerify(item.submission_id, false, reason);
                            }}
                            disabled={verifying === item.submission_id}
                          >
                            <XCircle size={14} />
                          </button>
                          <button 
                            className="btn small"
                            onClick={() => handleAIVerify(item.submission_id)}
                            disabled={verifying === item.submission_id}
                          >
                            <Brain size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Checklists Tab */}
      {activeTab === 'checklists' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-lg">
          {Object.entries(checklists).map(([loanType, requirements]) => (
            <div key={loanType} className="card">
              <div className="flex items-center gap-sm mb-md">
                {getLoanTypeIcon(loanType)}
                <h3 className="h3 capitalize">{loanType} Loans</h3>
              </div>
              
              <div className="space-y-sm">
                {requirements.map((req, idx) => (
                  <div key={req.id} className="card-inner">
                    <div className="flex items-start gap-sm">
                      <span className="small opacity-50" style={{ minWidth: 20 }}>{idx + 1}.</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-xs mb-xs">
                          <span className="font-bold small">{req.document_name}</span>
                          {req.required && <span className="tag danger" style={{ fontSize: 9 }}>REQ</span>}
                        </div>
                        <p className="small opacity-70">{req.description}</p>
                        <span className="tag small mt-xs">{req.verification_type}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="mt-md pt-md" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <div className="flex justify-between small opacity-70">
                  <span>{requirements.filter(r => r.required).length} required</span>
                  <span>{requirements.filter(r => !r.required).length} optional</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
