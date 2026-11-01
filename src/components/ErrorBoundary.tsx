import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Tractor, RotateCcw, AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Harvest Rentals Uncaught Error caught by boundary:', error, errorInfo);
  }

  private handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-cream flex items-center justify-center p-4 text-center font-sans">
          <div className="max-w-md w-full bg-white rounded-xl border border-cream-border p-6 sm:p-8 shadow-card space-y-4">
            <div className="w-14 h-14 rounded-xl bg-agri-light text-forest flex items-center justify-center mx-auto">
              <Tractor className="w-7 h-7" />
            </div>

            <div className="space-y-1">
              <h1 className="text-xl sm:text-2xl font-bold text-forest">
                Something went wrong
              </h1>
              <p className="text-xs sm:text-sm text-neutralText-secondary">
                ಏನೋ ತಪ್ಪಾಗಿದೆ &bull; कुछ गलत हो गया
              </p>
              <p className="text-xs text-neutralText-muted pt-1">
                A temporary issue occurred. Tap below to refresh and resume finding your harvester.
              </p>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="w-full py-3 px-4 bg-forest hover:bg-forest-light text-white font-bold rounded-lg transition-subtle flex items-center justify-center gap-2 text-sm shadow-soft min-h-[48px]"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Reload Application / ಮುಖಪುಟಕ್ಕೆ ಹಿಂತಿರುಗಿ</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

