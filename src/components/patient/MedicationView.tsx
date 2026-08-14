import React, { useState } from 'react';
import { useCareSync } from '../../context/CareSyncContext';
import { Pill, Clock, CheckCircle2, Plus, ShieldCheck, Sparkles, X, AlertCircle } from 'lucide-react';
import { motion } from 'motion/react';

export const MedicationView: React.FC = () => {
  const { medications, takeMedication, snoozeMedication, addToast, addMedicationSchedule, deleteMedicationSchedule } = useCareSync();

  const [newMedModal, setNewMedModal] = useState<boolean>(false);
  const [medName, setMedName] = useState<string>('');
  const [medDosage, setMedDosage] = useState<string>('');
  const [medTimePicker, setMedTimePicker] = useState<string>('08:00');
  const [medCategory, setMedCategory] = useState<'morning' | 'afternoon' | 'evening'>('morning');
  const [medInstructions, setMedInstructions] = useState<string>('');

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
    const [hStr, mStr] = time24.split(':');
    let hours = parseInt(hStr, 10);
    const minutes = mStr || '00';
    const ampm = hours >= 12 ? 'PM' : 'AM';
    if (hours === 0) hours = 12;
    else if (hours > 12) hours -= 12;
    return `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;
  };

  const handleAddMedication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!medName.trim()) return;

    const formattedTime = format24hTo12h(medTimePicker);

    try {
      await addMedicationSchedule({
        name: medName.trim(),
        dosage: medDosage.trim() || '1 tablet',
        scheduledTime: formattedTime,
        instructions: medInstructions.trim() || 'Take as prescribed',
        category: medCategory,
      });
      setNewMedModal(false);
      setMedName('');
      setMedDosage('');
      setMedInstructions('');
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-10 pb-20 pt-2 px-1">
      {/* 1. EDITORIAL HEADER */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-stone-200/80 pb-6">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-teal-800 block mb-1">
              Daily Pharmacy Routine
            </span>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-stone-900 tracking-tight">
              Medication Management
            </h1>
            <p className="text-base text-stone-600 font-medium mt-1">
              {totalCount > 0
                ? `Confirmed ${takenCount} of ${totalCount} scheduled doses for today.`
                : 'No medications scheduled today. Add your daily prescriptions below.'}
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Weekly Adherence pill */}
            <div className="bg-stone-100/80 border border-stone-200 px-4 py-2.5 rounded-2xl flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-800 flex items-center justify-center font-extrabold text-xs">
                <ShieldCheck className="w-5 h-5 text-emerald-700" />
              </div>
              <div>
                <div className="text-[11px] text-stone-500 font-semibold uppercase tracking-wider">Adherence</div>
                <div className="text-base font-extrabold text-stone-900">{adherencePercent}%</div>
              </div>
            </div>

            <button
              onClick={() => setNewMedModal(true)}
              className="py-3 px-4 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs shadow-xs transition-colors flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Add Schedule
            </button>
          </div>
        </div>
      </motion.section>

      {/* 2. PRIMARY ACTIONABLE FOCUS: CURRENT / NEXT MEDICATION */}
      {nextMedication ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-widest text-teal-800 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              Primary Action
            </h2>
            <span className="text-xs text-stone-500 font-medium">
              Scheduled: {nextMedication.scheduledTime}
            </span>
          </div>

          <div className="bg-white border border-stone-200/90 rounded-2xl p-6 sm:p-7 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-4">
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-100 text-teal-700 flex items-center justify-center">
                  <Pill className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-stone-900">{nextMedication.name}</h3>
                  <p className="text-xs font-semibold text-stone-500">{nextMedication.dosage}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span
                  className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                    nextMedication.status === 'taken'
                      ? 'bg-emerald-100 text-emerald-800'
                      : nextMedication.status === 'due'
                      ? 'bg-amber-100 text-amber-900 animate-pulse'
                      : 'bg-stone-100 text-stone-700'
                  }`}
                >
                  {nextMedication.status === 'taken'
                    ? 'Taken Today'
                    : nextMedication.status === 'due'
                    ? 'Due Now'
                    : 'Upcoming'}
                </span>
              </div>
            </div>

            <p className="text-xs text-stone-600 font-medium bg-stone-50 p-3.5 rounded-xl border border-stone-100">
              💡 <span className="font-semibold text-stone-800">Instructions:</span> {nextMedication.instructions}
            </p>

            <div className="flex items-center gap-3 pt-2">
              {nextMedication.status !== 'taken' ? (
                <>
                  <button
                    onClick={() => takeMedication(nextMedication.id)}
                    className="flex-1 py-3.5 px-4 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs shadow-xs transition-colors flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Confirm Taken ({nextMedication.scheduledTime})
                  </button>
                  <button
                    onClick={() => snoozeMedication(nextMedication.id, 15)}
                    className="py-3.5 px-4 rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-50 font-semibold text-xs transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Clock className="w-4 h-4" />
                    Snooze 15m
                  </button>
                </>
              ) : (
                <div className="w-full py-3 px-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-xs flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Confirmed Taken at {nextMedication.takenAt || 'today'}
                </div>
              )}
            </div>
          </div>
        </section>
      ) : (
        <section className="bg-stone-50 border border-dashed border-stone-200 rounded-3xl p-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-white border border-stone-200 text-stone-400 flex items-center justify-center mx-auto">
            <Pill className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-stone-800">No Medication Schedule Configured</h3>
          <p className="text-xs text-stone-500 max-w-sm mx-auto">
            Add your daily medications to receive automated alarms, reminder chimes, and adherence tracking.
          </p>
          <button
            onClick={() => setNewMedModal(true)}
            className="py-2.5 px-5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs shadow-xs transition-colors inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add First Medication
          </button>
        </section>
      )}

      {/* 3. DAILY SCHEDULE LIST */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-widest text-stone-700">All Scheduled Doses</h2>
          <span className="text-xs font-semibold text-stone-500">{activeMeds.length} Active Prescriptions</span>
        </div>

        <div className="space-y-3">
          {activeMeds.map((med) => (
            <div
              key={med.id}
              className="bg-white border border-stone-200/80 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs hover:border-teal-200 transition-colors"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-stone-100 text-stone-700 flex items-center justify-center shrink-0">
                  <Pill className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-bold text-stone-900">{med.name}</h4>
                    <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded-md bg-stone-100 text-stone-600">
                      {med.category}
                    </span>
                  </div>
                  <p className="text-xs text-stone-500 font-medium">
                    {med.dosage} • <span className="font-semibold text-teal-800">{med.scheduledTime}</span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 self-end sm:self-center">
                {med.status !== 'taken' ? (
                  <button
                    onClick={() => takeMedication(med.id)}
                    className="py-2 px-3.5 rounded-xl bg-stone-900 hover:bg-black text-white font-bold text-xs transition-colors flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Take Dose
                  </button>
                ) : (
                  <span className="px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-xs flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Taken
                  </span>
                )}

                <button
                  onClick={() => deleteMedicationSchedule(med.id)}
                  title="Remove from schedule"
                  className="p-2 text-stone-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4. MODAL: ADD MEDICATION SCHEDULE WITH STRUCTURED TIME PICKER */}
      {newMedModal && (
        <div className="fixed inset-0 z-50 bg-stone-950/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full border border-stone-200 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
                  <Pill className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-stone-900">Add Medication Schedule</h3>
              </div>
              <button
                onClick={() => setNewMedModal(false)}
                className="p-1 text-stone-400 hover:text-stone-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddMedication} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">Medication Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Lisinopril or Vitamin D3"
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
                    placeholder="e.g. 10mg / 1 tablet"
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

              {/* Structured Time Picker */}
              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">
                  Scheduled Daily Time (Time Picker)
                </label>
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

              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">Instructions / Note</label>
                <input
                  type="text"
                  placeholder="e.g. Take with warm water after breakfast"
                  value={medInstructions}
                  onChange={(e) => setMedInstructions(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-xs font-medium text-stone-800 focus:outline-none focus:ring-2 focus:ring-teal-700"
                />
              </div>

              <div className="flex gap-2.5 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setNewMedModal(false)}
                  className="w-1/2 py-3 rounded-xl border border-stone-200 text-stone-600 font-semibold text-xs hover:bg-stone-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-3 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs shadow-xs transition-colors"
                >
                  Save Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
