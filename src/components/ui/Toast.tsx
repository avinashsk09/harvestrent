import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export interface ToastProps {
  type?: 'success' | 'error' | 'info';
  message: string;
  onClose?: () => void;
  className?: string;
}

export const Toast: React.FC<ToastProps> = ({
  type = 'info',
  message,
  onClose,
  className = '',
}) => {
  const styles = {
    success: 'bg-white border-agri-border text-forest',
    error: 'bg-white border-brickRed-border text-brickRed',
    info: 'bg-white border-cream-border text-forest',
  };

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-agri flex-shrink-0" />,
    error: <AlertCircle className="w-5 h-5 text-brickRed flex-shrink-0" />,
    info: <Info className="w-5 h-5 text-forest flex-shrink-0" />,
  };

  return (
    <div
      className={`flex items-center justify-between gap-3 p-3.5 rounded-lg border shadow-soft ${
        styles[type]
      } ${className}`}
      role="alert"
    >
      <div className="flex items-center gap-2.5">
        {icons[type]}
        <span className="text-sm font-medium">{message}</span>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="text-neutralText-muted hover:text-forest p-1"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

