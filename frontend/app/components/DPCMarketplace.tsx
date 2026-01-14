'use client';
import { useState, useEffect } from 'react';
import { useLoan } from '../../lib/LoanContext';
import { useCurrency } from '../../lib/CurrencyContext';

interface DPCTile {
  id: string;
  tranche: string;
  amount: number;
  status: 'available' | 'owned' | 'pending' | 'locked';
  yieldBps: number;
  maturity: string;
  riskScore: number;
  holder?: string;
}

interface QRApprovalState {
  isOpen: boolean;
  action: 'buy' | 'sell' | null;
  tile: DPCTile | null;
  timeRemaining: number;
}

export default function DPCMarketplace() {
  const { activeLoanId, loanName } = useLoan();
  const { formatAmount } = useCurrency();
  
  const [tiles, setTiles] = useState<DPCTile[]>([
    { id: 'dpc-001', tranche: 'TL-A', amount: 5000000, status: 'available', yieldBps: 275, maturity: '2028-03', riskScore: 82 },
    { id: 'dpc-002', tranche: 'TL-A', amount: 5000000, status: 'owned', yieldBps: 275, maturity: '2028-03', riskScore: 82, holder: 'You' },
    { id: 'dpc-003', tranche: 'TL-A', amount: 5000000, status: 'available', yieldBps: 275, maturity: '2028-03', riskScore: 82 },
    { id: 'dpc-004', tranche: 'TL-B', amount: 10000000, status: 'owned', yieldBps: 350, maturity: '2029-03', riskScore: 74, holder: 'You' },
    { id: 'dpc-005', tranche: 'TL-B', amount: 10000000, status: 'available', yieldBps: 350, maturity: '2029-03', riskScore: 74 },
    { id: 'dpc-006', tranche: 'TL-B', amount: 10000000, status: 'pending', yieldBps: 350, maturity: '2029-03', riskScore: 74 },
    { id: 'dpc-007', tranche: 'RCF', amount: 2500000, status: 'available', yieldBps: 225, maturity: '2026-09', riskScore: 88 },
    { id: 'dpc-008', tranche: 'RCF', amount: 2500000, status: 'locked', yieldBps: 225, maturity: '2026-09', riskScore: 88 },
  ]);

  const [qrApproval, setQrApproval] = useState<QRApprovalState>({
    isOpen: false,
    action: null,
    tile: null,
    timeRemaining: 60
  });

  const [selectedTile, setSelectedTile] = useState<DPCTile | null>(null);

  useEffect(() => {
    if (qrApproval.isOpen && qrApproval.timeRemaining > 0) {
      const timer = setInterval(() => {
        setQrApproval(prev => ({
          ...prev,
          timeRemaining: prev.timeRemaining - 1
        }));
      }, 1000);
      return () => clearInterval(timer);
    } else if (qrApproval.timeRemaining === 0) {
      setQrApproval({ isOpen: false, action: null, tile: null, timeRemaining: 60 });
    }
  }, [qrApproval.isOpen, qrApproval.timeRemaining]);

  const handleTileClick = (tile: DPCTile) => {
    if (tile.status === 'locked') return;
    setSelectedTile(tile);
  };

  const handleBuy = () => {
    if (!selectedTile) return;
    setQrApproval({
      isOpen: true,
      action: 'buy',
      tile: selectedTile,
      timeRemaining: 60
    });
  };

  const handleSell = () => {
    if (!selectedTile || selectedTile.status !== 'owned') return;
    setQrApproval({
      isOpen: true,
      action: 'sell',
      tile: selectedTile,
      timeRemaining: 60
    });
  };

  const handleConfirmQR = () => {
    // Simulate successful transaction
    if (qrApproval.action === 'buy' && qrApproval.tile) {
      setTiles(prev => prev.map(t => 
        t.id === qrApproval.tile?.id 
          ? { ...t, status: 'owned' as const, holder: 'You' } 
          : t
      ));
    } else if (qrApproval.action === 'sell' && qrApproval.tile) {
      setTiles(prev => prev.map(t => 
        t.id === qrApproval.tile?.id 
          ? { ...t, status: 'available' as const, holder: undefined } 
          : t
      ));
    }
    setQrApproval({ isOpen: false, action: null, tile: null, timeRemaining: 60 });
    setSelectedTile(null);
  };

  const getStatusColor = (status: DPCTile['status']) => {
    switch (status) {
      case 'available': return 'var(--neon-green)';
      case 'owned': return 'var(--neon-cyan)';
      case 'pending': return 'var(--accent-warning)';
      case 'locked': return 'var(--text-muted)';
    }
  };

  const getStatusLabel = (status: DPCTile['status']) => {
    switch (status) {
      case 'available': return 'Available';
      case 'owned': return 'Your Position';
      case 'pending': return 'Pending Settlement';
      case 'locked': return 'Locked';
    }
  };

  const ownedValue = tiles
    .filter(t => t.status === 'owned')
    .reduce((sum, t) => sum + t.amount, 0);

  const availableValue = tiles
    .filter(t => t.status === 'available')
    .reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="flex-col gap-lg">
      {/* Syndication Progress */}
      <div className="card-inner">
        <div className="flex justify-between items-center mb-sm">
          <span className="small opacity-70">Deal Syndication</span>
          <span className="small" style={{ color: 'var(--neon-green)' }}>
            {Math.round((1 - availableValue / (ownedValue + availableValue + 10000000)) * 100)}% Syndicated
          </span>
        </div>
        <div className="syndication-bar">
          <div 
            className="syndication-fill" 
            style={{ width: `${Math.round((1 - availableValue / (ownedValue + availableValue + 10000000)) * 100)}%` }} 
          />
        </div>
        <div className="flex justify-between mt-sm" style={{ fontSize: 11 }}>
          <span style={{ color: 'var(--neon-cyan)' }}>Your Holdings: {formatAmount(ownedValue)}</span>
          <span className="opacity-60">Available: {formatAmount(availableValue)}</span>
        </div>
      </div>

      {/* DPC Grid */}
      <div>
        <h3 className="h3 mb-md" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>💎</span> Digital Participation Certificates
          <span className="tag" style={{ marginLeft: 'auto', fontSize: 9, background: 'var(--neon-purple-dim)', color: 'var(--neon-purple)' }}>
            ERC-1400 TOKENS
          </span>
        </h3>
        
        <div className="dpc-grid">
          {tiles.map(tile => (
            <div
              key={tile.id}
              className={`dpc-tile ${tile.status}`}
              onClick={() => handleTileClick(tile)}
              style={{
                opacity: tile.status === 'locked' ? 0.5 : 1,
                cursor: tile.status === 'locked' ? 'not-allowed' : 'pointer',
                borderColor: selectedTile?.id === tile.id ? 'var(--neon-green)' : undefined,
                boxShadow: selectedTile?.id === tile.id ? '0 0 20px var(--neon-green-dim)' : undefined
              }}
            >
              {/* Tranche Badge */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <span style={{
                  background: 'var(--glass-bg)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: 6,
                  padding: '2px 8px',
                  fontSize: 10,
                  fontWeight: 600
                }}>
                  {tile.tranche}
                </span>
                {tile.status === 'owned' && (
                  <span style={{ fontSize: 18 }}>✓</span>
                )}
              </div>

              {/* Amount */}
              <div>
                <div className="dpc-amount">{formatAmount(tile.amount).replace(/\.\d+/, '')}</div>
                <div className="dpc-label">Face Value</div>
              </div>

              {/* Yield & Risk */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                <span style={{ color: 'var(--neon-green)' }}>+{tile.yieldBps}bps</span>
                <span style={{ opacity: 0.7 }}>Risk: {tile.riskScore}%</span>
              </div>

              {/* Status Bar */}
              <div style={{
                height: 4,
                borderRadius: 2,
                background: getStatusColor(tile.status),
                marginTop: 8
              }} />
            </div>
          ))}
        </div>
      </div>

      {/* Selected Tile Actions */}
      {selectedTile && (
        <div className="card-inner" style={{ 
          border: '1px solid var(--neon-green)',
          background: 'var(--neon-green-dim)'
        }}>
          <div className="flex justify-between items-center">
            <div>
              <h4 style={{ margin: 0, fontSize: 14 }}>
                {selectedTile.tranche} — {formatAmount(selectedTile.amount)}
              </h4>
              <p className="small opacity-70">
                {getStatusLabel(selectedTile.status)} • Maturity: {selectedTile.maturity}
              </p>
            </div>
            <div className="flex gap-sm">
              {selectedTile.status === 'available' && (
                <button className="btn primary" onClick={handleBuy} style={{
                  background: 'linear-gradient(135deg, var(--neon-green), var(--neon-cyan))',
                  color: '#0A0E17',
                  border: 'none'
                }}>
                  💎 Buy Certificate
                </button>
              )}
              {selectedTile.status === 'owned' && (
                <button className="btn" onClick={handleSell} style={{
                  background: 'transparent',
                  border: '1px solid var(--accent-warning)',
                  color: 'var(--accent-warning)'
                }}>
                  Sell Position
                </button>
              )}
              <button className="btn secondary" onClick={() => setSelectedTile(null)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Approval Modal */}
      {qrApproval.isOpen && qrApproval.tile && (
        <div className="qr-overlay">
          <div className="qr-modal">
            <h2 style={{ color: 'white', marginBottom: 8 }}>
              {qrApproval.action === 'buy' ? '🔐 Confirm Purchase' : '🔐 Confirm Sale'}
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
              Scan with your mobile authenticator to sign the transaction
            </p>
            
            <div className="qr-code">
              {/* Simulated QR Code */}
              <svg viewBox="0 0 100 100" style={{ width: '80%', height: '80%' }}>
                <rect fill="#000" x="10" y="10" width="20" height="20" />
                <rect fill="#000" x="70" y="10" width="20" height="20" />
                <rect fill="#000" x="10" y="70" width="20" height="20" />
                <rect fill="#000" x="35" y="35" width="30" height="30" />
                {/* Pattern */}
                {[...Array(10)].map((_, i) => (
                  <rect key={i} fill="#000" 
                    x={15 + (i % 5) * 14} 
                    y={15 + Math.floor(i / 5) * 14} 
                    width="8" height="8" 
                    opacity={Math.random() > 0.3 ? 1 : 0} 
                  />
                ))}
              </svg>
            </div>
            
            <div style={{ marginBottom: 20 }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                fontSize: 14,
                color: 'var(--text-secondary)',
                marginBottom: 8
              }}>
                <span>Transaction</span>
                <span>{qrApproval.action === 'buy' ? 'BUY' : 'SELL'} {formatAmount(qrApproval.tile.amount)}</span>
              </div>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                fontSize: 14,
                color: 'var(--text-secondary)'
              }}>
                <span>Settlement</span>
                <span style={{ color: 'var(--neon-cyan)' }}>USDC (T+0)</span>
              </div>
            </div>
            
            <div style={{ 
              color: 'var(--accent-warning)', 
              fontSize: 13, 
              marginBottom: 20 
            }}>
              ⏱️ Expires in {qrApproval.timeRemaining}s
            </div>
            
            <div className="flex gap-sm justify-center">
              <button 
                className="btn"
                onClick={() => setQrApproval({ isOpen: false, action: null, tile: null, timeRemaining: 60 })}
                style={{ 
                  background: 'transparent', 
                  border: '1px solid var(--border-default)',
                  color: 'var(--text-secondary)'
                }}
              >
                Cancel
              </button>
              <button 
                className="btn primary"
                onClick={handleConfirmQR}
                style={{
                  background: 'linear-gradient(135deg, var(--neon-green), var(--neon-cyan))',
                  color: '#0A0E17',
                  border: 'none'
                }}
              >
                ✓ Simulate FaceID Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
