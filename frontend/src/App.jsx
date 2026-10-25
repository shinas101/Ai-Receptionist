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
      <div className="flex-1 flex flex-col p-4 sm:p-6 lg:p-8 max-w-[1700px] w-full mx-auto space-y-6">
        {/* Dashboard Title & Overview Metrics (matches reference Image 3) */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">
            Dashboard
          </h1>
          <p className="text-sm text-zinc-400 mt-1 font-mono">
            Manage clinic appointments, patient records, and real-time voice consultations.
          </p>
        </div>

        {/* 3 Metric Cards matching reference UI Image 3 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-5 rounded-lg bg-[#0a0a0a] border border-[#222222] flex items-center justify-between">
            <div>
              <div className="text-xs font-mono uppercase text-zinc-400 font-semibold tracking-wider">
                TOTAL APPOINTMENTS
              </div>
              <div className="text-3xl font-bold text-white mt-2">
                {stats?.total ?? 0}
              </div>
            </div>
            <Calendar className="w-6 h-6 text-zinc-600" />
          </div>

          <div className="p-5 rounded-lg bg-[#0a0a0a] border border-[#222222] flex items-center justify-between">
            <div>
              <div className="text-xs font-mono uppercase text-zinc-400 font-semibold tracking-wider">
                TODAY'S VISITS
              </div>
              <div className="text-3xl font-bold text-white mt-2">
                {stats?.today ?? 0}
              </div>
            </div>
            <Clock className="w-6 h-6 text-zinc-600" />
          </div>

          <div className="p-5 rounded-lg bg-[#0a0a0a] border border-[#222222] flex items-center justify-between">
            <div>
              <div className="text-xs font-mono uppercase text-zinc-400 font-semibold tracking-wider">
                SCHEDULED
              </div>
              <div className="text-3xl font-bold text-white mt-2">
                {stats?.scheduled ?? 0}
              </div>
            </div>
            <CheckCircle className="w-6 h-6 text-zinc-600" />
          </div>
        </div>

        {/* Two-Panel Responsive Layout: Calendar on Left, AI Agent on Right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 rounded-xl border border-[#222222] bg-[#000000] overflow-hidden min-h-[680px]">
          {/* Left Panel: Live Calendar */}
          <section className="lg:col-span-7 xl:col-span-8 flex flex-col border-b lg:border-b-0 lg:border-r border-[#222222] min-h-[500px]">
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
          <aside className="lg:col-span-5 xl:col-span-4 flex flex-col bg-[#000000] min-h-[500px]">
            <AgentSidePanel livekit={livekit} />
          </aside>
        </div>
      </div>
    </div>
  );
}
