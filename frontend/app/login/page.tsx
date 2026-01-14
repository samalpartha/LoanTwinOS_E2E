'use client';
import { useState } from "react";
import { useRouter } from "next/navigation";
import { login, socialLogin, register } from "../../lib/api";
import Link from "next/link";
import Logo from "../components/Logo";

export default function LoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState("");

  const handleSocialLogin = async (provider: string) => {
    setLoading(true);
    setError("");
    try {
      const mockData: any = {
        GitHub: { name: "Linus Torvalds", email: "linus@github.com" },
        Google: { name: "Sundar Pichai", email: "sundar@google.com" },
        LinkedIn: { name: "Satya Nadella", email: "satya@microsoft.com" },
        Facebook: { name: "Mark Zuckerberg", email: "zuck@meta.com" },
        Microsoft: { name: "Bill Gates", email: "bill@microsoft.com" }
      }[provider] || { name: "Guest User", email: "guest@example.com" };

      const user = await socialLogin(mockData.name, mockData.email, provider);
      localStorage.setItem('loantwin_user', JSON.stringify(user));
      window.location.href = '/';
    } catch (e: any) {
      setError(`${provider} login failed`);
    } finally {
      setLoading(false);
    }
  };

  const handleCredentialAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      let user;
      if (mode === 'login') {
        user = await login(email, password);
      } else {
        user = await register(fullName, email, password);
      }
      localStorage.setItem('loantwin_user', JSON.stringify(user));
      window.location.href = '/';
    } catch (e: any) {
      setError(e.message || `${mode === 'login' ? 'Login' : 'Registration'} failed`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container slide-up">
      <div className="login-card-lg">
        {/* Branding Area */}
        <div style={{ position: 'absolute', top: 40, left: 40 }}>
          <Logo size={40} showText={true} />
        </div>

        {/* Close Button */}
        <button 
          onClick={() => router.push('/')}
          style={{ position: 'absolute', top: 20, right: 20, background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', opacity: 0.3, color: 'var(--text-primary)' }}
        >
          ✕
        </button>

        <div className="login-header" style={{ marginTop: 60 }}>
          <h1 className="h1" style={{ fontSize: 24, marginBottom: 4 }}>
            {mode === 'login' ? 'Log in' : 'Sign up'}
          </h1>
          <p className="small">
            {mode === 'login' ? 'need an account? ' : 'already have an account? '}
            <button 
              className="small" 
              style={{ background: 'none', border: 'none', color: 'var(--accent-secondary)', cursor: 'pointer', fontWeight: 600, padding: 0 }} 
              onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
            >
              {mode === 'login' ? 'request to join' : 'sign in here'}
            </button>
          </p>
        </div>

        <div className="login-body">
          {/* Left Side: Credentials */}
          <div className="login-form-side">
            <form onSubmit={handleCredentialAuth} className="flex-col gap-md">
              {mode === 'register' && (
                <div className="form-group">
                  <label className="small mb-xs" style={{ display: 'block', color: 'var(--text-secondary)' }}>Full Name</label>
                  <input 
                    className="input" 
                    placeholder="John Doe" 
                    value={fullName} 
                    onChange={e => setFullName(e.target.value)} 
                    required 
                  />
                </div>
              )}
              <div className="form-group">
                <label className="small mb-xs" style={{ display: 'block', color: 'var(--text-secondary)' }}>Email Address</label>
                <input 
                  className="input" 
                  type="email" 
                  placeholder="name@company.com" 
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                  required 
                />
              </div>
              <div className="form-group">
                <label className="small mb-xs" style={{ display: 'block', color: 'var(--text-secondary)' }}>Password</label>
                <input 
                  className="input" 
                  type="password" 
                  placeholder="••••••••" 
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  required 
                />
              </div>

              {error && <div className="small" style={{ color: 'var(--accent-danger)' }}>{error}</div>}

              <div className="flex items-center gap-md mt-sm">
                <button type="submit" className="login-btn-primary" disabled={loading}>
                  {loading ? '...' : mode === 'login' ? 'Log in' : 'Sign up'}
                </button>
                <button type="button" className="small" style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0 }}>
                  Forgot your password?
                </button>
              </div>
            </form>
          </div>

          {/* Divider */}
          <div className="login-divider-vertical">
            <span>OR</span>
          </div>

          {/* Right Side: Social */}
          <div className="login-form-side flex-col gap-sm">
            <button className="social-btn" onClick={() => handleSocialLogin('GitHub')} disabled={loading}>
              <img src="https://cdn-icons-png.flaticon.com/512/25/25231.png" alt="" style={{ filter: 'invert(var(--social-invert))' }} />
              <span>Log in with GitHub</span>
            </button>
            <button className="social-btn" onClick={() => handleSocialLogin('Google')} disabled={loading}>
              <img src="https://www.gstatic.com/images/branding/product/1x/gsa_512dp.png" alt="" />
              <span>Log in with Google</span>
            </button>
            <button className="social-btn" onClick={() => handleSocialLogin('LinkedIn')} disabled={loading}>
              <img src="https://cdn-icons-png.flaticon.com/512/174/174857.png" alt="" />
              <span>Log in with LinkedIn</span>
            </button>
            <button className="social-btn" onClick={() => handleSocialLogin('Facebook')} disabled={loading}>
              <img src="https://upload.wikimedia.org/wikipedia/commons/0/05/Facebook_Logo_%282019%29.png" alt="" />
              <span>Log in with Facebook</span>
            </button>
            <button className="social-btn" onClick={() => handleSocialLogin('Microsoft')} disabled={loading}>
              <img src="https://upload.wikimedia.org/wikipedia/commons/4/44/Microsoft_logo.svg" alt="" />
              <span>Log in with Microsoft</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
