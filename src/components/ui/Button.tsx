import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  isLoading?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  isLoading = false,
  icon,
  className = '',
  disabled,
  ...props
}) => {
  const baseStyles = 'inline-flex items-center justify-center font-medium rounded-lg transition-subtle focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed';

  const sizeStyles = {
    sm: 'text-sm px-3 py-1.5 gap-1.5 min-h-[36px]',
    md: 'text-base px-4 py-2.5 gap-2 min-h-[44px]',
    lg: 'text-lg px-6 py-3.5 gap-2.5 min-h-[52px] font-semibold',
  };

  const variantStyles = {
    primary: 'bg-agri text-white hover:bg-agri-hover focus:ring-agri shadow-soft border border-transparent',
    secondary: 'bg-white text-forest hover:bg-cream-light border border-cream-border focus:ring-agri shadow-soft',
    outline: 'bg-transparent text-agri hover:bg-agri-light border border-agri focus:ring-agri',
    danger: 'bg-brickRed text-white hover:opacity-90 focus:ring-brickRed border border-transparent',
    ghost: 'bg-transparent text-neutralText-primary hover:bg-cream-dark/40 focus:ring-agri',
  };

  return (
    <button
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
      ) : (
        icon && <span className="flex-shrink-0">{icon}</span>
      )}
      <span>{children}</span>
    </button>
  );
};

