import React, { useState, useMemo, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  User,
  Calendar as CalendarIcon,
  X,
  Stethoscope,
  Phone,
  FileText,
  CalendarCheck,
  MapPin,
  Plus,
  Check,
  Trash2,
  Loader2,
  ArrowUpRight,
} from 'lucide-react';
import { api } from '../services/api';

function toLocalDateKey(dateObj) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseLocalDate(dateStr) {
  if (!dateStr) return new Date();
  const parts = String(dateStr).slice(0, 10).split('-').map(Number);
  if (parts.length === 3 && !parts.some(Number.isNaN)) {
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }
  return new Date();
}

function shiftDateStr(dateStr, deltaDays) {
  const d = parseLocalDate(dateStr);
  d.setDate(d.getDate() + deltaDays);
  return toLocalDateKey(d);
}

const STATUS_STYLES = {
  confirmed: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  scheduled: 'bg-sky-500/10 text-sky-300 border-sky-500/30',
  completed: 'bg-zinc-500/15 text-zinc-300 border-zinc-500/30',
  cancelled: 'bg-red-500/10 text-red-300 border-red-500/30',
};

export default function LiveCalendar({
  appointments = [],
  doctors = [],
  stats,
  selectedDate,
  onSelectDate,
  selectedDoctorId,
  onChangeDoctor,
  onRefresh,
}) {
  const [currentMonthDate, setCurrentMonthDate] = useState(() => parseLocalDate(selectedDate));
  const [lastSyncedDate, setLastSyncedDate] = useState(selectedDate);
  const [inspectedAppointment, setInspectedAppointment] = useState(null);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState(null);

  const [todayStr] = useState(() => toLocalDateKey(new Date()));

  // Booking form state
  const [bookingForm, setBookingForm] = useState(() => ({
    patient_name: '',
    patient_phone: '',
    doctor_id: '',
    date: selectedDate || toLocalDateKey(new Date()),
    time: '10:00',
    reason: '',
  }));
  const [bookingSubmitting, setBookingSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState('');

  // Sync month view cleanly if selectedDate changed externally
  if (selectedDate && selectedDate !== lastSyncedDate) {
    setLastSyncedDate(selectedDate);
    const d = parseLocalDate(selectedDate);
    if (
      d.getFullYear() !== currentMonthDate.getFullYear() ||
      d.getMonth() !== currentMonthDate.getMonth()
    ) {
      setCurrentMonthDate(new Date(d.getFullYear(), d.getMonth(), 1));
    }
  }

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (inspectedAppointment) setInspectedAppointment(null);
        if (showBookingModal) setShowBookingModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [inspectedAppointment, showBookingModal]);

  const monthData = useMemo(() => {
    const year = currentMonthDate.getFullYear();
    const month = currentMonthDate.getMonth();
    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const days = [];
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const dt = new Date(year, month - 1, d);
      days.push({ dayNumber: d, dateStr: toLocalDateKey(dt), isCurrentMonth: false });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(year, month, d);
      days.push({ dayNumber: d, dateStr: toLocalDateKey(dt), isCurrentMonth: true });
    }
    const remaining = (7 - (days.length % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
      const dt = new Date(year, month + 1, d);
      days.push({ dayNumber: d, dateStr: toLocalDateKey(dt), isCurrentMonth: false });
    }
    return days;
  }, [currentMonthDate]);

  const appointmentsByDate = useMemo(() => {
    const map = {};
    appointments.forEach((apt) => {
      if (!apt.start_time) return;
      const key = String(apt.start_time).slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(apt);
    });
    Object.values(map).forEach((list) => {
      list.sort((a, b) => String(a.start_time).localeCompare(String(b.start_time)));
    });
    return map;
  }, [appointments]);

  const activeDate = selectedDate || todayStr;
  const dayAppointments = appointmentsByDate[activeDate] || [];
  const monthLabel = currentMonthDate.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  const getRelativeTag = (dateStr) => {
    if (dateStr === todayStr) return 'Today';
    if (dateStr === shiftDateStr(todayStr, 1)) return 'Tomorrow';
    if (dateStr === shiftDateStr(todayStr, -1)) return 'Yesterday';
    return null;
  };

  const formatAgendaHeader = (dateStr) => {
    const d = parseLocalDate(dateStr);
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatTime = (iso) => {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const openNewBooking = (dateOverride) => {
    setBookingError('');
    setBookingForm({
      patient_name: '',
      patient_phone: '',
      doctor_id: selectedDoctorId || doctors[0]?.id || '',
      date: dateOverride || activeDate,
      time: '10:00',
      reason: '',
    });
    setShowBookingModal(true);
  };

  const handleCreateBooking = async (e) => {
    e.preventDefault();
    if (!bookingForm.patient_name.trim() || !bookingForm.patient_phone.trim()) {
      setBookingError('Patient name and phone number are required.');
      return;
    }
    if (!bookingForm.doctor_id) {
      setBookingError('Please select a specialist.');
      return;
    }

    setBookingSubmitting(true);
    setBookingError('');
    try {
      const res = await api.createAppointment({
        patient_name: bookingForm.patient_name.trim(),
        patient_phone: bookingForm.patient_phone.trim(),
        doctor_id: bookingForm.doctor_id,
        start_time: `${bookingForm.date}T${bookingForm.time}:00`,
        duration_minutes: 30,
        reason: bookingForm.reason.trim() || 'General consultation',
        status: 'scheduled',
      });
      if (res?.success === false) {
        throw new Error(res.error || 'Could not create booking');
      }
      onSelectDate(bookingForm.date);
      setShowBookingModal(false);
      await onRefresh?.();
    } catch (err) {
      setBookingError(err.message || 'Unable to save booking');
    } finally {
      setBookingSubmitting(false);
    }
  };

  const handleStatusChange = async (apptId, newStatus) => {
    setActionLoadingId(apptId);
    try {
      await api.updateAppointment(apptId, { status: newStatus });
      if (inspectedAppointment?.id === apptId) {
        setInspectedAppointment((prev) => (prev ? { ...prev, status: newStatus } : null));
      }
      await onRefresh?.();
    } catch (err) {
      console.warn('Update status note:', err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeleteAppointment = async (apptId) => {
    setActionLoadingId(apptId);
    try {
      await api.deleteAppointment(apptId);
      if (inspectedAppointment?.id === apptId) {
        setInspectedAppointment(null);
      }
      await onRefresh?.();
    } catch (err) {
      console.warn('Delete note:', err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto flex-1 flex flex-col gap-3 sm:gap-4 min-h-0">
      {/* Calendar Toolbar */}
      <section className="v-card p-3 sm:p-4 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-[6px] bg-[#141414] border border-[#262626] flex items-center justify-center shrink-0">
            <CalendarIcon className="w-4 h-4 text-zinc-200" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-semibold text-white tracking-tight truncate">
                Clinical Calendar
              </h1>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-[4px] bg-[#141414] border border-[#262626] text-[10px] font-mono text-zinc-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>Sync</span>
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 hidden sm:block">
              Select a date to inspect or manage clinic consultations
            </p>
          </div>

          {/* Compact Stats on Desktop */}
          <div className="hidden xl:flex items-center gap-1.5 ml-3 pl-3 border-l border-[#222222] text-[11px] font-mono">
            <span className="px-2 py-1 rounded-[6px] bg-[#111111] border border-[#222222] text-zinc-400">
              Today <strong className="text-white ml-1 tabular-nums">{stats?.today ?? 0}</strong>
            </span>
            <span className="px-2 py-1 rounded-[6px] bg-[#111111] border border-[#222222] text-zinc-400">
              Scheduled <strong className="text-sky-300 ml-1 tabular-nums">{stats?.scheduled ?? 0}</strong>
            </span>
            <span className="px-2 py-1 rounded-[6px] bg-[#111111] border border-[#222222] text-zinc-400">
              Confirmed <strong className="text-emerald-300 ml-1 tabular-nums">{stats?.confirmed ?? 0}</strong>
            </span>
          </div>
        </div>

        {/* Right Controls */}
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <select
            value={selectedDoctorId}
            onChange={(e) => onChangeDoctor(e.target.value)}
            aria-label="Filter by specialist"
            className="v-input !w-auto min-w-[140px] max-w-[190px] !py-1.5 !text-xs bg-[#111111]"
          >
            <option value="">
              All Specialists{stats?.total ? ` (${stats.total})` : !selectedDoctorId && appointments.length > 0 ? ` (${appointments.length})` : ''}
            </option>
            {doctors.map((doc) => (
              <option key={doc.id} value={doc.id}>
                {doc.name}
              </option>
            ))}
          </select>

          <div className="flex items-center rounded-[6px] bg-[#111111] border border-[#262626] p-0.5">
            <button
              type="button"
              onClick={() =>
                setCurrentMonthDate(
                  new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() - 1, 1)
                )
              }
              aria-label="Previous month"
              className="p-1.5 rounded-[4px] text-zinc-400 hover:text-white hover:bg-[#1a1a1a] transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="px-2 text-xs font-medium text-zinc-200 min-w-[106px] text-center whitespace-nowrap">
              {monthLabel}
            </span>
            <button
              type="button"
              onClick={() =>
                setCurrentMonthDate(
                  new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() + 1, 1)
                )
              }
              aria-label="Next month"
              className="p-1.5 rounded-[4px] text-zinc-400 hover:text-white hover:bg-[#1a1a1a] transition-colors cursor-pointer"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              const now = new Date();
              setCurrentMonthDate(new Date(now.getFullYear(), now.getMonth(), 1));
              onSelectDate(toLocalDateKey(now));
            }}
            className="btn-dark !py-1.5 !px-2.5 !text-xs"
          >
            Today
          </button>

          <button
            type="button"
            onClick={() => openNewBooking(activeDate)}
            className="btn-white !py-1.5 !px-3 !text-xs"
          >
            <Plus className="w-3.5 h-3.5 shrink-0" />
            <span>New Booking</span>
          </button>
        </div>
      </section>

      {/* Main Split: Month Grid + Selected Day Agenda */}
      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px] gap-3 sm:gap-4">
        {/* Month Grid */}
        <section className="v-card flex flex-col min-h-[300px] lg:min-h-0 overflow-hidden">
          <div className="grid grid-cols-7 border-b border-[#1c1c1c] bg-[#050505] text-[11px] font-mono text-zinc-500 text-center py-2 shrink-0">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div key={day}>{day}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 flex-1 min-h-0 auto-rows-fr bg-[#000000]">
            {monthData.map((d) => {
              const dayAppts = appointmentsByDate[d.dateStr] || [];
              const isSelected = activeDate === d.dateStr;
              const isToday = todayStr === d.dateStr;

              return (
                <button
                  key={d.dateStr}
                  type="button"
                  onClick={() => onSelectDate(d.dateStr)}
                  className={`group text-left p-1.5 sm:p-2 border-r border-b border-[#181818] flex flex-col justify-between gap-1 cursor-pointer transition-colors relative overflow-hidden focus-visible:outline-2 focus-visible:outline-white ${!d.isCurrentMonth
                    ? 'opacity-30 bg-[#000000] hover:opacity-60 hover:bg-[#0a0a0a]'
                    : isSelected
                      ? 'bg-[#121214] ring-1 ring-inset ring-white/40 z-10'
                      : 'bg-[#000000] hover:bg-[#0c0c0e]'
                    }`}
                >
                  <div className="flex items-center justify-between gap-1 w-full">
                    <span
                      className={`text-[11px] sm:text-xs font-mono tabular-nums px-1.5 py-0.5 rounded-[4px] ${isToday
                        ? 'bg-white text-black font-semibold'
                        : isSelected
                          ? 'text-white font-semibold'
                          : 'text-zinc-400 group-hover:text-zinc-200'
                        }`}
                    >
                      {d.dayNumber}
                    </span>

                    {dayAppts.length > 0 && (
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.2 rounded-[4px] tabular-nums ${isSelected
                          ? 'bg-white/15 text-white'
                          : 'bg-[#141414] text-zinc-400 border border-[#242424]'
                          }`}
                      >
                        {dayAppts.length}
                      </span>
                    )}
                  </div>

                  {/* Mobile dot indicators (< 640px) */}
                  <div className="flex sm:hidden items-center gap-0.5 min-h-[8px]">
                    {dayAppts.slice(0, 3).map((apt) => (
                      <span
                        key={apt.id}
                        className={`w-1.5 h-1.5 rounded-full ${apt.status === 'confirmed'
                          ? 'bg-emerald-400'
                          : apt.status === 'cancelled'
                            ? 'bg-red-400'
                            : 'bg-sky-400'
                          }`}
                      />
                    ))}
                  </div>

                  {/* Desktop/Tablet compact appointment previews (>= 640px) */}
                  <div className="hidden sm:flex flex-col gap-1 w-full overflow-hidden my-auto">
                    {dayAppts.slice(0, 2).map((apt) => (
                      <div
                        key={apt.id}
                        className="px-1.5 py-0.5 rounded-[4px] bg-[#111111] border border-[#222222] text-[10px] text-zinc-300 truncate flex items-center gap-1"
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full shrink-0 ${apt.status === 'confirmed'
                            ? 'bg-emerald-400'
                            : apt.status === 'cancelled'
                              ? 'bg-red-400'
                              : 'bg-sky-400'
                            }`}
                        />
                        <span className="font-mono text-zinc-500 shrink-0">
                          {formatTime(apt.start_time)}
                        </span>
                        <span className="truncate">{apt.patient_name}</span>
                      </div>
                    ))}
                    {dayAppts.length > 2 && (
                      <span className="text-[10px] font-mono text-zinc-500 pl-1">
                        +{dayAppts.length - 2} more
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Right / Bottom Day Agenda Panel */}
        <aside className="v-card flex flex-col min-h-[280px] lg:min-h-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-[#1c1c1c] bg-[#0a0a0a] flex items-center justify-between gap-2 shrink-0">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-xs sm:text-sm font-semibold text-white truncate">
                  {formatAgendaHeader(activeDate)}
                </h2>
                {getRelativeTag(activeDate) && (
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-[4px] bg-[#171717] border border-[#2e2e2e] text-zinc-200 shrink-0">
                    {getRelativeTag(activeDate)}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-zinc-400 mt-0.5 font-mono">
                {dayAppointments.length} consultation{dayAppointments.length !== 1 ? 's' : ''}
              </p>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => onSelectDate(shiftDateStr(activeDate, -1))}
                aria-label="Previous day"
                className="p-1.5 rounded-[6px] bg-[#111111] border border-[#242424] text-zinc-400 hover:text-white hover:border-[#383838] transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => onSelectDate(shiftDateStr(activeDate, 1))}
                aria-label="Next day"
                className="p-1.5 rounded-[6px] bg-[#111111] border border-[#242424] text-zinc-400 hover:text-white hover:border-[#383838] transition-colors cursor-pointer"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5">
            <AnimatePresence mode="popLayout" initial={false}>
              {dayAppointments.length === 0 ? (
                <motion.div
                  key="empty-day"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="py-10 px-4 text-center rounded-[8px] border border-dashed border-[#242424] bg-[#050505] space-y-3"
                >
                  <div className="w-9 h-9 mx-auto rounded-[6px] bg-[#111111] border border-[#262626] flex items-center justify-center text-zinc-400">
                    <CalendarCheck className="w-4 h-4" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-zinc-200">No appointments scheduled</p>
                    <p className="text-[11px] text-zinc-500">
                      Ask Mia by voice or add a booking manually.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => openNewBooking(activeDate)}
                    className="btn-dark !py-1.5 !px-3 !text-xs mx-auto"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Book this date</span>
                  </button>
                </motion.div>
              ) : (
                dayAppointments.map((apt) => {
                  const statusKey = (apt.status || 'scheduled').toLowerCase();
                  const badgeStyle = STATUS_STYLES[statusKey] || STATUS_STYLES.scheduled;
                  const isBusy = actionLoadingId === apt.id;

                  return (
                    <motion.div
                      key={apt.id}
                      layout
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.98 }}
                      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
                      className="p-3 rounded-[8px] bg-[#111111] border border-[#222222] hover:border-[#343434] transition-colors space-y-2.5"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="inline-flex items-center gap-1.5 text-xs font-mono text-zinc-200">
                          <Clock className="w-3 h-3 text-zinc-400 shrink-0" />
                          <span>
                            {formatTime(apt.start_time)} – {formatTime(apt.end_time)}
                          </span>
                        </span>
                        <span
                          className={`text-[10px] font-mono capitalize px-2 py-0.5 rounded-[4px] border ${badgeStyle}`}
                        >
                          {statusKey}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium text-white truncate">
                            {apt.patient_name || 'Patient'}
                          </p>
                          {apt.patient_phone && (
                            <span className="text-[11px] font-mono text-zinc-400 shrink-0">
                              {apt.patient_phone}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-zinc-400 truncate">
                          {apt.doctor_name || 'Attending Physician'} ·{' '}
                          <span className="text-zinc-500">{apt.doctor_room || 'Clinic Room'}</span>
                        </p>
                        {apt.reason && (
                          <p className="text-xs text-zinc-500 line-clamp-2 pt-0.5">{apt.reason}</p>
                        )}
                      </div>

                      <div className="pt-2 border-t border-[#1c1c1c] flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          {statusKey === 'scheduled' && (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleStatusChange(apt.id, 'confirmed')}
                              className="px-2 py-1 rounded-[5px] bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-[11px] font-medium text-emerald-300 transition-colors cursor-pointer whitespace-nowrap"
                            >
                              {isBusy ? 'Saving...' : 'Confirm'}
                            </button>
                          )}
                          {statusKey === 'confirmed' && (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleStatusChange(apt.id, 'completed')}
                              className="px-2 py-1 rounded-[5px] bg-[#1a1a1a] hover:bg-[#242424] border border-[#303030] text-[11px] font-medium text-zinc-200 transition-colors cursor-pointer whitespace-nowrap"
                            >
                              {isBusy ? 'Saving...' : 'Complete'}
                            </button>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => setInspectedAppointment(apt)}
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-300 hover:text-white transition-colors cursor-pointer whitespace-nowrap"
                        >
                          <span>Details</span>
                          <ArrowUpRight className="w-3 h-3 text-zinc-500" />
                        </button>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </AnimatePresence>
          </div>
        </aside>
      </div>

      {/* Appointment Detail Modal */}
      <AnimatePresence>
        {inspectedAppointment && (
          <motion.div
            key="detail-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-6"
            onClick={() => setInspectedAppointment(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.97, y: 6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 6 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg rounded-[10px] bg-[#0a0a0a] border border-[#262626] shadow-2xl overflow-hidden flex flex-col max-h-[90dvh]"
            >
              <div className="px-5 py-4 border-b border-[#1c1c1c] flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-white">Consultation Details</h3>
                  <p className="text-xs font-mono text-zinc-400 mt-0.5">
                    {formatAgendaHeader(String(inspectedAppointment.start_time).slice(0, 10))} ·{' '}
                    {formatTime(inspectedAppointment.start_time)} – {formatTime(inspectedAppointment.end_time)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setInspectedAppointment(null)}
                  aria-label="Close modal"
                  className="p-1.5 rounded-[6px] text-zinc-400 hover:text-white hover:bg-[#141414] transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-4 overflow-y-auto select-text">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-[8px] bg-[#111111] border border-[#222222] space-y-1.5">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-400">
                      <User className="w-3.5 h-3.5" />
                      <span>Patient</span>
                    </span>
                    <p className="text-sm font-semibold text-white">
                      {inspectedAppointment.patient_name || 'Patient'}
                    </p>
                    {inspectedAppointment.patient_phone && (
                      <p className="text-xs font-mono text-zinc-400 flex items-center gap-1.5">
                        <Phone className="w-3 h-3 text-zinc-500" />
                        <span>{inspectedAppointment.patient_phone}</span>
                      </p>
                    )}
                  </div>

                  <div className="p-3.5 rounded-[8px] bg-[#111111] border border-[#222222] space-y-1.5">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-400">
                      <Stethoscope className="w-3.5 h-3.5" />
                      <span>Specialist</span>
                    </span>
                    <p className="text-sm font-semibold text-white">
                      {inspectedAppointment.doctor_name || 'Physician'}
                    </p>
                    <p className="text-xs text-zinc-400 flex items-center gap-1.5">
                      <MapPin className="w-3 h-3 text-zinc-500" />
                      <span>{inspectedAppointment.doctor_room || 'Outpatient Wing'}</span>
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-[8px] bg-[#111111] border border-[#222222] space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-zinc-400">
                      <FileText className="w-3.5 h-3.5" />
                      <span>Reason for Visit</span>
                    </span>
                    <span
                      className={`text-[10px] font-mono capitalize px-2 py-0.5 rounded-[4px] border ${STATUS_STYLES[(inspectedAppointment.status || 'scheduled').toLowerCase()] ||
                        STATUS_STYLES.scheduled
                        }`}
                    >
                      {inspectedAppointment.status || 'scheduled'}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-zinc-200 leading-relaxed">
                    {inspectedAppointment.reason || 'General health consultation'}
                  </p>
                </div>
              </div>

              <div className="px-5 py-3.5 border-t border-[#1c1c1c] bg-[#050505] flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 flex-wrap">
                  {inspectedAppointment.status !== 'confirmed' && (
                    <button
                      type="button"
                      disabled={actionLoadingId === inspectedAppointment.id}
                      onClick={() => handleStatusChange(inspectedAppointment.id, 'confirmed')}
                      className="btn-dark !py-1.5 !px-3 !text-xs border-emerald-500/30 text-emerald-300"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Confirm</span>
                    </button>
                  )}
                  {inspectedAppointment.status !== 'cancelled' && (
                    <button
                      type="button"
                      disabled={actionLoadingId === inspectedAppointment.id}
                      onClick={() => handleStatusChange(inspectedAppointment.id, 'cancelled')}
                      className="btn-dark !py-1.5 !px-3 !text-xs text-amber-300 border-amber-500/30"
                    >
                      <span>Cancel Visit</span>
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={actionLoadingId === inspectedAppointment.id}
                    onClick={() => handleDeleteAppointment(inspectedAppointment.id)}
                    className="btn-dark !py-1.5 !px-2.5 !text-xs text-red-400 border-red-500/30"
                    title="Delete record"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setInspectedAppointment(null)}
                  className="btn-white !py-1.5 !px-4 !text-xs"
                >
                  Done
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* New Booking Modal */}
      <AnimatePresence>
        {showBookingModal && (
          <motion.div
            key="booking-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-6"
            onClick={() => setShowBookingModal(false)}
          >
            <motion.form
              onSubmit={handleCreateBooking}
              initial={{ opacity: 0, scale: 0.97, y: 6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: 6 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-[10px] bg-[#0a0a0a] border border-[#262626] shadow-2xl overflow-hidden flex flex-col max-h-[90dvh]"
            >
              <div className="px-5 py-4 border-b border-[#1c1c1c] flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-white">New Appointment</h3>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Schedule a consultation directly on the clinic calendar
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowBookingModal(false)}
                  className="p-1.5 rounded-[6px] text-zinc-400 hover:text-white hover:bg-[#141414] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-5 space-y-3.5 overflow-y-auto">
                {bookingError && (
                  <div className="p-2.5 rounded-[6px] bg-red-500/10 border border-red-500/30 text-xs text-red-300">
                    {bookingError}
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-300">Patient Name</label>
                  <input
                    type="text"
                    required
                    value={bookingForm.patient_name}
                    onChange={(e) => setBookingForm({ ...bookingForm, patient_name: e.target.value })}
                    placeholder="e.g. Aarav Sharma"
                    className="v-input"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-300">Phone Number</label>
                  <input
                    type="tel"
                    required
                    value={bookingForm.patient_phone}
                    onChange={(e) => setBookingForm({ ...bookingForm, patient_phone: e.target.value })}
                    placeholder="e.g. +91 98765 43210"
                    className="v-input"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-300">Specialist</label>
                  <select
                    value={bookingForm.doctor_id}
                    onChange={(e) => setBookingForm({ ...bookingForm, doctor_id: e.target.value })}
                    className="v-input"
                  >
                    {doctors.map((doc) => (
                      <option key={doc.id} value={doc.id}>
                        {doc.name} ({doc.specialization || doc.specialty || 'Specialist'})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-zinc-300">Date</label>
                    <input
                      type="date"
                      required
                      value={bookingForm.date}
                      onChange={(e) => setBookingForm({ ...bookingForm, date: e.target.value })}
                      className="v-input"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-zinc-300">Time</label>
                    <input
                      type="time"
                      required
                      value={bookingForm.time}
                      onChange={(e) => setBookingForm({ ...bookingForm, time: e.target.value })}
                      className="v-input"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-zinc-300">Reason for Visit</label>
                  <input
                    type="text"
                    value={bookingForm.reason}
                    onChange={(e) => setBookingForm({ ...bookingForm, reason: e.target.value })}
                    placeholder="e.g. Routine checkup"
                    className="v-input"
                  />
                </div>
              </div>

              <div className="px-5 py-3.5 border-t border-[#1c1c1c] bg-[#050505] flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowBookingModal(false)}
                  className="btn-dark !py-1.5 !px-3.5 !text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={bookingSubmitting}
                  className="btn-white !py-1.5 !px-4 !text-xs"
                >
                  {bookingSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Create Booking</span>
                  )}
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
