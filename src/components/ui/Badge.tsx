import React from 'react';
import { BookingStatus } from '../../types';

export interface BadgeProps {
  status?: BookingStatus;
  variant?: 'neutral' | 'success' | 'warning' | 'error' | 'info';
  children?: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  status,
  variant,
  children,
  className = '',
}) => {
  // Map booking status if provided
  let effectiveVariant = variant || 'neutral';
  let label = children;

  if (status) {
    switch (status) {
      case 'paid':
        effectiveVariant = 'success';
        label = label || 'Advance Paid';
        break;
      case 'confirmed':
        effectiveVariant = 'info';
        label = label || 'Confirmed';
        break;
      case 'cancelled':
        effectiveVariant = 'error';
        label = label || 'Cancelled';
        break;
      case 'pending':
      default:
        effectiveVariant = 'warning';
        label = label || 'Pending Confirmation';
        break;
    }
  }

  const variantStyles = {
    neutral: 'bg-cream-dark/50 text-neutralText-primary border-cream-border',
    success: 'bg-agri-light text-forest border-agri-border',
    info: 'bg-sky-50 text-sky-900 border-sky-200',
    warning: 'bg-amberGold-light text-amberGold border-amberGold-border',
    error: 'bg-brickRed-light text-brickRed border-brickRed-border',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border ${
        variantStyles[effectiveVariant]
      } ${className}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          effectiveVariant === 'success'
            ? 'bg-agri'
            : effectiveVariant === 'warning'
            ? 'bg-amberGold'
            : effectiveVariant === 'error'
            ? 'bg-brickRed'
            : effectiveVariant === 'info'
            ? 'bg-sky-600'
            : 'bg-neutralText-muted'
        }`}
      />
      <span>{label}</span>
    </span>
  );
};

