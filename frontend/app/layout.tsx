'use client';
import "../styles/globals.css";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useState, useEffect } from "react";
import LMAAssistant from "./components/LMAAssistant";
import FloatingActionButton from "./components/FloatingActionButton";
import { checkHealth, API_BASE } from "../lib/api";
import { CurrencyProvider, useCurrency } from "../lib/CurrencyContext";
import { LoanProvider, useLoan } from "../lib/LoanContext";
import Logo from "./components/Logo";
import {
  FileText,
  Search,
  Calendar,
  Package,
  HelpCircle,
  LogOut,
  User,
  Moon,
  Sun,
  Command,
  ArrowRight,
  Zap,
  CheckCircle,
  AlertCircle,
  Info,
  X,
  Database,
  ShieldAlert,
  ClipboardCheck,
  Upload,
  Users,
  Calculator,
  Mail,
  Brain
} from 'lucide-react';

const Sidebar = ({ user, mounted, onLogout }: any) => {
  const pathname = usePathname();
  const { activeLoanId } = useLoan();
  const [badgeCounts, setBadgeCounts] = useState({ obligations: 0, tradeChecks: 0, overdue: 0 });

  // Fetch dynamic badge counts
  useEffect(() => {
    if (!activeLoanId) return;
    const fetchCounts = async () => {
      try {
        const [obsRes, tradeRes] = await Promise.all([
          fetch(`${API_BASE}/api/loans/${activeLoanId}/obligations`).then(r => r.json()).catch(() => []),
          fetch(`${API_BASE}/api/loans/${activeLoanId}/trade-pack`).then(r => r.json()).catch(() => [])
        ]);
        const openObs = obsRes.filter((o: any) => o.status?.toLowerCase() !== 'completed').length;
        const highRiskTrade = tradeRes.filter((t: any) => t.risk_level?.toLowerCase() === 'high').length;
        setBadgeCounts({ obligations: openObs, tradeChecks: highRiskTrade, overdue: 0 });
      } catch (e) { /* ignore */ }
    };
    fetchCounts();
  }, [activeLoanId]);

  const items = [
    { href: `/dlr`, label: "Digital Loan Record", icon: FileText },
    { href: `/clauses`, label: "Clause Explorer", icon: Search },
    { href: `/obligations`, label: "Obligations", icon: Calendar, badge: badgeCounts.obligations || undefined, badgeType: 'alert' },
    { href: `/trade-pack`, label: "Trade Pack", icon: Package, badge: badgeCounts.tradeChecks || undefined, badgeType: 'count' },
    { href: `/import`, label: "Data Import", icon: Upload },
    { href: `/credit-risk`, label: "Credit Risk", icon: ShieldAlert },
    { href: `/vetting`, label: "Vetting Center", icon: ClipboardCheck },
    { href: `/experts`, label: "Expert Network", icon: Users },
    { href: `/ai-insights`, label: "AI Insights Hub", icon: Brain },
    { href: `/calculator`, label: "Loan Calculator", icon: Calculator },
    { href: `/help`, label: "Help Center", icon: HelpCircle },
    { href: `/about`, label: "About", icon: Info },
    { href: `/contact`, label: "Contact Us", icon: Mail },
  ];

  const isActive = (href: string) => {
    // Root redirects to DLR, so highlight DLR for both / and /dlr
    if (href === '/dlr') return pathname === '/' || pathname === '/dlr' || pathname?.startsWith('/dlr');
    return pathname?.startsWith(href.split('?')[0]);
  };

  return (
    <aside className="sidebar">
      <div className="mb-lg px-sm">
        <Link href="/dlr">
          <Logo size={32} showText={true} />
        </Link>
      </div>

      <nav className="flex-col gap-xs animate-stagger">
        {items.map((item) => {
          const IconComponent = item.icon;
          return (
            <Link key={item.href} href={item.href} className={`nav-item ${isActive(item.href) ? 'active' : ''}`}>
              <IconComponent size={18} className="nav-icon" />
              <span style={{ flex: 1 }}>{item.label}</span>
              {item.badge && (
                <span className="badge" style={{
                  background: item.badgeType === 'alert' ? 'var(--accent-danger)' : 'var(--bg-elevated)',
                  color: item.badgeType === 'alert' ? 'white' : 'var(--text-secondary)',
                  border: item.badgeType === 'count' ? '1px solid var(--border-default)' : 'none'
                }}>
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div style={{ marginTop: 'auto', paddingTop: 24, borderTop: '1px solid var(--border-subtle)' }}>
        {mounted && user ? (
          <div className="flex-col gap-sm">
            <Link href="/profile" className="flex items-center gap-md nav-item" style={{ padding: '8px 12px' }}>
              {user.picture_url ? (
                <img src={user.picture_url} alt="" style={{ width: 36, height: 36, borderRadius: '50%', border: '2px solid var(--accent-secondary)' }} />
              ) : (
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: 'var(--gradient-accent)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#00040F',
                  fontWeight: 700,
                  fontSize: 14
                }}>
                  {user.full_name ? user.full_name[0] : 'U'}
                </div>
              )}
              <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span className="small truncate" style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{user.full_name || 'User'}</span>
                <span className="small" style={{ fontSize: 11, color: 'var(--text-muted)' }}>Active Workspace</span>
              </div>
            </Link>
            <button className="btn secondary w-full" onClick={onLogout} style={{ justifyContent: 'center', fontSize: 12 }}>
              <LogOut size={14} /> Logout
            </button>
          </div>
        ) : mounted && (
          <Link href="/login" className="btn primary w-full" style={{ justifyContent: 'center' }}>
            <User size={16} /> Login / Register
          </Link>
        )}
      </div>
    </aside>
  );
};

const Header = ({ theme, toggleTheme, mounted }: any) => {
  const { baseCurrency, setBaseCurrency } = useCurrency();
  const [apiOk, setApiOk] = useState<boolean | null>(null);

  useEffect(() => {
    if (!mounted) return;
    checkHealth().then(setApiOk);
    const interval = setInterval(() => checkHealth().then(setApiOk), 10000);
    return () => clearInterval(interval);
  }, [mounted]);

  return (
    <header className="flex justify-between items-center mb-lg">
      <div className="flex items-center gap-md" style={{ flex: 1 }}>
        <div
          className="flex items-center gap-sm px-md py-sm interactive-hover"
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            width: '100%',
            maxWidth: 400,
            cursor: 'pointer'
          }}
          onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { metaKey: true, key: 'k' }))}
        >
          <Search size={16} style={{ opacity: 0.5 }} />
          <span className="small" style={{ opacity: 0.5, flex: 1 }}>Search deals, clauses...</span>
          <kbd className="small mono" style={{
            padding: '2px 6px',
            background: 'var(--bg-elevated)',
            borderRadius: 4,
            fontSize: 10,
            opacity: 0.6
          }}>⌘K</kbd>
        </div>
      </div>

      <div className="flex items-center gap-md">
        <button className="btn-icon" onClick={toggleTheme}>
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        <div
          className="flex items-center gap-xs px-sm py-xs"
          style={{
            background: apiOk ? 'var(--accent-success-dim)' : 'var(--accent-danger-dim)',
            borderRadius: 'var(--radius-full)',
            border: `1px solid ${apiOk ? 'var(--accent-success)' : 'var(--accent-danger)'}`
          }}
        >
          <div style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: apiOk ? 'var(--accent-success)' : 'var(--accent-danger)',
            boxShadow: apiOk ? 'var(--glow-success)' : 'var(--glow-danger)'
          }} />
          <span className="small" style={{
            fontSize: 10,
            fontWeight: 600,
            color: apiOk ? 'var(--accent-success)' : 'var(--accent-danger)'
          }}>
            {apiOk ? 'Online' : 'Offline'}
          </span>
        </div>
      </div>
    </header>
  );
};

