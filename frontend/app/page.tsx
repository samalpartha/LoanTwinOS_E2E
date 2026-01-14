'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Main page redirects to DLR - the unified workspace
export default function HomePage() {
  const router = useRouter();
  
  useEffect(() => {
    router.replace('/dlr');
  }, [router]);

  return (
    <div className="card" style={{ padding: 'var(--space-3xl)', textAlign: 'center' }}>
      <div className="spinner" style={{ width: 48, height: 48, margin: '0 auto' }} />
      <p className="mt-md opacity-70">Loading Digital Loan Record...</p>
    </div>
  );
}
