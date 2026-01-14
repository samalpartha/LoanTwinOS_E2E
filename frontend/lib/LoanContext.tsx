'use client';
import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface LoanContextType {
  activeLoanId: number | null;
  setActiveLoanId: (id: number | null) => void;
  loanName: string | null;
  setLoanName: (name: string | null) => void;
}

const LoanContext = createContext<LoanContextType>({
  activeLoanId: null,
  setActiveLoanId: () => {},
  loanName: null,
  setLoanName: () => {},
});

export function LoanProvider({ children }: { children: ReactNode }) {
  const [activeLoanId, setActiveLoanIdState] = useState<number | null>(null);
  const [loanName, setLoanNameState] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Load from localStorage on mount
    const storedId = localStorage.getItem('activeLoanId');
    const storedName = localStorage.getItem('activeLoanName');
    if (storedId) setActiveLoanIdState(parseInt(storedId));
    if (storedName) setLoanNameState(storedName);
  }, []);

  const setActiveLoanId = (id: number | null) => {
    setActiveLoanIdState(id);
    if (id) {
      localStorage.setItem('activeLoanId', id.toString());
    } else {
      localStorage.removeItem('activeLoanId');
    }
  };

  const setLoanName = (name: string | null) => {
    setLoanNameState(name);
    if (name) {
      localStorage.setItem('activeLoanName', name);
    } else {
      localStorage.removeItem('activeLoanName');
    }
  };

  // Don't render until mounted to avoid hydration mismatch
  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <LoanContext.Provider value={{ activeLoanId, setActiveLoanId, loanName, setLoanName }}>
      {children}
    </LoanContext.Provider>
  );
}

export function useLoan() {
  return useContext(LoanContext);
}
