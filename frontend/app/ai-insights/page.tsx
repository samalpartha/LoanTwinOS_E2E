'use client';
import { useState, useEffect } from 'react';
import { 
  Brain, 
  Cpu, 
  Coins, 
  Search, 
  Database, 
  Lightbulb,
  Eye,
  TrendingUp,
  Zap,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Info,
  ExternalLink,
  Activity,
  BarChart3,
  Clock,
  DollarSign,
  FileText,
  MessageSquare,
  Video,
  Shield,
  Sparkles
} from 'lucide-react';

interface AIModel {
  id: string;
  name: string;
  provider: string;
  version: string;
  type: string;
  features: string[];
  status: 'active' | 'standby' | 'deprecated';
  usageToday: number;
  costPerMille: number;
}

interface TokenUsage {
  feature: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalCost: number;
  calls: number;
  avgLatency: number;
}

interface AIDecision {
  id: string;
  timestamp: string;
  feature: string;
  model: string;
  confidence: number;
  reasoning: string;
  context: string[];
  inputPreview: string;
  outputPreview: string;
}

const AI_MODELS: AIModel[] = [
  {
    id: 'groq-llama',
    name: 'Llama 3.3 70B',
    provider: 'Groq',
    version: '3.3-70b-versatile',
    type: 'LLM',
    features: ['DLR Extraction', 'AI Recommendations', 'Script Generation', 'Clause Analysis'],
    status: 'active',
    usageToday: 2847,
    costPerMille: 0.27
  },
  {
    id: 'eleven-labs',
    name: 'Eleven Turbo v2',
    provider: 'Eleven Labs',
    version: 'eleven_turbo_v2',
    type: 'TTS',
    features: ['Video Narration', 'Voice Briefings'],
    status: 'active',
    usageToday: 12,
    costPerMille: 15.00
  },
  {
    id: 'sentence-transformers',
    name: 'all-MiniLM-L6-v2',
    provider: 'Local',
    version: '2.0',
    type: 'Embeddings',
    features: ['Clause Similarity', 'Semantic Search', 'Document Matching'],
    status: 'active',
    usageToday: 1523,
    costPerMille: 0
  },
  {
    id: 'pymupdf',
    name: 'PyMuPDF + EasyOCR',
    provider: 'Local',
    version: '1.24',
    type: 'Document Processing',
    features: ['PDF Parsing', 'Text Extraction', 'OCR'],
    status: 'active',
    usageToday: 89,
    costPerMille: 0
  }
];

const SAMPLE_TOKEN_USAGE: TokenUsage[] = [
  { feature: 'DLR Extraction', model: 'Llama 3.3 70B', inputTokens: 45230, outputTokens: 8920, totalCost: 14.61, calls: 23, avgLatency: 2340 },
  { feature: 'AI Recommendations', model: 'Llama 3.3 70B', inputTokens: 28450, outputTokens: 12340, totalCost: 11.01, calls: 156, avgLatency: 890 },
  { feature: 'Script Generation', model: 'Llama 3.3 70B', inputTokens: 12800, outputTokens: 6500, totalCost: 5.21, calls: 12, avgLatency: 1560 },
  { feature: 'Video Narration', model: 'Eleven Turbo v2', inputTokens: 8500, outputTokens: 0, totalCost: 127.50, calls: 12, avgLatency: 4200 },
  { feature: 'Clause Similarity', model: 'all-MiniLM-L6-v2', inputTokens: 89000, outputTokens: 0, totalCost: 0, calls: 234, avgLatency: 45 },
];

