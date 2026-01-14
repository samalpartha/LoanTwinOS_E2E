'use client';
import { useState, useRef, useEffect } from 'react';

interface VideoTooltipProps {
  term: string;
  children: React.ReactNode;
}

interface TermExplanation {
  title: string;
  summary: string;
  details: string[];
  duration: string;
  videoId?: string;
}

const TERM_LIBRARY: Record<string, TermExplanation> = {
  "merton model": {
    title: "Merton Model",
    summary: "A mathematical framework that uses equity data to estimate default probability.",
    details: [
      "Treats equity as a call option on the firm's assets",
      "Uses stock price volatility to calculate asset value",
      "Distance to Default (DTD) measured in standard deviations",
      "Higher DTD (5+) indicates lower default risk"
    ],
    duration: "45 seconds"
  },
  "distance to default": {
    title: "Distance to Default (DTD)",
    summary: "Measures how far a company's asset value is from its debt obligations.",
    details: [
      "Expressed in standard deviations (sigma)",
      "DTD of 7.3σ means very low default probability",
      "Calculated using Merton Model framework",
      "Real-time updates based on equity market data"
    ],
    duration: "30 seconds"
  },
  "trade readiness": {
    title: "Trade Readiness Score",
    summary: "Indicates how easily a loan can be transferred in the secondary market.",
    details: [
      "Score from 0-100, higher is better",
      "Factors: transfer restrictions, consents, documentation",
      "100 = fully ready for trading",
      "Common blockers: white-lists, missing ESG verifiers"
    ],
    duration: "40 seconds"
  },
  "lma standard": {
    title: "LMA Standard",
    summary: "Loan Market Association standard documentation templates.",
    details: [
      "Industry-standard templates for EMEA syndicated loans",
      "Clauses matching LMA = 'standard'",
      "Non-standard clauses may need extra review",
      "Reduces legal negotiation time significantly"
    ],
    duration: "35 seconds"
  },
  "covenant": {
    title: "Covenants",
    summary: "Binding agreements requiring the borrower to maintain certain conditions.",
    details: [
      "Financial covenants: leverage, interest coverage",
      "Tested periodically (usually quarterly)",
      "Breach can trigger events of default",
      "Headroom = margin of safety"
    ],
    duration: "45 seconds"
  },
  "esg": {
    title: "ESG-Linked Features",
    summary: "Sustainability-linked provisions that tie pricing to ESG performance.",
    details: [
      "KPIs tested annually with independent verification",
      "Meeting targets reduces margin by 5-10 bps",
      "Missing targets may increase margin",
      "Common KPIs: emissions, renewable energy, diversity"
    ],
    duration: "50 seconds"
  },
  "white list": {
    title: "White-Listed Transferees",
    summary: "Pre-approved buyers who can acquire loan participations without additional consent.",
    details: [
      "Listed in side letter or credit agreement",
      "Trades with white-listed parties settle faster (T+0)",
      "Non-listed buyers require waiver process",
      "Typically includes major institutional lenders"
    ],
    duration: "35 seconds"
  },
  "compliance shield": {
    title: "Compliance Shield",
    summary: "Real-time gatekeeper that blocks trades if compliance issues are detected.",
    details: [
      "Checks OFAC, UN, EU sanctions lists",
      "Monitors Equator Principles compliance",
      "Screens for adverse media mentions",
      "Physically locks trade button if issues found"
    ],
    duration: "40 seconds"
  }
};

