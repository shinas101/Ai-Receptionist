import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import LiveCalendar from './components/LiveCalendar';
import AgentSidePanel from './components/AgentSidePanel';
import { useLiveKit } from './hooks/useLiveKit';
import { api, FALLBACK_DOCTORS } from './services/api';

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
    <div className="h-screen w-screen flex flex-col bg-[#000000] text-white overflow-hidden select-none">
      {/* Sleek Minimalist Header with Live Metrics */}
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

      {/* Main Single-Window Workspace (Zero Window Scrolling) */}
      <main className="flex-1 min-h-0 p-2.5 sm:p-3 lg:p-4 flex flex-col lg:flex-row gap-3 overflow-hidden">
        {/* Left Primary Panel: Live Calendar & Specialists Directory */}
        <section className="flex-1 min-h-0 flex flex-col h-full rounded-xl border border-[#222224] bg-[#000000] overflow-hidden shadow-2xl">
          <LiveCalendar
            appointments={appointments}
            doctors={doctors}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
            selectedDoctorId={selectedDoctorId}
            onChangeDoctor={setSelectedDoctorId}
          />
        </section>

        {/* Right Secondary Panel: Mia Voice AI Receptionist */}
        <aside className="w-full lg:w-[380px] xl:w-[410px] shrink-0 flex flex-col h-full rounded-xl border border-[#222224] bg-[#000000] overflow-hidden shadow-2xl">
          <AgentSidePanel livekit={livekit} />
        </aside>
      </main>
    </div>
  );
}
