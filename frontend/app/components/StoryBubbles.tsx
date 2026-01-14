'use client';
import { useState, useEffect } from 'react';
import { useLoan } from '../../lib/LoanContext';

interface DealStory {
  id: number;
  name: string;
  emoji: string;
  status: 'new' | 'viewed' | 'urgent';
  latestUpdate: string;
  riskLevel: 'safe' | 'warning' | 'critical';
  videoPreview?: string;
}

interface StoryBubblesProps {
  onDealSelect?: (dealId: number) => void;
}

export default function StoryBubbles({ onDealSelect }: StoryBubblesProps) {
  const { activeLoanId, setActiveLoanId, setLoanName } = useLoan();
  const [deals, setDeals] = useState<DealStory[]>([
    {
      id: 1,
      name: "Greener Horizons",
      emoji: "🌱",
      status: 'new',
      latestUpdate: "ESG KPI on track. Margin reduced by 5bps.",
      riskLevel: 'safe'
    },
    {
      id: 2,
      name: "Boeing TL-A",
      emoji: "✈️",
      status: 'urgent',
      latestUpdate: "Distance-to-Default dropped 15%. Review recommended.",
      riskLevel: 'warning'
    },
    {
      id: 3,
      name: "SpaceX RCF",
      emoji: "🚀",
      status: 'viewed',
      latestUpdate: "Utilization request processed successfully.",
      riskLevel: 'safe'
    },
    {
      id: 4,
      name: "Tesla Green",
      emoji: "⚡",
      status: 'new',
      latestUpdate: "New trade interest from BlackRock.",
      riskLevel: 'safe'
    },
    {
      id: 5,
      name: "Amazon TLB",
      emoji: "📦",
      status: 'viewed',
      latestUpdate: "Quarterly compliance certificate received.",
      riskLevel: 'safe'
    }
  ]);

  const [selectedStory, setSelectedStory] = useState<DealStory | null>(null);
  const [storyProgress, setStoryProgress] = useState(0);

  const handleBubbleClick = (deal: DealStory) => {
    setSelectedStory(deal);
    setStoryProgress(0);

    // Mark as viewed
    setDeals(prev => prev.map(d =>
      d.id === deal.id ? { ...d, status: 'viewed' as const } : d
    ));

    // Auto-progress story
    const interval = setInterval(() => {
      setStoryProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setSelectedStory(null);
          return 0;
        }
        return prev + 2;
      });
    }, 100);
  };

  const handleStoryDismiss = () => {
    setSelectedStory(null);
    setStoryProgress(0);
  };

  const handleViewDeal = () => {
    if (selectedStory) {
      setActiveLoanId(selectedStory.id);
      setLoanName(selectedStory.name);
      onDealSelect?.(selectedStory.id);
      setSelectedStory(null);
    }
  };

  const getRingClass = (deal: DealStory) => {
    if (deal.status === 'viewed') return 'story-bubble-ring viewed';
    return 'story-bubble-ring';
  };

  return (
    <>
      <div className="story-bubbles">
        {/* Add New Deal Bubble */}
        <div className="story-bubble" onClick={() => window.dispatchEvent(new CustomEvent('loantwin-toast', { detail: { message: 'Drag a PDF to create a new deal', type: 'info' } }))}>
          <div style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            border: '2px dashed var(--border-default)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 24,
            color: 'var(--text-muted)'
          }}>
            +
          </div>
          <span className="story-bubble-label">New Deal</span>
        </div>

        {/* Deal Story Bubbles */}
        {deals.map(deal => (
          <div
            key={deal.id}
            className="story-bubble"
            onClick={() => handleBubbleClick(deal)}
          >
            <div className={getRingClass(deal)} style={
              deal.riskLevel === 'warning' ? { background: 'linear-gradient(135deg, #F59E0B, #DC2626)' } :
                deal.riskLevel === 'critical' ? { background: '#DC2626' } :
                  undefined
            }>
              <div className="story-bubble-inner">
                {deal.emoji}
              </div>
            </div>
            <span className="story-bubble-label">{deal.name}</span>
            {deal.status === 'urgent' && (
              <span style={{
                position: 'absolute',
                top: 0,
                right: 8,
                width: 12,
                height: 12,
                background: 'var(--accent-danger)',
                borderRadius: '50%',
                border: '2px solid var(--bg-primary)',
                animation: 'pulse 1.5s infinite'
              }} />
            )}
          </div>
        ))}
      </div>

      {/* Story Viewer Overlay */}
      {selectedStory && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(10, 14, 23, 0.95)',
            zIndex: 2000,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            animation: 'fadeIn 0.2s'
          }}
          onClick={handleStoryDismiss}
        >
          {/* Progress Bar */}
          <div style={{
            position: 'absolute',
            top: 16,
            left: 16,
            right: 16,
            height: 4,
            background: 'rgba(255, 255, 255, 0.2)',
            borderRadius: 2
          }}>
            <div style={{
              height: '100%',
              width: `${storyProgress}%`,
              background: 'white',
              borderRadius: 2,
              transition: 'width 0.1s linear'
            }} />
          </div>

          {/* Deal Header */}
          <div style={{
            position: 'absolute',
            top: 40,
            left: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 12
          }}>
            <div style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: 'var(--glass-bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20
            }}>
              {selectedStory.emoji}
            </div>
            <div>
              <div style={{ color: 'white', fontWeight: 600 }}>{selectedStory.name}</div>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>Just now</div>
            </div>
          </div>

          {/* Story Content */}
          <div
            style={{
              maxWidth: 400,
              padding: 32,
              textAlign: 'center'
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{
              fontSize: 64,
              marginBottom: 24
            }}>
              {selectedStory.emoji}
            </div>

            <h2 style={{ color: 'white', fontSize: 24, marginBottom: 16 }}>
              {selectedStory.name}
            </h2>

            <div style={{
              background: selectedStory.riskLevel === 'safe' ? 'var(--neon-green-dim)' :
                selectedStory.riskLevel === 'warning' ? 'var(--accent-warning-dim)' :
                  'var(--accent-danger-dim)',
              border: `1px solid ${selectedStory.riskLevel === 'safe' ? 'var(--neon-green)' :
                selectedStory.riskLevel === 'warning' ? 'var(--accent-warning)' :
                  'var(--accent-danger)'
                }`,
              borderRadius: 12,
              padding: 16,
              marginBottom: 24
            }}>
              <p style={{
                color: 'white',
                fontSize: 16,
                lineHeight: 1.6,
                margin: 0
              }}>
                {selectedStory.latestUpdate}
              </p>
            </div>

            <button
              onClick={handleViewDeal}
              style={{
                background: 'linear-gradient(135deg, var(--neon-green), var(--neon-cyan))',
                color: '#0A0E17',
                border: 'none',
                borderRadius: 24,
                padding: '14px 32px',
                fontSize: 16,
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              View Full Deal →
            </button>
          </div>

          {/* Close Button */}
          <button
            onClick={handleStoryDismiss}
            style={{
              position: 'absolute',
              top: 40,
              right: 16,
              background: 'transparent',
              border: 'none',
              color: 'white',
              fontSize: 24,
              cursor: 'pointer'
            }}
          >
            ×
          </button>
        </div>
      )}

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.6; transform: scale(1.2); }
        }
      `}</style>
    </>
  );
}
