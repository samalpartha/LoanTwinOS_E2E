'use client';
import { useState } from "react";
import { useRouter } from "next/navigation";
import { login, socialLogin, register } from "../../lib/api";

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
      const mockData = {
        X: { name: "Elon Musk", email: "elon@x.com" },
        Facebook: { name: "Mark Zuckerberg", email: "zuck@meta.com" },
        LinkedIn: { name: "Satya Nadella", email: "satya@microsoft.com" }
      }[provider] || { name: "Guest User", email: "guest@example.com" };

      const user = await socialLogin(mockData.name, mockData.email, provider);
      localStorage.setItem('loantwin_user', JSON.stringify(user));
      window.location.href = '/';
    } catch (e: any) {
      setError("Social login failed");
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
    <div className="flex-col items-center justify-center slide-up" style={{ display: 'flex', minHeight: '70vh' }}>
      <div className="card" style={{ width: 450 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🛡️</div>
          <h2 className="h1">{mode === 'login' ? 'Enterprise Login' : 'Create Account'}</h2>
          <p className="small mt-sm">Access your secure Deal Operating System</p>
        </div>

        {error && <div className="status error mb-md"><span>{error}</span></div>}

        <form onSubmit={handleCredentialAuth} className="flex-col gap-md" style={{ display: 'flex' }}>
          {mode === 'register' && (
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input className="input" placeholder="John Doe" value={fullName} onChange={e => setFullName(e.target.value)} required />
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Corporate Email</label>
            <input className="input" type="email" placeholder="name@company.com" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input className="input" type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          
          <button type="submit" className="btn primary w-full" disabled={loading}>
            {loading ? 'Processing...' : mode === 'login' ? 'Sign In' : 'Register'}
          </button>
        </form>

        <div className="flex justify-center mt-md">
          <button className="small" style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer' }} onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
            {mode === 'login' ? "Don't have an account? Register" : "Already have an account? Sign In"}
          </button>
        </div>

        <div className="divider" style={{ margin: '24px 0' }} />
        
        <div className="flex-col gap-sm" style={{ display: 'flex' }}>
          <button className="btn w-full" style={{ background: '#000', color: 'white', borderColor: '#333' }} onClick={() => handleSocialLogin('X')} disabled={loading}>
            Continue with X
          </button>
          <button className="btn w-full" style={{ background: '#1877F2', color: 'white', border: 'none' }} onClick={() => handleSocialLogin('Facebook')} disabled={loading}>
            Continue with Facebook
          </button>
          <button className="btn w-full" style={{ background: '#0077B5', color: 'white', border: 'none' }} onClick={() => handleSocialLogin('LinkedIn')} disabled={loading}>
            Continue with LinkedIn
          </button>
        </div>
        
        <p className="small mt-lg" style={{ textAlign: 'center', opacity: 0.6 }}>
          Institutional SSO available for enterprise clients.
        </p>
      </div>
    </div>
  );
}
