import React from 'react';

export default function Logo({ size = 32, showText = false, color = 'var(--accent-primary)' }: { size?: number, showText?: boolean, color?: string }) {
  const uniqueId = React.useId();
  
  return (
    <div style={{ 
      display: 'inline-flex', 
      alignItems: 'center', 
      gap: 14,
    }}>
      {/* Codium-style overlapping ellipses */}
      <div style={{
        transition: 'transform 0.4s ease',
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'scale(1.1)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
      }}
      >
        <svg 
          width={size * 1.3} 
          height={size} 
          viewBox="0 0 52 40" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
          style={{ 
            flexShrink: 0,
            filter: 'drop-shadow(0 4px 12px rgba(0, 245, 212, 0.3))',
          }}
        >
          <defs>
            {/* Leftmost ellipse - Teal/Cyan */}
            <linearGradient id={`ellipse1-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00F5D4" />
              <stop offset="100%" stopColor="#00D4AA" />
            </linearGradient>
            
            {/* Middle ellipse - Cyan/Blue blend */}
            <linearGradient id={`ellipse2-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00BBF9" />
              <stop offset="100%" stopColor="#0099DD" />
            </linearGradient>
            
            {/* Rightmost ellipse - Deep Blue */}
            <linearGradient id={`ellipse3-${uniqueId}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0066CC" />
              <stop offset="100%" stopColor="#003D7A" />
            </linearGradient>
          </defs>
          
          {/* Three overlapping ellipses - Codium style */}
          {/* Back ellipse (rightmost, darkest) */}
          <ellipse 
            cx="34" 
            cy="20" 
            rx="14" 
            ry="18" 
            fill={`url(#ellipse3-${uniqueId})`}
          />
          
          {/* Middle ellipse */}
          <ellipse 
            cx="26" 
            cy="20" 
            rx="14" 
            ry="18" 
            fill={`url(#ellipse2-${uniqueId})`}
            fillOpacity="0.9"
          />
          
          {/* Front ellipse (leftmost, brightest) */}
          <ellipse 
            cx="18" 
            cy="20" 
            rx="14" 
            ry="18" 
            fill={`url(#ellipse1-${uniqueId})`}
            fillOpacity="0.85"
          />
        </svg>
      </div>
      
      {showText && (
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          lineHeight: 1.1,
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'baseline',
            gap: 0
          }}>
            <span style={{ 
              fontFamily: '"SF Pro Display", "Inter", -apple-system, sans-serif', 
              fontSize: size * 0.65, 
              fontWeight: 700, 
              letterSpacing: '-0.02em',
              whiteSpace: 'nowrap',
              color: '#00F5D4',
            }}>
              LoanTwin
            </span>
            <span style={{
              fontFamily: '"SF Pro Display", "Inter", -apple-system, sans-serif',
              fontSize: size * 0.35,
              fontWeight: 600,
              color: '#00BBF9',
              marginLeft: 3,
              position: 'relative',
              top: -4
            }}>
              OS
            </span>
          </div>
          <span style={{ 
            fontSize: size * 0.28, 
            fontWeight: 500, 
            color: 'rgba(255,255,255,0.45)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginTop: 1
          }}>
            Enterprise v2.5
          </span>
        </div>
      )}
    </div>
  );
}
