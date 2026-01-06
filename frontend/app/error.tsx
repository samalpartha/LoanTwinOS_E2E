'use client';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex-col items-center justify-center" style={{ display: 'flex', minHeight: '60vh', textAlign: 'center' }}>
      <div className="card" style={{ maxWidth: 500 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
        <h2 className="h1">Something went wrong</h2>
        <p className="small mt-sm mb-lg">
          An unexpected error occurred in the LoanTwin OS interface. 
          Our engineering team has been notified.
        </p>
        <div className="status error mb-md">
          <code className="small mono">{error.message || "Unknown Application Error"}</code>
        </div>
        <div className="flex gap-md justify-center">
          <button className="btn primary" onClick={() => reset()}>Try again</button>
          <a href="/" className="btn">Go to Workspace</a>
        </div>
      </div>
    </div>
  );
}

