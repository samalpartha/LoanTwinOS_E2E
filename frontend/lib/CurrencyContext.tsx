'use client';
import React, { createContext, useContext, useState, useEffect } from 'react';

type Currency = 'USD' | 'EUR' | 'GBP' | 'JPY';

interface CurrencyContextType {
  baseCurrency: Currency;
  setBaseCurrency: (c: Currency) => void;
  formatAmount: (amount: number | string, originalCurrency?: string) => string;
  exchangeRates: Record<Currency, number>;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export const CurrencyProvider = ({ children }: { children: React.ReactNode }) => {
  const [baseCurrency, setBaseCurrency] = useState<Currency>('USD');

  // Mock exchange rates (Base: USD)
  const exchangeRates: Record<Currency, number> = {
    USD: 1,
    EUR: 0.91,
    GBP: 0.79,
    JPY: 145.0
  };

  const formatAmount = (amount: number | string, originalCurrency: string = 'USD') => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount.replace(/[^0-9.-]+/g, "")) : amount;
    if (isNaN(numAmount)) return String(amount);

    // Normalize to USD first, then to baseCurrency
    const inUSD = numAmount / (exchangeRates[originalCurrency as Currency] || 1);
    const converted = inUSD * exchangeRates[baseCurrency];

    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: baseCurrency,
      maximumFractionDigits: 0
    }).format(converted);
  };

  useEffect(() => {
    const saved = localStorage.getItem('loantwin_base_currency') as Currency;
    if (saved) setBaseCurrency(saved);
  }, []);

  const updateBaseCurrency = (c: Currency) => {
    setBaseCurrency(c);
    localStorage.setItem('loantwin_base_currency', c);
  };

  return (
    <CurrencyContext.Provider value={{ baseCurrency, setBaseCurrency: updateBaseCurrency, formatAmount, exchangeRates }}>
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = () => {
  const context = useContext(CurrencyContext);
  if (!context) throw new Error('useCurrency must be used within a CurrencyProvider');
  return context;
};
