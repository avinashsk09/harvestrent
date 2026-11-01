import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightElement?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({
  label,
  helperText,
  error,
  leftIcon,
  rightElement,
  id,
  className = '',
  disabled,
  ...props
}) => {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className="w-full space-y-1.5 text-left">
      {label && (
        <label
          htmlFor={inputId}
          className="block text-sm font-semibold text-forest tracking-tight"
        >
          {label}
        </label>
      )}

      <div className="relative flex items-center">
        {leftIcon && (
          <div className="absolute left-3.5 flex items-center pointer-events-none text-neutralText-muted">
            {leftIcon}
          </div>
        )}

        <input
          id={inputId}
          disabled={disabled}
          className={`w-full rounded-lg bg-white border text-neutralText-primary text-base placeholder-neutralText-muted/70 transition-subtle focus:outline-none focus:ring-2 focus:ring-agri focus:border-agri min-h-[44px] ${
            leftIcon ? 'pl-10' : 'pl-3.5'
          } ${rightElement ? 'pr-12' : 'pr-3.5'} py-2.5 ${
            error
              ? 'border-brickRed focus:ring-brickRed focus:border-brickRed'
              : 'border-cream-border'
          } ${disabled ? 'bg-cream-light opacity-60 cursor-not-allowed' : ''} ${className}`}
          {...props}
        />

        {rightElement && (
          <div className="absolute right-3 flex items-center">
            {rightElement}
          </div>
        )}
      </div>

      {error ? (
        <p className="text-xs font-medium text-brickRed mt-1">{error}</p>
      ) : helperText ? (
        <p className="text-xs text-neutralText-secondary mt-1">{helperText}</p>
      ) : null}
    </div>
  );
};

