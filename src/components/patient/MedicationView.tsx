import React, { useState } from 'react';
import { useCareSync } from '../../context/CareSyncContext';
import { Pill, Clock, CheckCircle2, Plus, ArrowRight, ShieldCheck, Sparkles, X } from 'lucide-react';
import { motion } from 'motion/react';

export const MedicationView: React.FC = () => {
  const { medications, takeMedication, snoozeMedication, addToast, addMedicationSchedule } = useCareSync();

  const [newMedModal, setNewMedModal] = useState<boolean>(false);
  const [medName, setMedName] = useState<string>('');
  const [medDosage, setMedDosage] = useState<string>('');
  const [medTime, setMedTime] = useState<string>('12:00 PM');

  const takenCount = medications.filter((m) => m.status === 'taken').length;
  const totalCount = medications.length;
  const adherencePercent = 94; // Realistic demo rate

  const nextMedication =
    medications.find((m) => m.status === 'due') ||
    medications.find((m) => m.status === 'upcoming') ||
    medications[0];

  const handleAddMedication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!medName.trim()) return;
    if (addMedicationSchedule) {
      await addMedicationSchedule({
        name: medName,
        dosage: medDosage || '1 tablet',
        scheduledTime: medTime || '12:00 PM',
        instructions: 'Take as prescribed',
        category: 'afternoon',
      });
    } else {
      addToast(`Added new medication schedule for ${medName}`, 'success');
    }
    setNewMedModal(false);
    setMedName('');
    setMedDosage('');
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
              Confirmed {takenCount} of {totalCount} scheduled doses for today.
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
      {nextMedication && (
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
                <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-900 flex items-center justify-center shrink-0">
                  <Pill className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-stone-500">{nextMedication.scheduledTime}</span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                        nextMedication.status === 'taken'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : nextMedication.status === 'due'
                          ? 'bg-amber-50 text-amber-900 border-amber-300 animate-pulse'
                          : 'bg-stone-100 text-stone-700 border-stone-200'
                      }`}
                    >
                      {nextMedication.status === 'taken'
                        ? 'Taken ✓'
                        : nextMedication.status === 'due'
                        ? 'Due Now'
                        : 'Scheduled'}
                    </span>
                  </div>
                  <h3 className="text-2xl font-bold text-stone-900 mt-0.5">{nextMedication.name}</h3>
                </div>
              </div>

              <div className="text-xs text-stone-600 font-medium sm:text-right">
                <span className="block text-sm font-bold text-stone-900">{nextMedication.dosage}</span>
                <span className="text-stone-500">{nextMedication.instructions}</span>
              </div>
            </div>

            <p className="text-sm text-stone-600 leading-relaxed">
              {nextMedication.status === 'taken'
                ? 'All current medications are up to date for today. You can view full schedule below.'
                : 'Please take this dose with a full glass of water at your designated time.'}
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              {nextMedication.status !== 'taken' ? (
                <>
                  <button
                    onClick={() => takeMedication(nextMedication.id)}
                    className="py-3.5 px-6 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-sm shadow-xs transition-colors flex items-center gap-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Mark as taken
                  </button>
                  <button
                    onClick={() => snoozeMedication(nextMedication.id, 30)}
                    className="py-3.5 px-5 rounded-xl border border-stone-200 text-stone-700 hover:bg-stone-50 font-semibold text-sm transition-colors"
                  >
                    Remind me later
                  </button>
                </>
              ) : (
                <div className="py-2.5 px-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 font-bold text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Dose Confirmed at {nextMedication.takenAt || nextMedication.scheduledTime}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* 3. TODAY'S TIMELINE / HISTORY */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-widest text-teal-800">
            Today's Schedule & History
          </h2>
          <span className="text-xs font-semibold text-stone-500">
            {takenCount} of {totalCount} Completed
          </span>
        </div>

        <div className="bg-white border border-stone-200/90 rounded-2xl p-6 shadow-xs space-y-6">
          <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-stone-200">
            {medications.map((med) => (
              <motion.div
                key={med.id}
                whileHover={{ x: 2 }}
                className="relative flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl bg-stone-50/70 border border-stone-200/80 transition-all"
              >
                {/* Status Dot */}
                <div
                  className={`absolute -left-[27px] top-5 w-4 h-4 rounded-full ring-4 ring-white ${
                    med.status === 'taken'
                      ? 'bg-emerald-600'
                      : med.status === 'due'
                      ? 'bg-amber-500 animate-pulse'
                      : 'bg-stone-300'
                  }`}
                />

                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-stone-500">{med.scheduledTime}</span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                        med.status === 'taken'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : med.status === 'due'
                          ? 'bg-amber-50 text-amber-900 border-amber-300'
                          : 'bg-stone-100 text-stone-700 border-stone-200'
                      }`}
                    >
                      {med.status === 'taken'
                        ? 'Taken ✓'
                        : med.status === 'due'
                        ? 'Due Now'
                        : 'Upcoming'}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-stone-900">{med.name}</h3>
                  <p className="text-xs text-stone-600 font-medium">{med.dosage}</p>
                  <p className="text-[11px] text-stone-400">{med.instructions}</p>
                </div>

                <div className="flex items-center gap-2">
                  {med.status !== 'taken' ? (
                    <>
                      <button
                        onClick={() => takeMedication(med.id)}
                        className="py-2 px-3.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs transition-colors flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Mark Taken
                      </button>
                      <button
                        onClick={() => snoozeMedication(med.id, 30)}
                        className="py-2 px-3 rounded-lg border border-stone-200 text-stone-600 hover:bg-white font-medium text-xs transition-colors"
                      >
                        Snooze
                      </button>
                    </>
                  ) : (
                    <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-200 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Confirmed ({med.takenAt || med.scheduledTime})
                    </span>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* 4. WEEKLY ADHERENCE TREND */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-widest text-teal-800">
            Weekly Adherence Summary
          </h2>
          <span className="text-xs font-semibold text-stone-500">
            Weekly Target: &gt;90%
          </span>
        </div>

        <div className="bg-white border border-stone-200/90 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="grid grid-cols-7 gap-2 pt-2 text-center">
            {[
              { day: 'Mon', rate: 100 },
              { day: 'Tue', rate: 100 },
              { day: 'Wed', rate: 100 },
              { day: 'Thu', rate: 66 },
              { day: 'Fri', rate: 100 },
              { day: 'Sat', rate: 100 },
              { day: 'Sun', rate: 100 },
            ].map((item, idx) => (
              <div key={idx} className="flex flex-col items-center gap-2">
                <div className="w-full h-20 bg-stone-100 rounded-xl p-1 flex items-end">
                  <div
                    className={`w-full rounded-lg transition-all duration-500 ${
                      item.rate >= 90 ? 'bg-teal-700' : 'bg-amber-600'
                    }`}
                    style={{ height: `${item.rate}%` }}
                  />
                </div>
                <span className="text-xs font-bold text-stone-700">{item.day}</span>
                <span className="text-[10px] text-stone-400 font-semibold">{item.rate}%</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 5. ADD MEDICATION MODAL */}
      {newMedModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-stone-200 space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-stone-900">Add Medication Schedule</h3>
                <p className="text-xs text-stone-500 mt-0.5">Set up a daily reminder confirmation.</p>
              </div>
              <button
                onClick={() => setNewMedModal(false)}
                className="p-1 text-stone-400 hover:text-stone-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddMedication} className="space-y-3.5">
              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">Medication Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Calcium Citrate"
                  value={medName}
                  onChange={(e) => setMedName(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-xs font-medium text-stone-800 focus:outline-none focus:ring-2 focus:ring-teal-700"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">Dosage & Instructions</label>
                <input
                  type="text"
                  placeholder="e.g. 500mg - Take 1 tablet with warm water"
                  value={medDosage}
                  onChange={(e) => setMedDosage(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-xs font-medium text-stone-800 focus:outline-none focus:ring-2 focus:ring-teal-700"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">Scheduled Time</label>
                <select
                  value={medTime}
                  onChange={(e) => setMedTime(e.target.value)}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-xs font-medium text-stone-800 focus:outline-none focus:ring-2 focus:ring-teal-700"
                >
                  <option value="08:00 AM">08:00 AM (Morning)</option>
                  <option value="01:00 PM">01:00 PM (Afternoon)</option>
                  <option value="08:00 PM">08:00 PM (Evening)</option>
                </select>
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

