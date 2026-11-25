import React, { useState, useEffect, useCallback } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'motion/react';
import FloatingNavbar from './components/FloatingNavbar';
import VoiceAgentHome from './components/VoiceAgentHome';
import LiveCalendar from './components/LiveCalendar';
import SpecialistsView from './components/SpecialistsView';
import { useLiveKit } from './hooks/useLiveKit';
import { api, FALLBACK_DOCTORS } from './services/api';

function getLocalTodayKey() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function App() {
  const livekit = useLiveKit();

  // Home page defaults to the AI Voice Agent ('agent')
  const [activeView, setActiveView] = useState('agent');
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

  const [selectedDate, setSelectedDate] = useState(getLocalTodayKey);
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [externalPrompt, setExternalPrompt] = useState(null);

  const loadDoctors = useCallback(async () => {
    try {
      const res = await api.getDoctors();
      if (res?.success && res.doctors?.length > 0) {
        setDoctors(res.doctors);
      }
    } catch {
      // Uses FALLBACK_DOCTORS when backend is offline
    }
  }, []);

  const refreshData = useCallback(
    async (showIndicator = false) => {
      if (showIndicator) setIsRefreshing(true);
      try {
        const [apptsRes, statsRes] = await Promise.all([
          api.getAppointments({ doctor_id: selectedDoctorId }),
          api.getStats(),
        ]);

        if (apptsRes?.success && Array.isArray(apptsRes.appointments)) {
          setAppointments(apptsRes.appointments);
        }
        if (statsRes?.success && statsRes.stats) {
          setStats(statsRes.stats);
        }
      } catch (err) {
        console.warn('Sync note:', err.message);
      } finally {
        if (showIndicator) setIsRefreshing(false);
      }
    },
    [selectedDoctorId]
  );

  useEffect(() => {
    let active = true;
    const init = async () => {
      if (!active) return;
      await Promise.all([loadDoctors(), refreshData(false)]);
    };
    void init();
    return () => {
      active = false;
    };
  }, [loadDoctors, refreshData]);

  // Periodic polling for live appointment updates
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
      setActiveView('agent');
    }
  };

  const handleSelectDoctorForCalendar = (doctorId) => {
    setSelectedDoctorId(doctorId);
    setActiveView('calendar');
  };

  const handleAskMiaAboutDoctor = (doc) => {
    setExternalPrompt(`What consultation slots does ${doc.name} have available?`);
    setActiveView('agent');
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-[100dvh] lg:h-[100dvh] w-full flex flex-col bg-[#000000] text-[#ededed] lg:overflow-hidden relative">
        {/* Floating Navbar (Top on Tablet/Desktop, Top Bar + Bottom Floating Dock on Mobile) */}
        <FloatingNavbar
          activeView={activeView}
          onSelectView={setActiveView}
          appointmentsCount={appointments.length}
          doctorsCount={doctors.length}
          connectionState={livekit.connectionState}
          isAgentSpeaking={livekit.isAgentSpeaking}
          isRefreshing={isRefreshing}
          onRefresh={() => refreshData(true)}
          onToggleCall={handleToggleCall}
        />

        {/* Main Workspace padded cleanly clear of floating navbar */}
        <main className="flex-1 min-h-0 w-full px-3 sm:px-6 pt-[72px] sm:pt-[84px] pb-[76px] md:pb-6 flex flex-col lg:overflow-hidden">
          <AnimatePresence mode="wait" initial={false}>
            {activeView === 'agent' && (
              <motion.div
                key="view-agent"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                className="flex-1 min-h-0 flex flex-col"
              >
                <VoiceAgentHome
                  livekit={livekit}
                  stats={stats}
                  onOpenCalendar={() => setActiveView('calendar')}
                  externalPrompt={externalPrompt}
                  onConsumeExternalPrompt={() => setExternalPrompt(null)}
                />
              </motion.div>
            )}

            {activeView === 'calendar' && (
              <motion.div
                key="view-calendar"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                className="flex-1 min-h-0 flex flex-col"
              >
                <LiveCalendar
                  appointments={appointments}
                  doctors={doctors}
                  stats={stats}
                  selectedDate={selectedDate}
                  onSelectDate={setSelectedDate}
                  selectedDoctorId={selectedDoctorId}
                  onChangeDoctor={setSelectedDoctorId}
                  onRefresh={() => refreshData(true)}
                />
              </motion.div>
            )}

            {activeView === 'specialists' && (
              <motion.div
                key="view-specialists"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                className="flex-1 min-h-0 flex flex-col lg:overflow-y-auto"
              >
                <SpecialistsView
                  doctors={doctors}
                  appointments={appointments}
                  selectedDoctorId={selectedDoctorId}
                  onSelectDoctorForCalendar={handleSelectDoctorForCalendar}
                  onAskMiaAboutDoctor={handleAskMiaAboutDoctor}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
    </MotionConfig>
  );
}
