'use client';
import { useEffect, useState, Suspense } from "react";
import { getTradePack, getDLR, getCounterparties, getTransferInfo, getMarketplaceData, initiateTrade, requestWaiver, exportToJSON, getComplianceShield, getTradeReadinessExplained } from "../../lib/api";
import Link from "next/link";
import { useCurrency } from "../../lib/CurrencyContext";
import { useLoan } from "../../lib/LoanContext";
import { jsPDF } from "jspdf";

interface TradeCheck {
  id: number;
  category: string;
  item: string;
  risk_level: string;
  rationale: string;
}

interface TransferInfo {
  transfer_mode: string;
  consent_required: boolean;
  consent_label: string;
  standard_basis: string;
  transferability_mode: string | null;
  minimum_transfer_amount?: number;
}

interface PreClearedBuyer {
  id: string;
  name: string;
  type: string;
  credit_rating: string;
  pre_cleared: boolean;
  relationship: string;
  last_trade_date: string | null;
}

interface MarketplaceData {
  loan_id: number;
  loan_name: string;
  total_commitment: number;
  currency: string;
  available_for_sale: number;
  min_ticket_size: number;
  settlement_type: string;
  pre_cleared_buyers: PreClearedBuyer[];
  interested_buyers: any[];
  instant_liquidity_available: boolean;
  trade_readiness_score: number;
}

