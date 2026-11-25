import React from 'react';
import { motion } from 'motion/react';
import {
  Mic,
  Calendar,
  Stethoscope,
  RefreshCw,
  Phone,
  PhoneOff,
  Loader2,
} from 'lucide-react';

export default function FloatingNavbar({
  activeView,
  onSelectView,
  appointmentsCount = 0,
  doctorsCount = 0,
  connectionState = 'disconnected',
  isAgentSpeaking = false,
  isRefreshing = false,
  onRefresh,
  onToggleCall,
}) {
  const isConnected = connectionState === 'connected';
  const isConnecting = connectionState === 'connecting';

  const navItems = [
    {
      id: 'agent',
      label: 'Voice Agent',
      mobileLabel: 'Agent',
      icon: Mic,
      badge: null,
    },
    {
      id: 'calendar',
      label: 'Calendar',
      mobileLabel: 'Calendar',
      icon: Calendar,
      badge: appointmentsCount > 0 ? appointmentsCount : null,
    },
    {
      id: 'specialists',
      label: 'Specialists',
      mobileLabel: 'Doctors',
      icon: Stethoscope,
      badge: doctorsCount > 0 ? doctorsCount : null,
    },
  ];

  return (
    <>
      {/* Top Floating Navbar */}
      <header className="fixed top-3 sm:top-4 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-1.5rem)] max-w-5xl pointer-events-none">
        <div className="pointer-events-auto h-12 sm:h-14 px-2.5 sm:px-3.5 rounded-[10px] bg-[#0a0a0a]/90 backdrop-blur-md border border-[#262626] shadow-[0_12px_36px_rgba(0,0,0,0.75)] flex items-center justify-between gap-2">
          {/* Left: Brand Identity */}
          <button
            type="button"
            onClick={() => onSelectView('agent')}
            className="flex items-center gap-2 sm:gap-2.5 min-w-0 rounded-[6px] px-1.5 py-1 hover:bg-[#141414] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-white"
            title="ABC Health Care Home"
          >
            <img
              src="/favicon.svg"
              alt="ABC Health Care"
              width={24}
              height={24}
              className="w-5 h-5 sm:w-6 sm:h-6 object-contain shrink-0"
            />
            <span className="font-semibold text-xs sm:text-sm text-white tracking-tight whitespace-nowrap">
              <span className="sm:hidden">ABC Health</span>
              <span className="hidden sm:inline">ABC Health Care</span>
            </span>
          </button>

          {/* Center: Floating Segmented Switcher (Desktop & Tablet >= 768px) */}
          <nav
            aria-label="Primary navigation"
            className="hidden md:flex items-center gap-1 p-1 rounded-[8px] bg-[#000000] border border-[#1f1f1f]"
          >
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeView === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectView(item.id)}
                  className={`relative px-3 py-1.5 rounded-[6px] text-xs font-medium flex items-center gap-2 whitespace-nowrap cursor-pointer transition-colors focus-visible:outline-2 focus-visible:outline-white ${
                    isActive ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {isActive && (
                    <motion.span
                      layoutId="desktop-nav-pill"
                      transition={{ type: 'spring', stiffness: 460, damping: 36 }}
                      className="absolute inset-0 rounded-[6px] bg-[#171717] border border-[#303030]"
                    />
                  )}
                  <span className="relative z-10 flex items-center gap-1.5">
                    <Icon className="w-3.5 h-3.5 shrink-0" />
                    <span>{item.label}</span>
                    {item.badge !== null && (
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.2 rounded-[4px] tabular-nums ${
                          isActive
                            ? 'bg-[#262626] text-zinc-200'
                            : 'bg-[#121212] text-zinc-400'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </nav>

          {/* Right: Live Status, Sync & Call CTA */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <div
              className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] bg-[#111111] border border-[#222222] text-[11px] text-zinc-300 whitespace-nowrap"
              aria-live="polite"
            >
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  isConnected
                    ? isAgentSpeaking
                      ? 'bg-sky-400 animate-pulse'
                      : 'bg-emerald-500 animate-pulse'
                    : isConnecting
                    ? 'bg-amber-400 animate-pulse'
                    : 'bg-zinc-500'
                }`}
              />
              <span>
                {isConnected ? (isAgentSpeaking ? 'Speaking' : 'Live') : isConnecting ? 'Connecting' : 'Ready'}
              </span>
            </div>

            <button
              type="button"
              onClick={onRefresh}
              disabled={isRefreshing}
              title="Refresh schedule"
              aria-label="Refresh schedule"
              className="p-2 rounded-[6px] text-zinc-400 hover:text-white hover:bg-[#141414] border border-transparent hover:border-[#262626] transition-colors cursor-pointer shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-white' : ''}`} />
            </button>

            <button
              type="button"
              onClick={onToggleCall}
              disabled={isConnecting}
              className={`h-8 px-3 rounded-[6px] text-xs font-medium flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-all shrink-0 ${
                isConnected
                  ? 'bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/35'
                  : 'btn-white !py-0 !h-8 !px-3'
              }`}
            >
              {isConnecting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                  <span>Connecting</span>
                </>
              ) : isConnected ? (
                <>
                  <PhoneOff className="w-3.5 h-3.5 shrink-0" />
                  <span>End Call</span>
                </>
              ) : (
                <>
                  <Phone className="w-3.5 h-3.5 shrink-0" />
                  <span>Call Mia</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Floating Bottom Navbar (< 768px) for Calendar / Voice Agent / Specialists */}
      <nav
        aria-label="Mobile navigation"
        className="md:hidden fixed bottom-3 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-1.5rem)] max-w-md"
      >
        <div className="p-1 rounded-[10px] bg-[#0a0a0a]/95 backdrop-blur-md border border-[#262626] shadow-[0_14px_40px_rgba(0,0,0,0.9)] grid grid-cols-3 gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectView(item.id)}
                className={`relative h-10 px-1.5 rounded-[6px] text-[11px] sm:text-xs font-medium flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors ${
                  isActive ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {isActive && (
                  <motion.span
                    layoutId="mobile-nav-pill"
                    transition={{ type: 'spring', stiffness: 460, damping: 36 }}
                    className="absolute inset-0 rounded-[6px] bg-[#171717] border border-[#303030]"
                  />
                )}
                <span className="relative z-10 flex items-center gap-1.5">
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{item.mobileLabel}</span>
                  {item.badge !== null && (
                    <span
                      className={`hidden min-[360px]:inline-flex text-[10px] font-mono px-1 rounded-[4px] tabular-nums ${
                        isActive ? 'bg-[#262626] text-zinc-200' : 'bg-[#141414] text-zinc-400'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}
