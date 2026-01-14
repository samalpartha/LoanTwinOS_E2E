'use client';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'title' | 'avatar' | 'card' | 'button';
  width?: string | number;
  height?: string | number;
}

export const Skeleton = ({ 
  className = '', 
  variant = 'text',
  width,
  height 
}: SkeletonProps) => {
  const variantClasses = {
    text: 'skeleton-text',
    title: 'skeleton-title',
    avatar: 'skeleton-avatar',
    card: 'skeleton-card',
    button: 'skeleton h-[44px] w-[120px]'
  };

  const style: React.CSSProperties = {};
  if (width) style.width = typeof width === 'number' ? `${width}px` : width;
  if (height) style.height = typeof height === 'number' ? `${height}px` : height;

  return (
    <div 
      className={`skeleton ${variantClasses[variant]} ${className}`}
      style={style}
    />
  );
};

// Skeleton for KPI cards
export const SkeletonKPI = () => (
  <div className="card kpi-card">
    <Skeleton variant="text" width="60%" />
    <Skeleton variant="title" width="80%" className="mt-sm" />
    <Skeleton variant="text" width="40%" className="mt-sm" />
  </div>
);

// Skeleton for feature cards
export const SkeletonFeatureCard = () => (
  <div className="feature-card">
    <Skeleton variant="avatar" />
    <div className="feature-content" style={{ flex: 1 }}>
      <Skeleton variant="text" width="70%" />
      <Skeleton variant="text" width="100%" className="mt-xs" />
      <Skeleton variant="text" width="50%" className="mt-xs" />
    </div>
  </div>
);

// Skeleton for list items
export const SkeletonListItem = () => (
  <div className="flex items-center gap-md p-md">
    <Skeleton variant="avatar" width={40} height={40} />
    <div style={{ flex: 1 }}>
      <Skeleton variant="text" width="60%" />
      <Skeleton variant="text" width="40%" className="mt-xs" />
    </div>
    <Skeleton variant="button" width={80} height={32} />
  </div>
);

// Skeleton for agent recommendations
export const SkeletonRecommendation = () => (
  <div className="card-inner">
    <div className="flex items-center gap-sm mb-sm">
      <Skeleton variant="avatar" width={24} height={24} />
      <Skeleton variant="text" width={60} />
    </div>
    <Skeleton variant="title" width="80%" />
    <Skeleton variant="text" width="100%" className="mt-sm" />
    <Skeleton variant="text" width="70%" className="mt-xs" />
    <div className="flex justify-between mt-md">
      <Skeleton variant="text" width={100} />
      <Skeleton variant="button" width={100} height={32} />
    </div>
  </div>
);

export default Skeleton;
