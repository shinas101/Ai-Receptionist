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
    <div className="h-[100dvh] w-screen flex flex-col bg-[#000000] text-white overflow-hidden select-none">
      {/* Sleek Minimalist Header with Live Metrics */}
      <Header
        stats={stats}
        onRefresh={() => refreshData(true)}
        isRefreshing={isRefreshing}
        isConnected={isConnected}
        onToggleCall={handleToggleCall}
      />

      {/* Mobile-First Segmented Navigation Bar (Visible only on < lg screens) */}
      <div className="lg:hidden shrink-0 px-2.5 py-1.5 bg-[#08080a] border-b border-[#1c1c22] flex items-center gap-2 z-20">
        <button
          onClick={() => setMobileTab('calendar')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold tracking-wide transition-all flex items-center justify-center gap-2 ${
            mobileTab === 'calendar'
              ? 'bg-[#181824] text-white border border-[#343446] shadow-sm'
              : 'text-zinc-400 hover:text-white bg-[#0e0e12] border border-transparent'
          }`}
        >
          <Calendar className="w-3.5 h-3.5 text-purple-400" />
          <span>Calendar</span>
          {appointments.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.2 rounded font-mono bg-[#22222e] text-zinc-300">
              {appointments.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setMobileTab('agent')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-semibold tracking-wide transition-all flex items-center justify-center gap-2 relative ${
            mobileTab === 'agent'
              ? 'bg-[#181824] text-white border border-[#343446] shadow-sm'
              : 'text-zinc-400 hover:text-white bg-[#0e0e12] border border-transparent'
          }`}
        >
          <Mic className={`w-3.5 h-3.5 ${isConnected ? 'text-emerald-400' : 'text-zinc-400'}`} />
          <span>Mia Receptionist</span>
          {isConnected && (
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          )}
        </button>
      </div>

      {/* Main Single-Window Workspace: Mobile full view per tab, Desktop side-by-side */}
      <main className="flex-1 min-h-0 p-2 sm:p-3 lg:p-4.5 flex flex-col lg:flex-row gap-3 lg:gap-4 overflow-hidden relative">
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

        {/* Floating Mini-Call Controller on Mobile when user browses Calendar while in active consultation */}
        {mobileTab === 'calendar' && isConnected && (
          <div className="lg:hidden absolute bottom-3 left-3 right-3 z-30 p-2.5 rounded-xl bg-[#0c0c14]/95 border border-purple-500/40 backdrop-blur-md shadow-[0_4px_30px_rgba(0,0,0,0.9)] flex items-center justify-between gap-3 animate-in slide-in-from-bottom duration-200">
            <div
              onClick={() => setMobileTab('agent')}
              className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
            >
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate flex items-center gap-1.5">
                  <span>Mia Active Call</span>
                  {livekit.isAgentSpeaking && (
                    <span className="text-[10px] font-mono font-normal text-purple-300">· Speaking</span>
                  )}
                </p>
                <p className="text-[10px] text-zinc-400 font-mono truncate">
                  Tap to view dialogue & visualizer →
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={livekit.toggleMute}
                className={`p-2 rounded-lg border text-xs font-mono transition-colors ${
                  livekit.isMuted
                    ? 'bg-rose-950/80 border-rose-600 text-rose-300'
                    : 'bg-zinc-800 border-zinc-700 text-zinc-200'
                }`}
                title={livekit.isMuted ? 'Unmute Mic' : 'Mute Mic'}
              >
                {livekit.isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => setMobileTab('agent')}
                className="px-2.5 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold"
              >
                Open
              </button>
              <button
                onClick={livekit.disconnect}
                className="p-2 rounded-lg bg-red-600 hover:bg-red-500 text-white"
                title="End Call"
              >
                <PhoneOff className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
