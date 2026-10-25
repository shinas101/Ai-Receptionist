import React, { useState, useMemo, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  User,
  Calendar as CalendarIcon,
  X,
  Stethoscope,
  Phone,
  Mail,
  FileText,
  CalendarCheck,
  MapPin,
} from 'lucide-react';

export default function LiveCalendar({
  appointments = [],
  doctors = [],
  selectedDate,
  onSelectDate,
  selectedDoctorId,
  onChangeDoctor,
}) {
  const [currentMonthDate, setCurrentMonthDate] = useState(() => {
    return selectedDate ? new Date(selectedDate) : new Date();
  });

  const [activeDayModal, setActiveDayModal] = useState(null);

  const getDateKey = (dateStr) => {
    if (!dateStr) return '';
    const s = String(dateStr);
    if (s.includes('T')) return s.split('T')[0];
    if (s.includes(' ')) return s.split(' ')[0];
    return s.slice(0, 10);
  };

  const monthData = useMemo(() => {
    const year = currentMonthDate.getFullYear();
    const month = currentMonthDate.getMonth();

    const firstDayIndex = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const days = [];

    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const m = month === 0 ? 12 : month;
      const y = month === 0 ? year - 1 : year;
      const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({ dayNumber: d, dateStr, isCurrentMonth: false });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({ dayNumber: d, dateStr, isCurrentMonth: true });
    }

    const remaining = (7 - (days.length % 7)) % 7;
    for (let d = 1; d <= remaining; d++) {
      const m = month + 2 > 12 ? 1 : month + 2;
      const y = month + 2 > 12 ? year + 1 : year;
      const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({ dayNumber: d, dateStr, isCurrentMonth: false });
    }

    return days;
  }, [currentMonthDate]);

  const monthName = currentMonthDate.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  const todayStr = new Date().toISOString().split('T')[0];

  const appointmentsByDate = useMemo(() => {
    const map = {};
    appointments.forEach((apt) => {
      const date = getDateKey(apt.start_time);
      if (date) {
        if (!map[date]) map[date] = [];
        map[date].push(apt);
      }
    });
    return map;
  }, [appointments]);

  const selectedDateAppointments = appointmentsByDate[selectedDate] || [];
  const modalAppointments = activeDayModal ? appointmentsByDate[activeDayModal] || [] : [];

  const prevMonth = () => {
    setCurrentMonthDate(new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonthDate(new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() + 1, 1));
  };

  const goToday = () => {
    const now = new Date();
    setCurrentMonthDate(now);
    const todayKey = now.toISOString().split('T')[0];
    onSelectDate(todayKey);
  };

  const handleDayClick = (dateStr) => {
    onSelectDate(dateStr);
    setActiveDayModal(dateStr);
  };

  const shiftDay = (dateStr, days) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const [y, m, d] = parts.map(Number);
    const date = new Date(y, m - 1, d + days);
    const ny = date.getFullYear();
    const nm = String(date.getMonth() + 1).padStart(2, '0');
    const nd = String(date.getDate()).padStart(2, '0');
    return `${ny}-${nm}-${nd}`;
  };

  const handlePrevDayModal = () => {
    if (!activeDayModal) return;
    const prev = shiftDay(activeDayModal, -1);
    setActiveDayModal(prev);
    onSelectDate(prev);
    const [y, m] = prev.split('-').map(Number);
    if (y !== currentMonthDate.getFullYear() || m - 1 !== currentMonthDate.getMonth()) {
      setCurrentMonthDate(new Date(y, m - 1, 1));
    }
  };

  const handleNextDayModal = () => {
    if (!activeDayModal) return;
    const next = shiftDay(activeDayModal, 1);
    setActiveDayModal(next);
    onSelectDate(next);
    const [y, m] = next.split('-').map(Number);
    if (y !== currentMonthDate.getFullYear() || m - 1 !== currentMonthDate.getMonth()) {
      setCurrentMonthDate(new Date(y, m - 1, 1));
    }
  };

  const getRelativeDateLabel = (dateStr) => {
    if (!dateStr) return null;
    if (dateStr === todayStr) return 'Today';
    const tomorrow = shiftDay(todayStr, 1);
    if (dateStr === tomorrow) return 'Tomorrow';
    const yesterday = shiftDay(todayStr, -1);
    if (dateStr === yesterday) return 'Yesterday';
    return null;
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && activeDayModal) {
        setActiveDayModal(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeDayModal]);

  const formatFriendlyDate = (dateStr) => {
    if (!dateStr) return '';
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        return d.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        });
      }
    } catch {
      // Fallback
    }
    return dateStr;
  };

  return (
    <div className="flex flex-col h-full bg-[#000000] text-white select-none relative">
      {/* Top Header & Doctor Filter */}
      <div className="px-6 py-4 border-b border-[#222222] bg-[#000000] flex flex-wrap items-center justify-between gap-4">
        {/* Month Selector */}
        <div className="flex items-center gap-2">
          <button
            onClick={prevMonth}
            className="p-1.5 rounded text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
            title="Previous Month"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h2 className="font-bold text-lg text-white min-w-[160px] text-center tracking-tight">
            {monthName}
          </h2>
          <button
            onClick={nextMonth}
            className="p-1.5 rounded text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
            title="Next Month"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
          <button
            onClick={goToday}
            className="btn-dark text-xs py-1.5 px-3 ml-2 font-medium"
          >
            Today
          </button>
        </div>

        {/* Doctor Filter Dropdown */}
        <div className="flex items-center gap-2">
          <select
            value={selectedDoctorId}
            onChange={(e) => onChangeDoctor(e.target.value)}
            className="v-input text-sm py-1.5 px-3 w-[180px] bg-[#0a0a0a] border-[#262626] text-white rounded-md"
          >
            <option value="">All Doctors</option>
            {doctors.map((doc) => (
              <option key={doc.id} value={doc.id}>
                {doc.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Weekday Header */}
      <div className="grid grid-cols-7 border-b border-[#222222] bg-[#050505] text-xs text-zinc-500 text-center font-medium py-2.5">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className="border-r border-[#1a1a1a] last:border-r-0">
            {day}
          </div>
        ))}
      </div>

      {/* Month Days Grid */}
      <div className="grid grid-cols-7 flex-1 auto-rows-fr bg-[#000000] overflow-y-auto">
        {monthData.map((d, idx) => {
          const dayAppts = appointmentsByDate[d.dateStr] || [];
          const isSelected = selectedDate === d.dateStr;
          const isToday = todayStr === d.dateStr;

          return (
            <div
              key={idx}
              onClick={() => handleDayClick(d.dateStr)}
              className={`min-h-[95px] p-2.5 border-r border-b border-[#1a1a1a] relative cursor-pointer transition-colors ${
                !d.isCurrentMonth
                  ? 'opacity-20 bg-[#000000]'
                  : isSelected
                  ? 'bg-[#111111] border-l-2 border-l-white'
                  : 'hover:bg-[#0c0c0c]'
              }`}
            >
              {/* Day Number */}
              <div className="flex items-center justify-between mb-2">
                <span
                  className={`text-sm ${
                    isToday
                      ? 'font-bold text-white bg-white/10 px-1.5 py-0.5 rounded'
                      : isSelected
                      ? 'text-white font-bold'
                      : 'text-zinc-400 font-medium'
                  }`}
                >
                  {d.dayNumber}
                </span>

                {dayAppts.length > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-[#1c1c1c] text-zinc-200 font-medium border border-[#2c2c2c]">
                    {dayAppts.length}
                  </span>
                )}
              </div>

              {/* Day Appointment Pills */}
              <div className="space-y-1.5">
                {dayAppts.map((apt) => {
                  const time = apt.start_time
                    ? new Date(apt.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : '';

                  return (
                    <div
                      key={apt.id}
                      className="text-xs truncate px-2 py-1 rounded bg-[#0f0f0f] border border-[#222222] text-zinc-200 hover:border-zinc-500 transition-colors flex items-center gap-1.5"
                      title={`${apt.patient_name} - ${apt.doctor_name || ''}`}
                    >
                      <span className="text-zinc-400 font-mono text-[11px] shrink-0">{time}</span>
                      <span className="truncate font-medium">{apt.patient_name}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Day Schedule Summary Strip */}
      <div className="border-t border-[#222222] bg-[#050505] p-4">
        <div className="flex items-center justify-between text-sm mb-3">
          <span className="flex items-center gap-2 font-semibold text-white">
            <Clock className="w-4 h-4 text-zinc-400" />
            {formatFriendlyDate(selectedDate || todayStr)}
          </span>
          <span className="text-zinc-400 text-xs font-medium">
            {selectedDateAppointments.length} appointment{selectedDateAppointments.length !== 1 ? 's' : ''}
          </span>
        </div>

        {selectedDateAppointments.length === 0 ? (
          <div className="text-sm text-zinc-500 py-1 font-mono">
            No consultations scheduled for this date.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-[120px] overflow-y-auto">
            {selectedDateAppointments.map((apt) => {
              const start = apt.start_time
                ? new Date(apt.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : '';
              const end = apt.end_time
                ? new Date(apt.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : '';

              return (
                <div
                  key={apt.id}
                  onClick={() => setActiveDayModal(selectedDate)}
                  className="p-3 rounded-lg bg-[#0a0a0a] border border-[#222222] hover:border-zinc-600 transition-colors text-sm flex items-center justify-between gap-3 cursor-pointer"
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-white flex items-center gap-2 truncate">
                      <User className="w-4 h-4 text-zinc-400 shrink-0" />
                      <span className="truncate">{apt.patient_name}</span>
                    </div>
                    <div className="text-xs text-zinc-400 truncate mt-1">
                      {apt.doctor_name || 'Doctor'} {apt.reason ? `· ${apt.reason}` : ''}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-mono text-zinc-300 text-xs font-medium">{start} – {end}</div>
                    <span className="inline-block mt-1 text-[11px] px-2 py-0.5 rounded bg-[#181818] border border-[#262626] text-zinc-300 font-medium">
                      {apt.status || 'Scheduled'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* DAY BOOKINGS MODAL (Clean, refined typography, app-consistent buttons) */}
      {activeDayModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 sm:p-6 animate-in fade-in duration-150"
          onClick={() => setActiveDayModal(null)}
        >
          <div
            className="w-full max-w-3xl lg:max-w-4xl bg-[#0a0a0a] border border-[#222222] rounded-lg shadow-2xl overflow-hidden flex flex-col max-h-[88vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header: Clean, consistent with App Header */}
            <div className="px-6 py-4 border-b border-[#222222] bg-[#000000] flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="border border-white/20 rounded px-2 py-1 text-xs font-bold tracking-wider text-white">
                  DAY
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base sm:text-lg text-white tracking-tight truncate">
                      {formatFriendlyDate(activeDayModal)}
                    </h3>
                    {getRelativeDateLabel(activeDayModal) && (
                      <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                        {getRelativeDateLabel(activeDayModal)}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-zinc-400 font-mono mt-0.5">
                    {modalAppointments.length} appointment{modalAppointments.length !== 1 ? 's' : ''} scheduled
                  </div>
                </div>
              </div>

              {/* Navigation and Close Buttons (App-consistent styling) */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrevDayModal}
                  className="btn-dark text-xs py-1.5 px-3 flex items-center gap-1"
                  title="Previous Day"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Prev</span>
                </button>
                <button
                  onClick={handleNextDayModal}
                  className="btn-dark text-xs py-1.5 px-3 flex items-center gap-1"
                  title="Next Day"
                >
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setActiveDayModal(null)}
                  className="p-1.5 rounded text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors ml-1"
                  title="Close (Esc)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content: Clean, uncluttered appointment cards */}
            <div className="p-5 sm:p-6 overflow-y-auto flex-1 select-text bg-[#000000]">
              {modalAppointments.length === 0 ? (
                <div className="py-14 text-center px-4 space-y-2">
                  <div className="w-10 h-10 mx-auto rounded-full bg-[#0a0a0a] border border-[#222222] flex items-center justify-center text-zinc-500">
                    <CalendarCheck className="w-5 h-5" />
                  </div>
                  <div className="text-sm font-semibold text-white">
                    No Appointments Scheduled
                  </div>
                  <p className="text-xs text-zinc-400 max-w-sm mx-auto font-mono">
                    There are no patient visits booked for this date.
                  </p>
                </div>
              ) : (
                <div
                  className={`grid gap-3.5 ${
                    modalAppointments.length > 1 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'
                  }`}
                >
                  {modalAppointments.map((apt) => {
                    const start = apt.start_time
                      ? new Date(apt.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : '';
                    const end = apt.end_time
                      ? new Date(apt.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : '';
                    const isConfirmed = apt.status?.toLowerCase() === 'confirmed';

                    return (
                      <div
                        key={apt.id}
                        className="p-4 rounded-lg bg-[#0a0a0a] border border-[#222222] hover:border-[#333333] transition-colors flex flex-col justify-between gap-3 text-sm"
                      >
                        {/* Top: Time + Status Badge */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 font-mono text-xs sm:text-sm font-semibold text-zinc-200">
                            <Clock className="w-4 h-4 text-zinc-400 shrink-0" />
                            <span>{start} – {end}</span>
                          </div>
                          <span
                            className={`text-[11px] px-2 py-0.5 rounded font-medium border ${
                              isConfirmed
                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                : 'bg-[#181818] text-zinc-300 border-[#2a2a2a]'
                            }`}
                          >
                            {apt.status || 'Scheduled'}
                          </span>
                        </div>

                        {/* Patient Info */}
                        <div className="space-y-1">
                          <div className="font-semibold text-sm sm:text-base text-white flex items-center gap-2 truncate">
                            <User className="w-4 h-4 text-zinc-400 shrink-0" />
                            <span className="truncate">{apt.patient_name || 'Patient'}</span>
                          </div>
                          {apt.patient_phone && (
                            <div className="text-xs text-zinc-400 font-mono truncate pl-6">
                              {apt.patient_phone}
                            </div>
                          )}
                        </div>

                        {/* Physician & Reason */}
                        <div className="pt-2 border-t border-[#1a1a1a] space-y-1.5 text-xs">
                          <div className="flex items-center justify-between gap-2 text-zinc-300">
                            <span className="font-medium flex items-center gap-1.5 truncate">
                              <Stethoscope className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                              <span className="truncate">{apt.doctor_name || 'Physician'}</span>
                            </span>
                            {apt.doctor_room && (
                              <span className="text-zinc-500 font-mono shrink-0">{apt.doctor_room}</span>
                            )}
                          </div>

                          {apt.doctor_specialization && (
                            <div className="text-zinc-500 pl-5 truncate">
                              {apt.doctor_specialization}
                            </div>
                          )}

                          {apt.reason && (
                            <div className="mt-1.5 p-2 rounded bg-[#111111] border border-[#1f1f1f] text-zinc-300 text-xs leading-relaxed">
                              <span className="text-zinc-400 font-medium">Reason: </span>
                              {apt.reason}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer: Clean with app's btn-white */}
            <div className="px-6 py-3.5 border-t border-[#222222] bg-[#000000] flex items-center justify-between gap-4">
              <div className="text-xs text-zinc-400 font-mono">
                {modalAppointments.length} appointment{modalAppointments.length !== 1 ? 's' : ''} on {formatFriendlyDate(activeDayModal)}
              </div>
              <button
                onClick={() => setActiveDayModal(null)}
                className="btn-white text-xs sm:text-sm px-4 py-2"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
