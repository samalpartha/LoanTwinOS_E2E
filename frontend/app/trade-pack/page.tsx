'use client';
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { getTradePack } from "../../lib/api";

interface TradeCheck {
  id: number;
  category: string;
  item: string;
  risk_level: string;
  rationale: string;
}

function TradePackContent() {
  const searchParams = useSearchParams();
  const loanId = Number(searchParams.get('loanId') || 1);
  const [items, setItems] = useState<TradeCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const data = await getTradePack(loanId);
        setItems(data);
      } catch (e: any) {
        setError(e.message || String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [loanId]);

  const getRiskConfig = (level: string) => {
    switch (level.toLowerCase()) {
      case 'low':
        return { 
          color: 'success', 
          label: 'Low Risk',
          icon: '✓',
          description: 'Standard terms, minimal due diligence required'
        };
      case 'med':
      case 'medium':
        return { 
          color: 'warning', 
          label: 'Medium Risk',
          icon: '⚡',
          description: 'Requires attention, standard review process'
        };
      case 'high':
        return { 
          color: 'danger', 
          label: 'High Risk',
          icon: '⚠',
          description: 'Critical review required before proceeding'
        };
      default:
        return { 
          color: '', 
          label: level,
          icon: '•',
          description: ''
        };
    }
  };

  // Risk summary
  const riskSummary = items.reduce((acc, item) => {
    const level = item.risk_level.toLowerCase();
    acc[level] = (acc[level] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Overall risk score (simplified)
  const overallRisk = () => {
    if (riskSummary['high'] > 0) return { level: 'High', color: 'danger' };
    if (riskSummary['med'] > 1) return { level: 'Medium', color: 'warning' };
    return { level: 'Low', color: 'success' };
  };

  if (loading) {
    return (
      <div className="card">
        <div className="loading-overlay">
          <div className="spinner" />
          <span>Loading trade pack...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <div className="empty-state">
          <div className="empty-state-icon">⚠️</div>
          <div className="empty-state-title">Unable to Load Trade Pack</div>
          <p className="small">{error}</p>
          <a href="/" className="btn primary mt-lg">
            Go to Workspace
          </a>
        </div>
      </div>
    );
  }

  const overall = overallRisk();

  return (
    <div className="slide-up">
      {/* Header */}
      <div className="card mb-md">
        <div className="flex justify-between items-center">
          <div>
            <div className="h2">Secondary Trade Due Diligence Pack</div>
            <h2 className="h3 mt-sm">Buyer-Side Risk Assessment</h2>
          </div>
          {items.length > 0 && (
            <div style={{ textAlign: 'right' }}>
              <div className="small mb-sm">Overall Risk Assessment</div>
              <span className={`tag ${overall.color}`} style={{ fontSize: 16, padding: '10px 20px' }}>
                {overall.level}
              </span>
            </div>
          )}
        </div>

        <p className="small mt-md" style={{ maxWidth: 700 }}>
          Automated checklist generated from agreement analysis. Covers transferability, consent requirements, 
          sanctions restrictions, and voting thresholds for secondary market transactions.
        </p>

        {/* Risk Summary */}
        {items.length > 0 && (
          <div className="kpi mt-lg">
            <div className="box accent">
              <div className="label">Total Items</div>
              <div className="value">{items.length}</div>
            </div>
            <div className="box" style={{ borderColor: 'rgba(16, 185, 129, 0.3)' }}>
              <div className="label" style={{ color: 'var(--accent-success)' }}>Low Risk</div>
              <div className="value" style={{ color: 'var(--accent-success)' }}>{riskSummary['low'] || 0}</div>
            </div>
            <div className="box" style={{ borderColor: 'rgba(245, 158, 11, 0.3)' }}>
              <div className="label" style={{ color: 'var(--accent-warning)' }}>Medium Risk</div>
              <div className="value" style={{ color: 'var(--accent-warning)' }}>{riskSummary['med'] || 0}</div>
            </div>
            <div className="box" style={{ borderColor: 'rgba(239, 68, 68, 0.3)' }}>
              <div className="label" style={{ color: 'var(--accent-danger)' }}>High Risk</div>
              <div className="value" style={{ color: 'var(--accent-danger)' }}>{riskSummary['high'] || 0}</div>
            </div>
          </div>
        )}
      </div>

      {/* Checklist Items */}
      <div className="card">
        {items.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <div className="empty-state-title">No Trade Pack Generated</div>
            <p className="small">
              Upload and process a loan agreement to generate the due diligence checklist.
            </p>
          </div>
        ) : (
          <>
            <div className="h2 mb-md">Due Diligence Checklist</div>
            <div className="flex-col gap-md" style={{ display: 'flex' }}>
              {items.map((check, idx) => {
                const config = getRiskConfig(check.risk_level);
                return (
                  <div 
                    key={check.id}
                    className="card-inner slide-up"
                    style={{ 
                      animationDelay: `${idx * 50}ms`,
                      borderLeft: `4px solid var(--accent-${config.color})`
                    }}
                  >
                    <div className="flex justify-between items-center mb-md">
                      <div className="flex items-center gap-md">
                        <span style={{ 
                          fontSize: 24, 
                          width: 48, 
                          height: 48, 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          borderRadius: 'var(--radius-md)',
                          background: `var(--accent-${config.color}-dim)`
                        }}>
                          {config.icon}
                        </span>
                        <div>
                          <div className="small" style={{ color: 'var(--text-muted)' }}>{check.category}</div>
                          <div style={{ fontWeight: 600, fontSize: 15 }}>{check.item}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-sm">
                        <div className="risk-indicator">
                          <span className={`risk-dot ${check.risk_level.toLowerCase()}`} />
                          <span className={`tag ${config.color}`}>
                            {config.label}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="small" style={{ 
                      padding: '12px 16px', 
                      background: 'var(--bg-primary)', 
                      borderRadius: 'var(--radius-sm)',
                      marginLeft: 60
                    }}>
                      <strong style={{ color: 'var(--text-muted)' }}>Rationale:</strong> {check.rationale}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Action Summary */}
      {items.length > 0 && (
        <div className="card mt-md">
          <div className="h2 mb-md">Recommended Actions</div>
          <div className="grid-auto">
            <div className="card-inner">
              <div className="flex items-center gap-sm mb-sm">
                <span className="tag success">✓</span>
                <span style={{ fontWeight: 600 }}>Low Risk Items</span>
              </div>
              <p className="small">Standard review process. Document findings and proceed with normal workflow.</p>
            </div>
            <div className="card-inner">
              <div className="flex items-center gap-sm mb-sm">
                <span className="tag warning">⚡</span>
                <span style={{ fontWeight: 600 }}>Medium Risk Items</span>
              </div>
              <p className="small">Requires legal review. Confirm mechanics with counsel before transaction close.</p>
            </div>
            <div className="card-inner">
              <div className="flex items-center gap-sm mb-sm">
                <span className="tag danger">⚠</span>
                <span style={{ fontWeight: 600 }}>High Risk Items</span>
              </div>
              <p className="small">Escalate immediately. Obtain written confirmation and consider deal-specific waivers.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={
      <div className="card">
        <div className="loading-overlay">
          <div className="spinner" />
          <span>Loading...</span>
        </div>
      </div>
    }>
      <TradePackContent />
    </Suspense>
  );
}