function TradePackContent() {
  const { activeLoanId } = useLoan();
  const loanId = activeLoanId || 1;
  const [items, setItems] = useState<TradeCheck[]>([]);
  const [borrowerName, setBorrowerName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showTechDetails, setShowTechDetails] = useState(false);
  const { formatAmount } = useCurrency();

  const [persona, setPersona] = useState<'Trader' | 'Legal' | 'Ops'>('Trader');
  const [view, setView] = useState<'checklist' | 'marketplace'>('checklist');

  // Live data state
  const [transferInfo, setTransferInfo] = useState<TransferInfo | null>(null);
  const [marketplace, setMarketplace] = useState<MarketplaceData | null>(null);
  const [dlrData, setDlrData] = useState<any>(null);

  // Trade execution state
  const [selectedBuyer, setSelectedBuyer] = useState<PreClearedBuyer | null>(null);
  const [tradeAmount, setTradeAmount] = useState<number>(0);
  const [tradePrice, setTradePrice] = useState<number>(99.5);
  const [tradeType, setTradeType] = useState<string>("assignment");
  const [settlementDate, setSettlementDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [executingTrade, setExecutingTrade] = useState(false);
  const [requestingWaiver, setRequestingWaiver] = useState<string | null>(null);
  const [activeTrade, setActiveTrade] = useState<any>(null);

  // Compliance Shield state
  const [complianceShield, setComplianceShield] = useState<any>(null);
  const [xaiExplanation, setXaiExplanation] = useState<any>(null);
  const [showXAI, setShowXAI] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [tradeData, dlr, transfer, mkt, shield, xai] = await Promise.all([
          getTradePack(loanId),
          getDLR(loanId),
          getTransferInfo(loanId),
          getMarketplaceData(loanId).catch(() => null),
          getComplianceShield(loanId).catch(() => null),
          getTradeReadinessExplained(loanId).catch(() => null)
        ]);
        setItems(tradeData);
        setDlrData(dlr);
        setBorrowerName(dlr.borrower_name);
        setTransferInfo(transfer);
        if (mkt) {
          setMarketplace(mkt);
          setTradeAmount(mkt.min_ticket_size);
        }
        setComplianceShield(shield);
        setXaiExplanation(xai);
      } catch (e: any) {
        setError(e.message || String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [loanId]);

  const getRiskConfig = (level: string) => {
    switch (level.toLowerCase()) {
      case 'low': return { color: 'success', label: 'Low Risk', icon: '✓', impact: 0 };
      case 'med':
      case 'medium': return { color: 'warning', label: 'Medium Risk', icon: '⚠', impact: 15 };
      case 'high': return { color: 'danger', label: 'High Risk', icon: '⛔', impact: 40 };
      default: return { color: '', label: level, icon: '•', impact: 0 };
    }
  };

  const calculateScore = () => {
    if (items.length === 0) return 100;
    let base = 100;
    items.forEach(item => { base -= getRiskConfig(item.risk_level).impact; });
    return Math.max(0, base);
  };

  const readinessScore = marketplace?.trade_readiness_score ?? calculateScore();
  const readinessLabel = readinessScore > 80 ? "Trade Ready" : readinessScore > 50 ? "Review Required" : "High Risk / Blocked";
  const lmaMatchScore = items.length === 0 ? 100 : Math.round(100 - (items.filter(i => i.risk_level.toLowerCase() !== 'low').length * 3));

  const [showDownloadMenu, setShowDownloadMenu] = useState(false);

  const handleDownloadPack = (format: 'json' | 'pdf') => {
    const pack = {
      loan_id: loanId,
      borrower: borrowerName,
      readiness_score: readinessScore,
      readiness_label: readinessLabel,
      transfer_info: transferInfo,
      marketplace: marketplace,
      checklist_items: items,
      lma_match_score: lmaMatchScore,
      generated_at: new Date().toISOString()
    };

    if (format === 'json') {
      exportToJSON(pack, `loantwin_trade_pack_${loanId}.json`);
      window.dispatchEvent(new CustomEvent('loantwin-toast', { detail: { message: "Trade Pack JSON downloaded", type: 'success' } }));
    } else if (format === 'pdf') {
      // Generate real PDF using jsPDF
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      let y = 20;

      // Header
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.text('LOANTWIN TRADE PACK', pageWidth / 2, y, { align: 'center' });
      y += 10;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, y, { align: 'center' });
      y += 15;

      // Deal Summary
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('DEAL SUMMARY', 15, y);
      y += 8;
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text(`Loan ID: ${loanId}`, 15, y); y += 6;
      doc.text(`Borrower: ${borrowerName}`, 15, y); y += 6;
      doc.text(`Trade Readiness Score: ${readinessScore}% (${readinessLabel})`, 15, y); y += 6;
      doc.text(`LMA Match Score: ${lmaMatchScore}%`, 15, y); y += 12;

      // Transfer Information
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('TRANSFER INFORMATION', 15, y);
      y += 8;
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text(`Transfer Mode: ${transferInfo?.transfer_mode || 'N/A'}`, 15, y); y += 6;
      doc.text(`Consent Required: ${transferInfo?.consent_required ? 'Yes - Borrower Required' : 'No'}`, 15, y); y += 6;
      doc.text(`Settlement: ${marketplace?.settlement_type || 'T+5'}`, 15, y); y += 6;
      doc.text(`Minimum Transfer: ${transferInfo?.minimum_transfer_amount ? `$${transferInfo.minimum_transfer_amount.toLocaleString()}` : 'N/A'}`, 15, y); y += 12;

      // Marketplace Status
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('MARKETPLACE STATUS', 15, y);
      y += 8;
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text(`Available for Sale: ${marketplace?.available_for_sale ? `$${marketplace.available_for_sale.toLocaleString()}` : 'N/A'}`, 15, y); y += 6;
      doc.text(`Pre-Cleared Buyers: ${marketplace?.pre_cleared_buyers?.length || 0}`, 15, y); y += 6;
      doc.text(`Instant Liquidity: ${marketplace?.instant_liquidity_available ? 'Available' : 'Not Available'}`, 15, y); y += 12;

      // Checklist Items
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(`CHECKLIST ITEMS (${items.length} total)`, 15, y);
      y += 8;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');

      items.forEach((item, i) => {
        if (y > 270) { doc.addPage(); y = 20; }
        doc.setFont('helvetica', 'bold');
        doc.text(`${i + 1}. [${item.risk_level.toUpperCase()}] ${item.category}`, 15, y);
        y += 5;
        doc.setFont('helvetica', 'normal');
        const itemLines = doc.splitTextToSize(item.item, pageWidth - 30);
        doc.text(itemLines, 20, y);
        y += itemLines.length * 5 + 3;
      });

      // Footer
      doc.setFontSize(9);
      doc.text('LoanTwin OS - Digital Loan Record Platform', pageWidth / 2, 285, { align: 'center' });

      doc.save(`loantwin_trade_pack_${loanId}.pdf`);
      window.dispatchEvent(new CustomEvent('loantwin-toast', {
        detail: { message: 'Trade Pack PDF downloaded', type: 'success' }
      }));
    }
    setShowDownloadMenu(false);
  };

  const handleInitiateTrade = async () => {
    if (!selectedBuyer || !tradeAmount) return;
    setExecutingTrade(true);
    try {
      const result = await initiateTrade(
        loanId,
        selectedBuyer.id,
        tradeAmount,
        tradePrice,
        tradeType,
        settlementDate
      );
      setActiveTrade(result);
      window.dispatchEvent(new CustomEvent('loantwin-toast', {
        detail: { message: `✓ Trade ${result.trade_id} initiated! ${formatAmount(result.proceeds, marketplace?.currency || 'USD')} proceeds`, type: 'success' }
      }));
      setSelectedBuyer(null);
    } catch (e: any) {
      window.dispatchEvent(new CustomEvent('loantwin-toast', { detail: { message: e.message, type: 'error' } }));
    } finally {
      setExecutingTrade(false);
    }
  };

  const handleRequestWaiver = async (buyer: any) => {
    setRequestingWaiver(buyer.id);
    try {
      const result = await requestWaiver(loanId, buyer.id, buyer.name);
      window.dispatchEvent(new CustomEvent('loantwin-toast', {
        detail: { message: `✓ Waiver requested for ${buyer.name}. Expected response: ${result.expected_response_days} days`, type: 'success' }
      }));
    } catch (e: any) {
      window.dispatchEvent(new CustomEvent('loantwin-toast', { detail: { message: e.message, type: 'error' } }));
    } finally {
      setRequestingWaiver(null);
    }
  };

  if (loading) return <div className="card"><div className="loading-overlay"><div className="spinner" /><span>Analyzing Secondary Trade Readiness...</span></div></div>;

  return (
    <div className="slide-up flex-col gap-lg">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-sm small" style={{ opacity: 0.7 }}>
        <Link href="/" className="hover-underline">Workspace</Link>
        <span>›</span>
        <Link href={`/dlr?loanId=${loanId}`} className="hover-underline">{borrowerName || `Loan #${loanId}`}</Link>
        <span>›</span>
        <span style={{ color: 'var(--accent-secondary)', fontWeight: 600 }}>Trade Pack</span>
      </div>

      {/* Hero with Marketplace Toggle */}
      <div className="grid" style={{ gridTemplateColumns: '1fr 0.4fr' }}>
        <div className="card">
          <div className="flex justify-between items-start mb-lg flex-mobile-wrap gap-md">
            <div>
              <div className="flex items-center gap-sm mb-sm">
                <h1 className="h1" style={{ margin: 0 }}>Secondary Trade Readiness</h1>
                {marketplace?.instant_liquidity_available && (
                  <span className="tag success" style={{ fontSize: 10 }}>⚡ INSTANT LIQUIDITY</span>
                )}
              </div>
              <p className="body opacity-70">LMA-Aligned Transfer Due Diligence & Liquidity Engine</p>
            </div>
            <div className="flex gap-sm flex-wrap">
              <div style={{ position: 'relative' }}>
                <button className="btn success" onClick={() => setShowDownloadMenu(!showDownloadMenu)}>
                  📥 Download Pack ▾
                </button>
                {showDownloadMenu && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    marginTop: 4,
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                    zIndex: 100,
                    minWidth: 150
                  }}>
                    <button
                      className="btn-text w-full text-left p-sm"
                      style={{ display: 'block', borderBottom: '1px solid var(--border-subtle)' }}
                      onClick={() => handleDownloadPack('pdf')}
                    >
                      📄 PDF Document
                    </button>
                    <button
                      className="btn-text w-full text-left p-sm"
                      style={{ display: 'block' }}
                      onClick={() => handleDownloadPack('json')}
                    >
                      🔧 JSON (for API)
                    </button>
                  </div>
                )}
              </div>
              <button className="btn" onClick={() => navigator.clipboard.writeText(window.location.href)}>🔗 Share</button>
            </div>
          </div>

          {/* View Toggle */}
          <div className="nav mb-lg" style={{ padding: 4, width: 'fit-content' }}>
            <button className={`pill ${view === 'checklist' ? 'active' : ''}`} onClick={() => setView('checklist')}>📋 Checklist</button>
            <button className={`pill ${view === 'marketplace' ? 'active' : ''}`} onClick={() => setView('marketplace')}>🏪 Marketplace</button>
          </div>

          <div className="dashboard-grid" style={{ marginBottom: 0 }}>
            <div className="card-inner flex-col gap-xs">
              <span className="small opacity-60">Transfer Mode</span>
              <span className="h3" style={{ color: 'var(--accent-secondary)' }}>{transferInfo?.transfer_mode || 'Assignment / Transfer'}</span>
            </div>
            <div className="card-inner flex-col gap-xs">
              <span className="small opacity-60">Consent Requirements</span>
              <span className="h3" style={{ color: transferInfo?.consent_required ? 'var(--accent-warning)' : 'var(--accent-success)' }}>
                {transferInfo?.consent_label || 'Loading...'}
              </span>
            </div>
            <div className="card-inner flex-col gap-xs">
              <span className="small opacity-60">Settlement</span>
              <span className="h3">{marketplace?.settlement_type?.split('/')[0] || 'T+5'}</span>
            </div>
          </div>
        </div>

        {/* Readiness Score */}
        <div className="card flex-col items-center justify-between py-lg" style={{ background: 'linear-gradient(135deg, var(--bg-card) 0%, var(--bg-secondary) 100%)', border: `1px solid ${readinessScore < 50 ? 'var(--accent-danger)' : 'var(--border-subtle)'}` }}>
          <div className="text-center">
            <span className="small mb-sm opacity-60 uppercase font-bold tracking-wider">Readiness Score</span>
            <div style={{ position: 'relative', width: 100, height: 100, margin: '16px auto' }}>
              <svg viewBox="0 0 36 36" style={{ transform: 'rotate(-90deg)', width: '100%', height: '100%' }}>
                <circle cx="18" cy="18" r="16" fill="none" stroke="var(--bg-elevated)" strokeWidth="3" />
                <circle cx="18" cy="18" r="16" fill="none" stroke={readinessScore > 80 ? 'var(--accent-success)' : readinessScore > 50 ? 'var(--accent-warning)' : 'var(--accent-danger)'} strokeWidth="3" strokeDasharray={`${readinessScore}, 100`} strokeLinecap="round" style={{ transition: 'all 1s ease-in-out' }} />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 800 }}>{readinessScore}</div>
            </div>
            <span className={`tag ${readinessScore > 80 ? 'success' : readinessScore > 50 ? 'warning' : 'danger'}`}>{readinessLabel}</span>
          </div>

          {readinessScore >= 80 && marketplace && complianceShield?.trade_enabled && (
            <button className="btn success w-full mt-lg" style={{ height: 40 }} onClick={() => setView('marketplace')}>
              🏪 Enter Marketplace
            </button>
          )}
          {complianceShield && !complianceShield.trade_enabled && (
            <div className="mt-lg p-sm" style={{ background: 'var(--accent-danger-dim)', borderRadius: 'var(--radius-sm)', textAlign: 'center' }}>
              <span className="small" style={{ color: 'var(--accent-danger)' }}>🔒 TRADE LOCKED</span>
            </div>
          )}
        </div>
      </div>

      {/* Compliance Shield */}
      {complianceShield && (
        <div className={`card`} style={{
          border: `2px solid ${complianceShield.shield_status === 'LOCKED' ? 'var(--accent-danger)' : complianceShield.shield_status === 'CAUTION' ? 'var(--accent-warning)' : 'var(--accent-success)'}`,
          background: complianceShield.shield_status === 'LOCKED' ? 'linear-gradient(135deg, var(--bg-card) 0%, rgba(231, 76, 60, 0.05) 100%)' : 'var(--bg-card)'
        }}>
          <div className="flex justify-between items-center mb-md flex-mobile-wrap gap-md">
            <div className="flex items-center gap-md">
              <div style={{
                width: 48, height: 48, borderRadius: '50%',
                background: complianceShield.shield_status === 'LOCKED' ? 'var(--accent-danger)' : complianceShield.shield_status === 'CAUTION' ? 'var(--accent-warning)' : 'var(--accent-success)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24
              }}>
                {complianceShield.shield_status === 'LOCKED' ? '🔒' : complianceShield.shield_status === 'CAUTION' ? '⚠️' : '✓'}
              </div>
              <div>
                <h2 className="h2" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                  Compliance Shield
                  <span className={`tag ${complianceShield.shield_status === 'LOCKED' ? 'danger' : complianceShield.shield_status === 'CAUTION' ? 'warning' : 'success'}`}>
                    {complianceShield.shield_status}
                  </span>
                </h2>
                <p className="small opacity-70">{complianceShield.shield_message}</p>
              </div>
            </div>
            <div className="flex gap-sm">
              <span className="tag" style={{ fontSize: 10 }}>Risk Score: {complianceShield.risk_score}/100</span>
              <span className="small mono opacity-50">Checked: {new Date(complianceShield.checked_at).toLocaleTimeString()}</span>
            </div>
          </div>

          {/* Blockers */}
          {complianceShield.blockers?.length > 0 && (
            <div className="mb-lg">
              <div className="small mb-sm font-bold" style={{ color: 'var(--accent-danger)' }}>⛔ TRADE BLOCKERS ({complianceShield.blockers.length})</div>
              {complianceShield.blockers.map((blocker: any, i: number) => (
                <div key={i} className="card-inner mb-sm" style={{ borderLeft: '4px solid var(--accent-danger)', background: 'var(--accent-danger-dim)' }}>
                  <div className="h3" style={{ fontSize: 14, color: 'var(--accent-danger)' }}>{blocker.title}</div>
                  <p className="small opacity-80">{blocker.description}</p>
                  <div className="flex justify-between items-center mt-sm">
                    <span className="small mono opacity-50">{blocker.source}</span>
                    <span className="small" style={{ color: 'var(--accent-danger)' }}>{blocker.action_required}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Warnings */}
          {complianceShield.warnings?.length > 0 && (
            <div className="mb-lg">
              <div className="small mb-sm font-bold" style={{ color: 'var(--accent-warning)' }}>⚠️ WARNINGS ({complianceShield.warnings.length})</div>
              {complianceShield.warnings.map((warning: any, i: number) => (
                <div key={i} className="card-inner mb-sm" style={{ borderLeft: '3px solid var(--accent-warning)' }}>
                  <div className="h3" style={{ fontSize: 14 }}>{warning.title}</div>
                  <p className="small opacity-80">{warning.description}</p>
                  <div className="flex justify-between items-center mt-sm">
                    <span className="small mono opacity-50">{warning.source}</span>
                    {warning.deadline && <span className="tag warning" style={{ fontSize: 9 }}>Due: {warning.deadline}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Data Sources */}
          <div className="flex gap-md flex-wrap">
            {complianceShield.data_sources?.map((source: any, i: number) => (
              <span key={i} className="tag" style={{ fontSize: 9, background: source.status === 'connected' ? 'var(--accent-success-dim)' : 'var(--bg-elevated)' }}>
                {source.status === 'connected' ? '🟢' : '⚪'} {source.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Explainable AI (XAI) Panel */}
      {xaiExplanation && (
        <div className="card">
          <div className="flex justify-between items-center mb-md">
            <div className="flex items-center gap-sm">
              <h2 className="h2" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 20 }}>🔍</span> Explainable AI: Trade Readiness
              </h2>
              <span className="tag primary">{xaiExplanation.grade}</span>
            </div>
            <button className="btn" onClick={() => setShowXAI(!showXAI)}>
              {showXAI ? 'Hide Details' : 'Why This Score?'}
            </button>
          </div>

          {showXAI && (
            <>
              <div className="flex-col gap-md mb-lg">
                {xaiExplanation.factors?.map((factor: any, i: number) => (
                  <div key={i} className="card-inner" style={{ borderLeft: `3px solid ${factor.score >= factor.max_score * 0.8 ? 'var(--accent-success)' : factor.score >= factor.max_score * 0.6 ? 'var(--accent-warning)' : 'var(--accent-danger)'}` }}>
                    <div className="flex justify-between items-start mb-sm">
                      <div>
                        <div className="small opacity-60">{factor.category}</div>
                        <div className="h3" style={{ fontSize: 14 }}>{factor.factor}</div>
                      </div>
                      <div className="text-right">
                        <div className="h3" style={{ fontSize: 16 }}>{factor.score}/{factor.max_score}</div>
                        <div className="small opacity-50">{factor.weight}</div>
                      </div>
                    </div>
                    <p className="small opacity-80">{factor.explanation}</p>
                    <div className="small mono opacity-50 mt-sm">📄 {factor.citation}</div>
                    {factor.evidence && <div className="small mt-xs" style={{ color: 'var(--accent-success)' }}>✓ {factor.evidence}</div>}
                    {factor.flag && <div className="small mt-xs" style={{ color: 'var(--accent-warning)' }}>⚠ {factor.flag}</div>}
                  </div>
                ))}
              </div>

              {/* Insights */}
              <div className="card-inner" style={{ background: 'var(--accent-primary-dim)' }}>
                <div className="small font-bold mb-sm">AI Insights</div>
                <ul style={{ margin: 0, paddingLeft: 20 }}>
                  {xaiExplanation.insights?.map((insight: any, i: number) => (
                    <li key={i} className="small mb-xs" style={{ color: insight.type === 'positive' ? 'var(--accent-success)' : insight.type === 'negative' ? 'var(--accent-danger)' : 'var(--text-primary)' }}>
                      {insight.insight}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="flex justify-between items-center mt-lg small opacity-50">
                <span>Model: {xaiExplanation.methodology?.model}</span>
                <span>Bias Check: {xaiExplanation.methodology?.bias_check}</span>
                <span>Cert ID: {xaiExplanation.certification?.certification_id}</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* Marketplace View */}
      {view === 'marketplace' && !marketplace && (
        <div className="card text-center py-2xl" style={{ border: '2px dashed var(--border-subtle)' }}>
          <span style={{ fontSize: 48, opacity: 0.3 }}>🏪</span>
          <h3 className="h3 mt-md mb-sm">Marketplace Not Available</h3>
          <p className="body opacity-60 mb-lg">Marketplace data is not loaded for this loan.</p>
          <button className="btn secondary" onClick={() => setView('checklist')}>
            ← Back to Checklist
          </button>
        </div>
      )}
      {view === 'marketplace' && marketplace && (
        <div className="card" style={{ border: '2px solid var(--accent-success)', background: 'linear-gradient(135deg, var(--bg-card) 0%, rgba(46, 204, 113, 0.02) 100%)' }}>
          <div className="flex justify-between items-center mb-lg">
            <div>
              <h2 className="h2" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 24 }}>🏪</span> Pre-Cleared Marketplace
              </h2>
              <p className="small opacity-60">Instant Settlement with White-listed Counterparties</p>
            </div>
            <div className="flex gap-md items-center">
              <div className="card-inner py-sm px-md">
                <span className="small opacity-60">Available</span>
                <span className="h3 ml-sm">{formatAmount(marketplace.available_for_sale, marketplace.currency)}</span>
              </div>
            </div>
          </div>

          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            {/* Pre-Cleared Buyers (Green Lane) */}
            <div>
              <div className="flex items-center gap-sm mb-md">
                <span className="tag success">🟢 GREEN LANE</span>
                <span className="small opacity-60">Pre-Cleared Buyers • T+0 Settlement</span>
              </div>
              <div className="flex-col gap-md">
                {marketplace.pre_cleared_buyers.map((buyer) => (
                  <div
                    key={buyer.id}
                    className={`card-inner hover-glow ${selectedBuyer?.id === buyer.id ? 'active' : ''}`}
                    style={{
                      borderLeft: '4px solid var(--accent-success)',
                      cursor: 'pointer',
                      background: selectedBuyer?.id === buyer.id ? 'var(--accent-success-dim)' : 'transparent'
                    }}
                    onClick={() => setSelectedBuyer(buyer)}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-sm">
                          <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 12 }}>
                            {buyer.name.charAt(0)}
                          </div>
                          <div>
                            <div className="h3" style={{ fontSize: 14 }}>{buyer.name}</div>
                            <div className="small opacity-60">{buyer.type} • {buyer.credit_rating}</div>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="tag success" style={{ fontSize: 9 }}>PRE-CLEARED</span>
                        <div className="small mt-xs opacity-50">{buyer.relationship}</div>
                      </div>
                    </div>
                    {buyer.last_trade_date && (
                      <div className="small mt-sm opacity-50" style={{ fontSize: 10 }}>Last trade: {buyer.last_trade_date}</div>
                    )}
                  </div>
                ))}
              </div>

              {/* Trade Execution Panel - Enhanced */}
              {selectedBuyer && !activeTrade && (
                <div className="card-inner mt-lg slide-up" style={{ background: 'var(--accent-success-dim)', border: '1px solid var(--accent-success)' }}>
                  <div className="flex justify-between items-center mb-md">
                    <div className="h3">Execute Trade with {selectedBuyer.name}</div>
                    <span className="tag success">⚡ T+0 Settlement</span>
                  </div>

                  <div className="grid gap-md mb-md" style={{ gridTemplateColumns: '1fr 1fr' }}>
                    <div>
                      <label className="small opacity-60 mb-xs block">Trade Amount ({marketplace.currency})</label>
                      <input
                        type="number"
                        className="input"
                        value={tradeAmount}
                        onChange={(e) => setTradeAmount(Number(e.target.value))}
                        min={marketplace.min_ticket_size}
                        max={marketplace.available_for_sale}
                      />
                      <div className="small mt-xs opacity-50">Min: {formatAmount(marketplace.min_ticket_size, marketplace.currency)}</div>
                    </div>
                    <div>
                      <label className="small opacity-60 mb-xs block">Price (% of Par)</label>
                      <input
                        type="number"
                        className="input"
                        value={tradePrice}
                        onChange={(e) => setTradePrice(Number(e.target.value))}
                        step={0.01}
                        min={90}
                        max={105}
                      />
                      <div className="small mt-xs opacity-50">Proceeds: {formatAmount(tradeAmount * (tradePrice / 100), marketplace.currency)}</div>
                    </div>
                    <div>
                      <label className="small opacity-60 mb-xs block">Trade Type</label>
                      <select className="input" value={tradeType} onChange={(e) => setTradeType(e.target.value)}>
                        <option value="assignment">Assignment</option>
                        <option value="participation">Participation</option>
                        <option value="novation">Novation</option>
                      </select>
                    </div>
                    <div>
                      <label className="small opacity-60 mb-xs block">Settlement Date</label>
                      <input
                        type="date"
                        className="input"
                        value={settlementDate}
                        onChange={(e) => setSettlementDate(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Trade Documents Checklist */}
                  <div className="mb-md p-md" style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)' }}>
                    <div className="small font-semibold mb-sm">📋 Required Documents</div>
                    <div className="grid grid-cols-2 gap-xs">
                      {[
                        { doc: 'Assignment Agreement', ready: true },
                        { doc: 'Transfer Certificate', ready: true },
                        { doc: 'KYC/AML Clearance', ready: true },
                        { doc: 'Settlement Instructions', ready: false }
                      ].map((item, i) => (
                        <div key={i} className="flex items-center gap-sm small">
                          <span style={{ color: item.ready ? 'var(--accent-success)' : 'var(--accent-warning)' }}>
                            {item.ready ? '✓' : '○'}
                          </span>
                          <span className={item.ready ? 'opacity-70' : ''}>{item.doc}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-sm">
                    <button
                      className="btn success flex-1"
                      style={{ height: 44 }}
                      onClick={handleInitiateTrade}
                      disabled={executingTrade || tradeAmount < marketplace.min_ticket_size}
                    >
                      {executingTrade ? (
                        <span className="flex items-center gap-sm"><span className="spinner" style={{ width: 16, height: 16 }} /> Processing...</span>
                      ) : (
                        '⚡ Execute Instant Trade'
                      )}
                    </button>
                    <button className="btn" style={{ height: 44 }} onClick={() => setSelectedBuyer(null)}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Active Trade Status */}
              {activeTrade && (
                <div className="card-inner mt-lg slide-up" style={{ background: 'linear-gradient(135deg, var(--bg-card) 0%, var(--accent-success-dim) 100%)', border: '2px solid var(--accent-success)' }}>
                  <div className="flex justify-between items-center mb-md">
                    <div>
                      <span className="small opacity-60">Active Trade</span>
                      <div className="h3 gradient-text-cyan">{activeTrade.trade_id}</div>
                    </div>
                    <span className="tag success">✓ {activeTrade.status?.replace('_', ' ').toUpperCase()}</span>
                  </div>

                  {/* Trade Summary */}
                  <div className="grid grid-cols-4 gap-md mb-md">
                    <div className="text-center p-sm" style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)' }}>
                      <div className="small opacity-60">Amount</div>
                      <div className="font-semibold">{formatAmount(activeTrade.amount, marketplace?.currency || 'USD')}</div>
                    </div>
                    <div className="text-center p-sm" style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)' }}>
                      <div className="small opacity-60">Price</div>
                      <div className="font-semibold">{activeTrade.price_percent}%</div>
                    </div>
                    <div className="text-center p-sm" style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)' }}>
                      <div className="small opacity-60">Proceeds</div>
                      <div className="font-semibold" style={{ color: 'var(--accent-success)' }}>{formatAmount(activeTrade.proceeds, marketplace?.currency || 'USD')}</div>
                    </div>
                    <div className="text-center p-sm" style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-sm)' }}>
                      <div className="small opacity-60">Settlement</div>
                      <div className="font-semibold">{activeTrade.settlement_type}</div>
                    </div>
                  </div>

                  {/* Workflow Progress */}
                  <div className="mb-md">
                    <div className="small font-semibold mb-sm">📊 Workflow Progress</div>
                    <div className="flex-col gap-xs">
                      {activeTrade.workflow?.map((step: any, i: number) => (
                        <div key={i} className="flex items-center gap-sm p-sm" style={{
                          background: step.status === 'completed' ? 'var(--accent-success-dim)' : 'var(--bg-primary)',
                          borderRadius: 'var(--radius-xs)',
                          borderLeft: `3px solid ${step.status === 'completed' ? 'var(--accent-success)' : step.status === 'in_progress' ? 'var(--accent-warning)' : 'var(--border-subtle)'}`
                        }}>
                          <span style={{
                            width: 20, height: 20, borderRadius: '50%',
                            background: step.status === 'completed' ? 'var(--accent-success)' : step.status === 'in_progress' ? 'var(--accent-warning)' : 'var(--bg-elevated)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 10, color: step.status === 'pending' ? 'var(--text-muted)' : 'white'
                          }}>
                            {step.status === 'completed' ? '✓' : step.status === 'in_progress' ? '•' : i + 1}
                          </span>
                          <span className="small flex-1">{step.step}</span>
                          {step.timestamp && <span className="small opacity-50">{new Date(step.timestamp).toLocaleTimeString()}</span>}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-sm">
                    <button className="btn flex-1" onClick={() => setActiveTrade(null)}>
                      New Trade
                    </button>
                    <button className="btn primary" onClick={() => window.dispatchEvent(new CustomEvent('loantwin-toast', { detail: { message: 'Trade document pack downloaded', type: 'success' } }))}>
                      📥 Download Docs
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Non-Cleared Buyers (Amber Lane) */}
            <div>
              <div className="flex items-center gap-sm mb-md">
                <span className="tag warning">🟡 AMBER LANE</span>
                <span className="small opacity-60">Interested Buyers • Waiver Required</span>
              </div>
              <div className="flex-col gap-md">
                {marketplace.interested_buyers.map((buyer: any) => (
                  <div key={buyer.id} className="card-inner" style={{ borderLeft: '4px solid var(--accent-warning)' }}>
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="h3" style={{ fontSize: 14 }}>{buyer.name}</div>
                        <div className="small opacity-60">{buyer.type}</div>
                      </div>
                      <div className="text-right">
                        <span className="tag warning" style={{ fontSize: 9 }}>WAIVER NEEDED</span>
                        <div className="small mt-xs">Interest: {buyer.interest_level}</div>
                      </div>
                    </div>
                    <div className="flex justify-between items-center mt-md">
                      <span className="small opacity-50">Status: {buyer.waiver_status}</span>
                      <button
                        className="btn primary"
                        style={{ fontSize: 11, padding: '4px 12px' }}
                        onClick={() => handleRequestWaiver(buyer)}
                        disabled={requestingWaiver === buyer.id}
                      >
                        {requestingWaiver === buyer.id ? '...' : 'Request Waiver'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Checklist View */}
      {view === 'checklist' && (
        <>
          {/* Persona Controls */}
          <div className="card flex justify-between items-center py-md flex-mobile-wrap gap-md">
            <div className="flex items-center gap-md flex-wrap">
              <span className="small font-bold">👤 Persona:</span>
              <div className="nav" style={{ margin: 0, padding: 4 }}>
                <button className={`pill ${persona === 'Trader' ? 'active' : ''}`} onClick={() => setPersona('Trader')}>💼 Trader</button>
                <button className={`pill ${persona === 'Legal' ? 'active' : ''}`} onClick={() => setPersona('Legal')}>⚖️ Legal</button>
                <button className={`pill ${persona === 'Ops' ? 'active' : ''}`} onClick={() => setPersona('Ops')}>⚙️ Ops</button>
              </div>
            </div>
            <span className="small opacity-50 italic">
              {persona === 'Trader' && "Viewing Liquidity, Yield & Transfer restrictions."}
              {persona === 'Legal' && "Viewing Clause-level deviations & Indemnities."}
              {persona === 'Ops' && "Viewing SSI, Notice & Operational mechanics."}
            </span>
          </div>

          {/* Checklist */}
          <div className="grid" style={{ gridTemplateColumns: '1.2fr 0.8fr' }}>
            <div className="card">
              <div className="flex justify-between items-center mb-lg">
                <h2 className="h2" style={{ margin: 0 }}>Operational Checklist</h2>
                <button className="btn" style={{ fontSize: 11 }} onClick={() => exportToJSON(items, `checklist_${loanId}.json`)}>
                  Generate Audit Log
                </button>
              </div>

              {(() => {
                // Filter items by persona
                const personaCategories: Record<string, string[]> = {
                  'Trader': ['Transfer', 'Consent', 'Commercial', 'Pricing', 'Liquidity', 'Assignment'],
                  'Legal': ['Legal', 'Clause', 'Indemnity', 'Warranty', 'Representation', 'Documentation'],
                  'Ops': ['Settlement', 'Notice', 'SSI', 'Operational', 'Admin', 'Notification']
                };
                const relevantCategories = personaCategories[persona] || [];
                const filteredItems = items.filter(item =>
                  relevantCategories.some(cat => item.category?.toLowerCase().includes(cat.toLowerCase())) ||
                  relevantCategories.length === 0
                );
                const displayItems = filteredItems.length > 0 ? filteredItems : items;

                return displayItems.length === 0 ? (
                  <div className="card-inner py-xl text-center">
                    <span style={{ fontSize: 40, opacity: 0.3 }}>📋</span>
                    <p className="small mt-md">No checklist items for {persona} persona.</p>
                  </div>
                ) : (
                  <div className="flex-col gap-md">
                    <div className="small opacity-50 mb-sm">
                      Showing {displayItems.length} of {items.length} items for {persona} view
                    </div>
                    {displayItems.map((check) => {
                      const config = getRiskConfig(check.risk_level);
                      return (
                        <div key={check.id} className="card-inner hover-glow" style={{ borderLeft: `4px solid var(--accent-${config.color})` }}>
                          <div className="flex justify-between items-start mb-sm">
                            <div>
                              <span className="small opacity-60 uppercase" style={{ fontSize: 10 }}>{check.category}</span>
                              <div className="h3">{check.item}</div>
                            </div>
                            <span className={`tag ${config.color}`}>{config.icon} {config.label}</span>
                          </div>
                          <div className="small p-md" style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-md)' }}>
                            <strong>Rationale:</strong> {check.rationale}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            <div className="flex-col gap-lg">
              {/* AI Confidence */}
              <section className="card" style={{ border: '1px solid var(--accent-secondary-dim)' }}>
                <div className="flex justify-between items-center mb-md">
                  <h2 className="h2" style={{ margin: 0 }}>Extraction Integrity</h2>
                  <button className="small mono text-secondary underline" onClick={() => setShowTechDetails(!showTechDetails)}>
                    {showTechDetails ? "Hide" : "Audit"}
                  </button>
                </div>
                <div className="mb-md">
                  <div className="flex justify-between items-center mb-sm">
                    <span className="small font-bold">LMA Template Match</span>
                    <span className={`tag ${lmaMatchScore > 90 ? 'success' : 'warning'}`}>{lmaMatchScore}%</span>
                  </div>
                  <div className="progress-bar" style={{ height: 8 }}><div className="fill" style={{ width: `${lmaMatchScore}%` }} /></div>
                </div>
                {showTechDetails && (
                  <div className="card-inner slide-up" style={{ background: 'var(--bg-primary)' }}>
                    <p className="small opacity-70 mb-sm">Cross-referencing against LMA_Assignment_v4.2</p>
                    <div className="small mono opacity-50" style={{ fontSize: 10 }}>
                      Engine: Llama-3-70B + Legal-BERT<br />
                      Items: {items.length}
                    </div>
                  </div>
                )}
              </section>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="card">Loading Trade Pack...</div>}>
      <TradePackContent />
    </Suspense>
  );
}
