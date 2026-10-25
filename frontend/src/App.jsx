import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import LiveCalendar from './components/LiveCalendar';
import AgentSidePanel from './components/AgentSidePanel';
import { useLiveKit } from './hooks/useLiveKit';
import { api, FALLBACK_DOCTORS } from './services/api';
import { Calendar, Users, CheckCircle, Clock } from 'lucide-react';

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

  return (
    <div className="flex flex-col min-h-screen bg-[#000000] text-white">
      {/* Reference UI Header */}
      <Header
        stats={stats}
        onRefresh={() => refreshData(true)}
        isRefreshing={isRefreshing}
        isConnected={livekit.connectionState === 'connected'}
        onToggleCall={() => {
          if (livekit.connectionState === 'connected') {
            livekit.disconnect();
          } else {
            livekit.connect();
          }
        }}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col p-6 sm:p-8 lg:p-10 xl:p-12 max-w-[1800px] w-full mx-auto space-y-8">
        {/* Dashboard Title */}
        <div className="flex items-center justify-between">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
            Dashboard
          </h1>
        </div>

        {/* 3 Metric Cards with generous padding and subtle tactile borders */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="p-6 sm:p-7 rounded-2xl bg-[#0a0a0a] border border-[#262626] flex items-center justify-between shadow-md hover:border-[#383838] transition-colors">
            <div>
              <div className="text-xs font-mono uppercase text-zinc-400 font-semibold tracking-wider">
                TOTAL APPOINTMENTS
              </div>
              <div className="text-3xl sm:text-4xl font-bold text-white mt-2.5 tabular-nums">
                {stats?.total ?? 0}
              </div>
            </div>
            <div className="w-12 h-12 rounded-xl bg-[#141414] border border-[#262626] flex items-center justify-center">
              <Calendar className="w-6 h-6 text-zinc-400" />
            </div>
          </div>

          <div className="p-6 sm:p-7 rounded-2xl bg-[#0a0a0a] border border-[#262626] flex items-center justify-between shadow-md hover:border-[#383838] transition-colors">
            <div>
              <div className="text-xs font-mono uppercase text-zinc-400 font-semibold tracking-wider">
                TODAY'S VISITS
              </div>
              <div className="text-3xl sm:text-4xl font-bold text-white mt-2.5 tabular-nums">
                {stats?.today ?? 0}
              </div>
            </div>
            <div className="w-12 h-12 rounded-xl bg-[#141414] border border-[#262626] flex items-center justify-center">
              <Clock className="w-6 h-6 text-zinc-400" />
            </div>
          </div>

          <div className="p-6 sm:p-7 rounded-2xl bg-[#0a0a0a] border border-[#262626] flex items-center justify-between shadow-md hover:border-[#383838] transition-colors">
            <div>
              <div className="text-xs font-mono uppercase text-zinc-400 font-semibold tracking-wider">
                SCHEDULED
              </div>
              <div className="text-3xl sm:text-4xl font-bold text-white mt-2.5 tabular-nums">
                {stats?.scheduled ?? 0}
              </div>
            </div>
            <div className="w-12 h-12 rounded-xl bg-[#141414] border border-[#262626] flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-emerald-400" />
            </div>
          </div>
        </div>

        {/* Two-Panel Responsive Layout: Calendar on Left, AI Agent on Right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 rounded-2xl border border-[#27272a] bg-[#000000] overflow-hidden min-h-[720px] shadow-2xl">
          {/* Left Panel: Live Calendar */}
          <section className="lg:col-span-7 xl:col-span-8 flex flex-col border-b lg:border-b-0 lg:border-r border-[#242424] min-h-[540px]">
            <LiveCalendar
              appointments={appointments}
              doctors={doctors}
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              selectedDoctorId={selectedDoctorId}
              onChangeDoctor={setSelectedDoctorId}
            />
          </section>

          {/* Right Panel: AI Voice Agent */}
          <aside className="lg:col-span-5 xl:col-span-4 flex flex-col bg-[#000000] min-h-[540px]">
            <AgentSidePanel livekit={livekit} />
          </aside>
        </div>
      </div>
    </div>
  );
}
