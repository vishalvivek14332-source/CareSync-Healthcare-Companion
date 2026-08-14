import React, { useState } from 'react';
import { useCareSync } from '../../context/CareSyncContext';
import { Medication } from '../../types';
import {
  User,
  Activity,
  Pill,
  Droplet,
  Footprints,
  Calendar,
  Clock,
  CheckCircle2,
  Plus,
  Edit2,
  Trash2,
  X,
  Check,
  AlertCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const CaregiverPatientView: React.FC = () => {
  const {
    patient,
    selectedPatientId,
    medications,
    hydration,
    activity,
    careScore,
    addMedicationSchedule,
    updateMedicationSchedule,
    deleteMedicationSchedule,
    addToast,
  } = useCareSync();

  // Medication Modal States
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [editingMedId, setEditingMedId] = useState<string | null>(null);
  const [medName, setMedName] = useState<string>('');
  const [medDosage, setMedDosage] = useState<string>('');
  const [medTime, setMedTime] = useState<string>('08:00 AM');
  const [medInstructions, setMedInstructions] = useState<string>('');
  const [medCategory, setMedCategory] = useState<'morning' | 'afternoon' | 'evening'>('morning');

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

  const format12hTo24h = (time12: string): string => {
    if (!time12) return '08:00';
    const match = time12.match(/(\d+):(\d+)\s*(AM|PM)?/i);
    if (!match) return '08:00';
    let h = parseInt(match[1], 10);
    const m = match[2].padStart(2, '0');
    const ampm = match[3]?.toUpperCase();
    if (ampm === 'PM' && h < 12) h += 12;
    if (ampm === 'AM' && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${m}`;
  };

  const openAddModal = () => {
    setEditingMedId(null);
    setMedName('');
    setMedDosage('');
    setMedTime('08:00');
    setMedInstructions('');
    setMedCategory('morning');
    setModalOpen(true);
  };

  const openEditModal = (med: Medication) => {
    setEditingMedId(med.id);
    setMedName(med.name);
    setMedDosage(med.dosage);
    setMedTime(format12hTo24h(med.scheduledTime));
    setMedInstructions(med.instructions || '');
    setMedCategory(med.category || 'morning');
    setModalOpen(true);
  };

  const handleSaveMedication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!medName.trim() || !medDosage.trim()) {
      addToast('Please provide a medication name and dosage.', 'warning');
      return;
    }

    const formattedTime = format24hTo12h(medTime);

    if (editingMedId) {
      await updateMedicationSchedule(editingMedId, {
        name: medName,
        dosage: medDosage,
        scheduledTime: formattedTime,
        instructions: medInstructions,
        category: medCategory,
      });
    } else {
      await addMedicationSchedule({
        name: medName,
        dosage: medDosage,
        scheduledTime: formattedTime,
        instructions: medInstructions,
        category: medCategory,
        patientId: selectedPatientId || patient.id,
      });
    }
    setModalOpen(false);
  };

  const handleDeleteMedication = async (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to deactivate and remove ${name}?`)) {
      await deleteMedicationSchedule(id);
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Patient Header */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <img
            src={patient?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250'}
            alt={patient?.name || 'Patient'}
            className="w-16 h-16 rounded-2xl object-cover border-2 border-indigo-600 shadow-md"
          />
          <div>
            <h1 className="text-2xl font-extrabold text-slate-900">{patient?.name || 'Connected Patient'}</h1>
            <p className="text-xs text-slate-500 font-medium">
              Age: {patient?.age || 72} • Primary Caregiver: {patient?.primaryCaregiver || 'Caregiver'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs font-bold text-slate-600">
          <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 text-center">
            <span className="text-[10px] text-slate-400 block uppercase">Overall CareScore</span>
            <span className="text-xl font-extrabold text-indigo-700">{careScore?.totalScore ?? 100} / 100</span>
          </div>
        </div>
      </div>

      {/* MEDICATION MANAGEMENT SECTION */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <Pill className="w-5 h-5 text-teal-700" />
              Patient Medication Schedules
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Caregiver schedule changes automatically synchronize to {patient?.name?.split(' ')[0] || 'your patient'}'s device.
            </p>
          </div>

          <button
            onClick={openAddModal}
            className="py-2.5 px-4 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs shadow-xs transition-colors flex items-center gap-1.5 self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            Add Medication
          </button>
        </div>

        {medications.length === 0 ? (
          <div className="text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            <Pill className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-600">No medications scheduled for this patient.</p>
            <button
              onClick={openAddModal}
              className="mt-3 py-2 px-4 rounded-xl bg-teal-700 text-white text-xs font-bold shadow-xs hover:bg-teal-800"
            >
              Add First Medication
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {medications.map((m) => (
              <div
                key={m.id}
                className="p-4 bg-slate-50/80 hover:bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-3 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between font-bold text-slate-900 mb-1">
                    <span className="text-sm font-extrabold text-slate-900">{m.name}</span>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        m.status === 'taken'
                          ? 'bg-emerald-100 text-emerald-800'
                          : m.status === 'due'
                          ? 'bg-amber-100 text-amber-900'
                          : 'bg-indigo-50 text-indigo-800'
                      }`}
                    >
                      {m.status}
                    </span>
                  </div>

                  <p className="text-slate-600 font-medium">{m.dosage}</p>
                  {m.instructions && (
                    <p className="text-slate-500 text-[11px] mt-1 italic">"{m.instructions}"</p>
                  )}

                  <div className="flex items-center gap-1.5 text-[11px] font-bold text-teal-800 mt-2 bg-teal-50/60 px-2.5 py-1 rounded-lg w-fit">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{m.scheduledTime}</span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-slate-200/60">
                  <button
                    onClick={() => openEditModal(m)}
                    className="p-2 rounded-xl text-slate-600 hover:text-indigo-700 hover:bg-indigo-50 transition-colors"
                    title="Edit Schedule"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteMedication(m.id, m.name)}
                    className="p-2 rounded-xl text-slate-400 hover:text-rose-700 hover:bg-rose-50 transition-colors"
                    title="Deactivate / Remove"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* DETAILED LOGS GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Hydration Logs */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Droplet className="w-5 h-5 text-sky-600" />
            Hydration Timeline
          </h2>

          <div className="space-y-2.5 max-h-64 overflow-y-auto">
            {hydration.logs.length > 0 ? (
              hydration.logs.map((h) => (
                <div
                  key={h.id}
                  className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs flex justify-between items-center"
                >
                  <span className="font-bold text-slate-900">+{h.amountMl} ml</span>
                  <span className="text-slate-400 font-medium">{h.timestamp}</span>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 italic">No hydration logs recorded today.</p>
            )}
          </div>
        </div>

        {/* Movement Summary */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Footprints className="w-5 h-5 text-emerald-600" />
            Activity Summary
          </h2>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
              <span className="font-semibold text-slate-600">Total Steps:</span>
              <span className="font-extrabold text-slate-900">
                {activity.steps.toLocaleString()} / {activity.stepGoal.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
              <span className="font-semibold text-slate-600">Active Minutes:</span>
              <span className="font-extrabold text-slate-900">{activity.activeMinutes} mins</span>
            </div>
            <div className="flex justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
              <span className="font-semibold text-slate-600">Distance Walked:</span>
              <span className="font-extrabold text-slate-900">{activity.distanceKm} km</span>
            </div>
          </div>
        </div>
      </div>

      {/* ADD / EDIT MEDICATION MODAL */}
      <AnimatePresence>
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl border border-slate-100 space-y-5"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center">
                    <Pill className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">
                      {editingMedId ? 'Edit Medication Schedule' : 'Add Medication Schedule'}
                    </h3>
                    <p className="text-xs text-slate-500">For patient {patient.name}</p>
                  </div>
                </div>
                <button
                  onClick={() => setModalOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveMedication} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Medication Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Lisinopril or Vitamin D3"
                    value={medName}
                    onChange={(e) => setMedName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-700"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Dosage *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 10mg (1 tablet)"
                      value={medDosage}
                      onChange={(e) => setMedDosage(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-700"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      Scheduled Time * ({format24hTo12h(medTime)})
                    </label>
                    <input
                      type="time"
                      required
                      value={medTime}
                      onChange={(e) => setMedTime(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-700"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Time Category</label>
                    <select
                      value={medCategory}
                      onChange={(e: any) => setMedCategory(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-700"
                    >
                      <option value="morning">Morning</option>
                      <option value="afternoon">Afternoon</option>
                      <option value="evening">Evening</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Instructions (Optional)</label>
                    <input
                      type="text"
                      placeholder="e.g. Take with food"
                      value={medInstructions}
                      onChange={(e) => setMedInstructions(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-700"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="w-1/2 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-xs hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="w-1/2 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs shadow-xs transition-colors"
                  >
                    {editingMedId ? 'Save Changes' : 'Add Schedule'}
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
