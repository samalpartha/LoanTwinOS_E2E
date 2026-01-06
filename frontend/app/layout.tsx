'use client';
import "../styles/globals.css";
import Link from "next/link";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { Suspense, useState, useEffect } from "react";
import ChatAssistant from "./components/ChatAssistant";
import { checkHealth } from "../lib/api";

const NavContent = ({ user, theme, toggleTheme, mounted }: any) => {
  const [apiOk, setApiOk] = useState<boolean | null>(null);

  useEffect(() => {
    if (!mounted) return;
    checkHealth().then(setApiOk);
    const interval = setInterval(() => checkHealth().then(setApiOk), 10000);
    return () => clearInterval(interval);
  }, [mounted]);

  const pathname = usePathname();
  const searchParams = useSearchParams();
  const loanId = searchParams.get('loanId') || '1';
  
  const items = [
    { href: `/`, label: "Workspace", icon: "◈" },
    { href: `/dlr?loanId=${loanId}`, label: "DLR", icon: "◉" },
    { href: `/clauses?loanId=${loanId}`, label: "Clause Explorer", icon: "◎" },
    { href: `/obligations?loanId=${loanId}`, label: "Obligations", icon: "◐" },
    { href: `/trade-pack?loanId=${loanId}`, label: "Trade Pack", icon: "◑" },
  ];

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href.split('?')[0]);
  };

  return (
    <nav className="nav">
      <div className="flex items-center gap-sm">
        {items.map((item) => (
          <Link key={item.href} href={item.href}>
            <span className={`pill ${isActive(item.href) ? 'active' : ''}`}>
              <span style={{ marginRight: 6, opacity: 0.7 }}>{item.icon}</span>
              {item.label}
            </span>
          </Link>
        ))}
      </div>
      
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
        {mounted && apiOk === false && (
          <span className="tag danger" style={{ fontSize: 10, animation: 'pulse 2s infinite' }}>
            ● API Offline
          </span>
        )}
        <button className="btn-icon btn" onClick={toggleTheme} title="Toggle Theme" style={{ background: 'transparent', border: 'none' }}>
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>
        {mounted && user ? (
          <Link href="/profile" className="flex items-center gap-sm pill" style={{ padding: '4px 12px', background: 'var(--bg-elevated)' }}>
            {user.picture_url && <img src={user.picture_url} alt="" style={{ width: 24, height: 24, borderRadius: '50%' }} />}
            <span className="small mono" style={{ fontWeight: 600 }}>{user.full_name ? user.full_name.split(' ')[0] : 'User'}</span>
          </Link>
        ) : mounted ? (
          <Link href="/login" className="btn primary" style={{ padding: '8px 16px', fontSize: 12, borderRadius: 'var(--radius-full)' }}>Login</Link>
        ) : (
          <div style={{ width: 80, height: 32, background: 'var(--bg-elevated)', borderRadius: 'var(--radius-full)', opacity: 0.3 }} />
        )}
      </div>
    </nav>
  );
};

const CommandPalette = ({ isOpen, onClose }: any) => {
  const [query, setQuery] = useState("");
  const router = useRouter();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!isOpen) return null;

  const actions = [
    { name: "Jump to Workspace", cmd: "/", icon: "◈" },
    { name: "Search Clauses", cmd: "/clauses", icon: "◎" },
    { name: "View Obligations", cmd: "/obligations", icon: "◐" },
    { name: "Export to Excel", cmd: "export", icon: "📥" },
    { name: "Toggle Theme", cmd: "theme", icon: "🌙" },
  ];

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '15vh', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div className="card" style={{ width: 500, padding: 8, boxShadow: '0 20px 50px rgba(0,0,0,0.5)', border: '1px solid var(--accent-primary)' }} onClick={e => e.stopPropagation()}>
        <input 
          autoFocus
          className="input" 
          placeholder="Type a command or search... (Cmd+K)" 
          value={query} 
          onChange={e => setQuery(e.target.value)}
          style={{ border: 'none', background: 'transparent', fontSize: 18, width: '100%' }}
        />
        <div className="divider" style={{ margin: '8px 0' }} />
        <div className="flex-col gap-sm" style={{ display: 'flex' }}>
          {actions.filter(a => a.name.toLowerCase().includes(query.toLowerCase())).map(a => (
            <div 
              key={a.name} 
              className="pill" 
              style={{ display: 'flex', justifyContent: 'space-between', cursor: 'pointer', borderRadius: 'var(--radius-md)' }}
              onClick={() => {
                if (a.cmd.startsWith('/')) router.push(a.cmd);
                onClose();
              }}
            >
              <span>{a.icon} {a.name}</span>
              <span className="small mono" style={{ opacity: 0.5 }}>{a.cmd}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [isCmdOpen, setIsCmdOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const savedUser = localStorage.getItem('loantwin_user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        console.error("Failed to parse user from localStorage");
      }
    }
    
    const savedTheme = localStorage.getItem('loantwin_theme') as any;
    if (savedTheme) setTheme(savedTheme);

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCmdOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('loantwin_theme', newTheme);
  };

  // Avoid hydration mismatch by only rendering the theme class and dynamic content after mounting
  return (
    <html lang="en" className={mounted && theme === 'light' ? 'theme-light' : ''}>
      <head>
        <title>LoanTwin OS</title>
        <meta name="description" content="Deal Operating System for Institutional Finance" />
      </head>
      <body>
        <div className="container">
          <header style={{ marginBottom: 8 }}>
            <div className="flex items-center gap-md">
              <div>
                <h1 className="h1">LoanTwin OS <span style={{ fontSize: 12, opacity: 0.5, verticalAlign: 'middle' }}>Enterprise</span></h1>
                <p className="subtitle">Institutional Deal Operating System</p>
              </div>
            </div>
          </header>
          
          <Suspense fallback={<div className="nav"><span className="pill">Loading...</span></div>}>
            <NavContent user={user} theme={theme} toggleTheme={toggleTheme} mounted={mounted} />
          </Suspense>
          
          <main>{children}</main>
          
          <footer style={{ marginTop: 40, paddingTop: 24, borderTop: '1px solid var(--border-subtle)' }}>
            <div className="flex justify-between items-center">
              <p className="small" style={{ opacity: 0.6 }}>LoanTwin OS — v2.5 Enterprise</p>
              <div className="flex gap-md">
                <span className="small mono">Press <kbd style={{ padding: '2px 4px', background: 'var(--bg-elevated)', borderRadius: 4 }}>Cmd+K</kbd> for Command Palette</span>
              </div>
            </div>
          </footer>
        </div>
        <CommandPalette isOpen={isCmdOpen} onClose={() => setIsCmdOpen(false)} />
        <ChatAssistant />
      </body>
    </html>
  );
}
