import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ error, errorInfo });
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full min-h-[400px] w-full p-8 text-center bg-zinc-50 rounded-lg border border-zinc-200">
          <AlertTriangle className="w-12 h-12 text-rose-500 mb-4" />
          <h2 className="text-xl font-bold text-zinc-900 mb-2">Something went wrong</h2>
          <p className="text-sm text-zinc-600 max-w-md mb-6">
            The application encountered an unexpected error while rendering this view.
          </p>
          <div className="flex gap-3">
             <button
               onClick={() => window.location.reload()}
               className="flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white text-xs font-bold uppercase tracking-widest rounded-md hover:bg-zinc-800 transition-colors"
             >
               <RefreshCw className="w-3.5 h-3.5" /> Reload Page
             </button>
             <button
               onClick={() => {
                 this.setState({ hasError: false, error: null, errorInfo: null });
                 window.history.back();
               }}
               className="flex items-center gap-2 px-4 py-2 bg-white text-zinc-700 text-xs font-bold uppercase tracking-widest rounded-md border border-zinc-200 hover:bg-zinc-50 transition-colors"
             >
               Go Back
             </button>
          </div>
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <div className="mt-8 text-left bg-zinc-900 text-red-400 p-4 rounded text-xs font-mono overflow-auto w-full max-w-2xl max-h-64 whitespace-pre-wrap">
              {this.state.error.toString()}
              <br />
              {this.state.errorInfo?.componentStack}
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
