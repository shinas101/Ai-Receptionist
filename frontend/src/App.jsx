import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import LiveCalendar from './components/LiveCalendar';
import AgentSidePanel from './components/AgentSidePanel';
import { useLiveKit } from './hooks/useLiveKit';
import { api, FALLBACK_DOCTORS } from './services/api';
import { Calendar, Mic, MicOff, PhoneOff, Stethoscope, Sparkles } from 'lucide-react';

export default function App() {
  const livekit = useLiveKit();

  const [appointments, setAppointments] = useState([]);
  const [doctors, setDoctors] = useState(FALLBACK_DOCTORS);
  const [stats, setStats] = useState({
    total: 0,
    today: 0,
    scheduled: 0,
    confirmed: 0,
    completed: 0,
    cancelled: 0,
  });

  const [selectedDate, setSelectedDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Mobile navigation active tab: default to 'agent' (Mia AI Receptionist)
  const [mobileTab, setMobileTab] = useState('agent');
  // Controlled tab for LiveCalendar: 'calendar' | 'doctors'
  const [calendarTab, setCalendarTab] = useState('calendar');

  const loadDoctors = useCallback(async () => {
    try {
      const res = await api.getDoctors();
      if (res?.success && res.doctors?.length > 0) {
        setDoctors(res.doctors);
      }
    } catch {
      // Fallback
    }
  }, []);

  const refreshData = useCallback(async (showIndicator = false) => {
    if (showIndicator) setIsRefreshing(true);
    try {
      const apptsRes = await api.getAppointments({
        doctor_id: selectedDoctorId,
      });

      if (apptsRes?.success && Array.isArray(apptsRes.appointments)) {
        setAppointments(apptsRes.appointments);
      }

      const statsRes = await api.getStats();
      if (statsRes?.success && statsRes.stats) {
        setStats(statsRes.stats);
      }
    } catch (err) {
      console.warn('Sync note:', err.message);
    } finally {
      if (showIndicator) setIsRefreshing(false);
    }
  }, [selectedDoctorId]);

  useEffect(() => {
    loadDoctors();
    refreshData(true);
  }, [loadDoctors, refreshData]);

  // Periodic polling for live updates
  useEffect(() => {
    const timer = setInterval(() => {
      refreshData(false);
    }, 3000);
    return () => clearInterval(timer);
  }, [refreshData]);

  const isConnected = livekit.connectionState === 'connected';

  const handleToggleCall = () => {
    if (isConnected) {
      livekit.disconnect();
    } else {
      livekit.connect();
      // On mobile, automatically show the Mia console when starting a call
      setMobileTab('agent');
    }
  };

  return (
    <div className="h-[100dvh] w-screen flex flex-col bg-[#000000] text-white overflow-hidden select-none relative">
      {/* Sleek Minimalist Header with Live Metrics */}
      <Header
        stats={stats}
        onRefresh={() => refreshData(true)}
        isRefreshing={isRefreshing}
        isConnected={isConnected}
        onToggleCall={handleToggleCall}
      />

      {/* Main Single-Window Workspace: Mobile full view per tab, Desktop side-by-side */}
      <main className="flex-1 min-h-0 p-2 sm:p-3 lg:p-4.5 pb-28 sm:pb-34 flex flex-col lg:flex-row gap-3 lg:gap-4 overflow-hidden relative">
        {/* Left Panel: Live Calendar & Specialists (Full view on mobile when active, side-by-side on lg) */}
        <section
          className={`flex-1 min-h-0 flex flex-col h-full rounded-xl sm:rounded-2xl border border-[#222228] bg-[#000000] overflow-hidden shadow-2xl ${
            mobileTab === 'calendar' ? 'flex' : 'hidden lg:flex'
          }`}
        >
          <LiveCalendar
            appointments={appointments}
            doctors={doctors}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            selectedDoctorId={selectedDoctorId}
            onChangeDoctor={setSelectedDoctorId}
            activeTab={calendarTab}
            onTabChange={setCalendarTab}
          />
        </section>

        {/* Right Panel: Mia Voice AI Receptionist (Full view on mobile when active, side-by-side on lg) */}
        <aside
          className={`w-full lg:w-[380px] xl:w-[410px] shrink-0 flex flex-col h-full rounded-xl sm:rounded-2xl border border-[#222228] bg-[#000000] overflow-hidden shadow-2xl ${
            mobileTab === 'agent' ? 'flex' : 'hidden lg:flex'
          }`}
        >
          <AgentSidePanel livekit={livekit} />
        </aside>
      </main>

      {/* Hallmark Precision Floating Dock (Architectural, spacious, thumb-first on mobile, grand on desktop) */}
      <nav
        aria-label="Application dock navigation"
        className="fixed bottom-4 sm:bottom-7 left-1/2 -translate-x-1/2 z-40 bg-[#0d0d12]/95 backdrop-blur-2xl border border-[#282838] shadow-[0_24px_60px_-10px_rgba(0,0,0,0.95),inset_0_1px_0_rgba(255,255,255,0.09)] rounded-2xl p-2 sm:p-2.5 flex items-center justify-center gap-1.5 sm:gap-3 max-w-[96vw] select-none"
      >
        {/* Dock Item 1: Mia AI Voice Receptionist */}
        <button
          onClick={() => setMobileTab('agent')}
          className={`px-3 sm:px-6 py-2 sm:py-3.5 rounded-xl text-xs sm:text-base font-semibold tracking-wide transition-all flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2.5 cursor-pointer min-w-[68px] sm:min-w-0 active:scale-[0.97] ${
            mobileTab === 'agent'
              ? 'bg-[#1e1e2c] text-white border border-[#404058] shadow-md'
              : 'text-zinc-400 hover:text-white hover:bg-[#14141e] border border-transparent'
          }`}
          title="Mia AI Voice Receptionist"
        >
          <div className="relative flex items-center justify-center">
            <Mic className={`w-5 h-5 shrink-0 ${isConnected ? 'text-emerald-400' : 'text-purple-400'}`} />
            {isConnected && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-[#0d0d12] animate-pulse" />
            )}
          </div>
          <span>Mia AI</span>
          {isConnected && livekit.isAgentSpeaking && (
            <span className="hidden sm:flex items-end gap-0.5 h-3.5 ml-0.5">
              <span className="w-0.5 h-2 bg-emerald-400 animate-pulse" />
              <span className="w-0.5 h-3.5 bg-emerald-400 animate-pulse delay-75" />
              <span className="w-0.5 h-2 bg-emerald-400 animate-pulse delay-150" />
            </span>
          )}
        </button>

        {/* Dock Item 2: Calendar */}
        <button
          onClick={() => {
            setMobileTab('calendar');
            setCalendarTab('calendar');
          }}
          className={`px-3 sm:px-6 py-2 sm:py-3.5 rounded-xl text-xs sm:text-base font-semibold tracking-wide transition-all flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2.5 cursor-pointer min-w-[68px] sm:min-w-0 active:scale-[0.97] ${
            mobileTab === 'calendar' && calendarTab === 'calendar'
              ? 'bg-[#1e1e2c] text-white border border-[#404058] shadow-md'
              : 'text-zinc-400 hover:text-white hover:bg-[#14141e] border border-transparent'
          }`}
          title="Clinical Calendar"
        >
          <div className="relative flex items-center justify-center">
            <Calendar className="w-5 h-5 text-purple-400 shrink-0" />
            {appointments.length > 0 && (
              <span className="sm:hidden absolute -top-1.5 -right-2 text-[9px] px-1 py-0.2 rounded-full font-mono font-bold bg-purple-600 text-white leading-none">
                {appointments.length}
              </span>
            )}
          </div>
          <span>Calendar</span>
          {appointments.length > 0 && (
            <span className="hidden sm:inline-block text-xs px-2.5 py-0.5 rounded-md font-mono font-medium bg-[#1c1c28] border border-[#303042] text-zinc-300">
              {appointments.length}
            </span>
          )}
        </button>

        {/* Dock Item 3: Specialists */}
        <button
          onClick={() => {
            setMobileTab('calendar');
            setCalendarTab('doctors');
          }}
          className={`px-3 sm:px-6 py-2 sm:py-3.5 rounded-xl text-xs sm:text-base font-semibold tracking-wide transition-all flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2.5 cursor-pointer min-w-[68px] sm:min-w-0 active:scale-[0.97] ${
            mobileTab === 'calendar' && calendarTab === 'doctors'
              ? 'bg-[#1e1e2c] text-white border border-[#404058] shadow-md'
              : 'text-zinc-400 hover:text-white hover:bg-[#14141e] border border-transparent'
          }`}
          title="Physicians & Specialists Directory"
        >
          <div className="relative flex items-center justify-center">
            <Stethoscope className="w-5 h-5 text-purple-400 shrink-0" />
            <span className="sm:hidden absolute -top-1.5 -right-2 text-[9px] px-1 py-0.2 rounded-full font-mono font-bold bg-[#2a2a3c] text-zinc-300 leading-none">
              {doctors.length}
            </span>
          </div>
          <span>Specialists</span>
          <span className="hidden sm:inline-block text-xs px-2.5 py-0.5 rounded-md font-mono font-medium bg-[#1c1c28] border border-[#303042] text-zinc-300">
            {doctors.length}
          </span>
        </button>

        {/* Architectural Vertical Separator */}
        <div className="w-px h-8 sm:h-9 bg-[#282838] mx-0.5 sm:mx-1.5" />

        {/* Dock Action Controls */}
        {!isConnected ? (
          <button
            onClick={handleToggleCall}
            className="px-3.5 sm:px-7 py-2 sm:py-3.5 rounded-xl bg-white hover:bg-zinc-100 text-black font-bold text-xs sm:text-base tracking-wide transition-all flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2.5 shadow-lg active:scale-95 cursor-pointer shrink-0"
            title="Start Voice Consultation with Mia"
          >
            <Sparkles className="w-5 h-5 text-purple-600 shrink-0" />
            <span>Call Mia</span>
          </button>
        ) : (
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <button
              onClick={livekit.toggleMute}
              className={`p-2.5 sm:p-3.5 rounded-xl border text-xs sm:text-base transition-colors cursor-pointer active:scale-95 ${
                livekit.isMuted
                  ? 'bg-rose-950/80 border-rose-600 text-rose-300'
                  : 'bg-[#14141e] hover:bg-[#1e1e2c] border-[#2e2e40] text-zinc-200'
              }`}
              title={livekit.isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
            >
              {livekit.isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5 text-emerald-400" />}
            </button>
            <button
              onClick={livekit.disconnect}
              className="px-3 sm:px-5 py-2.5 sm:py-3.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs sm:text-base flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
              title="End Voice Consultation"
            >
              <PhoneOff className="w-4 h-4 sm:w-5 sm:h-5" />
              <span>End</span>
            </button>
          </div>
        )}
      </nav>
    </div>
  );
}
