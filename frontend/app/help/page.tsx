'use client';
import { useState } from 'react';
import Link from 'next/link';
import { 
  LayoutDashboard, FileText, Search, Calendar, Package, Settings, 
  Upload, ShieldAlert, ClipboardCheck, Users, ShieldCheck, 
  Link2, Sparkles, ChevronRight, CheckCircle, AlertCircle, ArrowRight,
  BookOpen, Play, Zap, Target, Star, TrendingUp, UserCheck, Scale,
  Briefcase, Eye, RefreshCw, AlertTriangle, FileCheck, MapPin
} from 'lucide-react';

type Section = 
  | 'overview' 
  | 'quick-start'
  | 'journey-credit-analyst'
  | 'journey-loan-ops'
  | 'journey-legal'
  | 'journey-trader'
  | 'journey-compliance'
  | 'journey-portfolio-mgr'
  | 'ai-features'
  | 'glossary';

export default function HelpPage() {
  const [activeSection, setActiveSection] = useState<Section>('overview');

  const sections: { id: Section; label: string; icon: any; category?: string }[] = [
    { id: 'overview', label: 'Platform Overview', icon: LayoutDashboard, category: 'GETTING STARTED' },
    { id: 'quick-start', label: 'Quick Start Guide', icon: Zap },
    { id: 'journey-credit-analyst', label: 'Credit Analyst Journey', icon: TrendingUp, category: 'USER JOURNEYS' },
    { id: 'journey-loan-ops', label: 'Loan Operations Journey', icon: RefreshCw },
    { id: 'journey-legal', label: 'Legal/Documentation Journey', icon: Scale },
    { id: 'journey-trader', label: 'Trader Journey', icon: Briefcase },
    { id: 'journey-compliance', label: 'Compliance Officer Journey', icon: UserCheck },
    { id: 'journey-portfolio-mgr', label: 'Portfolio Manager Journey', icon: Eye },
    { id: 'ai-features', label: 'AI & Automation Guide', icon: Sparkles, category: 'REFERENCE' },
    { id: 'glossary', label: 'Glossary & Shortcuts', icon: BookOpen },
  ];

  let lastCategory = '';

  return (
    <div className="flex-col gap-lg slide-up">
      {/* Header */}
      <div className="card" style={{ background: 'linear-gradient(135deg, var(--bg-card) 0%, var(--accent-primary-dim) 100%)' }}>
        <div className="flex justify-between items-center flex-mobile-wrap gap-md">
          <div>
            <h1 className="h1" style={{ margin: 0 }}>
              <BookOpen size={28} style={{ display: 'inline', marginRight: 12 }} />
              LoanTwin OS User Guide
            </h1>
            <p className="body opacity-70 mt-sm">End-to-end workflows organized by user role</p>
          </div>
          <Link href="/" className="btn primary">← Back to Dashboard</Link>
        </div>
      </div>

      <div className="grid" style={{ gridTemplateColumns: '280px 1fr', gap: 24 }}>
        {/* Sidebar Navigation */}
        <div className="flex-col gap-xs">
          {sections.map((section) => {
            const IconComponent = section.icon;
            const showCategory = section.category && section.category !== lastCategory;
            if (section.category) lastCategory = section.category;
            
            return (
              <div key={section.id}>
                {showCategory && (
                  <div className="small font-semibold opacity-50 mb-sm mt-md px-sm">{section.category}</div>
                )}
                <button
                  className={`flex items-center gap-sm p-sm rounded-lg`}
                style={{
                  cursor: 'pointer',
                  textAlign: 'left',
                  background: activeSection === section.id ? 'var(--accent-primary-dim)' : 'transparent',
                  borderTop: 'none',
                  borderRight: 'none',
                  borderBottom: 'none',
                  borderLeft: activeSection === section.id ? '3px solid var(--accent-primary)' : '3px solid transparent',
                  width: '100%'
                }}
                  onClick={() => setActiveSection(section.id)}
                >
                  <IconComponent size={16} style={{ opacity: activeSection === section.id ? 1 : 0.5 }} />
                  <span className="small" style={{ fontWeight: activeSection === section.id ? 600 : 400, flex: 1 }}>
                    {section.label}
                  </span>
                </button>
              </div>
            );
          })}
        </div>

        {/* Content */}
        <div className="card" style={{ minHeight: 600, maxHeight: '80vh', overflowY: 'auto' }}>
          {activeSection === 'overview' && <OverviewSection />}
          {activeSection === 'quick-start' && <QuickStartSection />}
          {activeSection === 'journey-credit-analyst' && <CreditAnalystJourney />}
          {activeSection === 'journey-loan-ops' && <LoanOpsJourney />}
          {activeSection === 'journey-legal' && <LegalJourney />}
          {activeSection === 'journey-trader' && <TraderJourney />}
          {activeSection === 'journey-compliance' && <ComplianceJourney />}
          {activeSection === 'journey-portfolio-mgr' && <PortfolioManagerJourney />}
          {activeSection === 'ai-features' && <AIFeaturesSection />}
          {activeSection === 'glossary' && <GlossarySection />}
        </div>
      </div>
    </div>
  );
}

