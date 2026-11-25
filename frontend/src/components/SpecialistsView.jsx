import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  Stethoscope,
  Search,
  MapPin,
  Clock,
  Calendar,
  Mic,
} from 'lucide-react';

export default function SpecialistsView({
  doctors = [],
  appointments = [],
  selectedDoctorId,
  onSelectDoctorForCalendar,
  onAskMiaAboutDoctor,
}) {
  const [search, setSearch] = useState('');

  const filteredDoctors = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return doctors;
    return doctors.filter(
      (d) =>
        d.name?.toLowerCase().includes(q) ||
        d.specialization?.toLowerCase().includes(q) ||
        d.specialty?.toLowerCase().includes(q) ||
        d.room?.toLowerCase().includes(q)
    );
  }, [doctors, search]);

  return (
    <div className="w-full max-w-5xl mx-auto flex-1 flex flex-col gap-3 sm:gap-4 min-h-0">
      {/* Top Bar */}
      <section className="v-card p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-[6px] bg-[#141414] border border-[#262626] flex items-center justify-center shrink-0">
            <Stethoscope className="w-4 h-4 text-zinc-200" />
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-semibold text-white tracking-tight">
              Medical Specialists
            </h1>
            <p className="text-[11px] text-zinc-400">
              {doctors.length} consulting physicians · ABC Health Care
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search specialist or room..."
              aria-label="Search specialists"
              className="v-input !pl-8 !py-1.5 !text-xs bg-[#111111]"
            />
          </div>
          {selectedDoctorId && (
            <button
              type="button"
              onClick={() => onSelectDoctorForCalendar('')}
              className="btn-dark !py-1.5 !px-3 !text-xs shrink-0"
            >
              Show All
            </button>
          )}
        </div>
      </section>

      {/* Specialists Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 pb-4">
        {filteredDoctors.map((doc, idx) => {
          const isSelected = selectedDoctorId === doc.id;
          const initials = (doc.name || 'DR')
            .replace(/^Dr\.\s*/i, '')
            .split(' ')
            .map((part) => part[0])
            .join('')
            .slice(0, 2)
            .toUpperCase();

          const apptsCount = appointments.filter((a) => a.doctor_id === doc.id).length;
          const specialty = doc.specialization || doc.specialty || 'General Medicine';
          const room = doc.room || doc.room_number || 'Room 101';
          const degrees = doc.degrees || 'MBBS, MD';
          const experience = doc.experience || '10+ yrs experience';

          return (
            <motion.article
              key={doc.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: idx * 0.04, ease: [0.16, 1, 0.3, 1] }}
              className={`v-card p-4 sm:p-5 flex flex-col justify-between gap-4 transition-colors ${
                isSelected ? 'border-white/40 bg-[#111111]' : 'hover:border-[#383838]'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-[8px] bg-[#141414] border border-[#262626] flex items-center justify-center font-mono font-semibold text-xs text-zinc-200 shrink-0">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-sm font-semibold text-white truncate">{doc.name}</h2>
                      <p className="text-xs text-zinc-400 truncate">{specialty}</p>
                    </div>
                  </div>

                  <span className="text-[11px] font-mono px-2 py-0.5 rounded-[4px] bg-[#141414] border border-[#262626] text-zinc-300 shrink-0 tabular-nums">
                    {apptsCount} visits
                  </span>
                </div>

                <div className="text-[11px] font-mono text-zinc-500">{degrees}</div>

                <div className="pt-3 border-t border-[#1c1c1c] space-y-1.5 text-xs text-zinc-400">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                      <span>{room}</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-emerald-400 text-[11px]">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                      <span>Available</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                    <span className="truncate">{experience} · 09:00 AM – 05:00 PM</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => onSelectDoctorForCalendar(doc.id)}
                  className="btn-white flex-1 !py-2 !text-xs"
                >
                  <Calendar className="w-3.5 h-3.5 shrink-0" />
                  <span>Schedule</span>
                </button>
                <button
                  type="button"
                  onClick={() => onAskMiaAboutDoctor(doc)}
                  className="btn-dark !py-2 !px-3 !text-xs"
                  title={`Ask Mia about ${doc.name}`}
                >
                  <Mic className="w-3.5 h-3.5 shrink-0" />
                  <span>Ask Mia</span>
                </button>
              </div>
            </motion.article>
          );
        })}

        {filteredDoctors.length === 0 && (
          <div className="col-span-full v-card p-10 text-center text-xs text-zinc-500">
            No specialists match &ldquo;{search}&rdquo;.
          </div>
        )}
      </div>
    </div>
  );
}
