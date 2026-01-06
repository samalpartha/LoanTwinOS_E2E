'use client';
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

export default function ProfilePage() {
  const [user, setUser] = useState<any>(null);
  const router = useRouter();

  useEffect(() => {
    const savedUser = localStorage.getItem('loantwin_user');
    if (!savedUser) router.push('/login');
    else setUser(JSON.parse(savedUser));
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('loantwin_user');
    window.location.href = '/login';
  };

  if (!user) return <div className="card">Loading...</div>;

  return (
    <div className="grid slide-up">
      <div className="card">
        <div className="h2">User Profile</div>
        <div className="flex items-center gap-lg mt-lg">
          <img src={user.picture_url} style={{ width: 100, height: 100, borderRadius: 'var(--radius-xl)', border: '2px solid var(--border-accent)' }} />
          <div>
            <h2 className="h1">{user.full_name}</h2>
            <div className="tag primary">{user.role}</div>
            <p className="small mt-sm">{user.email}</p>
          </div>
        </div>
        
        <div className="divider" />
        
        <div className="form-group mb-md">
          <label className="form-label">Full Name</label>
          <input className="input" defaultValue={user.full_name} />
        </div>
        <div className="form-group mb-md">
          <label className="form-label">Job Role</label>
          <input className="input" defaultValue={user.role} />
        </div>
        
        <div className="flex gap-md mt-lg">
          <button className="btn primary">Update Details</button>
          <button className="btn danger" onClick={handleLogout}>Logout</button>
        </div>
      </div>
      
      <div className="flex-col gap-md" style={{ display: 'flex' }}>
        <div className="card">
          <div className="h2">Enterprise Security</div>
          <div className="flex justify-between items-center mt-md">
            <span className="small">Provider</span>
            <span className="tag">{user.social_provider}</span>
          </div>
          <div className="flex justify-between items-center mt-md">
            <span className="small">2FA Status</span>
            <span className="tag success">Active</span>
          </div>
        </div>
        
        <div className="card">
          <div className="h2">Activity Summary</div>
          <div className="kpi mt-md">
            <div className="box">
              <div className="label">Loans Created</div>
              <div className="value">12</div>
            </div>
            <div className="box">
              <div className="label">Verifications</div>
              <div className="value">482</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