const SAMPLE_DECISIONS: AIDecision[] = [
  {
    id: 'dec-001',
    timestamp: new Date(Date.now() - 5 * 60000).toISOString(),
    feature: 'AI Recommendation',
    model: 'Llama 3.3 70B',
    confidence: 0.94,
    reasoning: 'Detected that KPMG audit confirmation is overdue by 5 days based on payment schedule clause analysis. Cross-referenced with audit_due_date field and current date.',
    context: ['Clause 12.4 - Audit Requirements', 'Payment Schedule Amendment', 'Historical audit patterns'],
    inputPreview: 'Loan DLR with 847 extracted fields, maturity_date: 2027-03-15, audit_required: true...',
    outputPreview: 'Recommend: Approve & Send to KPMG - Priority: HIGH - Reason: Overdue audit confirmation'
  },
  {
    id: 'dec-002',
    timestamp: new Date(Date.now() - 12 * 60000).toISOString(),
    feature: 'Trade Readiness',
    model: 'Llama 3.3 70B',
    confidence: 0.87,
    reasoning: 'Analyzed 14 compliance checkpoints. 12 passed, 2 require attention (KYC refresh, jurisdiction approval). Calculated 87% trade readiness score.',
    context: ['Compliance Matrix', 'KYC Records', 'Jurisdiction Rules Engine'],
    inputPreview: 'Trade request for $25M participation, buyer: Apollo Credit...',
    outputPreview: 'Trade Readiness: 87% - Blockers: KYC refresh needed, Cayman jurisdiction pending'
  },
  {
    id: 'dec-003',
    timestamp: new Date(Date.now() - 25 * 60000).toISOString(),
    feature: 'Clause Deviation',
    model: 'Llama 3.3 70B + Embeddings',
    confidence: 0.91,
    reasoning: 'Compared extracted LIBOR replacement clause against LMA standard template. Found 3 material deviations: fallback rate differs, notification period shortened, calculation agent changed.',
    context: ['LMA Standard: Clause 8.2', 'Deal Clause: Section 8.2', 'Precedent database (847 deals)'],
    inputPreview: 'Clause text: "In the event LIBOR ceases to be published, the replacement rate shall be..."',
    outputPreview: 'Non-Standard: 3 deviations found - Risk Level: MEDIUM - Recommendation: Legal review'
  }
];

