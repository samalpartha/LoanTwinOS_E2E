'use client';
import { useState, useEffect, useId } from 'react';
import { useLoan } from '../../lib/LoanContext';
import { getDistanceToDefault } from '../../lib/api';
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Shield, 
  AlertTriangle,
  CheckCircle,
  BarChart3,
  Building2,
  DollarSign,
  Info
} from 'lucide-react';

interface DTDData {
  ticker: string;
  company_name: string;
  stock_price: number;
  stock_price_change_pct: number;
  market_cap: number;
  total_debt: number;
  equity_cushion_pct: number;
  distance_to_default: number;
  implied_default_probability: number;
  rating_implied: string;
  signal: 'safe' | 'watch' | 'warning' | 'critical';
  last_updated: string;
}

// Animated Gauge Component
const AnimatedGauge = ({ 
  value, 
  max = 100, 
  color,
  size = 100
}: { 
  value: number; 
  max?: number; 
  color: string;
  size?: number;
}) => {
  const uniqueId = useId();
  const circumference = 2 * Math.PI * 45; // r = 45
  const percentage = Math.min(value / max, 1);
  const offset = circumference - (percentage * circumference);

  return (
    <div className="gauge-container" style={{ width: size, height: size, position: 'relative' }}>
      <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
        <defs>
          <linearGradient id={`gauge-gradient-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={color} />
            <stop offset="100%" stopColor={color} stopOpacity={0.6} />
          </linearGradient>
        </defs>
        {/* Background ring */}
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke="var(--bg-elevated)"
          strokeWidth="8"
        />
        {/* Animated fill ring */}
        <circle
          cx="50"
          cy="50"
          r="45"
          fill="none"
          stroke={`url(#gauge-gradient-${uniqueId})`}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference}
          style={{
            transition: 'stroke-dashoffset 1.5s ease-out',
            animation: 'none',
            strokeDashoffset: offset,
            filter: `drop-shadow(0 0 8px ${color})`
          }}
        />
      </svg>
      {/* Center value */}
      <div style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <span style={{ 
          fontFamily: 'var(--font-heading)', 
          fontSize: size * 0.22, 
          fontWeight: 700,
          color
        }}>
          {value.toFixed(1)}
        </span>
      </div>
    </div>
  );
};

export default function DistanceToDefaultHero() {
  const { activeLoanId } = useLoan();
  const [data, setData] = useState<DTDData | null>(null);
  const [loading, setLoading] = useState(false);
  const [showInfo, setShowInfo] = useState(false);

  useEffect(() => {
    if (activeLoanId) {
      setLoading(true);
      getDistanceToDefault(activeLoanId)
        .then(setData)
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [activeLoanId]);

  if (!activeLoanId) {
    return (
      <section className="card empty-state" style={{ padding: 'var(--space-2xl)' }}>
        <Activity size={48} style={{ opacity: 0.2, marginBottom: 'var(--space-md)' }} />
        <h3 className="h3 opacity-50">Borrower Risk Analysis</h3>
        <p className="small opacity-40">Load a deal to view Distance-to-Default metrics</p>
      </section>
    );
  }

  if (loading) {
    return (
      <section className="card" style={{ textAlign: 'center', padding: 'var(--space-2xl)' }}>
        <span className="spinner" style={{ width: 32, height: 32 }} />
        <p className="small opacity-50 mt-md">Calculating risk metrics...</p>
      </section>
    );
  }

  if (!data) return null;

  const getSignalConfig = (signal: string) => {
    switch (signal) {
      case 'safe': return { 
        color: 'var(--accent-success)', 
        icon: CheckCircle, 
        label: 'LOW RISK',
        bg: 'var(--accent-success-dim)'
      };
      case 'watch': return { 
        color: 'var(--accent-warning)', 
        icon: Activity, 
        label: 'WATCH',
        bg: 'var(--accent-warning-dim)'
      };
      case 'warning': return { 
        color: 'var(--accent-warning)', 
        icon: AlertTriangle, 
        label: 'ELEVATED',
        bg: 'var(--accent-warning-dim)'
      };
      case 'critical': return { 
        color: 'var(--accent-danger)', 
        icon: AlertTriangle, 
        label: 'HIGH RISK',
        bg: 'var(--accent-danger-dim)'
      };
      default: return { 
        color: 'var(--text-muted)', 
        icon: Activity, 
        label: 'UNKNOWN',
        bg: 'var(--bg-elevated)'
      };
    }
  };

  const config = getSignalConfig(data.signal);
  const SignalIcon = config.icon;

  return (
    <section className="hero-widget slide-up" style={{ borderLeft: `4px solid ${config.color}` }}>
      {/* Header */}
      <div className="flex justify-between items-start mb-lg flex-mobile-wrap gap-md">
        <div className="flex items-start gap-md">
          <div style={{
            width: 48,
            height: 48,
            borderRadius: 'var(--radius-md)',
            background: config.bg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 0 20px ${config.color}30`
          }}>
            <Activity size={24} style={{ color: config.color }} />
          </div>
          <div>
            <div className="flex items-center gap-sm mb-xs">
              <h2 className="h2" style={{ margin: 0 }}>Distance-to-Default</h2>
              <button 
                className="btn-icon" 
                onClick={() => setShowInfo(!showInfo)}
                style={{ width: 24, height: 24, border: 'none' }}
              >
                <Info size={14} style={{ opacity: 0.5 }} />
              </button>
            </div>
            <div className="flex items-center gap-md">
              <span className="small opacity-70">{data.company_name} ({data.ticker})</span>
              <span className={`tag`} style={{ 
                background: config.bg, 
                color: config.color, 
                border: 'none',
                fontSize: 10
              }}>
                <SignalIcon size={10} style={{ marginRight: 4 }} />
                {config.label}
              </span>
            </div>
          </div>
        </div>
        
        {/* Stock Price */}
        <div className="text-right">
          <div className="flex items-center gap-xs justify-end">
            <span className="h2" style={{ margin: 0 }}>${data.stock_price.toFixed(2)}</span>
            <span className={`tag ${data.stock_price_change_pct >= 0 ? 'success' : 'danger'}`} style={{ fontSize: 10 }}>
              {data.stock_price_change_pct >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
              {Math.abs(data.stock_price_change_pct).toFixed(1)}%
            </span>
          </div>
          <span className="small opacity-50">{new Date(data.last_updated).toLocaleTimeString()}</span>
        </div>
      </div>

      {/* Info Panel */}
      {showInfo && (
        <div className="card-inner mb-lg slide-down" style={{ borderLeft: `3px solid ${config.color}` }}>
          <p className="small opacity-80">
            The <strong>Merton Model Distance-to-Default</strong> measures a company's default risk based on its equity value, volatility, and debt. 
            A higher σ (sigma) value indicates lower default probability. This is a forward-looking, market-based credit signal.
          </p>
        </div>
      )}

      {/* Metrics Grid */}
      <div className="grid-auto" style={{ gridTemplateColumns: 'repeat(5, 1fr)', gap: 16 }}>
        {/* Distance to Default - Primary with Gauge */}
        <div className="card-inner flex-col items-center justify-center" style={{ 
          padding: 'var(--space-md)',
          borderColor: config.color
        }}>
          <AnimatedGauge 
            value={data.distance_to_default} 
            max={20} 
            color={config.color}
            size={80}
          />
          <span className="small opacity-60 mt-sm">DTD (σ)</span>
          <span className="small" style={{ color: config.color, fontWeight: 600 }}>
            {data.distance_to_default > 4 ? 'Very Safe' : data.distance_to_default > 2 ? 'Safe' : 'Monitor'}
          </span>
        </div>

        {/* Equity Cushion with Gauge */}
        <div className="card-inner flex-col items-center justify-center" style={{ padding: 'var(--space-md)' }}>
          <AnimatedGauge 
            value={data.equity_cushion_pct} 
            max={100} 
            color="var(--accent-secondary)"
            size={80}
          />
          <span className="small opacity-60 mt-sm">Equity Cushion</span>
          <span className="small opacity-70">{data.equity_cushion_pct}%</span>
        </div>

        {/* Default Probability */}
        <div className="card-inner flex-col gap-xs justify-center text-center" style={{ padding: 'var(--space-md)' }}>
          <BarChart3 size={20} style={{ margin: '0 auto', color: 'var(--accent-secondary)', opacity: 0.6 }} />
          <span className="h2 gradient-text-cyan" style={{ margin: '4px 0', fontSize: 24 }}>
            {data.implied_default_probability.toFixed(2)}%
          </span>
          <span className="small opacity-60">Default Probability</span>
          <span className="small opacity-50">1-Year Implied</span>
        </div>

        {/* Implied Rating */}
        <div className="card-inner flex-col gap-xs justify-center text-center" style={{ padding: 'var(--space-md)' }}>
          <Shield size={20} style={{ margin: '0 auto', color: 'var(--accent-secondary)', opacity: 0.6 }} />
          <span className="h2 gradient-text-cyan" style={{ margin: '4px 0', fontSize: 24 }}>
            {data.rating_implied}
          </span>
          <span className="small opacity-60">Implied Rating</span>
          <span className="small opacity-50">Market-Derived</span>
        </div>

        {/* Market Cap */}
        <div className="card-inner flex-col gap-xs justify-center text-center" style={{ padding: 'var(--space-md)' }}>
          <Building2 size={20} style={{ margin: '0 auto', color: 'var(--accent-secondary)', opacity: 0.6 }} />
          <span className="h2 gradient-text-cyan" style={{ margin: '4px 0', fontSize: 24 }}>
            ${(data.market_cap / 1e9).toFixed(1)}B
          </span>
          <span className="small opacity-60">Market Cap</span>
          <span className="small opacity-50">Enterprise Value</span>
        </div>
      </div>

      {/* Debt Info Footer */}
      <div className="flex justify-between items-center mt-lg pt-md" style={{ borderTop: '1px solid var(--border-subtle)' }}>
        <div className="flex items-center gap-sm">
          <DollarSign size={14} style={{ opacity: 0.5 }} />
          <span className="small opacity-60">
            Total Debt: <strong>${(data.total_debt / 1e6).toFixed(0)}M</strong>
          </span>
        </div>
        <span className="small mono opacity-40">
          Merton Model • Live Equity Data
        </span>
      </div>
    </section>
  );
}