// ============== REUSABLE COMPONENTS ==============

function E2EFlow({ title, description, steps, outcome }: { 
  title: string; 
  description: string;
  steps: { action: string; module: string; detail?: string }[];
  outcome: string;
}) {
  return (
    <div className="mb-lg p-md rounded-lg" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)' }}>
      <div className="flex items-start gap-md mb-md">
        <div className="p-sm rounded-lg" style={{ background: 'var(--accent-primary-dim)' }}>
          <Play size={20} style={{ color: 'var(--accent-primary)' }} />
        </div>
        <div>
          <h4 className="font-semibold">{title}</h4>
          <p className="small opacity-70">{description}</p>
        </div>
      </div>
      
      <div className="flex-col gap-sm mb-md">
        {steps.map((step, i) => (
          <div key={i} className="flex items-start gap-sm">
            <div style={{ 
              width: 24, height: 24, borderRadius: '50%', 
              background: 'var(--gradient-accent)', 
              display: 'flex', alignItems: 'center', justifyContent: 'center', 
              color: '#00040F', fontSize: 12, fontWeight: 700, flexShrink: 0 
            }}>
              {i + 1}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-sm">
                <span className="small font-semibold">{step.action}</span>
                <span className="badge" style={{ fontSize: 9, background: 'var(--bg-elevated)' }}>{step.module}</span>
              </div>
              {step.detail && <p className="small opacity-60 mt-xs">{step.detail}</p>}
            </div>
          </div>
        ))}
      </div>
      
      <div className="p-sm rounded-lg flex items-center gap-sm" style={{ background: 'var(--accent-success-dim)' }}>
        <CheckCircle size={16} style={{ color: 'var(--accent-success)' }} />
        <span className="small font-semibold" style={{ color: 'var(--accent-success)' }}>Outcome: {outcome}</span>
      </div>
    </div>
  );
}

function QuickTip({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-sm rounded-lg flex items-start gap-sm mb-md" style={{ background: 'var(--accent-secondary-dim)', borderLeft: '3px solid var(--accent-secondary)' }}>
      <Zap size={16} style={{ color: 'var(--accent-secondary)', flexShrink: 0, marginTop: 2 }} />
      <span className="small">{children}</span>
    </div>
  );
}

// ============== SECTIONS ==============

