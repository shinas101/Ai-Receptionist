import React from 'react';
import { RefreshCw, Activity, Calendar, Clock, CheckCircle } from 'lucide-react';

export default function Header({ stats, onRefresh, isRefreshing, isConnected, onToggleCall }) {
  return (
    <header className="h-14 shrink-0 border-b border-[#222222] bg-[#000000] px-3 sm:px-6 flex items-center justify-between text-sm select-none z-10">
      {/* Left: Brand Icon + Title */}
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
        <img
          src="/favicon.svg"
          alt="ABC Logo"
          className="w-6 h-6 sm:w-7 sm:h-7 object-contain drop-shadow-[0_0_10px_rgba(192,132,252,0.7)] shrink-0"
        />
        <div className="flex items-baseline gap-2 min-w-0">
          <span className="font-bold text-sm sm:text-base lg:text-lg text-white tracking-tight truncate">
            ABC Health Care
          </span>
          <span className="text-[11px] font-mono text-zinc-500 hidden xl:inline">
            Receptionist Console
          </span>
        </div>
      </div>

      {/* Center: Minimal Stat Badges (Replaces tall metric cards to fit 1-window) */}
      <div className="hidden md:flex items-center gap-2 lg:gap-3 text-xs font-mono">
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#0c0c0e] border border-[#222226] text-zinc-300 hover:border-zinc-700 transition-colors">
          <span className="text-[10px] uppercase font-semibold text-zinc-500">Total</span>
          <span className="font-bold text-white tabular-nums">{stats?.total ?? 0}</span>
        </div>
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#0c0c0e] border border-[#222226] text-zinc-300 hover:border-zinc-700 transition-colors">
          <span className="text-[10px] uppercase font-semibold text-zinc-500">Today</span>
          <span className="font-bold text-purple-300 tabular-nums">{stats?.today ?? 0}</span>
        </div>
        <div className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#0c0c0e] border border-[#222226] text-zinc-300 hover:border-zinc-700 transition-colors">
          <span className="text-[10px] uppercase font-semibold text-zinc-500">Scheduled</span>
          <span className="font-bold text-emerald-400 tabular-nums">{stats?.scheduled ?? 0}</span>
        </div>
      </div>

      {/* Right: Status & Actions */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Simple live status */}
        <div className="flex items-center gap-2 text-xs text-zinc-400 hidden sm:flex px-2 py-1 rounded-md bg-[#0c0c0e] border border-[#222226]">
          <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-600'}`} />
          <span className="font-medium text-zinc-300">{isConnected ? 'Mia Connected' : 'Agent Ready'}</span>
        </div>

        {/* Refresh button */}
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          title="Refresh Data"
          className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-900 border border-transparent hover:border-[#2a2a2a] transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-white' : ''}`} />
        </button>

        {/* Primary Call Action */}
        <button
          onClick={onToggleCall}
          className={`text-xs sm:text-sm px-3 sm:px-3.5 py-1.5 font-semibold transition-all flex items-center gap-1.5 rounded-md ${
            isConnected
              ? 'bg-red-600 hover:bg-red-500 text-white shadow-sm'
              : 'btn-white'
          }`}
        >
          {isConnected ? (
            <>
              <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
              <span>End Call</span>
            </>
          ) : (
            <span>Call Mia →</span>
          )}
        </button>
      </div>
    </header>
  );
}