export default function VideoTooltip({ term, children }: VideoTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showVideo, setShowVideo] = useState(false);
  const [hoverTimer, setHoverTimer] = useState<NodeJS.Timeout | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const explanation = TERM_LIBRARY[term.toLowerCase()];

  const handleMouseEnter = () => {
    // Show tooltip after 500ms hover
    const timer = setTimeout(() => {
      setIsOpen(true);
    }, 500);
    setHoverTimer(timer);
  };

  const handleMouseLeave = () => {
    if (hoverTimer) {
      clearTimeout(hoverTimer);
      setHoverTimer(null);
    }
    // Keep tooltip open briefly for interaction
    setTimeout(() => {
      if (!tooltipRef.current?.matches(':hover')) {
        setIsOpen(false);
        setShowVideo(false);
      }
    }, 300);
  };

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setShowVideo(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  if (!explanation) {
    return <>{children}</>;
  }

  return (
    <span
      className="video-tooltip-trigger"
      style={{
        position: 'relative',
        display: 'inline',
        borderBottom: '1px dotted var(--accent-primary)',
        cursor: 'help'
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}

      {isOpen && (
        <div
          ref={tooltipRef}
          className="video-tooltip"
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 8px)',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 320,
            maxWidth: '90vw',
            padding: 16,
            background: 'var(--bg-card)',
            border: '1px solid var(--border-default)',
            borderRadius: 12,
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
            zIndex: 1000,
            animation: 'fadeIn 0.2s ease-out'
          }}
          onMouseEnter={() => setIsOpen(true)}
          onMouseLeave={() => {
            setIsOpen(false);
            setShowVideo(false);
          }}
        >
          {/* Arrow */}
          <div style={{
            position: 'absolute',
            bottom: -8,
            left: '50%',
            width: 16,
            height: 16,
            background: 'var(--bg-card)',
            border: '1px solid var(--border-default)',
            borderTop: 'none',
            borderLeft: 'none',
            transform: 'translateX(-50%) rotate(45deg)'
          }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
            <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>
              {explanation.title}
            </h4>
            <button
              onClick={() => setShowVideo(!showVideo)}
              style={{
                padding: '4px 8px',
                background: showVideo ? 'var(--accent-danger)' : 'var(--accent-primary)',
                color: 'white',
                border: 'none',
                borderRadius: 6,
                fontSize: 10,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4
              }}
            >
              {showVideo ? '⏹️ Close' : '▶️ Watch'}
              <span style={{ opacity: 0.8 }}>{explanation.duration}</span>
            </button>
          </div>

          <p style={{ margin: '8px 0', fontSize: 12, opacity: 0.9, lineHeight: 1.5 }}>
            {explanation.summary}
          </p>

          {!showVideo ? (
            <ul style={{ margin: '8px 0 0 0', padding: '0 0 0 16px', fontSize: 11, opacity: 0.7 }}>
              {explanation.details.map((detail, i) => (
                <li key={i} style={{ marginBottom: 4 }}>{detail}</li>
              ))}
            </ul>
          ) : (
            <div style={{
              marginTop: 12,
              background: 'var(--bg-elevated)',
              borderRadius: 8,
              padding: 16,
              textAlign: 'center'
            }}>
              {/* Video Player Placeholder */}
              <div style={{
                width: '100%',
                height: 120,
                background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
                borderRadius: 8,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                marginBottom: 8
              }}>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🎬</div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>AI Avatar Explainer</div>
                <div style={{ fontSize: 10, opacity: 0.5 }}>{explanation.duration}</div>
              </div>

              <p style={{ fontSize: 11, fontStyle: 'italic', opacity: 0.6, margin: 0 }}>
                Video generation available in LoanTwin OS Enterprise
              </p>

              {/* Audio-only narration button */}
              <button
                onClick={() => {
                  const utterance = new SpeechSynthesisUtterance(
                    `${explanation.title}. ${explanation.summary}. ${explanation.details.join('. ')}`
                  );
                  utterance.rate = 0.9;
                  window.speechSynthesis.speak(utterance);
                }}
                style={{
                  marginTop: 12,
                  padding: '8px 16px',
                  background: 'var(--accent-primary)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 11,
                  cursor: 'pointer'
                }}
              >
                🔊 Listen to Explanation
              </button>
            </div>
          )}
        </div>
      )}

      <style jsx>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateX(-50%) translateY(8px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </span>
  );
}

// Helper component for quick term highlighting
export function Term({ children }: { children: string }) {
  return (
    <VideoTooltip term={children}>
      <span style={{ fontWeight: 500 }}>{children}</span>
    </VideoTooltip>
  );
}
