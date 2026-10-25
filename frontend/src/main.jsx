import React, { Component, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('App runtime error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-6 text-center">
          <div className="w-12 h-12 rounded-xl bg-red-950/40 border border-red-800/50 flex items-center justify-center text-red-400 font-bold text-lg mb-4">
            !
          </div>
          <h1 className="text-xl font-bold mb-2 text-white">Application Notice</h1>
          <p className="text-xs text-red-400 max-w-md mb-4 font-mono bg-zinc-900/80 p-3 rounded border border-zinc-800 text-left overflow-auto max-h-40">
            {this.state.error?.message || String(this.state.error)}
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-white text-black font-semibold rounded-lg text-sm hover:bg-zinc-200 transition-colors"
          >
            Reload Application
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
