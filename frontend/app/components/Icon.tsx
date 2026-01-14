'use client';

import { LucideIcon } from 'lucide-react';

interface IconProps {
  icon: LucideIcon;
  size?: number;
  className?: string;
  color?: string;
}

export const Icon = ({ 
  icon: IconComponent, 
  size = 20, 
  className = '',
  color
}: IconProps) => {
  return (
    <IconComponent 
      size={size} 
      className={`nav-icon ${className}`}
      color={color}
    />
  );
};

// Gradient icon wrapper for feature cards
export const GradientIcon = ({ 
  icon: IconComponent, 
  size = 24 
}: { icon: LucideIcon; size?: number }) => {
  return (
    <div className="feature-icon">
      <IconComponent size={size} color="#00040F" />
    </div>
  );
};

export default Icon;
