'use client';
import { useState, useEffect } from 'react';
import { getApprovalQueue, getActionDraft, approveAction, rejectAction, runAgentWorkflow } from '../../lib/api';
import { useLoan } from '../../lib/LoanContext';
import { 
  Bot, 
  RefreshCw, 
  ScanSearch, 
  CheckCircle, 
  XCircle, 
  ChevronDown, 
  ChevronUp,
  FileText,
  FileCheck,
  Bell,
  Mail,
  Zap,
  AlertCircle,
  AlertTriangle,
  Circle,
  Copy,
  Clock,
  Activity,
  TrendingUp
} from 'lucide-react';

interface AgentAction {
  id: string;
  action_type: string;
  title: string;
  description: string;
  loan_id: number;
  priority: string;
  confidence: number;
  created_at: string;
  status: string;
  has_draft: boolean;
  agent_reasoning: string;
  auto_execute_eligible: boolean;
}

interface ApprovalQueueProps {
  onActionComplete?: () => void;
  compact?: boolean;
}

export default function ApprovalQueue({ onActionComplete, compact = false }: ApprovalQueueProps) {
  const { activeLoanId } = useLoan();
  const [actions, setActions] = useState<AgentAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [draftContent, setDraftContent] = useState<string | null>(null);
  const [draftMetadata, setDraftMetadata] = useState<any>(null);
  const [executing, setExecuting] = useState<string | null>(null);
  const [runningWorkflow, setRunningWorkflow] = useState(false);

  const fetchQueue = async () => {
    try {
      const data = await getApprovalQueue(activeLoanId || undefined);
      setActions(data.actions || []);
    } catch (e) {
      console.error('Failed to fetch approval queue:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, [activeLoanId]);

  const handleRunWorkflow = async () => {
    if (!activeLoanId) return;
    setRunningWorkflow(true);
    try {
      const result = await runAgentWorkflow(activeLoanId);
      window.dispatchEvent(new CustomEvent('loantwin-toast', { 
        detail: { message: `Agent generated ${result.recommendations_generated} recommendations`, type: 'success' } 
      }));
      await fetchQueue();
    } catch (e: any) {
      window.dispatchEvent(new CustomEvent('loantwin-toast', { 
        detail: { message: `Workflow failed: ${e.message}`, type: 'error' } 
      }));
    } finally {
      setRunningWorkflow(false);
    }
  };

  const handleViewDraft = async (actionId: string) => {
    if (selectedAction === actionId) {
      setSelectedAction(null);
      setDraftContent(null);
      setDraftMetadata(null);
      return;
    }
    
    try {
      const draft = await getActionDraft(actionId);
      setSelectedAction(actionId);
      setDraftContent(draft.drafted_content);
      setDraftMetadata(draft.metadata);
    } catch (e) {
      console.error('Failed to fetch draft:', e);
    }
  };

  const handleApprove = async (actionId: string) => {
    setExecuting(actionId);
    try {
      const result = await approveAction(actionId);
      window.dispatchEvent(new CustomEvent('loantwin-toast', { 
        detail: { message: `${result.result || 'Action approved and executed'}`, type: 'success' } 
      }));
      await fetchQueue();
      onActionComplete?.();
    } catch (e: any) {
      window.dispatchEvent(new CustomEvent('loantwin-toast', { 
        detail: { message: `Failed: ${e.message}`, type: 'error' } 
      }));
    } finally {
      setExecuting(null);
      setSelectedAction(null);
    }
  };

  const handleReject = async (actionId: string) => {
    const reason = prompt('Reason for rejection (optional):');
    setExecuting(actionId);
    try {
      await rejectAction(actionId, reason || undefined);
      window.dispatchEvent(new CustomEvent('loantwin-toast', { 
        detail: { message: 'Action rejected', type: 'info' } 
      }));
      await fetchQueue();
    } catch (e: any) {
      window.dispatchEvent(new CustomEvent('loantwin-toast', { 
        detail: { message: `Failed: ${e.message}`, type: 'error' } 
      }));
    } finally {
      setExecuting(null);
    }
  };

  const getPriorityConfig = (priority: string) => {
    switch (priority) {
      case 'critical': return { color: 'danger', icon: AlertCircle, label: 'Critical' };
      case 'high': return { color: 'warning', icon: AlertTriangle, label: 'High' };
      case 'medium': return { color: 'primary', icon: Circle, label: 'Medium' };
      default: return { color: '', icon: Circle, label: 'Low' };
    }
  };

  const getActionTypeIcon = (type: string) => {
    switch (type) {
      case 'draft_engagement': return FileText;
      case 'draft_waiver': return FileCheck;
      case 'draft_notice': return Bell;
      case 'send_notification': return Mail;
      default: return Zap;
    }
  };

  if (loading) {
    return (
      <div className="card">
        <div className="flex items-center justify-center gap-md py-xl">
          <span className="spinner" />
          <span className="small opacity-60">Loading Agent Queue...</span>
        </div>
      </div>
    );
  }

  if (compact && actions.length === 0) {
    return null;
  }

  return (
    <div className="card" style={{ 
      borderLeft: actions.length > 0 ? '4px solid var(--accent-warning)' : '4px solid var(--accent-success)'
    }}>
      <div className="flex justify-between items-center mb-md flex-mobile-wrap gap-md">
        <div className="flex items-center gap-sm">
          <div style={{
            width: 40,
            height: 40,
            borderRadius: 'var(--radius-md)',
            background: actions.length > 0 ? 'var(--accent-warning-dim)' : 'var(--accent-success-dim)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <Bot size={20} style={{ color: actions.length > 0 ? 'var(--accent-warning)' : 'var(--accent-success)' }} />
          </div>
          <div>
            <div className="flex items-center gap-sm">
              <h2 className="h2" style={{ margin: 0 }}>Agent Approval Queue</h2>
              {actions.length > 0 && (
                <span className="tag warning" style={{ fontSize: 10 }}>{actions.length} PENDING</span>
              )}
            </div>
            <p className="small opacity-60">Actions drafted by LoanTwin Agent</p>
          </div>
        </div>
        <div className="flex gap-sm">
          <button 
            className="btn primary" 
            onClick={handleRunWorkflow}
            disabled={runningWorkflow || !activeLoanId}
          >
            {runningWorkflow ? (
              <><span className="spinner" style={{ width: 14, height: 14 }} /> Analyzing...</>
            ) : (
              <><ScanSearch size={16} /> Run Analysis</>
            )}
          </button>
          <button className="btn secondary" onClick={fetchQueue}>
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {actions.length === 0 ? (
        <div className="empty-state" style={{ padding: 'var(--space-xl)' }}>
          <CheckCircle size={48} style={{ color: 'var(--accent-success)', opacity: 0.5 }} />
          <h3 className="h3 mt-md opacity-70">All Clear</h3>
          <p className="small opacity-50">No pending actions. Run Agent Analysis to generate recommendations.</p>
        </div>
      ) : (
        <div className="flex-col gap-md">
          {actions.map((action) => {
            const priorityConfig = getPriorityConfig(action.priority);
            const PriorityIcon = priorityConfig.icon;
            const ActionIcon = getActionTypeIcon(action.action_type);
            const isSelected = selectedAction === action.id;
            const isExecuting = executing === action.id;

            return (
              <div key={action.id} className="card-inner interactive-hover" style={{ 
                borderLeft: `4px solid var(--accent-${priorityConfig.color})`,
                background: isSelected ? 'var(--bg-elevated)' : 'transparent'
              }}>
                <div className="flex justify-between items-start gap-md flex-mobile-wrap">
                  <div style={{ flex: 1 }}>
                    <div className="flex items-center gap-sm mb-xs flex-wrap">
                      <ActionIcon size={18} style={{ color: 'var(--accent-secondary)' }} />
                      <span className="h3" style={{ fontSize: 14 }}>{action.title}</span>
                      <span className={`tag ${priorityConfig.color}`} style={{ fontSize: 9 }}>
                        <PriorityIcon size={10} style={{ marginRight: 4 }} />
                        {priorityConfig.label}
                      </span>
                      {action.auto_execute_eligible && (
                        <span className="tag success" style={{ fontSize: 9 }}>
                          <Zap size={8} style={{ marginRight: 2 }} />
                          AUTO-ELIGIBLE
                        </span>
                      )}
                    </div>
                    <p className="small opacity-80">{action.description}</p>
                    {action.agent_reasoning && (
                      <div className="flex items-start gap-xs mt-sm p-sm" style={{ 
                        background: 'var(--accent-secondary-dim)', 
                        borderRadius: 'var(--radius-sm)' 
                      }}>
                        <Bot size={14} style={{ color: 'var(--accent-secondary)', marginTop: 2 }} />
                        <p className="small" style={{ color: 'var(--accent-secondary)' }}>
                          {action.agent_reasoning}
                        </p>
                      </div>
                    )}
                    <div className="flex gap-md mt-sm">
                      <span className="small opacity-50 flex items-center gap-xs">
                        <TrendingUp size={12} /> {Math.round(action.confidence * 100)}% confidence
                      </span>
                      <span className="small opacity-50 flex items-center gap-xs">
                        <Clock size={12} /> {new Date(action.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex gap-sm flex-wrap">
                    {action.has_draft && (
                      <button 
                        className="btn secondary" 
                        onClick={() => handleViewDraft(action.id)}
                      >
                        {isSelected ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        {isSelected ? 'Hide' : 'Draft'}
                      </button>
                    )}
                    <button 
                      className="btn success" 
                      onClick={() => handleApprove(action.id)}
                      disabled={isExecuting}
                    >
                      {isExecuting ? <span className="spinner" style={{ width: 14, height: 14 }} /> : <CheckCircle size={14} />}
                      Approve
                    </button>
                    <button 
                      className="btn danger" 
                      onClick={() => handleReject(action.id)}
                      disabled={isExecuting}
                    >
                      <XCircle size={14} />
                    </button>
                  </div>
                </div>

                {/* Draft Preview */}
                {isSelected && draftContent && (
                  <div className="mt-md p-md slide-down" style={{ 
                    background: 'var(--bg-primary)', 
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-default)',
                    maxHeight: 400,
                    overflow: 'auto'
                  }}>
                    <div className="flex justify-between items-center mb-md">
                      <span className="small flex items-center gap-xs" style={{ fontWeight: 600 }}>
                        <FileText size={14} /> Drafted Document Preview
                      </span>
                      <button 
                        className="btn secondary"
                        style={{ padding: '4px 8px', height: 'auto' }} 
                        onClick={() => {
                          navigator.clipboard.writeText(draftContent);
                          window.dispatchEvent(new CustomEvent('loantwin-toast', { 
                            detail: { message: 'Copied to clipboard', type: 'success' } 
                          }));
                        }}
                      >
                        <Copy size={12} /> Copy
                      </button>
                    </div>
                    <pre style={{ 
                      whiteSpace: 'pre-wrap', 
                      fontFamily: 'var(--font-mono)', 
                      fontSize: 12,
                      lineHeight: 1.6,
                      color: 'var(--text-secondary)'
                    }}>
                      {draftContent}
                    </pre>
                    
                    {draftMetadata && Object.keys(draftMetadata).length > 0 && (
                      <div className="mt-md pt-md" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                        <span className="small mb-sm block" style={{ fontWeight: 600 }}>Metadata</span>
                        <div className="flex gap-sm flex-wrap">
                          {Object.entries(draftMetadata).map(([key, value]) => (
                            <span key={key} className="tag" style={{ fontSize: 9 }}>
                              {key}: {typeof value === 'object' ? JSON.stringify(value).slice(0, 50) : String(value).slice(0, 50)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Agent Activity Timeline */}
      {!compact && (
        <div className="mt-lg pt-lg" style={{ borderTop: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center gap-sm mb-md">
            <Activity size={14} style={{ color: 'var(--accent-secondary)' }} />
            <span className="small" style={{ fontWeight: 600 }}>Agent Activity</span>
          </div>
          <div className="flex gap-lg flex-wrap small opacity-70">
            <span>Approved Today: <strong className="gradient-text-cyan">3</strong></span>
            <span>Auto-Executed: <strong className="gradient-text-cyan">1</strong></span>
            <span>Avg. Resolution: <strong className="gradient-text-cyan">2.3 min</strong></span>
            <span>Uptime: <strong className="text-success">99.9%</strong></span>
          </div>
        </div>
      )}
    </div>
  );
}
