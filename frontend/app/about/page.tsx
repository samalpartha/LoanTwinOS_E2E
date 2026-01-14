'use client';
import { useState } from 'react';
import { 
  Cpu, Database, Cloud, Shield, Zap, Globe, Code, Server,
  FileText, Bot, Brain, Lock, GitBranch, Layers, Terminal,
  CheckCircle, ExternalLink, Github, BookOpen, Award, Users,
  Sparkles, BarChart3, Building2
} from 'lucide-react';

export default function AboutPage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'tech' | 'features' | 'roadmap'>('overview');

  const techStack = {
    frontend: [
      { name: 'Next.js 14', desc: 'React framework with App Router', icon: Code },
      { name: 'TypeScript', desc: 'Type-safe JavaScript', icon: Terminal },
      { name: 'Recharts', desc: 'Data visualization library', icon: BarChart3 },
      { name: 'Lucide Icons', desc: 'Beautiful icon library', icon: Sparkles },
    ],
    backend: [
      { name: 'FastAPI', desc: 'High-performance Python API', icon: Zap },
      { name: 'SQLModel', desc: 'SQL databases with Python types', icon: Database },
      { name: 'PyMuPDF', desc: 'PDF parsing & extraction', icon: FileText },
      { name: 'Groq LPU', desc: 'Ultra-fast AI inference', icon: Brain },
    ],
    ai: [
      { name: 'Llama 3.3 70B', desc: 'Large language model via Groq', icon: Bot },
      { name: 'EasyOCR', desc: 'Document text recognition', icon: FileText },
      { name: 'SHAP', desc: 'ML model explainability', icon: BarChart3 },
      { name: 'Random Forest', desc: 'Credit risk prediction', icon: Cpu },
    ],
    infrastructure: [
      { name: 'Docker', desc: 'Container orchestration', icon: Layers },
      { name: 'SQLite', desc: 'Embedded database', icon: Database },
      { name: 'Google Maps API', desc: 'Expert geolocation', icon: Globe },
      { name: 'MCP Protocol', desc: 'AI agent framework', icon: GitBranch },
    ],
  };

  const features = [
    {
      title: 'Digital Loan Record (DLR)',
      desc: 'AI-powered extraction of loan agreements into structured, searchable records',
      highlights: ['119+ clause types', 'Table detection', 'ESG identification']
    },
    {
      title: 'Credit Risk Engine',
      desc: 'Machine learning model for loan default prediction with 97% accuracy',
      highlights: ['Random Forest model', 'SHAP explainability', 'Real-time scoring']
    },
    {
      title: 'Expert Network',
      desc: 'AI-matched legal/compliance experts via Google Maps + Groq',
      highlights: ['Zip code search', 'Real-time matching', 'Engagement letters']
    },
    {
      title: 'LMA Standards',
      desc: 'Compliance checking against Loan Market Association templates',
      highlights: ['Variance detection', 'Auto-redlining', 'Clause comparison']
    },
    {
      title: 'Credit Risk ML',
      desc: 'Machine learning model for loan risk assessment and prediction',
      highlights: ['Risk scoring', 'Default prediction', 'Batch assessment']
    },
    {
      title: 'MCP Agent',
      desc: 'Autonomous vetting agent built on Model Context Protocol',
      highlights: ['16 tools', 'Groq-powered', 'Auto-approval queue']
    },
  ];

  const roadmap = [
    { q: 'Q1 2026', items: ['Blockchain settlement', 'Multi-language OCR', 'LSTA template support'] },
    { q: 'Q2 2026', items: ['Real-time pricing feeds', 'ESG scoring engine', 'Mobile app'] },
    { q: 'Q3 2026', items: ['Multi-tenant SaaS', 'Enterprise SSO', 'Audit compliance'] },
    { q: 'Q4 2026', items: ['AI document drafting', 'Market intelligence', 'API marketplace'] },
  ];

  return (
    <div className="flex-col gap-lg animate-stagger">
      {/* Hero */}
      <section className="card-premium" style={{ 
        textAlign: 'center', 
        padding: 'var(--space-2xl)',
        background: 'linear-gradient(135deg, var(--bg-card) 0%, rgba(51, 187, 207, 0.08) 100%)'
      }}>
        <div className="flex justify-center gap-sm mb-md">
          <Building2 size={48} style={{ color: 'var(--accent-primary)' }} />
        </div>
        <h1 className="h1 gradient-text-cyan" style={{ fontSize: 32 }}>LoanTwin OS</h1>
        <p className="body opacity-70 mt-sm" style={{ maxWidth: 600, margin: '12px auto 0' }}>
          The Self-Driving Loan Asset Platform — AI-powered document intelligence, 
          credit risk analytics, and compliance automation for institutional finance.
        </p>
        <div className="flex gap-sm justify-center mt-lg flex-wrap">
          <span className="tag success">v4.0 Enterprise</span>
          <span className="tag primary">LMA Compliant</span>
          <span className="tag" style={{ background: 'var(--accent-secondary-dim)', color: 'var(--accent-secondary)' }}>Groq-Powered</span>
        </div>
      </section>

      {/* Tab Navigation */}
      <div className="flex justify-center">
        <div 
          className="flex items-center gap-xs"
          style={{ 
            background: 'var(--bg-card)', 
            padding: '6px', 
            borderRadius: '12px',
            border: '1px solid var(--border-subtle)'
          }}
        >
          {(['overview', 'tech', 'features', 'roadmap'] as const).map(tab => (
            <button 
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{ 
                padding: '10px 20px',
                borderRadius: '8px',
                border: 'none',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: 14,
                transition: 'all 0.2s',
                background: activeTab === tab ? 'var(--accent-primary)' : 'transparent',
                color: activeTab === tab ? '#0A1628' : 'var(--text-secondary)'
              }}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <>
          <section className="card">
            <h2 className="h2 mb-md"><Award size={24} /> What is LoanTwin OS?</h2>
            <div className="grid grid-cols-2 gap-lg">
              <div>
                <p className="body opacity-80 mb-md">
                  LoanTwin OS transforms loan document management from manual spreadsheet work 
                  into an AI-powered, automated platform. Upload a credit agreement PDF and get 
                  instant structured data extraction, compliance checking, and risk analytics.
                </p>
                <ul className="flex-col gap-sm">
                  <li className="flex items-start gap-sm">
                    <CheckCircle size={18} style={{ color: 'var(--accent-success)', marginTop: 2 }} />
                    <span>Extract 100+ data points from loan documents in seconds</span>
                  </li>
                  <li className="flex items-start gap-sm">
                    <CheckCircle size={18} style={{ color: 'var(--accent-success)', marginTop: 2 }} />
                    <span>Predict loan defaults with 97% accuracy ML model</span>
                  </li>
                  <li className="flex items-start gap-sm">
                    <CheckCircle size={18} style={{ color: 'var(--accent-success)', marginTop: 2 }} />
                    <span>Auto-match legal experts using AI + Google Maps</span>
                  </li>
                  <li className="flex items-start gap-sm">
                    <CheckCircle size={18} style={{ color: 'var(--accent-success)', marginTop: 2 }} />
                    <span>ML-powered credit risk assessment with batch processing</span>
                  </li>
                </ul>
              </div>
              <div className="card-inner" style={{ background: 'var(--bg-primary)', padding: 'var(--space-lg)' }}>
                <h3 className="h3 mb-md">Quick Stats</h3>
                <div className="grid grid-cols-2 gap-md">
                  <div className="text-center">
                    <div className="mono" style={{ fontSize: 28, color: 'var(--accent-primary)' }}>208</div>
                    <div className="small opacity-60">Max Pages/Doc</div>
                  </div>
                  <div className="text-center">
                    <div className="mono" style={{ fontSize: 28, color: 'var(--accent-secondary)' }}>119</div>
                    <div className="small opacity-60">Clause Types</div>
                  </div>
                  <div className="text-center">
                    <div className="mono" style={{ fontSize: 28, color: 'var(--accent-success)' }}>97%</div>
                    <div className="small opacity-60">ML Accuracy</div>
                  </div>
                  <div className="text-center">
                    <div className="mono" style={{ fontSize: 28, color: 'var(--accent-warning)' }}>&lt;1s</div>
                    <div className="small opacity-60">AI Response</div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="card">
            <h2 className="h2 mb-md"><Users size={24} /> Who Is This For?</h2>
            <div className="grid grid-cols-3 gap-md">
              <div className="card-inner" style={{ padding: 'var(--space-lg)' }}>
                <h3 className="h3" style={{ color: 'var(--accent-primary)' }}>Credit Analysts</h3>
                <p className="small opacity-70 mt-sm">
                  Risk assessment, credit scoring, default prediction, portfolio analysis.
                </p>
              </div>
              <div className="card-inner" style={{ padding: 'var(--space-lg)' }}>
                <h3 className="h3" style={{ color: 'var(--accent-secondary)' }}>Loan Operations</h3>
                <p className="small opacity-70 mt-sm">
                  Document processing, obligation tracking, compliance management.
                </p>
              </div>
              <div className="card-inner" style={{ padding: 'var(--space-lg)' }}>
                <h3 className="h3" style={{ color: 'var(--accent-success)' }}>Legal/Compliance</h3>
                <p className="small opacity-70 mt-sm">
                  Clause analysis, LMA compliance, expert matching, vetting workflows.
                </p>
              </div>
            </div>
          </section>
        </>
      )}

      {/* Tech Stack Tab */}
      {activeTab === 'tech' && (
        <>
          <section className="card">
            <h2 className="h2 mb-lg"><Code size={24} /> Technology Stack</h2>
            
            <div className="grid grid-cols-2 gap-lg">
              {/* Frontend */}
              <div>
                <h3 className="h3 mb-md" style={{ color: 'var(--accent-primary)' }}>
                  <Globe size={20} /> Frontend
                </h3>
                <div className="flex-col gap-sm">
                  {techStack.frontend.map(tech => (
                    <div key={tech.name} className="flex items-center gap-md p-sm" style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)' }}>
                      <tech.icon size={20} style={{ color: 'var(--accent-primary)' }} />
                      <div>
                        <div className="small font-semibold">{tech.name}</div>
                        <div className="small opacity-50">{tech.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Backend */}
              <div>
                <h3 className="h3 mb-md" style={{ color: 'var(--accent-secondary)' }}>
                  <Server size={20} /> Backend
                </h3>
                <div className="flex-col gap-sm">
                  {techStack.backend.map(tech => (
                    <div key={tech.name} className="flex items-center gap-md p-sm" style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)' }}>
                      <tech.icon size={20} style={{ color: 'var(--accent-secondary)' }} />
                      <div>
                        <div className="small font-semibold">{tech.name}</div>
                        <div className="small opacity-50">{tech.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* AI/ML */}
              <div>
                <h3 className="h3 mb-md" style={{ color: 'var(--accent-success)' }}>
                  <Brain size={20} /> AI / ML
                </h3>
                <div className="flex-col gap-sm">
                  {techStack.ai.map(tech => (
                    <div key={tech.name} className="flex items-center gap-md p-sm" style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)' }}>
                      <tech.icon size={20} style={{ color: 'var(--accent-success)' }} />
                      <div>
                        <div className="small font-semibold">{tech.name}</div>
                        <div className="small opacity-50">{tech.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Infrastructure */}
              <div>
                <h3 className="h3 mb-md" style={{ color: 'var(--accent-warning)' }}>
                  <Cloud size={20} /> Infrastructure
                </h3>
                <div className="flex-col gap-sm">
                  {techStack.infrastructure.map(tech => (
                    <div key={tech.name} className="flex items-center gap-md p-sm" style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)' }}>
                      <tech.icon size={20} style={{ color: 'var(--accent-warning)' }} />
                      <div>
                        <div className="small font-semibold">{tech.name}</div>
                        <div className="small opacity-50">{tech.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="card" style={{ background: 'var(--bg-secondary)' }}>
            <h2 className="h2 mb-md"><Shield size={24} /> Security & Compliance</h2>
            <div className="grid grid-cols-4 gap-md">
              <div className="flex items-center gap-sm">
                <Lock size={18} style={{ color: 'var(--accent-success)' }} />
                <span className="small">AES-256 Encryption</span>
              </div>
              <div className="flex items-center gap-sm">
                <Shield size={18} style={{ color: 'var(--accent-success)' }} />
                <span className="small">OAuth 2.0 + MFA</span>
              </div>
              <div className="flex items-center gap-sm">
                <Users size={18} style={{ color: 'var(--accent-success)' }} />
                <span className="small">Role-Based Access</span>
              </div>
              <div className="flex items-center gap-sm">
                <FileText size={18} style={{ color: 'var(--accent-success)' }} />
                <span className="small">Immutable Audit Logs</span>
              </div>
            </div>
          </section>
        </>
      )}

      {/* Features Tab */}
      {activeTab === 'features' && (
        <section className="card">
          <h2 className="h2 mb-lg"><Sparkles size={24} /> Core Features</h2>
          <div className="grid grid-cols-2 gap-lg">
            {features.map((feature, i) => (
              <div 
                key={i} 
                className="card-inner" 
                style={{ 
                  padding: 'var(--space-lg)',
                  borderLeft: `4px solid var(--accent-${['primary', 'secondary', 'success', 'warning', 'info', 'danger'][i % 6]})`
                }}
              >
                <h3 className="h3">{feature.title}</h3>
                <p className="small opacity-70 mt-sm mb-md">{feature.desc}</p>
                <div className="flex gap-xs flex-wrap">
                  {feature.highlights.map((h, j) => (
                    <span key={j} className="tag" style={{ fontSize: 10 }}>{h}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Roadmap Tab */}
      {activeTab === 'roadmap' && (
        <section className="card">
          <h2 className="h2 mb-lg"><GitBranch size={24} /> Product Roadmap</h2>
          <div className="grid grid-cols-4 gap-lg">
            {roadmap.map((r, i) => (
              <div key={i} className="card-inner" style={{ padding: 'var(--space-lg)' }}>
                <div 
                  className="tag mb-md" 
                  style={{ 
                    background: i === 0 ? 'var(--accent-success-dim)' : 'var(--bg-elevated)',
                    color: i === 0 ? 'var(--accent-success)' : 'inherit'
                  }}
                >
                  {r.q} {i === 0 && '• Current'}
                </div>
                <ul className="flex-col gap-xs">
                  {r.items.map((item, j) => (
                    <li key={j} className="small flex items-start gap-sm">
                      <CheckCircle size={14} style={{ color: 'var(--accent-primary)', marginTop: 2 }} />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Footer Links */}
      <section className="card" style={{ textAlign: 'center' }}>
        <p className="small opacity-50 mb-md">Built for the London Hackathon 2026</p>
        <div className="flex gap-md justify-center">
          <a href="https://github.com" target="_blank" rel="noopener" className="btn secondary" style={{ gap: 8 }}>
            <Github size={16} /> GitHub
          </a>
          <a href="/help" className="btn secondary" style={{ gap: 8 }}>
            <BookOpen size={16} /> Documentation
          </a>
        </div>
      </section>
    </div>
  );
}
