'use client';

import { LucideIcon } from 'lucide-react';
import { GradientIcon } from './Icon';

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
  onClick?: () => void;
  className?: string;
  accentColor?: 'cyan' | 'purple' | 'green' | 'warning' | 'danger';
}

export const FeatureCard = ({ 
  icon,
  title, 
  description, 
  onClick,
  className = '',
  accentColor = 'cyan'
}: FeatureCardProps) => {
  const accentStyles = {
    cyan: 'var(--accent-secondary)',
    purple: 'var(--neon-purple)',
    green: 'var(--accent-success)',
    warning: 'var(--accent-warning)',
    danger: 'var(--accent-danger)'
  };

  return (
    <div 
      className={`feature-card interactive-hover ${onClick ? 'cursor-pointer' : ''} ${className}`}
      onClick={onClick}
      style={{ borderLeft: `3px solid ${accentStyles[accentColor]}` }}
    >
      <GradientIcon icon={icon} />
      <div className="feature-content">
        <h3 className="h3">{title}</h3>
        <p className="small opacity-70">{description}</p>
      </div>
    </div>
  );
};

// Compact feature card for smaller grids
export const FeatureCardCompact = ({ 
  icon: IconComponent,
  title, 
  description, 
  onClick,
  className = ''
}: FeatureCardProps) => {
  return (
    <div 
      className={`card-inner interactive-hover ${onClick ? 'cursor-pointer' : ''} ${className}`}
      onClick={onClick}
    >
      <div className="flex items-center gap-sm mb-sm">
        <div 
          className="flex items-center justify-center"
          style={{ 
            width: 32, 
            height: 32, 
            borderRadius: 'var(--radius-sm)',
            background: 'var(--gradient-accent)'
          }}
        >
          <IconComponent size={16} color="#00040F" />
        </div>
        <h3 className="h3" style={{ margin: 0 }}>{title}</h3>
      </div>
      <p className="small opacity-70">{description}</p>
    </div>
  );
};

// Large hero feature card
export const FeatureCardHero = ({ 
  icon: IconComponent,
  title, 
  description, 
  onClick,
  className = '',
  children
}: FeatureCardProps & { children?: React.ReactNode }) => {
  return (
    <div 
      className={`card-premium interactive-hover ${onClick ? 'cursor-pointer' : ''} ${className}`}
      onClick={onClick}
      style={{ padding: 'var(--space-xl)' }}
    >
      <div className="flex items-start gap-lg">
        <div 
          className="flex items-center justify-center flex-shrink-0"
          style={{ 
            width: 64, 
            height: 64, 
            borderRadius: 'var(--radius-lg)',
            background: 'var(--gradient-accent)',
            boxShadow: 'var(--glow-accent)'
          }}
        >
          <IconComponent size={32} color="#00040F" />
        </div>
        <div className="flex-1">
          <h2 className="h2" style={{ marginBottom: 'var(--space-xs)' }}>{title}</h2>
          <p className="body opacity-70">{description}</p>
          {children && <div className="mt-md">{children}</div>}
        </div>
      </div>
    </div>
  );
};

export default FeatureCard;
