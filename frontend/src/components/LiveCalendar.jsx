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
  Users,
  Search,
  Filter,
  ArrowRight,
  Check,
} from 'lucide-react';

export default function LiveCalendar({
  appointments = [],
  doctors = [],
  selectedDate,
  onSelectDate,
  selectedDoctorId,
  onChangeDoctor,
}) {
  const [activeTab, setActiveTab] = useState('calendar'); // 'calendar' | 'doctors'
  const [doctorSearch, setDoctorSearch] = useState('');
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
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        });
      }
    } catch {
      // Fallback
    }
    return dateStr;
  };

  const formatFullDate = (dateStr) => {
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

  // Filtered doctors for the Doctors directory tab
  const filteredDoctors = useMemo(() => {
    if (!doctorSearch.trim()) return doctors;
    const q = doctorSearch.toLowerCase();
    return doctors.filter(
      (d) =>
        d.name?.toLowerCase().includes(q) ||
        d.specialization?.toLowerCase().includes(q) ||
        d.specialty?.toLowerCase().includes(q) ||
        d.room?.toLowerCase().includes(q)
    );
  }, [doctors, doctorSearch]);

  const selectedDoctorObj = doctors.find((d) => d.id === selectedDoctorId);

  return (
    <div className="flex flex-col h-full bg-[#000000] text-white select-none relative overflow-hidden">
      {/* Top Header Bar with Minimalist Tabs and Month Controls */}
      <div className="h-13 shrink-0 px-4 sm:px-5 border-b border-[#222222] bg-[#000000] flex items-center justify-between gap-3">
        {/* Left: Minimal Tabs Switcher (Calendar vs Doctors) */}
        <div className="flex items-center gap-1.5 p-0.5 rounded-lg bg-[#0d0d0f] border border-[#222226]">
          <button
            onClick={() => setActiveTab('calendar')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold tracking-wide transition-all flex items-center gap-1.5 ${
              activeTab === 'calendar'
                ? 'bg-[#1e1e24] text-white shadow-sm border border-[#303038]'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <CalendarIcon className="w-3.5 h-3.5" />
            <span>Calendar</span>
          </button>
          <button
            onClick={() => setActiveTab('doctors')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold tracking-wide transition-all flex items-center gap-1.5 ${
              activeTab === 'doctors'
                ? 'bg-[#1e1e24] text-white shadow-sm border border-[#303038]'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            <Stethoscope className="w-3.5 h-3.5" />
            <span>Specialists</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300 font-mono">
              {doctors.length}
            </span>
          </button>
        </div>

        {/* Right Header Controls (Conditional by Active Tab) */}
        {activeTab === 'calendar' ? (
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Quick Doctor Filter Dropdown (Zero Vertical Waste) */}
            <div className="flex items-center gap-1.5">
              <select
                value={selectedDoctorId}
                onChange={(e) => onChangeDoctor(e.target.value)}
                className="bg-[#0c0c0e] border border-[#242428] hover:border-zinc-500 text-zinc-300 text-xs rounded-md px-2.5 py-1.5 outline-none font-medium cursor-pointer transition-colors max-w-[150px] sm:max-w-[180px] truncate"
                title="Filter Calendar by Doctor"
              >
                <option value="">All Specialists ({appointments.length})</option>
                {doctors.map((doc) => {
                  const docCount = appointments.filter((a) => a.doctor_id === doc.id).length;
                  return (
                    <option key={doc.id} value={doc.id}>
                      {doc.name} ({docCount})
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Month Navigation */}
            <div className="flex items-center gap-1">
              <button
                onClick={prevMonth}
                className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-900 border border-transparent hover:border-[#262626] transition-colors"
                title="Previous Month"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-semibold text-xs sm:text-sm text-white min-w-[120px] text-center tracking-tight truncate">
                {monthName}
              </span>
              <button
                onClick={nextMonth}
                className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-900 border border-transparent hover:border-[#262626] transition-colors"
                title="Next Month"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={goToday}
                className="text-[11px] px-2 py-1 rounded bg-[#101012] border border-[#262626] text-zinc-300 hover:text-white hover:bg-zinc-800 transition-colors ml-1 font-mono"
              >
                Today
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {/* Search Input for Doctors */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
              <input
                type="text"
                placeholder="Search specialist..."
                value={doctorSearch}
                onChange={(e) => setDoctorSearch(e.target.value)}
                className="pl-8 pr-3 py-1 bg-[#0c0c0e] border border-[#242428] rounded-md text-xs text-white placeholder-zinc-500 outline-none w-36 sm:w-48 focus:border-purple-500 transition-colors"
              />
            </div>
            <button
              onClick={() => setActiveTab('calendar')}
              className="text-xs px-2.5 py-1 rounded bg-[#141416] border border-[#28282c] text-zinc-300 hover:text-white hover:border-zinc-500 transition-colors flex items-center gap-1"
            >
              <span>Back to Calendar</span>
              <ArrowRight className="w-3 h-3 text-purple-400" />
            </button>
          </div>
        )}
      </div>

      {/* ACTIVE TAB: CALENDAR */}
      {activeTab === 'calendar' && (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Weekday Header */}
          <div className="grid grid-cols-7 border-b border-[#1f1f1f] bg-[#050505] text-[11px] font-mono text-zinc-500 text-center font-medium py-1.5 shrink-0">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div key={day} className="border-r border-[#161616] last:border-r-0">
                {day}
              </div>
            ))}
          </div>

          {/* Month Days Grid - Fills remaining height proportionally without page scrolling */}
          <div className="grid grid-cols-7 flex-1 min-h-0 auto-rows-fr bg-[#000000] overflow-hidden">
            {monthData.map((d, idx) => {
              const dayAppts = appointmentsByDate[d.dateStr] || [];
              const isSelected = selectedDate === d.dateStr;
              const isToday = todayStr === d.dateStr;

              return (
                <div
                  key={idx}
                  onClick={() => handleDayClick(d.dateStr)}
                  className={`group h-full p-1.5 sm:p-2 border-r border-b border-[#1a1a1c] relative cursor-pointer select-none transition-all duration-150 ease-out flex flex-col justify-between overflow-hidden ${
                    !d.isCurrentMonth
                      ? 'opacity-25 bg-[#000000] hover:opacity-60 hover:bg-[#0c0c0e]'
                      : isSelected
                      ? 'bg-[#141418] ring-1 ring-inset ring-purple-500/80 shadow-md z-10'
                      : 'bg-[#000000] hover:bg-[#101014] hover:ring-1 hover:ring-inset hover:ring-[#3e3e46]'
                  }`}
                >
                  {/* Day Number Row */}
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-mono transition-all duration-150 ${
                        isToday
                          ? 'font-bold text-white bg-purple-600/40 border border-purple-500/60 px-1.5 py-0.5 rounded shadow-sm'
                          : isSelected
                          ? 'text-white font-bold scale-105'
                          : 'text-zinc-400 font-medium group-hover:text-white group-hover:scale-105'
                      }`}
                    >
                      {d.dayNumber}
                    </span>

                    {dayAppts.length > 0 && (
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono transition-colors ${
                          isSelected
                            ? 'bg-purple-950/90 text-purple-200 border border-purple-700/60'
                            : 'bg-[#161618] text-zinc-400 border border-[#242426] group-hover:text-white group-hover:border-zinc-500'
                        }`}
                      >
                        {dayAppts.length}
                      </span>
                    )}
                  </div>

                  {/* Day Appointment Compact Pills (up to 2 visible to preserve 1-window height) */}
                  <div className="space-y-1 my-auto overflow-hidden">
                    {dayAppts.slice(0, 2).map((apt) => {
                      const time = apt.start_time
                        ? new Date(apt.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : '';

                      return (
                        <div
                          key={apt.id}
                          className="text-[10px] sm:text-[11px] truncate px-1.5 py-0.5 rounded bg-[#0d0d10] border border-[#202024] text-zinc-300 group-hover:border-[#383840] group-hover:bg-[#141418] transition-all flex items-center gap-1 shadow-sm leading-tight"
                          title={`${apt.patient_name} - ${apt.doctor_name || ''}`}
                        >
                          <span className="text-zinc-500 font-mono text-[9px] sm:text-[10px] shrink-0">
                            {time}
                          </span>
                          <span className="truncate font-medium">{apt.patient_name}</span>
                        </div>
                      );
                    })}
                    {dayAppts.length > 2 && (
                      <div className="text-[10px] text-zinc-500 font-mono pl-1 group-hover:text-purple-400 transition-colors leading-none">
                        +{dayAppts.length - 2} more
                      </div>
                    )}
                  </div>

                  {/* Bottom indicator strip for selected/active */}
                  <div className="h-0.5 w-full">
                    {isSelected && <div className="h-0.5 w-full bg-purple-500 rounded-full" />}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Minimal 1-line Footer Strip (Replaces tall 160px schedule strip) */}
          <div className="h-9 shrink-0 px-4 border-t border-[#1f1f1f] bg-[#050505] flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-zinc-400 truncate">
              <Clock className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
              <span className="font-semibold text-zinc-200 truncate">
                {formatFriendlyDate(selectedDate || todayStr)}
              </span>
              <span className="text-zinc-600">•</span>
              <span className="font-mono text-zinc-400">
                {selectedDateAppointments.length} appointment{selectedDateAppointments.length !== 1 ? 's' : ''}
              </span>
              {selectedDoctorObj && (
                <>
                  <span className="text-zinc-600">•</span>
                  <span className="text-purple-300 font-medium truncate">
                    Filtered: {selectedDoctorObj.name}
                  </span>
                </>
              )}
            </div>

            <button
              onClick={() => setActiveDayModal(selectedDate || todayStr)}
              className="text-[11px] font-semibold text-zinc-300 hover:text-white flex items-center gap-1 hover:underline cursor-pointer shrink-0"
            >
              <span>Inspect Day</span>
              <ArrowRight className="w-3 h-3 text-purple-400" />
            </button>
          </div>
        </div>
      )}

      {/* ACTIVE TAB: DOCTORS DIRECTORY ("move doctors detail to another tab make it minimal") */}
      {activeTab === 'doctors' && (
        <div className="flex-1 flex flex-col min-h-0 bg-[#000000] overflow-y-auto p-4 sm:p-6 space-y-4">
          {/* Top Banner with Clinic Overview */}
          <div className="p-4 rounded-xl bg-[#0a0a0c] border border-[#222226] flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <Stethoscope className="w-4 h-4 text-purple-400" />
                Medical Specialists & Consulting Staff
              </h3>
              <p className="text-xs text-zinc-400 font-mono mt-0.5">
                {doctors.length} Registered Physicians · ABC Health Care
              </p>
            </div>

            <button
              onClick={() => {
                onChangeDoctor('');
                setActiveTab('calendar');
              }}
              className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-all ${
                !selectedDoctorId
                  ? 'bg-purple-950/60 border-purple-500 text-purple-200'
                  : 'bg-[#121215] border-[#26262a] text-zinc-300 hover:text-white'
              }`}
            >
              {!selectedDoctorId ? '✓ Showing All Doctors in Calendar' : 'Show All Doctors in Calendar'}
            </button>
          </div>

          {/* Doctors Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredDoctors.map((doc) => {
              const isDocSelected = selectedDoctorId === doc.id;
              const initials = doc.name
                .replace('Dr. ', '')
                .split(' ')
                .map((n) => n[0])
                .join('')
                .slice(0, 2);

              const docApptsCount = appointments.filter((a) => a.doctor_id === doc.id).length;
              const docSpecialty = doc.specialization || doc.specialty || 'General Medicine';
              const docRoom = doc.room || doc.room_number || 'Room 101';
              const docDegrees = doc.degrees || 'MBBS, MD';
              const docExp = doc.experience || '10+ Years Experience';

              return (
                <div
                  key={doc.id}
                  className={`p-5 rounded-2xl border transition-all duration-200 flex flex-col justify-between gap-4 ${
                    isDocSelected
                      ? 'bg-[#121216] border-purple-500/80 ring-2 ring-purple-500/20 shadow-xl'
                      : 'bg-[#09090b] border-[#222226] hover:border-[#38383e] hover:bg-[#0e0e11] shadow-md'
                  }`}
                >
                  {/* Top Doctor Profile Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div
                        className={`w-13 h-13 rounded-2xl border flex items-center justify-center font-bold text-base shrink-0 shadow-inner ${
                          isDocSelected
                            ? 'bg-purple-950/80 border-purple-500 text-purple-200'
                            : 'bg-[#16161a] border-[#28282e] text-zinc-200'
                        }`}
                      >
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-base text-white tracking-tight truncate flex items-center gap-2">
                          <span>{doc.name}</span>
                          {isDocSelected && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-950 text-purple-300 border border-purple-700">
                              Active Filter
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-purple-300 font-medium truncate mt-0.5">
                          {docSpecialty}
                        </div>
                        <div className="text-[11px] text-zinc-500 font-mono truncate">
                          {docDegrees}
                        </div>
                      </div>
                    </div>

                    <span className="text-xs px-2.5 py-1 rounded-full bg-[#141418] border border-[#26262a] font-mono text-zinc-300 font-semibold shrink-0">
                      {docApptsCount} Appts
                    </span>
                  </div>

                  {/* Doctor Metadata Tags */}
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-3 border-t border-[#1c1c20]">
                    <div className="flex items-center gap-1.5 text-zinc-400">
                      <MapPin className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                      <span className="truncate">{docRoom}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-zinc-400">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                      <span className="truncate text-emerald-400">Available Today</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-zinc-400 col-span-2">
                      <Clock className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                      <span className="truncate">{docExp} · 09:00 AM – 05:00 PM</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        onChangeDoctor(doc.id);
                        setActiveTab('calendar');
                      }}
                      className="btn-white flex-1 py-2 text-xs font-semibold"
                    >
                      View Schedule on Calendar →
                    </button>
                    {isDocSelected && (
                      <button
                        type="button"
                        onClick={() => onChangeDoctor('')}
                        className="btn-dark py-2 px-3 text-xs font-semibold text-zinc-400 hover:text-white"
                        title="Clear filter"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* DAY BOOKINGS MODAL - REDESIGNED SPATIOUS & ELEGANT */}
      {activeDayModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 sm:p-6 lg:p-8 animate-in fade-in duration-200"
          onClick={() => setActiveDayModal(null)}
        >
          <div
            className={`w-full ${
              modalAppointments.length > 1 ? 'max-w-3xl' : 'max-w-xl'
            } bg-[#0b0b0e] border border-[#262630] rounded-2xl shadow-[0_25px_70px_-15px_rgba(0,0,0,0.95)] overflow-hidden flex flex-col max-h-[85vh] transition-all`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header: Spacious, elegant clinical title & controls */}
            <div className="px-6 sm:px-7 py-5 border-b border-[#202028] bg-gradient-to-r from-[#0d0d12] via-[#09090c] to-[#0d0d12] flex items-center justify-between gap-4 shrink-0">
              <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-purple-950/40 border border-purple-800/40 flex items-center justify-center text-purple-400 shrink-0 shadow-inner">
                  <CalendarIcon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h3 className="font-bold text-lg sm:text-xl text-white tracking-tight truncate">
                      {formatFullDate(activeDayModal)}
                    </h3>
                    {getRelativeDateLabel(activeDayModal) && (
                      <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-purple-950/70 text-purple-300 border border-purple-800/60 font-mono">
                        {getRelativeDateLabel(activeDayModal)}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-zinc-400 font-mono mt-1 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                    <span>
                      {modalAppointments.length} scheduled consultation{modalAppointments.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              </div>

              {/* Day Switcher Controls */}
              <div className="flex items-center gap-2 shrink-0">
                <div className="flex items-center p-0.5 rounded-lg bg-[#141418] border border-[#24242c]">
                  <button
                    onClick={handlePrevDayModal}
                    className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                    title="Previous Day"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <div className="w-px h-4 bg-zinc-800 mx-0.5" />
                  <button
                    onClick={handleNextDayModal}
                    className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                    title="Next Day"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
                <button
                  onClick={() => setActiveDayModal(null)}
                  className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800/80 border border-transparent hover:border-zinc-700 transition-colors"
                  title="Close (Esc)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Content: Clean, spacious, beautifully formatted appointment cards */}
            <div className="p-6 sm:p-7 overflow-y-auto flex-1 select-text bg-[#070709] space-y-4">
              {modalAppointments.length === 0 ? (
                <div className="py-16 text-center px-4 space-y-3">
                  <div className="w-12 h-12 mx-auto rounded-2xl bg-[#121216] border border-[#26262e] flex items-center justify-center text-zinc-500 shadow-inner">
                    <CalendarCheck className="w-6 h-6 text-zinc-400" />
                  </div>
                  <div className="text-base font-semibold text-white">
                    No Consultations Scheduled
                  </div>
                  <p className="text-xs text-zinc-400 max-w-sm mx-auto font-mono leading-relaxed">
                    No appointments are booked for {formatFullDate(activeDayModal)}. Patients can book via Mia or the reception line.
                  </p>
                </div>
              ) : (
                <div
                  className={`grid gap-5 ${
                    modalAppointments.length > 1 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'
                  }`}
                >
                  {modalAppointments.map((apt) => {
                    const start = apt.start_time
                      ? new Date(apt.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : '10:00 AM';
                    const end = apt.end_time
                      ? new Date(apt.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : '10:30 AM';
                    const isConfirmed = apt.status?.toLowerCase() === 'confirmed';
                    const patientInitial = (apt.patient_name || 'P').trim().charAt(0).toUpperCase();

                    return (
                      <div
                        key={apt.id}
                        className="p-5 sm:p-6 rounded-2xl bg-[#0f0f14] border border-[#242430] hover:border-purple-600/40 transition-all duration-200 shadow-lg flex flex-col justify-between space-y-4"
                      >
                        {/* Top: Time Pill + Status Badge */}
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#181822] border border-[#2a2a38] text-purple-200 font-mono text-xs sm:text-sm font-semibold shadow-inner">
                            <Clock className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                            <span>{start} – {end}</span>
                          </div>

                          <div
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                              isConfirmed
                                ? 'bg-emerald-950/50 text-emerald-300 border-emerald-800/50'
                                : 'bg-purple-950/50 text-purple-300 border-purple-800/50'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                isConfirmed ? 'bg-emerald-400' : 'bg-purple-400'
                              } animate-pulse`}
                            />
                            <span className="capitalize">{apt.status || 'Scheduled'}</span>
                          </div>
                        </div>

                        {/* Patient Profile Block */}
                        <div className="flex items-center gap-3.5 pt-1">
                          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#271a3d] to-[#161224] border border-purple-800/50 flex items-center justify-center text-purple-200 font-bold text-base shrink-0 shadow-inner">
                            {patientInitial}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="font-bold text-base sm:text-lg text-white tracking-tight truncate leading-tight">
                              {apt.patient_name || 'Patient'}
                            </h4>
                            {apt.patient_phone && (
                              <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-mono mt-1">
                                <Phone className="w-3 h-3 text-zinc-500 shrink-0" />
                                <span>{apt.patient_phone}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Doctor & Location Details */}
                        <div className="pt-3.5 border-t border-[#1e1e28] space-y-2.5 text-xs">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2 min-w-0">
                              <Stethoscope className="w-4 h-4 text-purple-400 shrink-0" />
                              <span className="font-semibold text-sm text-zinc-100 truncate">
                                {apt.doctor_name || 'Dr. Rahul Nair'}
                              </span>
                            </div>
                            {apt.doctor_specialization && (
                              <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-[#181822] text-purple-300 border border-[#2e2e3e] font-medium shrink-0">
                                {apt.doctor_specialization}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 text-zinc-400 font-mono pl-6">
                            <MapPin className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                            <span className="truncate">{apt.doctor_room || 'Room 102 · Primary Care Wing'}</span>
                          </div>
                        </div>

                        {/* Chief Complaint / Reason */}
                        <div className="p-3.5 rounded-xl bg-[#14141c] border border-[#22222e] border-l-2 border-l-purple-500 text-xs sm:text-sm text-zinc-200 flex items-start gap-3 shadow-inner">
                          <FileText className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                          <div className="leading-relaxed">
                            <span className="font-semibold text-zinc-400">Chief Reason: </span>
                            <span className="text-white font-medium">
                              {apt.reason || 'General Medical Consultation & Examination'}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 sm:px-7 py-4 border-t border-[#202028] bg-[#09090c] flex items-center justify-between gap-4 shrink-0">
              <div className="text-xs text-zinc-400 flex items-center gap-2 font-mono">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>Live Clinic Records Synchronized</span>
              </div>
              <button
                onClick={() => setActiveDayModal(null)}
                className="btn-dark text-xs sm:text-sm px-5 py-2 font-semibold hover:border-zinc-500 text-zinc-200 hover:text-white transition-colors"
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
