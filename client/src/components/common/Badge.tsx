import React from 'react';
import { BADGE_CLASSES } from '../../constants/theme';

export type BadgeVariant = keyof typeof BADGE_CLASSES;

export interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = React.memo(({
  variant = 'neutral',
  children,
  icon,
  className = '',
}) => {
  const variantClass = BADGE_CLASSES[variant];

  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${variantClass} ${className}`}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </span>
  );
});

Badge.displayName = 'Badge';
export default Badge;
