import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import LiveCalendar from './components/LiveCalendar';
import AgentSidePanel from './components/AgentSidePanel';
import { useLiveKit } from './hooks/useLiveKit';
import { api, FALLBACK_DOCTORS } from './services/api';
import { Calendar, Mic, MicOff, PhoneOff, Stethoscope } from 'lucide-react';

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

  // Mobile navigation active tab: 'calendar' | 'agent'
  const [mobileTab, setMobileTab] = useState('calendar');
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
      <main className="flex-1 min-h-0 p-2 sm:p-3 lg:p-4.5 pb-20 sm:pb-22 lg:pb-20 flex flex-col lg:flex-row gap-3 lg:gap-4 overflow-hidden relative">
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

      {/* Small Floating Dock (Bottom Navbar) */}
      <nav
        aria-label="Floating dock navigation"
        className="fixed bottom-3 sm:bottom-4 left-1/2 -translate-x-1/2 z-40 bg-[#09090f]/90 backdrop-blur-2xl border border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.9),0_0_24px_rgba(168,85,247,0.18)] rounded-2xl p-1.5 flex items-center gap-1 sm:gap-1.5 max-w-[95vw] select-none"
      >
        {/* Dock Item 1: Calendar */}
        <button
          onClick={() => {
            setMobileTab('calendar');
            setCalendarTab('calendar');
          }}
          className={`px-3 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all flex items-center gap-1.5 sm:gap-2 cursor-pointer ${
            mobileTab === 'calendar' && calendarTab === 'calendar'
              ? 'bg-[#181826] text-white border border-[#3b3b52] shadow-sm'
              : 'text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent'
          }`}
          title="Clinical Calendar"
        >
          <Calendar className="w-4 h-4 text-purple-400 shrink-0" />
          <span className="hidden xs:inline">Calendar</span>
          {appointments.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.2 rounded font-mono bg-[#222230] text-zinc-300">
              {appointments.length}
            </span>
          )}
        </button>

        {/* Dock Item 2: Specialists */}
        <button
          onClick={() => {
            setMobileTab('calendar');
            setCalendarTab('doctors');
          }}
          className={`px-3 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all flex items-center gap-1.5 sm:gap-2 cursor-pointer ${
            mobileTab === 'calendar' && calendarTab === 'doctors'
              ? 'bg-[#181826] text-white border border-[#3b3b52] shadow-sm'
              : 'text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent'
          }`}
          title="Physicians Directory"
        >
          <Stethoscope className="w-4 h-4 text-purple-400 shrink-0" />
          <span className="hidden xs:inline">Specialists</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded font-mono bg-[#222230] text-zinc-300">
            {doctors.length}
          </span>
        </button>

        {/* Dock Item 3: Mia Voice AI */}
        <button
          onClick={() => setMobileTab('agent')}
          className={`px-3 py-2 rounded-xl text-xs font-semibold tracking-wide transition-all flex items-center gap-1.5 sm:gap-2 cursor-pointer relative ${
            mobileTab === 'agent'
              ? 'bg-[#181826] text-white border border-[#3b3b52] shadow-sm'
              : 'text-zinc-400 hover:text-white hover:bg-white/5 border border-transparent'
          }`}
          title="Mia AI Voice Receptionist"
        >
          <Mic className={`w-4 h-4 shrink-0 ${isConnected ? 'text-emerald-400' : 'text-purple-400'}`} />
          <span className="hidden xs:inline">Mia AI</span>
          {isConnected && (
            <div className="flex items-center gap-1">
              {livekit.isAgentSpeaking ? (
                <span className="flex items-end gap-0.5 h-3">
                  <span className="w-0.5 h-1.5 bg-emerald-400 animate-pulse" />
                  <span className="w-0.5 h-3 bg-emerald-400 animate-pulse delay-75" />
                  <span className="w-0.5 h-2 bg-emerald-400 animate-pulse delay-150" />
                </span>
              ) : (
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              )}
            </div>
          )}
        </button>

        {/* Divider */}
        <div className="w-px h-5 bg-white/15 mx-0.5 sm:mx-1" />

        {/* Dock Item 4: Call Action Controls */}
        {!isConnected ? (
          <button
            onClick={handleToggleCall}
            className="px-3 py-2 rounded-xl bg-white hover:bg-zinc-200 text-black font-semibold text-xs tracking-wide transition-all flex items-center gap-1.5 shadow-md cursor-pointer shrink-0"
            title="Start Consultation with Mia"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-600 shrink-0" />
            <span>Call Mia</span>
          </button>
        ) : (
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={livekit.toggleMute}
              className={`p-2 rounded-xl border text-xs transition-colors cursor-pointer ${
                livekit.isMuted
                  ? 'bg-rose-950/80 border-rose-600 text-rose-300'
                  : 'bg-zinc-800 hover:bg-zinc-700 border-zinc-700 text-zinc-200'
              }`}
              title={livekit.isMuted ? 'Unmute Microphone' : 'Mute Microphone'}
            >
              {livekit.isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5 text-emerald-400" />}
            </button>
            <button
              onClick={livekit.disconnect}
              className="px-2.5 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-xs flex items-center gap-1 shadow-sm cursor-pointer"
              title="End Consultation"
            >
              <PhoneOff className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">End</span>
            </button>
          </div>
        )}
      </nav>
    </div>
  );
}
