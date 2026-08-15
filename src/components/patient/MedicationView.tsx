import React, { useState, useEffect } from 'react';
import { useCareSync } from '../../context/CareSyncContext';
import {
  Pill,
  Clock,
  CheckCircle2,
  Plus,
  ShieldCheck,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  X,
  Volume2,
  Trash2,
  Edit2,
  Sparkles,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Medication } from '../../types';

export const MedicationView: React.FC = () => {
  const {
    medications,
    selectedDate,
    setSelectedDate,
    takeMedication,
    snoozeMedication,
    addMedicationSchedule,
    updateMedicationSchedule,
    deleteMedicationSchedule,
    triggerAlarmTest,
  } = useCareSync();

  const [newMedModal, setNewMedModal] = useState<boolean>(false);
  const [editingMed, setEditingMed] = useState<Medication | null>(null);

  // Calendar state
  const initialDate = selectedDate ? new Date(`${selectedDate}T12:00:00Z`) : new Date();
  const [currentYear, setCurrentYear] = useState<number>(initialDate.getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(initialDate.getMonth()); // 0 - 11

  // Form State
  const [medName, setMedName] = useState<string>('');
  const [medDosage, setMedDosage] = useState<string>('');
  const [medTimePicker, setMedTimePicker] = useState<string>('08:00');
  const [medCategory, setMedCategory] = useState<'morning' | 'afternoon' | 'evening'>('morning');
  const [medInstructions, setMedInstructions] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [repeatPattern, setRepeatPattern] = useState<'daily' | 'weekdays' | 'weekends' | 'custom'>('daily');
  const [customDays, setCustomDays] = useState<string[]>(['Mon', 'Wed', 'Fri']);

  const activeMeds = medications.filter((m) => m.status !== undefined);
  const takenCount = activeMeds.filter((m) => m.status === 'taken').length;
  const totalCount = activeMeds.length;
  const adherencePercent = totalCount > 0 ? Math.round((takenCount / totalCount) * 100) : 100;

  const nextMedication =
    activeMeds.find((m) => m.status === 'due') ||
    activeMeds.find((m) => m.status === 'upcoming') ||
    (activeMeds.length > 0 ? activeMeds[0] : null);

  // Convert 24h format (e.g. 14:30) to 12h AM/PM (e.g. 02:30 PM)
  const format24hTo12h = (time24: string): string => {
    if (!time24) return '08:00 AM';
    if (time24.includes('AM') || time24.includes('PM')) return time24;
    const [hStr, mStr] = time24.split(':');
    let hours = parseInt(hStr, 10);
    const minutes = mStr || '00';
    const ampm = hours >= 12 ? 'PM' : 'AM';
    if (hours === 0) hours = 12;
    else if (hours > 12) hours -= 12;
    return `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
  };

  const format12hTo24h = (time12: string): string => {
    if (!time12) return '08:00';
    const match = time12.match(/(\d+):(\d+)\s*(AM|PM)?/i);
    if (!match) return '08:00';
    let h = parseInt(match[1], 10);
    const m = match[2];
    const ampm = match[3]?.toUpperCase();
    if (ampm === 'PM' && h < 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${m}`;
  };

  // Calendar calculation
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];
  const dayNamesShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay();

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const handleSelectDay = (day: number) => {
    const monthStr = String(currentMonth + 1).padStart(2, '0');
    const dayStr = String(day).padStart(2, '0');
    const formatted = `${currentYear}-${monthStr}-${dayStr}`;
    setSelectedDate(formatted);
  };

  const handleOpenAddModal = () => {
    setEditingMed(null);
    setMedName('');
    setMedDosage('');
    setMedTimePicker('08:00');
    setMedCategory('morning');
    setMedInstructions('');
    setStartDate(selectedDate || new Date().toISOString().split('T')[0]);
    setEndDate('');
    setRepeatPattern('daily');
    setCustomDays(['Mon', 'Wed', 'Fri']);
    setNewMedModal(true);
  };

  const handleOpenEditModal = (med: Medication) => {
    setEditingMed(med);
    setMedName(med.name);
    setMedDosage(med.dosage);
    setMedTimePicker(format12hTo24h(med.scheduledTime));
    setMedCategory(med.category || 'morning');
    setMedInstructions(med.instructions || '');
    setStartDate(med.startDate || '');
    setEndDate(med.endDate || '');
    setRepeatPattern(med.repeatPattern || 'daily');
    setCustomDays(med.daysOfWeek || ['Mon', 'Wed', 'Fri']);
    setNewMedModal(true);
  };

  const toggleCustomDay = (day: string) => {
    setCustomDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleSaveMedication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!medName.trim()) return;

    const formattedTime = format24hTo12h(medTimePicker);

    try {
      if (editingMed) {
        await updateMedicationSchedule(editingMed.id, {
          name: medName.trim(),
          dosage: medDosage.trim() || '1 tablet',
          scheduledTime: formattedTime,
          instructions: medInstructions.trim() || 'Take as prescribed',
          category: medCategory,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          repeatPattern,
          daysOfWeek: repeatPattern === 'custom' ? customDays : undefined,
        });
      } else {
        await addMedicationSchedule({
          name: medName.trim(),
          dosage: medDosage.trim() || '1 tablet',
          scheduledTime: formattedTime,
          instructions: medInstructions.trim() || 'Take as prescribed',
          category: medCategory,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          repeatPattern,
          daysOfWeek: repeatPattern === 'custom' ? customDays : undefined,
        });
      }
      setNewMedModal(false);
    } catch (err) {
      console.error(err);
    }
  };

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className="max-w-4xl mx-auto space-y-10 pb-20 pt-2 px-1">
      {/* 1. HEADER */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-stone-200/80 pb-6">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-teal-800 block mb-1">
              Monthly Prescription Calendar
            </span>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-stone-900 tracking-tight">
              Medication Management
            </h1>
            <p className="text-base text-stone-600 font-medium mt-1">
              Schedule prescriptions over entire months with recurring rules and real alarm reminders.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              onClick={() => triggerAlarmTest('medication')}
              className="py-2.5 px-3.5 rounded-xl border border-teal-200 bg-teal-50 hover:bg-teal-100 text-teal-800 font-bold text-xs shadow-xs transition-colors flex items-center gap-1.5"
              title="Test the native alarm chime and alert experience"
            >
              <Volume2 className="w-3.5 h-3.5 text-teal-700" />
              Preview Alarm
            </button>

            {/* Adherence pill */}
            <div className="bg-stone-100/80 border border-stone-200 px-3.5 py-2 rounded-xl flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4 text-emerald-700" />
              <div className="text-xs font-extrabold text-stone-900">{adherencePercent}% Adherence</div>
            </div>

            <button
              onClick={handleOpenAddModal}
              className="py-2.5 px-4 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs shadow-xs transition-colors flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Add Medication
            </button>
          </div>
        </div>
      </motion.section>

      {/* 2. MONTH-LONG INTERACTIVE CALENDAR */}
      <section className="bg-white border border-stone-200/90 rounded-3xl p-6 sm:p-7 shadow-xs space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-800 flex items-center justify-center font-extrabold border border-teal-100">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-stone-900">
                {monthNames[currentMonth]} {currentYear}
              </h2>
              <p className="text-xs text-stone-500 font-semibold">
                Select any date to inspect scheduled doses
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const now = new Date();
                setCurrentYear(now.getFullYear());
                setCurrentMonth(now.getMonth());
                setSelectedDate(todayStr);
              }}
              className="py-1.5 px-3 rounded-xl border border-stone-200 text-xs font-bold text-stone-700 hover:bg-stone-50"
            >
              Today
            </button>
            <button
              onClick={handlePrevMonth}
              className="p-2 rounded-xl border border-stone-200 hover:bg-stone-100 text-stone-600 transition-colors"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleNextMonth}
              className="p-2 rounded-xl border border-stone-200 hover:bg-stone-100 text-stone-600 transition-colors"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 7-Column Grid */}
        <div>
          <div className="grid grid-cols-7 gap-1 text-center mb-2">
            {dayNamesShort.map((day) => (
              <span key={day} className="text-[11px] font-extrabold uppercase tracking-wider text-stone-400 py-1">
                {day}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {/* Empty slots before first day of month */}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} className="h-14 sm:h-16 rounded-2xl bg-stone-50/40" />
            ))}

            {/* Month Day Cells */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const monthStr = String(currentMonth + 1).padStart(2, '0');
              const dayStr = String(dayNum).padStart(2, '0');
              const cellDateStr = `${currentYear}-${monthStr}-${dayStr}`;

              const isSelected = selectedDate === cellDateStr;
              const isToday = todayStr === cellDateStr;

              return (
                <button
                  key={cellDateStr}
                  onClick={() => handleSelectDay(dayNum)}
                  className={`h-14 sm:h-16 rounded-2xl p-1.5 flex flex-col justify-between items-center transition-all border ${
                    isSelected
                      ? 'bg-teal-800 text-white border-teal-900 shadow-md ring-2 ring-teal-600/30'
                      : isToday
                      ? 'bg-teal-50/80 border-teal-300 text-teal-900'
                      : 'bg-white hover:bg-stone-50 border-stone-200/80 text-stone-800'
                  }`}
                >
                  <span className={`text-xs font-black ${isSelected ? 'text-white' : ''}`}>
                    {dayNum}
                  </span>

                  {/* Dot indicator if active meds exist */}
                  <div className="flex gap-0.5 mt-auto">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isSelected ? 'bg-teal-200' : 'bg-teal-600'
                      }`}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* 3. SELECTED DATE MEDICATION SCHEDULE */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-stone-200 pb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-teal-800" />
            <h2 className="text-base font-extrabold text-stone-900">
              Schedule for {selectedDate || todayStr}
            </h2>
          </div>
          <span className="text-xs font-semibold text-stone-500">
            {activeMeds.length} Prescription(s)
          </span>
        </div>

        {activeMeds.length === 0 ? (
          <div className="bg-stone-50 border border-dashed border-stone-200 rounded-3xl p-8 text-center space-y-3">
            <Pill className="w-10 h-10 text-stone-300 mx-auto" />
            <h3 className="text-base font-bold text-stone-800">No Medications Scheduled on this Date</h3>
            <p className="text-xs text-stone-500 max-w-sm mx-auto">
              Schedule daily or recurring prescriptions for this date using the Add button.
            </p>
            <button
              onClick={handleOpenAddModal}
              className="py-2.5 px-4 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs shadow-xs"
            >
              + Schedule for {selectedDate || 'Today'}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {activeMeds.map((med) => (
              <div
                key={med.id}
                className="bg-white border border-stone-200/90 rounded-2xl p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center font-bold shrink-0 border border-teal-100">
                    <Pill className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-base font-bold text-stone-900">{med.name}</h4>
                      <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-md bg-stone-100 text-stone-600">
                        {med.category}
                      </span>
                      {med.repeatPattern && med.repeatPattern !== 'daily' && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-sky-50 text-sky-700 border border-sky-200">
                          {med.repeatPattern}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-stone-500 font-medium mt-0.5">
                      {med.dosage} • <span className="font-extrabold text-teal-800">{med.scheduledTime}</span>
                      {med.instructions ? ` • ${med.instructions}` : ''}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-center">
                  {med.status !== 'taken' ? (
                    <>
                      <button
                        onClick={() => takeMedication(med.id, selectedDate)}
                        className="py-2 px-3.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs shadow-xs transition-colors flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Take Dose
                      </button>
                      <button
                        onClick={() => snoozeMedication(med.id, 10)}
                        className="py-2 px-3 rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-50 font-semibold text-xs transition-colors"
                      >
                        Snooze
                      </button>
                    </>
                  ) : (
                    <span className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-xs flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Confirmed Taken
                    </span>
                  )}

                  <button
                    onClick={() => handleOpenEditModal(med)}
                    className="p-2 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-100"
                    title="Edit Schedule"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteMedicationSchedule(med.id)}
                    className="p-2 text-stone-400 hover:text-rose-600 rounded-lg hover:bg-rose-50"
                    title="Delete Prescription"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 4. MODAL: ADD / EDIT RECURRING MEDICATION */}
      <AnimatePresence>
        {newMedModal && (
          <div className="fixed inset-0 z-50 bg-stone-950/50 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 sm:p-7 max-w-lg w-full border border-stone-200 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-stone-100 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
                    <Pill className="w-4 h-4" />
                  </div>
                  <h3 className="text-base font-bold text-stone-900">
                    {editingMed ? 'Edit Medication Schedule' : 'Schedule Medication'}
                  </h3>
                </div>
                <button
                  onClick={() => setNewMedModal(false)}
                  className="p-1 text-stone-400 hover:text-stone-600 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveMedication} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">Medication Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Atorvastatin or Metformin"
                    value={medName}
                    onChange={(e) => setMedName(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-xs font-medium text-stone-800 focus:outline-none focus:ring-2 focus:ring-teal-700"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-stone-700 block mb-1">Dosage</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 20 mg"
                      value={medDosage}
                      onChange={(e) => setMedDosage(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-xs font-medium text-stone-800 focus:outline-none focus:ring-2 focus:ring-teal-700"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-stone-700 block mb-1">Category</label>
                    <select
                      value={medCategory}
                      onChange={(e) => setMedCategory(e.target.value as any)}
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-xs font-medium text-stone-800 focus:outline-none focus:ring-2 focus:ring-teal-700"
                    >
                      <option value="morning">Morning</option>
                      <option value="afternoon">Afternoon</option>
                      <option value="evening">Evening</option>
                    </select>
                  </div>
                </div>

                {/* Time Picker */}
                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">Scheduled Time</label>
                  <div className="flex items-center gap-3">
                    <input
                      type="time"
                      required
                      value={medTimePicker}
                      onChange={(e) => setMedTimePicker(e.target.value)}
                      className="flex-1 bg-stone-50 border border-stone-200 rounded-xl p-3 text-sm font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-teal-700"
                    />
                    <div className="px-3.5 py-2.5 bg-teal-50 border border-teal-200 rounded-xl text-teal-800 font-extrabold text-xs">
                      {format24hTo12h(medTimePicker)}
                    </div>
                  </div>
                </div>

                {/* Recurrence Rule Selector */}
                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">Repeat Pattern</label>
                  <select
                    value={repeatPattern}
                    onChange={(e) => setRepeatPattern(e.target.value as any)}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-xs font-medium text-stone-800 focus:outline-none focus:ring-2 focus:ring-teal-700"
                  >
                    <option value="daily">Every Day</option>
                    <option value="weekdays">Weekdays Only (Monday - Friday)</option>
                    <option value="weekends">Weekends Only (Saturday - Sunday)</option>
                    <option value="custom">Custom Days</option>
                  </select>
                </div>

                {/* Custom Days Selector */}
                {repeatPattern === 'custom' && (
                  <div>
                    <label className="text-[11px] font-bold text-stone-600 block mb-1.5">Select Active Days</label>
                    <div className="flex flex-wrap gap-1.5">
                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                        <button
                          key={day}
                          type="button"
                          onClick={() => toggleCustomDay(day)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-colors border ${
                            customDays.includes(day)
                              ? 'bg-teal-700 text-white border-teal-800'
                              : 'bg-stone-100 text-stone-600 border-stone-200'
                          }`}
                        >
                          {day}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Date Range Boundaries */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] font-bold text-stone-600 block mb-1">Start Date</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl p-2.5 text-xs font-semibold text-stone-800"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-stone-600 block mb-1">End Date (Optional)</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl p-2.5 text-xs font-semibold text-stone-800"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">Instructions / Note</label>
                  <input
                    type="text"
                    placeholder="e.g. Take with food or warm water"
                    value={medInstructions}
                    onChange={(e) => setMedInstructions(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-xs font-medium text-stone-800 focus:outline-none focus:ring-2 focus:ring-teal-700"
                  />
                </div>

                <div className="flex gap-2.5 pt-3 border-t border-stone-100">
                  <button
                    type="button"
                    onClick={() => setNewMedModal(false)}
                    className="w-1/2 py-3 rounded-xl border border-stone-200 text-stone-600 font-semibold text-xs hover:bg-stone-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="w-1/2 py-3 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs shadow-xs"
                  >
                    {editingMed ? 'Update Schedule' : 'Save Prescription'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