const CommandPalette = ({ isOpen, onClose }: any) => {
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ deals: any[], clauses: any[] } | null>(null);
  const [searching, setSearching] = useState(false);
  const router = useRouter();
  const { setActiveLoanId, setLoanName } = useLoan();

  // Reset state when palette opens
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSearchResults(null);
    }
  }, [isOpen]);

  // Debounced search
  useEffect(() => {
    if (!query || query.length < 2) {
      setSearchResults(null);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const { globalSearch } = await import('../lib/api');
        const results = await globalSearch(query);
        setSearchResults(results);
      } catch (e) {
        console.error('Search failed:', e);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  if (!isOpen) return null;

  const navItems = [
    { name: "Digital Loan Record", cmd: "/dlr", icon: FileText, shortcut: "G D" },
    { name: "Clause Explorer", cmd: "/clauses", icon: Search, shortcut: "G C" },
    { name: "Obligations", cmd: "/obligations", icon: Calendar, shortcut: "G O" },
    { name: "Trade Pack", cmd: "/trade-pack", icon: Package, shortcut: "G T" },
    { name: "Data Import", cmd: "/import", icon: Upload, shortcut: "G I" },
    { name: "Credit Risk", cmd: "/credit-risk", icon: ShieldAlert, shortcut: "G K" },
    { name: "Vetting Center", cmd: "/vetting", icon: ClipboardCheck, shortcut: "G V" },
    { name: "Expert Network", cmd: "/experts", icon: Users, shortcut: "G E" },
    { name: "AI Insights Hub", cmd: "/ai-insights", icon: Brain, shortcut: "G N" },
    { name: "Loan Calculator", cmd: "/calculator", icon: Calculator, shortcut: "G A" },
    { name: "Help Center", cmd: "/help", icon: HelpCircle, shortcut: "G H" },
    { name: "About", cmd: "/about", icon: Info, shortcut: "G B" },
    { name: "Contact Us", cmd: "/contact", icon: Mail, shortcut: "G U" },
  ];

  const filteredNav = query
    ? navItems.filter(item => item.name.toLowerCase().includes(query.toLowerCase()))
    : navItems;

  const handleSelectDeal = (deal: any) => {
    setActiveLoanId(deal.id);
    setLoanName(deal.name);
    router.push('/dlr');
    onClose();
    window.dispatchEvent(new CustomEvent('loantwin-toast', {
      detail: { message: `Loaded: ${deal.name}`, type: 'success' }
    }));
  };

  const handleSelectClause = (clause: any) => {
    setActiveLoanId(clause.loan_id);
    setLoanName(clause.loan_name);
    router.push(`/clauses?highlight=${clause.id}`);
    onClose();
  };

  const hasSearchResults = searchResults && (searchResults.deals.length > 0 || searchResults.clauses.length > 0);

  return (
    <div className="cmd-palette-overlay" onClick={onClose}>
      <div className="cmd-palette" onClick={e => e.stopPropagation()}>
        <div className="cmd-palette-input">
          {searching ? (
            <div className="spinner" style={{ width: 20, height: 20 }} />
          ) : (
            <Search size={20} style={{ opacity: 0.5 }} />
          )}
          <input
            autoFocus
            placeholder="Search deals, clauses, or navigate..."
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          <button className="btn-icon" onClick={onClose} style={{ border: 'none' }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ maxHeight: 400, overflowY: 'auto' }}>
          {/* Search Results - Deals */}
          {hasSearchResults && searchResults.deals.length > 0 && (
            <div className="cmd-group">
              <div className="cmd-group-header" style={{ color: 'var(--accent-secondary)' }}>
                Deals ({searchResults.deals.length})
              </div>
              {searchResults.deals.slice(0, 5).map((deal: any) => (
                <div
                  key={deal.id}
                  className="cmd-item"
                  onClick={() => handleSelectDeal(deal)}
                >
                  <div className="cmd-item-icon" style={{ background: 'var(--accent-secondary-dim)' }}>
                    <FileText size={16} style={{ color: 'var(--accent-secondary)' }} />
                  </div>
                  <div className="cmd-item-content">
                    <div className="cmd-item-title">{deal.name}</div>
                    <div className="cmd-item-desc" style={{ fontSize: 11, opacity: 0.6 }}>
                      {deal.borrower} • {deal.facility_type} • {deal.currency}
                      {deal.is_esg_linked && <span style={{ color: 'var(--accent-success)', marginLeft: 8 }}>ESG</span>}
                    </div>
                  </div>
                  <ArrowRight size={14} style={{ opacity: 0.4 }} />
                </div>
              ))}
            </div>
          )}

          {/* Search Results - Clauses */}
          {hasSearchResults && searchResults.clauses.length > 0 && (
            <div className="cmd-group">
              <div className="cmd-group-header" style={{ color: 'var(--accent-primary)' }}>
                Clauses ({searchResults.clauses.length})
              </div>
              {searchResults.clauses.slice(0, 5).map((clause: any) => (
                <div
                  key={clause.id}
                  className="cmd-item"
                  onClick={() => handleSelectClause(clause)}
                >
                  <div className="cmd-item-icon" style={{
                    background: clause.is_standard ? 'var(--accent-success-dim)' : 'var(--accent-warning-dim)'
                  }}>
                    <FileText size={16} style={{
                      color: clause.is_standard ? 'var(--accent-success)' : 'var(--accent-warning)'
                    }} />
                  </div>
                  <div className="cmd-item-content">
                    <div className="cmd-item-title">{clause.heading}</div>
                    <div className="cmd-item-desc" style={{ fontSize: 11, opacity: 0.6 }}>
                      {clause.loan_name} • Page {clause.page_start}
                      {!clause.is_standard && <span style={{ color: 'var(--accent-warning)', marginLeft: 8 }}>Non-Standard</span>}
                    </div>
                  </div>
                  <ArrowRight size={14} style={{ opacity: 0.4 }} />
                </div>
              ))}
            </div>
          )}

          {/* Navigation - show when no search or as secondary */}
          {(!query || filteredNav.length > 0) && (
            <div className="cmd-group">
              <div className="cmd-group-header">Navigation</div>
              {(query ? filteredNav.slice(0, 5) : filteredNav).map(item => {
                const IconComponent = item.icon;
                return (
                  <div
                    key={item.name}
                    className="cmd-item"
                    onClick={() => {
                      router.push(item.cmd);
                      onClose();
                    }}
                  >
                    <div className="cmd-item-icon">
                      <IconComponent size={16} />
                    </div>
                    <div className="cmd-item-content">
                      <div className="cmd-item-title">{item.name}</div>
                    </div>
                    <span className="cmd-item-shortcut">{item.shortcut}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* No results */}
          {query && query.length >= 2 && !searching && !hasSearchResults && filteredNav.length === 0 && (
            <div className="empty-state" style={{ padding: 'var(--space-xl)', textAlign: 'center' }}>
              <Search size={32} style={{ opacity: 0.3 }} />
              <p className="small mt-md opacity-50">No deals or clauses found for "{query}"</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const Toast = ({ message, type, onClose }: { message: string; type: 'success' | 'error' | 'warning' | 'info'; onClose: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const icons = {
    success: CheckCircle,
    error: AlertCircle,
    warning: AlertCircle,
    info: Info
  };

  const IconComponent = icons[type];

  return (
    <div className={`toast-premium ${type}`}>
      <div className="toast-icon" style={{
        color: type === 'success' ? 'var(--accent-success)' :
          type === 'error' ? 'var(--accent-danger)' :
            type === 'warning' ? 'var(--accent-warning)' : 'var(--accent-secondary)'
      }}>
        <IconComponent size={20} />
      </div>
      <div className="toast-content">
        <span className="small" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{message}</span>
      </div>
      <button className="toast-close" onClick={onClose}>
        <X size={16} />
      </button>
    </div>
  );
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [isCmdOpen, setIsCmdOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' | 'warning' | 'info' } | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const isLoginPage = pathname === '/login' || pathname?.startsWith('/login');

  useEffect(() => {
    setMounted(true);
    const savedUser = localStorage.getItem('loantwin_user');
    if (savedUser) {
      try { setUser(JSON.parse(savedUser)); } catch (e) { }
    }
    const savedTheme = localStorage.getItem('loantwin_theme') as any;
    if (savedTheme) setTheme(savedTheme);

    const handleToast = (e: any) => setToast(e.detail);
    window.addEventListener('loantwin-toast', handleToast);

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCmdOpen(prev => !prev);
      }
      if (e.key === 'Escape' && isCmdOpen) {
        setIsCmdOpen(false);
      }
    };

    const handleDragEnter = (e: DragEvent) => {
      if (pathname?.includes('/login')) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.dataTransfer?.types.includes('Files')) {
        setIsDragging(true);
      }
    };
    const handleDragOver = (e: DragEvent) => {
      if (pathname?.includes('/login')) return;
      e.preventDefault();
      e.stopPropagation();
    };
    const handleDragLeave = (e: DragEvent) => {
      if (pathname?.includes('/login')) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.clientX <= 0 || e.clientY <= 0 || e.clientX >= window.innerWidth || e.clientY >= window.innerHeight) {
        setIsDragging(false);
      }
    };
    const handleDrop = (e: DragEvent) => {
      if (pathname?.includes('/login')) return;
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        const pdfFiles = Array.from(files).filter(f => f.type === 'application/pdf' || f.name.endsWith('.pdf'));
        if (pdfFiles.length > 0) {
          window.dispatchEvent(new CustomEvent('loantwin-file-drop', {
            detail: { files: pdfFiles }
          }));
          window.dispatchEvent(new CustomEvent('loantwin-toast', {
            detail: { message: `${pdfFiles.length} PDF${pdfFiles.length > 1 ? 's' : ''} ready for analysis`, type: 'success' }
          }));
        } else {
          window.dispatchEvent(new CustomEvent('loantwin-toast', {
            detail: { message: 'Please drop PDF files only', type: 'error' }
          }));
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('loantwin-toast', handleToast);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('drop', handleDrop);
    };
  }, [pathname, isCmdOpen]);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('loantwin_theme', newTheme);
  };

  const handleLogout = () => {
    localStorage.removeItem('loantwin_user');
    setUser(null);
    router.push('/login');
  };

  return (
    <html lang="en" className={mounted ? (theme === 'dark' ? 'theme-dark' : 'theme-light') : ''} suppressHydrationWarning>
      <head>
        <title>LoanTwin OS</title>
        <meta name="description" content="Deal Operating System for Institutional Finance" />
      </head>
      <body>
        <CurrencyProvider>
          <LoanProvider>
            {isLoginPage ? (
              <div className="login-full-screen">
                <Suspense fallback={null}>
                  {children}
                </Suspense>
              </div>
            ) : (
              <div className="app-shell">
                <Sidebar user={user} mounted={mounted} onLogout={handleLogout} />
                <div className="main-content">
                  <Header theme={theme} toggleTheme={toggleTheme} mounted={mounted} />
                  <main>
                    <Suspense fallback={null}>
                      {children}
                    </Suspense>
                  </main>
                  <footer style={{ marginTop: 60, paddingBottom: 40, borderTop: '1px solid var(--border-subtle)', paddingTop: 24 }}>
                    <div className="flex justify-between items-center">
                      <p className="small opacity-70">LoanTwin OS Enterprise v2.5 — Institutional Grade</p>
                      <span className="small mono flex items-center gap-sm" style={{ opacity: 0.5 }}>
                        <Command size={12} />
                        <kbd style={{ padding: '2px 6px', background: 'var(--bg-elevated)', borderRadius: 4, fontSize: 11 }}>K</kbd>
                      </span>
                    </div>
                  </footer>
                </div>
              </div>
            )}

            {!isLoginPage && <CommandPalette isOpen={isCmdOpen} onClose={() => setIsCmdOpen(false)} />}
            {!isLoginPage && <LMAAssistant />}
            {!isLoginPage && <FloatingActionButton />}

            <div className={`drop-overlay ${isDragging && !isLoginPage ? 'active' : ''}`}>
              <div className="pulsing-icon">
                <FileText size={64} style={{ color: 'var(--accent-secondary)' }} />
              </div>
              <h2 className="h2 gradient-text-cyan" style={{ fontSize: 28, marginBottom: 12 }}>Institutional Analysis Engine</h2>
              <p className="body" style={{ textAlign: 'center', marginBottom: 16, color: 'var(--text-secondary)' }}>
                Drop Legal Documents Here to Analyze
              </p>
              <div className="flex gap-lg" style={{ opacity: 0.7 }}>
                <div className="flex items-center gap-xs">
                  <CheckCircle size={14} style={{ color: 'var(--accent-success)' }} />
                  <span className="small">LMA / LSTA Detection</span>
                </div>
                <div className="flex items-center gap-xs">
                  <CheckCircle size={14} style={{ color: 'var(--accent-success)' }} />
                  <span className="small">Multi-Doc Mapping</span>
                </div>
                <div className="flex items-center gap-xs">
                  <CheckCircle size={14} style={{ color: 'var(--accent-success)' }} />
                  <span className="small">AI Extraction</span>
                </div>
              </div>
              <p className="small mono mt-lg" style={{ textAlign: 'center', opacity: 0.4 }}>
                Supports: Credit Agreements • Side Letters • ESG Annexes • Amendments
              </p>
            </div>
            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
          </LoanProvider>
        </CurrencyProvider>
      </body>
    </html>
  );
}
