import React, { useState } from 'react';
import { useCareSync } from '../../context/CareSyncContext';
import { CareScoreRing } from '../common/CareScoreRing';
import {
  Phone,
  ShieldCheck,
  Activity,
  BellRing,
  Pill,
  Droplet,
  Footprints,
  Sparkles,
  ArrowRight,
  HeartHandshake,
  Eye,
  UserCheck,
  Plus,
  Key,
  X,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const CaregiverDashboardView: React.FC = () => {
  const {
    currentUser,
    patient,
    linkedPatients,
    selectedPatientId,
    selectCaregiverPatient,
    linkPatientWithCode,
    careScore,
    medications,
    hydration,
    activity,
    routineItems,
    alerts,
    setActiveCaregiverTab,
    markAlertReviewed,
    addToast,
  } = useCareSync();

  const [connectModalOpen, setConnectModalOpen] = useState<boolean>(false);
  const [connectCodeInput, setConnectCodeInput] = useState<string>('');
  const [isLinking, setIsLinking] = useState<boolean>(false);

  const unreviewedAlerts = alerts.filter((a) => !a.reviewed);
  const takenMeds = medications.filter((m) => m.status === 'taken').length;
  const totalMeds = medications.length;

  const completedRoutines = routineItems ? routineItems.filter((r) => r.completed).length : 4;
  const totalRoutines = routineItems ? routineItems.length : 7;

  const hydrationPercent = hydration?.goalLiters ? Math.min(100, Math.round((hydration.currentLiters / hydration.goalLiters) * 100)) : 70;
  const activityPercent = activity?.stepGoal ? Math.min(100, Math.round((activity.steps / activity.stepGoal) * 100)) : 80;
  const medPercent = totalMeds > 0 ? Math.min(100, Math.round((takenMeds / totalMeds) * 100)) : 100;
  const routinePercent = totalRoutines > 0 ? Math.min(100, Math.round((completedRoutines / totalRoutines) * 100)) : 100;

  const hasHighAlert = unreviewedAlerts.some((a) => a.severity === 'high' || a.severity === 'emergency');
  const hasMediumAlert = unreviewedAlerts.some((a) => a.severity === 'medium');

  const statusText = hasHighAlert
    ? 'Attention required'
    : hasMediumAlert
    ? 'Routine needs attention'
    : 'All routines on track';

  const statusExplanation = hasHighAlert
    ? 'Immediate check-in recommended due to high-priority alert.'
    : hasMediumAlert
    ? 'Evening medication or routine task has not been confirmed.'
    : 'All scheduled daily tasks and medications are being completed on time.';

  const handleConnectPatientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!connectCodeInput.trim()) return;

    setIsLinking(true);
    try {
      await linkPatientWithCode(connectCodeInput.trim());
      setConnectModalOpen(false);
      setConnectCodeInput('');
    } catch (err: any) {
      // Toast already fired in context
    } finally {
      setIsLinking(false);
    }
  };

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
              Caregiver Overview
            </span>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-stone-900 tracking-tight">
              Good day, {currentUser?.name?.split(' ')[0] || 'Caregiver'}
            </h1>
            <p className="text-base text-stone-600 font-medium mt-1">
              Here's how {patient?.name?.split(' ')[0] || 'your connected patient'} is doing today.
            </p>
          </div>

          {/* Connected Patient Selector & Link Button */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-3 bg-stone-100/80 border border-stone-200 px-3.5 py-2 rounded-2xl shrink-0">
              <UserCheck className="w-4 h-4 text-teal-700 shrink-0" />
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase text-stone-400">Connected Patient</span>
                {linkedPatients.length > 0 ? (
                  <select
                    value={selectedPatientId || ''}
                    onChange={(e) => selectCaregiverPatient(e.target.value)}
                    className="bg-transparent text-xs font-bold text-stone-900 focus:outline-none cursor-pointer pr-1"
                  >
                    {linkedPatients.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-xs font-bold text-stone-700">{patient?.name || 'No patient connected'}</span>
                )}
              </div>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse ml-1 shrink-0" title="Active Connection" />
            </div>

            <button
              onClick={() => setConnectModalOpen(true)}
              className="py-2.5 px-3 rounded-2xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs shadow-xs transition-colors flex items-center gap-1.5 shrink-0"
              title="Connect another patient using Care Connection Code"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Connect Patient</span>
            </button>
          </div>
        </div>
      </motion.section>

      {/* 2. PATIENT OVERALL STATUS (5-SECOND READ) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-widest text-teal-800 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" />
            Patient Status
          </h2>
          <span className="text-xs text-stone-500 font-medium">Last active: {patient?.lastActive || 'Just now'}</span>
        </div>

        <div className="bg-white border border-stone-200/90 rounded-2xl p-6 sm:p-7 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-100 pb-5">
            <div className="flex items-center gap-4">
              <img
                src={patient?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250'}
                alt={patient?.name || 'Patient'}
                className="w-14 h-14 rounded-2xl object-cover border border-stone-200 shadow-xs"
              />
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xl font-bold text-stone-900">{patient?.name || 'Connected Patient'}</h3>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border flex items-center gap-1.5 ${
                      hasHighAlert
                        ? 'bg-rose-50 text-rose-800 border-rose-200'
                        : hasMediumAlert
                        ? 'bg-amber-50 text-amber-900 border-amber-300'
                        : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        hasHighAlert ? 'bg-rose-600' : hasMediumAlert ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'
                      }`}
                    />
                    {statusText}
                  </span>
                </div>
                <p className="text-xs text-stone-600 font-medium mt-1">{statusExplanation}</p>
              </div>
            </div>

            {/* CareScore Gauge Mini */}
            <div className="flex items-center gap-3 bg-stone-50 border border-stone-200/80 px-4 py-2.5 rounded-xl shrink-0">
              <CareScoreRing score={careScore?.totalScore ?? 100} size={42} strokeWidth={5} showDetails={false} />
              <div>
                <div className="text-[11px] text-stone-500 font-semibold uppercase tracking-wider">CareScore</div>
                <div className="text-sm font-extrabold text-stone-900">
                  {careScore?.totalScore ?? 100} <span className="text-xs font-normal text-stone-500">/ 100</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-stone-500">
            <span className="italic">Non-diagnostic wellness summary based on daily device synchronization.</span>
            <a
              href={`tel:${patient.emergencyPhone}`}
              className="py-2 px-3.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5 shrink-0"
            >
              <Phone className="w-3.5 h-3.5" />
              Check-In Call
            </a>
          </div>
        </div>
      </section>

      {/* 3. TODAY'S CARE (4 CLEAN SUMMARY AREAS) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-widest text-teal-800">
            Today's Care Metrics
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {/* Medication */}
          <div className="bg-white border border-stone-200/90 rounded-2xl p-5 shadow-xs space-y-3 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-stone-500">Medication</span>
              <Pill className="w-4 h-4 text-amber-700" />
            </div>
            <div>
              <div className="text-2xl font-extrabold text-stone-900">
                {takenMeds} <span className="text-xs font-normal text-stone-500">/ {totalMeds} done</span>
              </div>
              <div className="w-full h-1.5 bg-stone-100 rounded-full overflow-hidden mt-2">
                <div className="h-full bg-amber-600 rounded-full transition-all duration-500" style={{ width: `${medPercent}%` }} />
              </div>
            </div>
            <p className="text-[11px] text-stone-500 font-medium">
              {takenMeds === totalMeds ? 'All doses confirmed' : `${totalMeds - takenMeds} dose remaining`}
            </p>
          </div>

          {/* Hydration */}
          <div className="bg-white border border-stone-200/90 rounded-2xl p-5 shadow-xs space-y-3 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-stone-500">Hydration</span>
              <Droplet className="w-4 h-4 text-sky-600" />
            </div>
            <div>
              <div className="text-2xl font-extrabold text-stone-900">
                {hydration.currentLiters}L <span className="text-xs font-normal text-stone-500">/ {hydration.goalLiters}L</span>
              </div>
              <div className="w-full h-1.5 bg-stone-100 rounded-full overflow-hidden mt-2">
                <div className="h-full bg-sky-500 rounded-full transition-all duration-500" style={{ width: `${hydrationPercent}%` }} />
              </div>
            </div>
            <p className="text-[11px] text-stone-500 font-medium">{hydrationPercent}% daily target logged</p>
          </div>

          {/* Activity */}
          <div className="bg-white border border-stone-200/90 rounded-2xl p-5 shadow-xs space-y-3 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-stone-500">Activity</span>
              <Footprints className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <div className="text-2xl font-extrabold text-stone-900">
                {activity.steps.toLocaleString()} <span className="text-xs font-normal text-stone-500">steps</span>
              </div>
              <div className="w-full h-1.5 bg-stone-100 rounded-full overflow-hidden mt-2">
                <div className="h-full bg-emerald-600 rounded-full transition-all duration-500" style={{ width: `${activityPercent}%` }} />
              </div>
            </div>
            <p className="text-[11px] text-stone-500 font-medium">{activity.activeMinutes} mins active movement</p>
          </div>

          {/* Routine */}
          <div className="bg-white border border-stone-200/90 rounded-2xl p-5 shadow-xs space-y-3 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-stone-500">Routine</span>
              <Activity className="w-4 h-4 text-teal-700" />
            </div>
            <div>
              <div className="text-2xl font-extrabold text-stone-900">
                {completedRoutines} <span className="text-xs font-normal text-stone-500">/ {totalRoutines} done</span>
              </div>
              <div className="w-full h-1.5 bg-stone-100 rounded-full overflow-hidden mt-2">
                <div className="h-full bg-teal-700 rounded-full transition-all duration-500" style={{ width: `${routinePercent}%` }} />
              </div>
            </div>
            <p className="text-[11px] text-stone-500 font-medium">{routinePercent}% tasks completed</p>
          </div>
        </div>
      </section>

      {/* 4. IMPORTANT ALERTS */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-widest text-teal-800 flex items-center gap-1.5">
            <BellRing className="w-3.5 h-3.5" />
            Important Alerts ({unreviewedAlerts.length})
          </h2>
          <button
            onClick={() => setActiveCaregiverTab('alerts')}
            className="text-xs font-bold text-teal-700 hover:text-teal-800 flex items-center gap-1"
          >
            All Alerts History
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="space-y-3">
          {unreviewedAlerts.length === 0 ? (
            <div className="bg-white border border-stone-200/90 rounded-2xl p-6 text-center text-stone-500 text-xs font-medium">
              No active unreviewed alerts for {patient.name}. Everything is up to date.
            </div>
          ) : (
            unreviewedAlerts.slice(0, 3).map((alt) => {
              const isHigh = alt.severity === 'high' || alt.severity === 'emergency';
              const isMedium = alt.severity === 'medium';

              return (
                <div
                  key={alt.id}
                  className={`p-5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all ${
                    isHigh
                      ? 'bg-rose-50/70 border-rose-200'
                      : isMedium
                      ? 'bg-amber-50/70 border-amber-200'
                      : 'bg-white border-stone-200/90'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider ${
                          isHigh
                            ? 'bg-rose-700 text-white'
                            : isMedium
                            ? 'bg-amber-600 text-white'
                            : 'bg-stone-200 text-stone-700'
                        }`}
                      >
                        {isHigh ? '🔴 Important' : isMedium ? '🟡 Attention' : '🟢 Normal'}
                      </span>
                      <span className="font-bold text-stone-900 text-sm">{alt.title}</span>
                    </div>
                    <p className="text-xs text-stone-600 leading-relaxed">{alt.description}</p>
                    <span className="text-[11px] text-stone-400 font-medium block">{alt.timestamp}</span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => markAlertReviewed(alt.id)}
                      className="py-2 px-3.5 rounded-xl bg-white border border-stone-200 hover:bg-stone-50 text-stone-800 font-bold text-xs shadow-xs transition-colors"
                    >
                      Mark Reviewed
                    </button>
                    <button
                      onClick={() => setActiveCaregiverTab('alerts')}
                      className="py-2 px-3 rounded-xl text-teal-800 hover:bg-stone-100 font-bold text-xs transition-colors flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      View
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* 5. ROUTINE INSIGHT */}
      <section className="bg-stone-100/70 border border-stone-200/90 rounded-2xl p-6 space-y-2">
        <div className="text-xs font-bold uppercase tracking-widest text-teal-800 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-teal-700" />
          Routine Insight
        </div>
        <p className="text-base font-semibold text-stone-800 italic">
          "Alex's medication adherence has remained consistent this week. Afternoon routines show high engagement."
        </p>
        <div className="flex items-center gap-2 pt-1 text-xs text-stone-500">
          <HeartHandshake className="w-3.5 h-3.5 text-stone-400 shrink-0" />
          <span>Non-diagnostic wellness & routine observations for caregiver reference.</span>
        </div>
      </section>

      {/* 6. QUICK ACTIONS */}
      <section className="pt-2 border-t border-stone-200/80">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs font-bold text-stone-400 uppercase tracking-wider">Quick Caregiver Actions</span>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={`tel:${patient?.emergencyPhone || patient?.caregiverPhone || ''}`}
              className="py-2.5 px-4 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 font-semibold text-xs transition-colors flex items-center gap-1.5"
            >
              <Phone className="w-3.5 h-3.5 text-teal-700" />
              Check In Call
            </a>
            <button
              onClick={() => setActiveCaregiverTab('patient')}
              className="py-2.5 px-4 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 font-semibold text-xs transition-colors flex items-center gap-1.5"
            >
              <Pill className="w-3.5 h-3.5 text-amber-700" />
              View Medications
            </button>
            <button
              onClick={() => setActiveCaregiverTab('alerts')}
              className="py-2.5 px-4 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 font-semibold text-xs transition-colors flex items-center gap-1.5"
            >
              <BellRing className="w-3.5 h-3.5 text-rose-600" />
              View Alerts
            </button>
          </div>
        </div>
      </section>

      {/* CONNECT PATIENT MODAL */}
      <AnimatePresence>
        {connectModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center">
                    <Key className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">Connect to Patient</h3>
                    <p className="text-xs text-slate-500">Enter patient care connection code</p>
                  </div>
                </div>
                <button
                  onClick={() => setConnectModalOpen(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleConnectPatientSubmit} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Care Connection Code (e.g. CARE-7K4P9Q) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="CARE-XXXXXX"
                    value={connectCodeInput}
                    onChange={(e) => setConnectCodeInput(e.target.value.toUpperCase())}
                    className="w-full font-mono uppercase bg-slate-50 border border-slate-200 rounded-xl p-3 text-center text-lg font-extrabold text-slate-900 tracking-widest focus:outline-none focus:ring-2 focus:ring-teal-700"
                  />
                </div>

                <div className="flex gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setConnectModalOpen(false)}
                    className="w-1/2 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold text-xs hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isLinking}
                    className="w-1/2 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs shadow-xs transition-colors"
                  >
                    {isLinking ? 'Linking...' : 'Connect'}
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

