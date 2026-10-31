import React from 'react';
import { ShieldAlert, RotateCcw, Home } from 'lucide-react';
import { storageService } from '../../services/storageService';

/**
 * Phase 7 Section 14: Application Error Boundary
 * Catches unexpected runtime rendering errors, prevents exposing raw stack traces
 * to users, and provides safe recovery actions (Return Home or Reset Demo Data).
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      errorTitle: 'An unexpected interface error occurred',
    };
  }

  static getDerivedStateFromError() {
    return {
      hasError: true,
      errorTitle:
        'The demonstration portal encountered an unexpected rendering issue.',
    };
  }

  componentDidCatch(error) {
    // Log sanitized warning to console for developer diagnostics without exposing stack traces in the UI
    console.warn('[OVS ErrorBoundary]: Handled unexpected UI error:', error?.message || 'Unknown error');
  }

  handleReturnHome = () => {
    this.setState({ hasError: false });
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  };

  handleResetAndReload = () => {
    try {
      storageService.resetAllDemoData();
    } catch {
      // Ignore storage error during recovery
    }
    this.setState({ hasError: false });
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          aria-live="assertive"
          className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans text-slate-900"
        >
          <div className="max-w-lg w-full bg-white rounded-2xl border border-slate-200 shadow-lg p-6 sm:p-8 space-y-5 text-center">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 border border-amber-300 text-amber-800 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-6 h-6" />
            </div>

            <div className="space-y-2">
              <span className="inline-block px-2.5 py-0.5 rounded-md bg-blue-50 text-[#002868] text-[11px] font-bold uppercase tracking-wider">
                Safe Recovery Mode
              </span>
              <h1 className="text-xl font-extrabold text-slate-900">
                {this.state.errorTitle}
              </h1>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Your browser session encountered an unexpected state or corrupted local storage entry. No internal stack traces or sensitive records are exposed. Use one of the recovery options below to continue.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleReturnHome}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#002868] hover:bg-blue-900 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                <Home className="w-4 h-4" />
                Return to Homepage
              </button>
              <button
                type="button"
                onClick={this.handleResetAndReload}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-300 text-xs font-bold transition-colors cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                Reset Demo Data &amp; Reload
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
