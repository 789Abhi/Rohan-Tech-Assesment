import React from 'react';
import { BUTTON_CLASSES } from '../../constants/theme';
import { Loader2 } from 'lucide-react';

export type ButtonVariant = keyof typeof BUTTON_CLASSES;
export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
}

const SIZE_CLASSES: Record<ButtonSize, string> = {
  xs: 'px-2.5 py-1 text-xs rounded-md font-semibold gap-1',
  sm: 'px-3.5 py-1.5 text-xs rounded-lg font-bold gap-1.5',
  md: 'px-4 py-2 text-sm rounded-xl font-bold gap-2',
  lg: 'px-5 py-3 text-base rounded-xl font-extrabold gap-2.5',
};

export const Button: React.FC<ButtonProps> = React.memo(({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  children,
  className = '',
  disabled,
  ...props
}) => {
  const variantClass = BUTTON_CLASSES[variant];
  const sizeClass = SIZE_CLASSES[size];

  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer ${variantClass} ${sizeClass} ${className}`}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>Processing...</span>
        </>
      ) : (
        <>
          {icon && <span className="shrink-0">{icon}</span>}
          {children}
        </>
      )}
    </button>
  );
});

Button.displayName = 'Button';
export default Button;