function OverviewSection() {
  return (
    <div className="flex-col gap-lg">
      <div>
        <h2 className="h2">Welcome to LoanTwin OS v4.0</h2>
        <p className="body opacity-80 mt-md">
          The Self-Driving Loan Asset Platform that transforms legal agreements into governed digital twins 
          with autonomous management, AI-powered risk assessment, and real-time monitoring.
        </p>
      </div>

      <div className="card-inner" style={{ background: 'var(--accent-secondary-dim)', borderLeft: '3px solid var(--accent-secondary)' }}>
        <div className="flex items-center gap-sm mb-sm">
          <Star size={18} style={{ color: 'var(--accent-secondary)' }} />
          <span className="font-semibold">v4.0 Capabilities</span>
        </div>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          <div className="flex items-center gap-xs"><CheckCircle size={14} style={{ color: 'var(--accent-success)' }} /><span className="small">ML Credit Risk (97%)</span></div>
          <div className="flex items-center gap-xs"><CheckCircle size={14} style={{ color: 'var(--accent-success)' }} /><span className="small">AI Document Vetting</span></div>
          <div className="flex items-center gap-xs"><CheckCircle size={14} style={{ color: 'var(--accent-success)' }} /><span className="small">Expert Network</span></div>
          <div className="flex items-center gap-xs"><CheckCircle size={14} style={{ color: 'var(--accent-success)' }} /><span className="small">Groq Real-Time AI</span></div>
          <div className="flex items-center gap-xs"><CheckCircle size={14} style={{ color: 'var(--accent-success)' }} /><span className="small">Trade Pack Builder</span></div>
          <div className="flex items-center gap-xs"><CheckCircle size={14} style={{ color: 'var(--accent-success)' }} /><span className="small">Data Import</span></div>
        </div>
      </div>

      <div>
        <h3 className="h3 mb-md">👥 This Guide is Organized by Role</h3>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
          <div className="p-md rounded-lg" style={{ background: 'var(--bg-primary)', borderLeft: '3px solid var(--accent-primary)' }}>
            <div className="flex items-center gap-sm mb-xs"><TrendingUp size={16} /><span className="font-semibold">Credit Analyst</span></div>
            <p className="small opacity-60">Risk assessment, portfolio analysis, default prediction</p>
          </div>
          <div className="p-md rounded-lg" style={{ background: 'var(--bg-primary)', borderLeft: '3px solid var(--accent-secondary)' }}>
            <div className="flex items-center gap-sm mb-xs"><RefreshCw size={16} /><span className="font-semibold">Loan Operations</span></div>
            <p className="small opacity-60">Onboarding, document management, obligation tracking</p>
          </div>
          <div className="p-md rounded-lg" style={{ background: 'var(--bg-primary)', borderLeft: '3px solid var(--accent-warning)' }}>
            <div className="flex items-center gap-sm mb-xs"><Scale size={16} /><span className="font-semibold">Legal/Documentation</span></div>
            <p className="small opacity-60">Clause review, LMA compliance, redlining</p>
          </div>
          <div className="p-md rounded-lg" style={{ background: 'var(--bg-primary)', borderLeft: '3px solid var(--accent-success)' }}>
            <div className="flex items-center gap-sm mb-xs"><Briefcase size={16} /><span className="font-semibold">Trader</span></div>
            <p className="small opacity-60">Trade readiness, marketplace, settlement</p>
          </div>
          <div className="p-md rounded-lg" style={{ background: 'var(--bg-primary)', borderLeft: '3px solid var(--accent-info)' }}>
            <div className="flex items-center gap-sm mb-xs"><UserCheck size={16} /><span className="font-semibold">Compliance Officer</span></div>
            <p className="small opacity-60">KYC/AML, vetting verification, expert engagement</p>
          </div>
          <div className="p-md rounded-lg" style={{ background: 'var(--bg-primary)', borderLeft: '3px solid var(--accent-danger)' }}>
            <div className="flex items-center gap-sm mb-xs"><Eye size={16} /><span className="font-semibold">Portfolio Manager</span></div>
            <p className="small opacity-60">Risk monitoring, trade preparation, portfolio health</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickStartSection() {
  return (
    <div className="flex-col gap-lg">
      <div>
        <h2 className="h2">Quick Start Guide</h2>
        <p className="body opacity-80 mt-md">Get up and running in under 5 minutes.</p>
      </div>

      <QuickTip>
        <strong>Fastest way to explore:</strong> Go to Credit Risk → Click "Load Demo Portfolio" → 50 sample loans loaded instantly!
      </QuickTip>

      <E2EFlow
        title="First-Time Setup"
        description="Initial platform configuration for new users"
        steps={[
          { action: "Login or Register", module: "Auth", detail: "Create account or use existing credentials" },
          { action: "Load Demo Data", module: "Credit Risk", detail: "Click 'Load Demo Portfolio' to get sample loans" },
          { action: "Explore Dashboard", module: "Dashboard", detail: "View portfolio summary and key metrics" },
          { action: "Try AI Assistant", module: "LMA Agent", detail: "Click chat bubble, ask 'Show me high-risk loans'" },
        ]}
        outcome="Platform ready with sample data to explore all features"
      />

      <div className="card-inner" style={{ background: 'var(--bg-primary)' }}>
        <h4 className="font-semibold mb-md">⌨️ Essential Shortcuts</h4>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
          <div className="flex justify-between"><span className="small">Command Palette</span><kbd className="badge">⌘ K</kbd></div>
          <div className="flex justify-between"><span className="small">Search</span><kbd className="badge">⌘ /</kbd></div>
          <div className="flex justify-between"><span className="small">Toggle Theme</span><kbd className="badge">⌘ T</kbd></div>
          <div className="flex justify-between"><span className="small">Export Data</span><kbd className="badge">⌘ E</kbd></div>
        </div>
      </div>
    </div>
  );
}

function CreditAnalystJourney() {
  return (
    <div className="flex-col gap-lg">
      <div>
        <div className="flex items-center gap-sm mb-sm">
          <TrendingUp size={24} style={{ color: 'var(--accent-primary)' }} />
          <h2 className="h2">Credit Analyst Journey</h2>
        </div>
        <p className="body opacity-80">Workflows for risk assessment, portfolio analysis, and default prediction.</p>
      </div>

      <E2EFlow
        title="Assess a New Loan Application"
        description="Complete credit risk assessment with AI explanation"
        steps={[
          { action: "Navigate to Credit Risk", module: "Sidebar", detail: "Click 'Credit Risk' in navigation" },
          { action: "Find the application", module: "Portfolio Table", detail: "Use search or scroll to locate loan" },
          { action: "Click 'Assess' button", module: "Credit Risk", detail: "ML model runs (1-2 seconds)" },
          { action: "Review risk score", module: "Credit Risk", detail: "Score 0-100, color-coded risk level" },
          { action: "View SHAP factors", module: "Credit Risk", detail: "See which factors drove the score" },
          { action: "Get AI explanation", module: "AI", detail: "Click 'Explain' for Groq-powered narrative" },
        ]}
        outcome="Risk score with explainable AI factors for credit decision"
      />

      <E2EFlow
        title="Batch Portfolio Risk Assessment"
        description="Assess entire portfolio and identify high-risk loans"
        steps={[
          { action: "Go to Credit Risk dashboard", module: "Credit Risk" },
          { action: "Click 'Assess All'", module: "Credit Risk", detail: "Processes all unassessed loans" },
          { action: "Wait for completion", module: "Credit Risk", detail: "Progress bar shows status" },
          { action: "Review risk distribution", module: "Dashboard", detail: "See Low/Medium/High breakdown" },
          { action: "Click 'Predicted Defaults'", module: "Credit Risk", detail: "View highest-risk loans sorted by probability" },
          { action: "Export results", module: "Export", detail: "Download CSV for reporting" },
        ]}
        outcome="Complete portfolio risk profile with identified defaults"
      />

      <E2EFlow
        title="Import External Loan Data for Analysis"
        description="Bring in data from CSV or external systems"
        steps={[
          { action: "Navigate to Data Import", module: "Sidebar" },
          { action: "Upload CSV or paste URL", module: "Data Import", detail: "Supports Kaggle datasets, Lending Club format" },
          { action: "Preview data", module: "Data Import", detail: "System shows first 10 rows" },
          { action: "Map columns", module: "Data Import", detail: "Match your fields to LoanTwin schema" },
          { action: "Execute import", module: "Data Import", detail: "Progress bar tracks completion" },
          { action: "Run batch assessment", module: "Credit Risk", detail: "Assess all imported loans" },
        ]}
        outcome="External data analyzed with ML risk predictions"
      />

      <E2EFlow
        title="Train Custom Risk Model"
        description="Retrain ML model on your specific portfolio"
        steps={[
          { action: "Ensure sufficient data", module: "Credit Risk", detail: "Need 100+ loans with outcomes" },
          { action: "Click 'Train Model'", module: "Credit Risk" },
          { action: "Wait for training", module: "Credit Risk", detail: "5-fold cross-validation runs" },
          { action: "Review metrics", module: "Credit Risk", detail: "See accuracy, precision, recall" },
          { action: "Model auto-deployed", module: "System", detail: "New predictions use updated model" },
        ]}
        outcome="Custom model trained on your portfolio data"
      />

      <QuickTip>
        Ask the AI: "What are the top risk factors in my portfolio?" or "Show me loans with DTI above 40%"
      </QuickTip>
    </div>
  );
}

function LoanOpsJourney() {
  return (
    <div className="flex-col gap-lg">
      <div>
        <div className="flex items-center gap-sm mb-sm">
          <RefreshCw size={24} style={{ color: 'var(--accent-secondary)' }} />
          <h2 className="h2">Loan Operations Journey</h2>
        </div>
        <p className="body opacity-80">Workflows for loan onboarding, document management, and obligation tracking.</p>
      </div>

      <E2EFlow
        title="Onboard a New Loan"
        description="Complete loan setup from document upload to risk assessment"
        steps={[
          { action: "Upload loan documents", module: "Dashboard", detail: "Drag & drop Credit Agreement PDFs" },
          { action: "AI extracts data", module: "AI", detail: "Automatic term extraction (10-30s)" },
          { action: "Review Digital Loan Record", module: "DLR", detail: "Verify parties, facilities, terms" },
          { action: "Initiate vetting", module: "Vetting", detail: "System creates document checklist" },
          { action: "Request borrower documents", module: "Vetting", detail: "Send list to borrower" },
          { action: "Run initial risk assessment", module: "Credit Risk", detail: "Get preliminary risk score" },
          { action: "Review obligations", module: "Obligations", detail: "Track borrower/lender obligations" },
        ]}
        outcome="Loan fully onboarded with DLR, vetting initiated, obligations tracked"
      />

      <E2EFlow
        title="Process Incoming Documents"
        description="Handle documents submitted by borrowers"
        steps={[
          { action: "Navigate to Vetting Center", module: "Sidebar" },
          { action: "Select application", module: "Vetting", detail: "Choose from pending queue" },
          { action: "View checklist", module: "Vetting", detail: "See required vs submitted docs" },
          { action: "Upload received documents", module: "Vetting", detail: "Match to checklist items" },
          { action: "Run AI verification", module: "Vetting", detail: "Click 'AI Verify' for each doc" },
          { action: "Review flagged items", module: "Vetting", detail: "Handle any verification issues" },
          { action: "Mark checklist complete", module: "Vetting", detail: "All docs verified = ready for approval" },
        ]}
        outcome="Documents verified, application ready for credit decision"
      />

      <E2EFlow
        title="Manage Upcoming Obligations"
        description="Track and complete compliance requirements"
        steps={[
          { action: "Go to Obligations", module: "Sidebar" },
          { action: "Filter by due date", module: "Obligations", detail: "Next 7/30/90 days" },
          { action: "Assign owners", module: "Obligations", detail: "Click obligation → Assign team member" },
          { action: "Upload evidence", module: "Obligations", detail: "Attach certificates, statements" },
          { action: "Mark complete", module: "Obligations", detail: "System creates audit trail" },
          { action: "Generate compliance report", module: "Export", detail: "Export for audit purposes" },
        ]}
        outcome="Obligations tracked, evidence collected, audit-ready"
      />

      <E2EFlow
        title="Handle Amendment Processing"
        description="Process loan amendments and update records"
        steps={[
          { action: "Upload amendment document", module: "Dashboard" },
          { action: "AI identifies changes", module: "AI", detail: "Compares to original terms" },
          { action: "Review DLR updates", module: "DLR", detail: "See what changed (highlighted)" },
          { action: "Approve changes", module: "DLR", detail: "Confirm updated terms" },
          { action: "Update obligations if needed", module: "Obligations", detail: "Due dates may have changed" },
          { action: "Version history saved", module: "DLR", detail: "Time-travel to any version" },
        ]}
        outcome="Amendment processed, DLR updated, full audit trail"
      />
    </div>
  );
}

function LegalJourney() {
  return (
    <div className="flex-col gap-lg">
      <div>
        <div className="flex items-center gap-sm mb-sm">
          <Scale size={24} style={{ color: 'var(--accent-warning)' }} />
          <h2 className="h2">Legal/Documentation Journey</h2>
        </div>
        <p className="body opacity-80">Workflows for clause review, LMA compliance, and documentation standards.</p>
      </div>

      <E2EFlow
        title="Review Loan Documentation for Compliance"
        description="Check agreement against LMA standards"
        steps={[
          { action: "Open Clause Explorer", module: "Sidebar" },
          { action: "Browse by category", module: "Clauses", detail: "Covenants, Events of Default, etc." },
          { action: "Check variance scores", module: "Clauses", detail: "Red flags indicate non-standard" },
          { action: "Click non-standard clause", module: "Clauses", detail: "View full text and source" },
          { action: "Compare to LMA template", module: "Clauses", detail: "Side-by-side comparison" },
          { action: "View AI redline", module: "Clauses", detail: "Suggested changes to standard" },
          { action: "Approve or escalate", module: "Clauses", detail: "Accept redline or flag for review" },
        ]}
        outcome="Documentation reviewed, non-standard clauses identified and addressed"
      />

      <E2EFlow
        title="Handle Non-Standard Clause Negotiation"
        description="Manage bespoke terms that deviate from market standard"
        steps={[
          { action: "Identify flagged clause", module: "Clauses", detail: "High variance score alert" },
          { action: "Understand deviation", module: "Clauses", detail: "Read AI explanation of difference" },
          { action: "Draft response position", module: "AI", detail: "Ask AI to suggest negotiation points" },
          { action: "Engage external counsel (if needed)", module: "Experts", detail: "Create issue, find legal expert" },
          { action: "Document final position", module: "Clauses", detail: "Record accepted deviation" },
          { action: "Update risk assessment", module: "Credit Risk", detail: "Non-standard terms may affect risk" },
        ]}
        outcome="Non-standard clause resolved with documented rationale"
      />

      <E2EFlow
        title="Prepare Trade Documentation"
        description="Ensure documentation supports secondary trading"
        steps={[
          { action: "Go to Trade Pack", module: "Sidebar" },
          { action: "Check trade readiness score", module: "Trade Pack", detail: "See blocking issues" },
          { action: "Review transfer restrictions", module: "Clauses", detail: "Check consent requirements" },
          { action: "Verify white-list clauses", module: "Trade Pack", detail: "Pre-approved buyer list" },
          { action: "Generate trade pack", module: "Trade Pack", detail: "Compile required documents" },
          { action: "Export for counterparty", module: "Export", detail: "PDF or secure share" },
        ]}
        outcome="Trade documentation package ready for execution"
      />

      <QuickTip>
        Use Command Palette (⌘K) → Type "non-standard" to quickly find all flagged clauses
      </QuickTip>
    </div>
  );
}

function TraderJourney() {
  return (
    <div className="flex-col gap-lg">
      <div>
        <div className="flex items-center gap-sm mb-sm">
          <Briefcase size={24} style={{ color: 'var(--accent-success)' }} />
          <h2 className="h2">Trader Journey</h2>
        </div>
        <p className="body opacity-80">Workflows for trade readiness, marketplace access, and settlement.</p>
      </div>

      <E2EFlow
        title="Assess Loan for Secondary Trade"
        description="Determine if a loan is ready for trading"
        steps={[
          { action: "Select loan from portfolio", module: "Dashboard" },
          { action: "Go to Trade Pack", module: "Sidebar" },
          { action: "Review trade readiness score", module: "Trade Pack", detail: "80-100 = Ready, <50 = High Risk" },
          { action: "Check blocking issues", module: "Trade Pack", detail: "Consent requirements, restrictions" },
          { action: "Review market intelligence", module: "Market Intel", detail: "Distance-to-Default, pricing" },
          { action: "Decide: proceed or remediate", module: "Trade Pack" },
        ]}
        outcome="Clear understanding of trade readiness and any blockers"
      />

      <E2EFlow
        title="Execute Pre-Cleared Trade (Green Lane)"
        description="Instant trade with white-listed buyer"
        steps={[
          { action: "Open Marketplace", module: "Trade Pack" },
          { action: "View interested buyers", module: "Marketplace", detail: "Filter by pre-cleared status" },
          { action: "Select green-lane buyer", module: "Marketplace", detail: "Already on white-list" },
          { action: "Confirm trade terms", module: "Marketplace", detail: "Price, settlement date" },
          { action: "Execute trade", module: "Marketplace", detail: "One-click execution" },
          { action: "Settlement confirmation", module: "Settlement", detail: "T+0 if tokenized" },
        ]}
        outcome="Trade executed instantly with pre-cleared counterparty"
      />

      <E2EFlow
        title="Request Consent for New Buyer (Amber Lane)"
        description="Process waiver for non-white-listed buyer"
        steps={[
          { action: "Identify interested buyer", module: "Marketplace", detail: "Not on white-list" },
          { action: "Click 'Request Waiver'", module: "Marketplace" },
          { action: "AI drafts waiver request", module: "AI", detail: "Pre-filled with deal details" },
          { action: "Review and customize", module: "Marketplace" },
          { action: "Send to Agent Bank", module: "Marketplace", detail: "Email or portal submission" },
          { action: "Track approval status", module: "Trade Pack", detail: "Pending → Approved" },
          { action: "Execute upon approval", module: "Marketplace" },
        ]}
        outcome="Waiver obtained, new buyer cleared, trade executed"
      />

      <E2EFlow
        title="Monitor Market Risk on Position"
        description="Track borrower credit risk in real-time"
        steps={[
          { action: "Go to Market Intelligence", module: "Sidebar" },
          { action: "Select borrower", module: "Market Intel" },
          { action: "View Distance-to-Default", module: "Market Intel", detail: "Merton model calculation" },
          { action: "Check equity cushion", module: "Market Intel", detail: "Buffer protecting lenders" },
          { action: "Review capital structure", module: "Market Intel", detail: "Position in debt stack" },
          { action: "Set alert thresholds", module: "Market Intel", detail: "Notify on rating changes" },
        ]}
        outcome="Real-time visibility into borrower credit risk"
      />
    </div>
  );
}

function ComplianceJourney() {
  return (
    <div className="flex-col gap-lg">
      <div>
        <div className="flex items-center gap-sm mb-sm">
          <UserCheck size={24} style={{ color: 'var(--accent-info)' }} />
          <h2 className="h2">Compliance Officer Journey</h2>
        </div>
        <p className="body opacity-80">Workflows for KYC/AML, document verification, and regulatory compliance.</p>
      </div>

      <E2EFlow
        title="Complete KYC/AML Verification"
        description="Verify borrower identity and run compliance checks"
        steps={[
          { action: "Open Vetting Center", module: "Sidebar" },
          { action: "Select pending application", module: "Vetting" },
          { action: "Review submitted ID documents", module: "Vetting" },
          { action: "Run AI verification", module: "Vetting", detail: "Checks authenticity, extracts data" },
          { action: "Run compliance checks", module: "Vetting", detail: "KYC, AML, sanctions screening" },
          { action: "Review any flags", module: "Vetting", detail: "Address issues or escalate" },
          { action: "Approve or reject", module: "Vetting" },
        ]}
        outcome="Borrower verified, compliance checks passed, documented"
      />

      <E2EFlow
        title="Handle Compliance Issue with Expert"
        description="Engage external expert for complex compliance matter"
        steps={[
          { action: "Identify compliance issue", module: "Vetting", detail: "Flag during verification" },
          { action: "Create issue in Expert Network", module: "Experts", detail: "Describe the problem" },
          { action: "AI triages issue", module: "Experts", detail: "Classifies category, severity" },
          { action: "Review matched experts", module: "Experts", detail: "AI suggests top matches" },
          { action: "Select expert", module: "Experts", detail: "View profile, rates, reviews" },
          { action: "AI drafts engagement letter", module: "Experts" },
          { action: "Approve and send", module: "Experts" },
          { action: "Track engagement", module: "Experts", detail: "Status updates, deliverables" },
        ]}
        outcome="Expert engaged, compliance issue being resolved"
      />

      <E2EFlow
        title="Audit Loan Documentation"
        description="Conduct periodic compliance audit"
        steps={[
          { action: "Select loans for audit", module: "Portfolio" },
          { action: "Run LMA compliance check", module: "DLR", detail: "Compliance tab shows scores" },
          { action: "Review clause variances", module: "Clauses" },
          { action: "Check obligation status", module: "Obligations", detail: "Any missed deadlines?" },
          { action: "Verify document retention", module: "Vetting", detail: "All docs properly stored" },
          { action: "Generate audit report", module: "Export", detail: "Comprehensive PDF/Excel" },
        ]}
        outcome="Audit completed with documented findings"
      />
    </div>
  );
}

function PortfolioManagerJourney() {
  return (
    <div className="flex-col gap-lg">
      <div>
        <div className="flex items-center gap-sm mb-sm">
          <Eye size={24} style={{ color: 'var(--accent-danger)' }} />
          <h2 className="h2">Portfolio Manager Journey</h2>
        </div>
        <p className="body opacity-80">Workflows for portfolio oversight, risk monitoring, and reporting.</p>
      </div>

      <E2EFlow
        title="Portfolio Health Review"
        description="Comprehensive portfolio status assessment"
        steps={[
          { action: "Open Dashboard", module: "Dashboard" },
          { action: "Review portfolio metrics", module: "Dashboard", detail: "Exposure, risk distribution" },
          { action: "Check predicted defaults", module: "Credit Risk", detail: "Highest risk loans" },
          { action: "Review AI insights", module: "AI Insights", detail: "Portfolio trends" },
          { action: "Check vetting pipeline", module: "Vetting", detail: "Pending applications" },
          { action: "Generate executive summary", module: "Export", detail: "PDF for leadership" },
        ]}
        outcome="Complete portfolio health picture for reporting"
      />

      <E2EFlow
        title="Bulk Risk Assessment"
        description="Assess risk across multiple loan applications"
        steps={[
          { action: "Go to Data Import", module: "Sidebar" },
          { action: "Import loan data CSV", module: "Data Import", detail: "Upload or URL" },
          { action: "Navigate to Credit Risk", module: "Credit Risk" },
          { action: "Click 'Assess All'", module: "Credit Risk", detail: "ML model runs on all" },
          { action: "Review risk distribution", module: "Credit Risk", detail: "High/Medium/Low breakdown" },
          { action: "Drill into high risk loans", module: "Credit Risk", detail: "See risk factors" },
        ]}
        outcome="All loans assessed with ML risk scores"
      />

      <E2EFlow
        title="Trade Preparation"
        description="Prepare loan for secondary market trade"
        steps={[
          { action: "Go to loan DLR", module: "DLR" },
          { action: "Navigate to Trade Pack", module: "Trade Pack" },
          { action: "Review checklist items", module: "Trade Pack", detail: "Transfer requirements" },
          { action: "Verify consent requirements", module: "Trade Pack", detail: "Borrower consent needed?" },
          { action: "Download trade pack", module: "Trade Pack", detail: "PDF for counterparty" },
        ]}
        outcome="Trade documentation ready for settlement"
      />
    </div>
  );
}

function AIFeaturesSection() {
  return (
    <div className="flex-col gap-lg">
      <div>
        <h2 className="h2">AI & Automation Features</h2>
        <p className="body opacity-80 mt-md">LoanTwin OS uses Groq's ultra-fast inference for real-time AI capabilities.</p>
      </div>

      <div className="card-inner" style={{ background: 'var(--accent-secondary-dim)', borderLeft: '3px solid var(--accent-secondary)' }}>
        <div className="flex items-center gap-sm mb-sm">
          <Sparkles size={18} style={{ color: 'var(--accent-secondary)' }} />
          <span className="font-semibold">Groq-Powered AI (&lt;200ms latency)</span>
        </div>
        <p className="small opacity-80">All AI features use Groq's Llama 3.3 70B model for instant responses.</p>
      </div>

      <div>
        <h3 className="h3 mb-md">🤖 AI Capabilities by Feature</h3>
        <div className="flex-col gap-sm">
          <div className="p-md rounded-lg" style={{ background: 'var(--bg-primary)' }}>
            <div className="font-semibold mb-xs">Credit Risk Explanation</div>
            <p className="small opacity-70">Natural language explanation of ML risk scores, factor analysis</p>
            <div className="small mt-sm" style={{ color: 'var(--accent-secondary)' }}>→ Ask: "Explain why loan #123 is high risk"</div>
          </div>
          <div className="p-md rounded-lg" style={{ background: 'var(--bg-primary)' }}>
            <div className="font-semibold mb-xs">Document AI Verification</div>
            <p className="small opacity-70">Authenticity checks, data extraction, cross-reference validation</p>
            <div className="small mt-sm" style={{ color: 'var(--accent-secondary)' }}>→ Click: "AI Verify" on any submitted document</div>
          </div>
          <div className="p-md rounded-lg" style={{ background: 'var(--bg-primary)' }}>
            <div className="font-semibold mb-xs">Issue Triage & Expert Matching</div>
            <p className="small opacity-70">Auto-classify issues, match to experts by specialty/jurisdiction</p>
            <div className="small mt-sm" style={{ color: 'var(--accent-secondary)' }}>→ Create issue → AI suggests top 5 experts</div>
          </div>
          <div className="p-md rounded-lg" style={{ background: 'var(--bg-primary)' }}>
            <div className="font-semibold mb-xs">Covenant Extraction</div>
            <p className="small opacity-70">Automatically identify covenants from loan documents</p>
            <div className="small mt-sm" style={{ color: 'var(--accent-secondary)' }}>→ Click: "AI Extract Covenants" for any loan</div>
          </div>
          <div className="p-md rounded-lg" style={{ background: 'var(--bg-primary)' }}>
            <div className="font-semibold mb-xs">Engagement Letter Drafting</div>
            <p className="small opacity-70">Generate professional engagement letters for experts</p>
            <div className="small mt-sm" style={{ color: 'var(--accent-secondary)' }}>→ Click: "Draft Engagement" on matched expert</div>
          </div>
          <div className="p-md rounded-lg" style={{ background: 'var(--bg-primary)' }}>
            <div className="font-semibold mb-xs">LMA Assistant Chat</div>
            <p className="small opacity-70">Ask any question about your loans, get instant answers</p>
            <div className="small mt-sm" style={{ color: 'var(--accent-secondary)' }}>→ Click chat bubble → Ask anything</div>
          </div>
        </div>
      </div>

      <div>
        <h3 className="h3 mb-md">💬 Example AI Prompts</h3>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
          <div className="p-sm rounded-lg" style={{ background: 'var(--bg-primary)' }}>
            <span className="small">"Show me all loans with DTI above 40%"</span>
          </div>
          <div className="p-sm rounded-lg" style={{ background: 'var(--bg-primary)' }}>
            <span className="small">"What covenants are due this month?"</span>
          </div>
          <div className="p-sm rounded-lg" style={{ background: 'var(--bg-primary)' }}>
            <span className="small">"Draft a waiver request for leverage breach"</span>
          </div>
          <div className="p-sm rounded-lg" style={{ background: 'var(--bg-primary)' }}>
            <span className="small">"Explain risk factors for loan #456"</span>
          </div>
          <div className="p-sm rounded-lg" style={{ background: 'var(--bg-primary)' }}>
            <span className="small">"Find a legal expert in New York"</span>
          </div>
          <div className="p-sm rounded-lg" style={{ background: 'var(--bg-primary)' }}>
            <span className="small">"What's the portfolio compliance rate?"</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function GlossarySection() {
  const terms = [
    { term: 'LMA', definition: 'Loan Market Association - governing body for standardized loan documentation' },
    { term: 'DLR', definition: 'Digital Loan Record - structured representation of a loan agreement' },
    { term: 'CIBIL', definition: 'Credit Information Bureau score (300-900) used in India' },
    { term: 'DTI', definition: 'Debt-to-Income ratio - % of income used for debt payments' },
    { term: 'DTD', definition: 'Distance-to-Default - Merton model credit risk metric' },
    { term: 'SHAP', definition: 'SHapley Additive exPlanations - ML feature importance method' },
    { term: 'Covenant', definition: 'Contractual commitment restricting borrower behavior' },
    { term: 'White-list', definition: 'Pre-approved list of eligible loan buyers' },
    { term: 'T+0', definition: 'Same-day settlement (vs T+2 standard)' },
    { term: 'ESG-Linked', definition: 'Loan with pricing tied to sustainability targets' },
    { term: 'Agent Bank', definition: 'Administrative agent coordinating syndicate lenders' },
    { term: 'Groq', definition: 'Ultra-fast AI inference provider (<200ms latency)' },
  ];

  return (
    <div className="flex-col gap-lg">
      <div>
        <h2 className="h2">Glossary & Shortcuts</h2>
        <p className="body opacity-80 mt-md">Key terms and keyboard shortcuts.</p>
      </div>

      <div className="card-inner" style={{ background: 'var(--bg-primary)' }}>
        <h4 className="font-semibold mb-md">⌨️ Keyboard Shortcuts</h4>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
          <div className="flex justify-between"><span className="small">Command Palette</span><kbd className="badge">⌘ K</kbd></div>
          <div className="flex justify-between"><span className="small">Quick Search</span><kbd className="badge">⌘ /</kbd></div>
          <div className="flex justify-between"><span className="small">Toggle Theme</span><kbd className="badge">⌘ T</kbd></div>
          <div className="flex justify-between"><span className="small">Export Data</span><kbd className="badge">⌘ E</kbd></div>
          <div className="flex justify-between"><span className="small">Go to Dashboard</span><kbd className="badge">G D</kbd></div>
          <div className="flex justify-between"><span className="small">Go to Credit Risk</span><kbd className="badge">G K</kbd></div>
          <div className="flex justify-between"><span className="small">Go to Vetting</span><kbd className="badge">G V</kbd></div>
          <div className="flex justify-between"><span className="small">Go to Experts</span><kbd className="badge">G E</kbd></div>
        </div>
      </div>

      <div>
        <h3 className="h3 mb-md">📖 Terms</h3>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
          {terms.map((item, idx) => (
            <div key={idx} className="p-sm rounded-lg" style={{ background: 'var(--bg-primary)' }}>
              <span className="small font-semibold" style={{ color: 'var(--accent-primary)' }}>{item.term}</span>
              <span className="small opacity-70"> — {item.definition}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