export default function AIInsightsPage() {
  const [activeTab, setActiveTab] = useState<'models' | 'tokens' | 'embeddings' | 'rag' | 'reasoning' | 'context'>('models');
  const [selectedDecision, setSelectedDecision] = useState<AIDecision | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1500);
  };

  const totalCostToday = SAMPLE_TOKEN_USAGE.reduce((sum, u) => sum + u.totalCost, 0);
  const totalCalls = SAMPLE_TOKEN_USAGE.reduce((sum, u) => sum + u.calls, 0);
  const avgLatency = Math.round(SAMPLE_TOKEN_USAGE.reduce((sum, u) => sum + u.avgLatency * u.calls, 0) / totalCalls);

  const tabs = [
    { id: 'models', label: 'LLMs', icon: Brain },
    { id: 'tokens', label: 'Tokens', icon: Coins },
    { id: 'embeddings', label: 'Embeddings', icon: Database },
    { id: 'rag', label: 'RAG', icon: Search },
    { id: 'reasoning', label: 'Reasoning', icon: Lightbulb },
    { id: 'context', label: 'Context', icon: Eye },
  ];

  return (
    <div className="animate-fade-in">
      {/* Hero Header */}
      <div className="card mb-lg" style={{ 
        background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(6, 182, 212, 0.1) 100%)',
        border: '1px solid rgba(139, 92, 246, 0.3)'
      }}>
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-md mb-sm">
              <div style={{ 
                width: 48, 
                height: 48, 
                borderRadius: 'var(--radius-lg)',
                background: 'linear-gradient(135deg, var(--accent-primary) 0%, var(--accent-secondary) 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: 'var(--glow-primary)'
              }}>
                <Sparkles size={24} color="white" />
              </div>
              <div>
                <h1 className="h2" style={{ marginBottom: 4 }}>AI Insights Hub</h1>
                <p className="small" style={{ color: 'var(--text-secondary)' }}>
                  Transparency & explainability for all AI-powered features
                </p>
              </div>
            </div>
          </div>
          
          <button 
            className="btn secondary"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Refreshing...' : 'Refresh Stats'}
          </button>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-md mt-lg">
          <div className="card" style={{ background: 'var(--bg-secondary)', padding: 16 }}>
            <div className="flex items-center gap-sm mb-xs">
              <Activity size={16} style={{ color: 'var(--accent-success)' }} />
              <span className="small" style={{ color: 'var(--text-secondary)' }}>Active Models</span>
            </div>
            <span className="h3 mono">{AI_MODELS.filter(m => m.status === 'active').length}</span>
          </div>
          
          <div className="card" style={{ background: 'var(--bg-secondary)', padding: 16 }}>
            <div className="flex items-center gap-sm mb-xs">
              <BarChart3 size={16} style={{ color: 'var(--accent-primary)' }} />
              <span className="small" style={{ color: 'var(--text-secondary)' }}>API Calls Today</span>
            </div>
            <span className="h3 mono">{totalCalls.toLocaleString()}</span>
          </div>
          
          <div className="card" style={{ background: 'var(--bg-secondary)', padding: 16 }}>
            <div className="flex items-center gap-sm mb-xs">
              <DollarSign size={16} style={{ color: 'var(--accent-warning)' }} />
              <span className="small" style={{ color: 'var(--text-secondary)' }}>Cost Today</span>
            </div>
            <span className="h3 mono">${totalCostToday.toFixed(2)}</span>
          </div>
          
          <div className="card" style={{ background: 'var(--bg-secondary)', padding: 16 }}>
            <div className="flex items-center gap-sm mb-xs">
              <Clock size={16} style={{ color: 'var(--accent-secondary)' }} />
              <span className="small" style={{ color: 'var(--text-secondary)' }}>Avg Latency</span>
            </div>
            <span className="h3 mono">{avgLatency}ms</span>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-xs mb-lg" style={{ 
        background: 'var(--bg-secondary)', 
        padding: 4, 
        borderRadius: 'var(--radius-lg)',
        width: 'fit-content'
      }}>
        {tabs.map(tab => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-sm px-md py-sm`}
              style={{
                background: activeTab === tab.id ? 'var(--bg-elevated)' : 'transparent',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: activeTab === tab.id ? 600 : 400,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'models' && (
        <div className="animate-fade-in">
          <h3 className="h4 mb-md flex items-center gap-sm">
            <Brain size={20} style={{ color: 'var(--accent-primary)' }} />
            AI Models Powering LoanTwin
          </h3>
          
          <div className="grid grid-cols-2 gap-md">
            {AI_MODELS.map(model => (
              <div key={model.id} className="card">
                <div className="flex justify-between items-start mb-md">
                  <div className="flex items-center gap-md">
                    <div style={{ 
                      width: 44, 
                      height: 44, 
                      borderRadius: 'var(--radius-md)',
                      background: model.type === 'LLM' ? 'var(--accent-primary-dim)' :
                                 model.type === 'TTS' ? 'var(--accent-warning-dim)' :
                                 model.type === 'Embeddings' ? 'var(--accent-secondary-dim)' :
                                 'var(--bg-elevated)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      {model.type === 'LLM' && <Brain size={22} style={{ color: 'var(--accent-primary)' }} />}
                      {model.type === 'TTS' && <MessageSquare size={22} style={{ color: 'var(--accent-warning)' }} />}
                      {model.type === 'Embeddings' && <Database size={22} style={{ color: 'var(--accent-secondary)' }} />}
                      {model.type === 'Document Processing' && <FileText size={22} style={{ color: 'var(--text-secondary)' }} />}
                    </div>
                    <div>
                      <h4 className="h5">{model.name}</h4>
                      <p className="small" style={{ color: 'var(--text-muted)' }}>
                        {model.provider} • {model.version}
                      </p>
                    </div>
                  </div>
                  
                  <span className="badge" style={{ 
                    background: model.status === 'active' ? 'var(--accent-success-dim)' : 'var(--bg-elevated)',
                    color: model.status === 'active' ? 'var(--accent-success)' : 'var(--text-muted)'
                  }}>
                    <span style={{ 
                      width: 6, 
                      height: 6, 
                      borderRadius: '50%', 
                      background: model.status === 'active' ? 'var(--accent-success)' : 'var(--text-muted)',
                      display: 'inline-block',
                      marginRight: 6
                    }} />
                    {model.status}
                  </span>
                </div>
                
                <div className="mb-md">
                  <p className="small mb-xs" style={{ color: 'var(--text-secondary)' }}>Features:</p>
                  <div className="flex flex-wrap gap-xs">
                    {model.features.map(feature => (
                      <span key={feature} className="badge" style={{ 
                        background: 'var(--bg-elevated)',
                        fontSize: 11
                      }}>
                        {feature}
                      </span>
                    ))}
                  </div>
                </div>
                
                <div className="flex justify-between items-center pt-md" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                  <div>
                    <span className="small" style={{ color: 'var(--text-muted)' }}>Usage Today</span>
                    <p className="mono" style={{ fontWeight: 600 }}>{model.usageToday.toLocaleString()} calls</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span className="small" style={{ color: 'var(--text-muted)' }}>Cost/1K tokens</span>
                    <p className="mono" style={{ fontWeight: 600, color: model.costPerMille > 0 ? 'var(--accent-warning)' : 'var(--accent-success)' }}>
                      {model.costPerMille > 0 ? `$${model.costPerMille.toFixed(2)}` : 'Free'}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'tokens' && (
        <div className="animate-fade-in">
          <h3 className="h4 mb-md flex items-center gap-sm">
            <Coins size={20} style={{ color: 'var(--accent-warning)' }} />
            Token Usage & Cost Tracking
          </h3>
          
          <div className="card">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <th style={{ textAlign: 'left', padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: 13 }}>Feature</th>
                  <th style={{ textAlign: 'left', padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: 13 }}>Model</th>
                  <th style={{ textAlign: 'right', padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: 13 }}>Input Tokens</th>
                  <th style={{ textAlign: 'right', padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: 13 }}>Output Tokens</th>
                  <th style={{ textAlign: 'right', padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: 13 }}>API Calls</th>
                  <th style={{ textAlign: 'right', padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: 13 }}>Avg Latency</th>
                  <th style={{ textAlign: 'right', padding: '12px 16px', color: 'var(--text-secondary)', fontWeight: 500, fontSize: 13 }}>Cost</th>
                </tr>
              </thead>
              <tbody>
                {SAMPLE_TOKEN_USAGE.map((usage, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '14px 16px' }}>
                      <span style={{ fontWeight: 500 }}>{usage.feature}</span>
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span className="badge" style={{ background: 'var(--bg-elevated)', fontSize: 11 }}>
                        {usage.model}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right' }} className="mono">
                      {usage.inputTokens.toLocaleString()}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right' }} className="mono">
                      {usage.outputTokens.toLocaleString()}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right' }} className="mono">
                      {usage.calls}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right' }} className="mono">
                      <span style={{ 
                        color: usage.avgLatency < 1000 ? 'var(--accent-success)' : 
                               usage.avgLatency < 3000 ? 'var(--accent-warning)' : 
                               'var(--accent-danger)'
                      }}>
                        {usage.avgLatency}ms
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right' }} className="mono">
                      <span style={{ fontWeight: 600, color: usage.totalCost > 0 ? 'var(--accent-warning)' : 'var(--accent-success)' }}>
                        ${usage.totalCost.toFixed(2)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: 'var(--bg-secondary)' }}>
                  <td colSpan={6} style={{ padding: '14px 16px', fontWeight: 600 }}>Total Today</td>
                  <td style={{ padding: '14px 16px', textAlign: 'right' }} className="mono">
                    <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--accent-warning)' }}>
                      ${totalCostToday.toFixed(2)}
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'embeddings' && (
        <div className="animate-fade-in">
          <h3 className="h4 mb-md flex items-center gap-sm">
            <Database size={20} style={{ color: 'var(--accent-secondary)' }} />
            Semantic Search & Embeddings
          </h3>
          
          <div className="grid grid-cols-2 gap-lg">
            <div className="card">
              <h4 className="h5 mb-md">Document Embedding Pipeline</h4>
              
              <div className="flex-col gap-md">
                <div className="flex items-center gap-md p-md" style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent-primary-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <FileText size={16} style={{ color: 'var(--accent-primary)' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p className="small" style={{ fontWeight: 600 }}>1. Document Parsing</p>
                    <p className="small" style={{ color: 'var(--text-muted)' }}>PyMuPDF extracts text & structure</p>
                  </div>
                  <CheckCircle size={16} style={{ color: 'var(--accent-success)' }} />
                </div>
                
                <div className="flex items-center gap-md p-md" style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent-secondary-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Cpu size={16} style={{ color: 'var(--accent-secondary)' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p className="small" style={{ fontWeight: 600 }}>2. Chunking</p>
                    <p className="small" style={{ color: 'var(--text-muted)' }}>Split into 512-token overlapping chunks</p>
                  </div>
                  <CheckCircle size={16} style={{ color: 'var(--accent-success)' }} />
                </div>
                
                <div className="flex items-center gap-md p-md" style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent-warning-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Database size={16} style={{ color: 'var(--accent-warning)' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p className="small" style={{ fontWeight: 600 }}>3. Embedding</p>
                    <p className="small" style={{ color: 'var(--text-muted)' }}>all-MiniLM-L6-v2 → 384-dim vectors</p>
                  </div>
                  <CheckCircle size={16} style={{ color: 'var(--accent-success)' }} />
                </div>
                
                <div className="flex items-center gap-md p-md" style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent-success-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Search size={16} style={{ color: 'var(--accent-success)' }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p className="small" style={{ fontWeight: 600 }}>4. Vector Storage</p>
                    <p className="small" style={{ color: 'var(--text-muted)' }}>FAISS index for fast similarity search</p>
                  </div>
                  <CheckCircle size={16} style={{ color: 'var(--accent-success)' }} />
                </div>
              </div>
            </div>
            
            <div className="card">
              <h4 className="h5 mb-md">Similarity Use Cases</h4>
              
              <div className="flex-col gap-sm">
                <div className="p-md" style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                  <div className="flex items-center gap-sm mb-xs">
                    <Shield size={16} style={{ color: 'var(--accent-primary)' }} />
                    <span style={{ fontWeight: 600 }}>Clause Deviation Detection</span>
                  </div>
                  <p className="small" style={{ color: 'var(--text-secondary)' }}>
                    Compare extracted clauses against LMA standard templates using cosine similarity. Threshold: 0.85 for "standard", below triggers review.
                  </p>
                </div>
                
                <div className="p-md" style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                  <div className="flex items-center gap-sm mb-xs">
                    <Search size={16} style={{ color: 'var(--accent-secondary)' }} />
                    <span style={{ fontWeight: 600 }}>Cross-Document Search</span>
                  </div>
                  <p className="small" style={{ color: 'var(--text-secondary)' }}>
                    Find similar clauses across your entire deal portfolio. "Show me all LIBOR fallback clauses" returns ranked results by semantic similarity.
                  </p>
                </div>
                
                <div className="p-md" style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                  <div className="flex items-center gap-sm mb-xs">
                    <TrendingUp size={16} style={{ color: 'var(--accent-success)' }} />
                    <span style={{ fontWeight: 600 }}>Precedent Matching</span>
                  </div>
                  <p className="small" style={{ color: 'var(--text-secondary)' }}>
                    Match new deal clauses against 847+ precedent documents to suggest standard language and identify market-standard deviations.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'rag' && (
        <div className="animate-fade-in">
          <h3 className="h4 mb-md flex items-center gap-sm">
            <Search size={20} style={{ color: 'var(--accent-primary)' }} />
            Retrieval-Augmented Generation (RAG)
          </h3>
          
          <div className="card mb-lg">
            <h4 className="h5 mb-md">LMA Clause Lookup System</h4>
            
            <div className="grid grid-cols-3 gap-lg">
              <div className="p-md" style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                <div style={{ 
                  width: 56, 
                  height: 56, 
                  borderRadius: '50%', 
                  background: 'var(--accent-primary-dim)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  margin: '0 auto 12px'
                }}>
                  <FileText size={24} style={{ color: 'var(--accent-primary)' }} />
                </div>
                <h5 className="h5 mb-xs">847</h5>
                <p className="small" style={{ color: 'var(--text-secondary)' }}>LMA Standard Clauses</p>
              </div>
              
              <div className="p-md" style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                <div style={{ 
                  width: 56, 
                  height: 56, 
                  borderRadius: '50%', 
                  background: 'var(--accent-secondary-dim)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  margin: '0 auto 12px'
                }}>
                  <Database size={24} style={{ color: 'var(--accent-secondary)' }} />
                </div>
                <h5 className="h5 mb-xs">2.3M</h5>
                <p className="small" style={{ color: 'var(--text-secondary)' }}>Embedded Chunks</p>
              </div>
              
              <div className="p-md" style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
                <div style={{ 
                  width: 56, 
                  height: 56, 
                  borderRadius: '50%', 
                  background: 'var(--accent-success-dim)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  margin: '0 auto 12px'
                }}>
                  <Zap size={24} style={{ color: 'var(--accent-success)' }} />
                </div>
                <h5 className="h5 mb-xs">45ms</h5>
                <p className="small" style={{ color: 'var(--text-secondary)' }}>Avg Retrieval Time</p>
              </div>
            </div>
          </div>
          
          <div className="card">
            <h4 className="h5 mb-md">RAG Pipeline Flow</h4>
            
            <div className="flex items-center gap-md p-md" style={{ 
              background: 'linear-gradient(90deg, var(--accent-primary-dim) 0%, var(--accent-secondary-dim) 50%, var(--accent-success-dim) 100%)',
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden'
            }}>
              <div style={{ flex: 1, textAlign: 'center', padding: 16 }}>
                <MessageSquare size={24} style={{ color: 'var(--accent-primary)', marginBottom: 8 }} />
                <p className="small" style={{ fontWeight: 600 }}>User Query</p>
                <p className="small" style={{ color: 'var(--text-muted)', fontSize: 11 }}>"What's the LIBOR fallback?"</p>
              </div>
              
              <div style={{ color: 'var(--text-muted)' }}>→</div>
              
              <div style={{ flex: 1, textAlign: 'center', padding: 16 }}>
                <Database size={24} style={{ color: 'var(--accent-secondary)', marginBottom: 8 }} />
                <p className="small" style={{ fontWeight: 600 }}>Vector Search</p>
                <p className="small" style={{ color: 'var(--text-muted)', fontSize: 11 }}>Top 5 relevant chunks</p>
              </div>
              
              <div style={{ color: 'var(--text-muted)' }}>→</div>
              
              <div style={{ flex: 1, textAlign: 'center', padding: 16 }}>
                <Brain size={24} style={{ color: 'var(--accent-warning)', marginBottom: 8 }} />
                <p className="small" style={{ fontWeight: 600 }}>LLM Synthesis</p>
                <p className="small" style={{ color: 'var(--text-muted)', fontSize: 11 }}>Context + query → answer</p>
              </div>
              
              <div style={{ color: 'var(--text-muted)' }}>→</div>
              
              <div style={{ flex: 1, textAlign: 'center', padding: 16 }}>
                <CheckCircle size={24} style={{ color: 'var(--accent-success)', marginBottom: 8 }} />
                <p className="small" style={{ fontWeight: 600 }}>Response</p>
                <p className="small" style={{ color: 'var(--text-muted)', fontSize: 11 }}>With source citations</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'reasoning' && (
        <div className="animate-fade-in">
          <h3 className="h4 mb-md flex items-center gap-sm">
            <Lightbulb size={20} style={{ color: 'var(--accent-warning)' }} />
            XAI Reasoning & Explanations
          </h3>
          
          <p className="body mb-lg" style={{ color: 'var(--text-secondary)' }}>
            Every AI recommendation includes explainable reasoning so you understand why decisions were made.
          </p>
          
          <div className="grid grid-cols-1 gap-md">
            {SAMPLE_DECISIONS.map(decision => (
              <div 
                key={decision.id} 
                className="card interactive-hover"
                onClick={() => setSelectedDecision(selectedDecision?.id === decision.id ? null : decision)}
                style={{ cursor: 'pointer' }}
              >
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-md">
                    <div style={{ 
                      width: 44, 
                      height: 44, 
                      borderRadius: 'var(--radius-md)',
                      background: decision.confidence > 0.9 ? 'var(--accent-success-dim)' :
                                 decision.confidence > 0.8 ? 'var(--accent-warning-dim)' :
                                 'var(--accent-danger-dim)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Lightbulb size={22} style={{ 
                        color: decision.confidence > 0.9 ? 'var(--accent-success)' :
                               decision.confidence > 0.8 ? 'var(--accent-warning)' :
                               'var(--accent-danger)'
                      }} />
                    </div>
                    <div>
                      <h4 className="h5">{decision.feature}</h4>
                      <p className="small" style={{ color: 'var(--text-muted)' }}>
                        {decision.model} • {new Date(decision.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-md">
                    <div style={{ textAlign: 'right' }}>
                      <span className="small" style={{ color: 'var(--text-muted)' }}>Confidence</span>
                      <p className="mono" style={{ 
                        fontWeight: 700,
                        color: decision.confidence > 0.9 ? 'var(--accent-success)' :
                               decision.confidence > 0.8 ? 'var(--accent-warning)' :
                               'var(--accent-danger)'
                      }}>
                        {(decision.confidence * 100).toFixed(0)}%
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="mt-md p-md" style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                  <p className="small" style={{ fontWeight: 600, marginBottom: 4, color: 'var(--text-secondary)' }}>
                    Reasoning:
                  </p>
                  <p className="small">{decision.reasoning}</p>
                </div>
                
                {selectedDecision?.id === decision.id && (
                  <div className="mt-md animate-fade-in">
                    <div className="grid grid-cols-2 gap-md">
                      <div className="p-md" style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                        <p className="small" style={{ fontWeight: 600, marginBottom: 8, color: 'var(--accent-primary)' }}>
                          Context Sources:
                        </p>
                        {decision.context.map((ctx, idx) => (
                          <div key={idx} className="flex items-center gap-sm mb-xs">
                            <FileText size={12} style={{ color: 'var(--text-muted)' }} />
                            <span className="small">{ctx}</span>
                          </div>
                        ))}
                      </div>
                      
                      <div className="p-md" style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                        <p className="small" style={{ fontWeight: 600, marginBottom: 8, color: 'var(--accent-secondary)' }}>
                          Output Preview:
                        </p>
                        <p className="small mono" style={{ 
                          padding: 8, 
                          background: 'var(--bg-primary)', 
                          borderRadius: 'var(--radius-sm)',
                          fontSize: 11
                        }}>
                          {decision.outputPreview}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'context' && (
        <div className="animate-fade-in">
          <h3 className="h4 mb-md flex items-center gap-sm">
            <Eye size={20} style={{ color: 'var(--accent-secondary)' }} />
            Context Transparency
          </h3>
          
          <p className="body mb-lg" style={{ color: 'var(--text-secondary)' }}>
            See exactly what data is being used for each AI decision.
          </p>
          
          <div className="card">
            <h4 className="h5 mb-md">Context Sources by Feature</h4>
            
            <div className="flex-col gap-md">
              <div className="p-md" style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                <div className="flex items-center gap-sm mb-md">
                  <FileText size={18} style={{ color: 'var(--accent-primary)' }} />
                  <span style={{ fontWeight: 600 }}>DLR Extraction</span>
                </div>
                <div className="grid grid-cols-3 gap-sm">
                  <div className="flex items-center gap-xs">
                    <CheckCircle size={14} style={{ color: 'var(--accent-success)' }} />
                    <span className="small">Full PDF text</span>
                  </div>
                  <div className="flex items-center gap-xs">
                    <CheckCircle size={14} style={{ color: 'var(--accent-success)' }} />
                    <span className="small">Document structure</span>
                  </div>
                  <div className="flex items-center gap-xs">
                    <CheckCircle size={14} style={{ color: 'var(--accent-success)' }} />
                    <span className="small">Table data</span>
                  </div>
                </div>
              </div>
              
              <div className="p-md" style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                <div className="flex items-center gap-sm mb-md">
                  <Zap size={18} style={{ color: 'var(--accent-warning)' }} />
                  <span style={{ fontWeight: 600 }}>AI Recommendations</span>
                </div>
                <div className="grid grid-cols-3 gap-sm">
                  <div className="flex items-center gap-xs">
                    <CheckCircle size={14} style={{ color: 'var(--accent-success)' }} />
                    <span className="small">Extracted DLR</span>
                  </div>
                  <div className="flex items-center gap-xs">
                    <CheckCircle size={14} style={{ color: 'var(--accent-success)' }} />
                    <span className="small">Obligation calendar</span>
                  </div>
                  <div className="flex items-center gap-xs">
                    <CheckCircle size={14} style={{ color: 'var(--accent-success)' }} />
                    <span className="small">Compliance status</span>
                  </div>
                  <div className="flex items-center gap-xs">
                    <CheckCircle size={14} style={{ color: 'var(--accent-success)' }} />
                    <span className="small">Trade history</span>
                  </div>
                  <div className="flex items-center gap-xs">
                    <CheckCircle size={14} style={{ color: 'var(--accent-success)' }} />
                    <span className="small">Market data</span>
                  </div>
                  <div className="flex items-center gap-xs">
                    <CheckCircle size={14} style={{ color: 'var(--accent-success)' }} />
                    <span className="small">User preferences</span>
                  </div>
                </div>
              </div>
              
              <div className="p-md" style={{ background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)' }}>
                <div className="flex items-center gap-sm mb-md">
                  <Video size={18} style={{ color: 'var(--accent-secondary)' }} />
                  <span style={{ fontWeight: 600 }}>Video Briefing</span>
                </div>
                <div className="grid grid-cols-3 gap-sm">
                  <div className="flex items-center gap-xs">
                    <CheckCircle size={14} style={{ color: 'var(--accent-success)' }} />
                    <span className="small">Deal summary</span>
                  </div>
                  <div className="flex items-center gap-xs">
                    <CheckCircle size={14} style={{ color: 'var(--accent-success)' }} />
                    <span className="small">Key financials</span>
                  </div>
                  <div className="flex items-center gap-xs">
                    <CheckCircle size={14} style={{ color: 'var(--accent-success)' }} />
                    <span className="small">Risk highlights</span>
                  </div>
                  <div className="flex items-center gap-xs">
                    <CheckCircle size={14} style={{ color: 'var(--accent-success)' }} />
                    <span className="small">Parties involved</span>
                  </div>
                  <div className="flex items-center gap-xs">
                    <CheckCircle size={14} style={{ color: 'var(--accent-success)' }} />
                    <span className="small">Maturity timeline</span>
                  </div>
                  <div className="flex items-center gap-xs">
                    <AlertTriangle size={14} style={{ color: 'var(--accent-warning)' }} />
                    <span className="small">No PII exposed</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="card mt-lg" style={{ 
            background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(6, 182, 212, 0.05) 100%)',
            border: '1px solid rgba(34, 197, 94, 0.3)'
          }}>
            <div className="flex items-center gap-md">
              <Shield size={32} style={{ color: 'var(--accent-success)' }} />
              <div>
                <h4 className="h5" style={{ marginBottom: 4 }}>Data Privacy Commitment</h4>
                <p className="small" style={{ color: 'var(--text-secondary)' }}>
                  All AI processing happens with anonymized identifiers. PII is never sent to external APIs. 
                  Embeddings are stored locally. You maintain full control of your data.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
