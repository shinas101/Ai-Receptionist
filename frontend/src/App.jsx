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
      <main className="flex-1 min-h-0 p-2 sm:p-3 lg:p-4.5 pb-24 sm:pb-28 flex flex-col lg:flex-row gap-3 lg:gap-4 overflow-hidden relative">
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

      {/* Prominent Floating Dock Navbar (Built directly on website design system) */}
      <nav
        aria-label="Application dock navigation"
        className="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-40 bg-[#0a0a0e]/95 backdrop-blur-xl border border-[#262630] shadow-[0_20px_50px_rgba(0,0,0,0.95)] rounded-xl sm:rounded-2xl p-2 sm:p-2.5 flex items-center gap-1.5 sm:gap-2.5 max-w-[calc(100vw-1.5rem)] select-none"
      >
        {/* Dock Item 1: Mia AI Voice Receptionist */}
        <button
          onClick={() => setMobileTab('agent')}
          className={`px-3.5 sm:px-5 py-2.5 sm:py-3 rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold tracking-wide transition-all flex items-center gap-2 cursor-pointer ${
            mobileTab === 'agent'
              ? 'bg-[#181824] text-white border border-[#3b3b50] shadow-sm'
              : 'text-zinc-400 hover:text-white hover:bg-[#121218] border border-transparent'
          }`}
          title="Mia AI Voice Receptionist"
        >
          <Mic className={`w-4 h-4 sm:w-4.5 sm:h-4.5 shrink-0 ${isConnected ? 'text-emerald-400' : 'text-purple-400'}`} />
          <span>Mia AI</span>
          {isConnected && (
            <div className="flex items-center gap-1 ml-0.5">
              {livekit.isAgentSpeaking ? (
                <span className="flex items-end gap-0.5 h-3">
                  <span className="w-0.5 h-2 bg-emerald-400 animate-pulse" />
                  <span className="w-0.5 h-3.5 bg-emerald-400 animate-pulse delay-75" />
                  <span className="w-0.5 h-2 bg-emerald-400 animate-pulse delay-150" />
                </span>
              ) : (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              )}
            </div>
          )}
        </button>

        {/* Dock Item 2: Calendar */}
        <button
          onClick={() => {
            setMobileTab('calendar');
            setCalendarTab('calendar');
          }}
          className={`px-3.5 sm:px-5 py-2.5 sm:py-3 rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold tracking-wide transition-all flex items-center gap-2 cursor-pointer ${
            mobileTab === 'calendar' && calendarTab === 'calendar'
              ? 'bg-[#181824] text-white border border-[#3b3b50] shadow-sm'
              : 'text-zinc-400 hover:text-white hover:bg-[#121218] border border-transparent'
          }`}
          title="Clinical Calendar"
        >
          <Calendar className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-purple-400 shrink-0" />
          <span>Calendar</span>
          {appointments.length > 0 && (
            <span className="text-[11px] px-2 py-0.5 rounded font-mono bg-[#1c1c28] border border-[#2c2c3e] text-zinc-300">
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
          className={`px-3.5 sm:px-5 py-2.5 sm:py-3 rounded-lg sm:rounded-xl text-xs sm:text-sm font-semibold tracking-wide transition-all flex items-center gap-2 cursor-pointer ${
            mobileTab === 'calendar' && calendarTab === 'doctors'
              ? 'bg-[#181824] text-white border border-[#3b3b50] shadow-sm'
              : 'text-zinc-400 hover:text-white hover:bg-[#121218] border border-transparent'
          }`}
          title="Physicians & Specialists Directory"
        >
          <Stethoscope className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-purple-400 shrink-0" />
          <span className="hidden xs:inline">Specialists</span>
          <span className="text-[11px] px-2 py-0.5 rounded font-mono bg-[#1c1c28] border border-[#2c2c3e] text-zinc-300">
            {doctors.length}
          </span>
        </button>

        {/* Technical Border Divider */}
        <div className="w-px h-6 sm:h-7 bg-[#272732] mx-1 sm:mx-1.5" />

        {/* Dock Action Controls */}
        {!isConnected ? (
          <button
            onClick={handleToggleCall}
            className="px-4 sm:px-5 py-2.5 sm:py-3 rounded-lg sm:rounded-xl bg-white hover:bg-zinc-200 text-black font-semibold text-xs sm:text-sm tracking-wide transition-all flex items-center gap-2 shadow-md cursor-pointer shrink-0"
            title="Start Voice Consultation with Mia"
          >
            <Sparkles className="w-4 h-4 text-purple-600 shrink-0" />
            <span>Call Mia</span>
          </button>
        ) : (
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={livekit.toggleMute}
              className={`p-2.5 sm:p-3 rounded-lg sm:rounded-xl border text-xs sm:text-sm transition-colors cursor-pointer ${
                livekit.isMuted
                  ? 'bg-rose-950/80 border-rose-600 text-rose-300'
                  : 'bg-[#14141c] hover:bg-[#1c1c28] border-[#2a2a38] text-zinc-200'
              }`}
              title={livekit.isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
            >
              {livekit.isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4 text-emerald-400" />}
            </button>
            <button
              onClick={livekit.disconnect}
              className="px-3.5 sm:px-4 py-2.5 sm:py-3 rounded-lg sm:rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-xs sm:text-sm flex items-center gap-1.5 shadow-sm cursor-pointer"
              title="End Voice Consultation"
            >
              <PhoneOff className="w-4 h-4" />
              <span className="hidden sm:inline">End</span>
            </button>
          </div>
        )}
      </nav>
    </div>
  );
}
