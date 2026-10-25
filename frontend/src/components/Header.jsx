import React from 'react';
import { RefreshCw, Radio } from 'lucide-react';

export default function Header({ stats, onRefresh, isRefreshing, isConnected, onToggleCall }) {
  return (
    <header className="border-b border-[#222222] bg-[#000000] px-6 py-4 flex items-center justify-between text-sm select-none">
      {/* Left: Square Brand Box + Title (matches screenshot) */}
      <div className="flex items-center gap-3">
        <div className="border border-white/30 rounded px-2 py-1 text-xs font-bold tracking-wider text-white">
          ABC
        </div>
        <span className="font-bold text-lg text-white tracking-tight">
          ABC Health Care
        </span>
      </div>

      {/* Right: Clean minimal actions */}
      <div className="flex items-center gap-4">
        {/* Simple live status */}
        <div className="flex items-center gap-2 text-xs text-zinc-400 hidden sm:flex">
          <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-600'}`} />
          <span>{isConnected ? 'Mia Live' : 'Ready'}</span>
        </div>

        {/* Refresh button */}
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          title="Refresh Data"
          className="p-2 rounded text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-white' : ''}`} />
        </button>

        {/* Primary White Button (matches screenshot: Dashboard ->) */}
        <button
          onClick={onToggleCall}
          className="btn-white text-sm px-4 py-2"
        >
          {isConnected ? 'End Call' : 'Call Mia →'}
        </button>
      </div>
    </header>
  );
}
