import React from 'react';
import { useCareSync } from '../../context/CareSyncContext';
import { CareScoreRing } from '../common/CareScoreRing';
import {
  Pill,
  Droplet,
  Footprints,
  CheckCircle2,
  Clock,
  Play,
  ArrowRight,
  Sparkles,
  ChevronRight,
  HeartHandshake,
  Bot,
  Plus,
  Activity as ActivityIcon,
} from 'lucide-react';
import { motion } from 'motion/react';

export const PatientHomeView: React.FC = () => {
  const {
    currentUser,
    patient,
    careScore,
    medications,
    hydration,
    activity,
    routineItems,
    takeMedication,
    snoozeMedication,
    logWater,
    startActivitySession,
    toggleRoutineItem,
    setActivePatientTab,
    setAssistantOpen,
  } = useCareSync();

  const nextMedication =
    medications.find((m) => m.status === 'due') ||
    medications.find((m) => m.status === 'upcoming') ||
    (medications.length > 0 ? medications[0] : null);

  const takenMeds = medications.filter((m) => m.status === 'taken').length;
  const totalMeds = medications.length;

  const completedRoutines = routineItems ? routineItems.filter((r) => r.completed).length : 0;
  const totalRoutines = routineItems ? routineItems.length : 0;

  const currentLiters = hydration?.currentLiters || 0;
  const goalLiters = hydration?.goalLiters || 2.0;
  const currentSteps = activity?.steps || 0;
  const goalSteps = activity?.stepGoal || 5000;

  const hydrationPercent = goalLiters > 0 ? Math.min(100, Math.round((currentLiters / goalLiters) * 100)) : 100;
  const activityPercent = goalSteps > 0 ? Math.min(100, Math.round((currentSteps / goalSteps) * 100)) : 100;
  const medicationPercent = totalMeds > 0 ? Math.min(100, Math.round((takenMeds / totalMeds) * 100)) : 100;
  const routinePercent = totalRoutines > 0 ? Math.min(100, Math.round((completedRoutines / totalRoutines) * 100)) : 100;

  const patientName = patient?.name || currentUser?.name || 'there';
  const firstName = patientName.split(' ')[0];

  return (
    <div className="max-w-4xl mx-auto space-y-10 pb-20 pt-2 px-1">
      {/* 1. EDITORIAL HEADER & GREETING */}
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-stone-200/80 pb-6">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-teal-800 block mb-1">
              Personal Health Overview
            </span>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-stone-900 tracking-tight">
              Good morning, {firstName}
            </h1>
            <p className="text-base text-stone-600 font-medium mt-1">
              Your health routine is on track today.
            </p>
          </div>

          {/* Refined Secondary CareScore Pill */}
          <div className="flex items-center gap-3 bg-stone-100/80 border border-stone-200 px-4 py-2.5 rounded-2xl shrink-0">
            <CareScoreRing score={careScore?.totalScore ?? 100} size={42} strokeWidth={5} showDetails={false} />
            <div>
              <div className="text-xs text-stone-500 font-semibold">CareScore</div>
              <div className="text-sm font-extrabold text-stone-900">
                {careScore?.totalScore ?? 100} <span className="text-xs font-normal text-stone-500">/ 100</span>
              </div>
            </div>
            <button
              onClick={() => setActivePatientTab('routine')}
              className="ml-1 p-1 text-stone-400 hover:text-stone-700 transition-colors"
              title="View CareScore breakdown"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </motion.section>

      {/* 2. PRIMARY ACTIONABLE ITEM: NEXT UP (MEDICATION) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-widest text-teal-800 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            Next Up
          </h2>
          <button
            onClick={() => setActivePatientTab('medication')}
            className="text-xs font-bold text-teal-700 hover:text-teal-800 flex items-center gap-1"
          >
            All Medications ({takenMeds}/{totalMeds})
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {nextMedication ? (
          <div className="bg-white border border-stone-200/90 rounded-2xl p-6 sm:p-7 shadow-xs space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200/80 text-amber-800 flex items-center justify-center shrink-0">
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
                  <h3 className="text-xl font-bold text-stone-900 mt-0.5">{nextMedication.name}</h3>
                </div>
              </div>

              <div className="text-xs text-stone-600 font-medium sm:text-right">
                <span className="block font-semibold text-stone-800">{nextMedication.dosage}</span>
                <span className="text-stone-500">{nextMedication.instructions || 'Take as prescribed'}</span>
              </div>
            </div>

            <p className="text-sm text-stone-600 leading-relaxed">
              {nextMedication.status === 'taken'
                ? 'This medication has been logged for today. Your next scheduled dose will appear here.'
                : 'Please take your scheduled medication with a glass of water.'}
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
                  Medication Confirmed at {nextMedication.takenAt || nextMedication.scheduledTime}
                </div>
              )}

              <button
                onClick={() => setAssistantOpen(true)}
                className="ml-auto py-2.5 px-3.5 rounded-xl text-teal-800 hover:bg-teal-50 font-semibold text-xs transition-colors flex items-center gap-1.5"
              >
                <Bot className="w-4 h-4 text-teal-700" />
                Ask Assistant
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white border border-dashed border-stone-200 rounded-2xl p-7 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center mx-auto">
              <Pill className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-stone-900">No Medications Scheduled Today</h3>
              <p className="text-xs text-stone-500 max-w-sm mx-auto mt-0.5">
                Add your daily medication schedule or let your caregiver configure it for you.
              </p>
            </div>
            <button
              onClick={() => setActivePatientTab('medication')}
              className="py-2.5 px-4 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs shadow-xs transition-colors inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Add Medication Schedule
            </button>
          </div>
        )}
      </section>

      {/* 3. TODAY'S HEALTH (PROGRESS SUMMARY & SUBTLE VISUALIZATIONS) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-widest text-teal-800">
            Today's Health
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Medication Progress */}
          <div className="bg-white border border-stone-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Pill className="w-4 h-4 text-amber-700" />
                <span className="text-sm font-bold text-stone-900">Medication</span>
              </div>
              <span className="text-xs font-extrabold text-stone-700">
                {takenMeds} / {totalMeds} completed
              </span>
            </div>
            <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-600 transition-all duration-500 rounded-full"
                style={{ width: `${medicationPercent}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-stone-500 pt-1">
              <span>{medicationPercent}% adherence today</span>
              <button
                onClick={() => setActivePatientTab('medication')}
                className="text-teal-700 font-bold hover:underline"
              >
                Schedule
              </button>
            </div>
          </div>

          {/* Hydration Progress */}
          <div className="bg-white border border-stone-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Droplet className="w-4 h-4 text-sky-600" />
                <span className="text-sm font-bold text-stone-900">Hydration</span>
              </div>
              <span className="text-xs font-extrabold text-stone-700">
                {currentLiters} L / {goalLiters} L
              </span>
            </div>
            <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-sky-500 transition-all duration-500 rounded-full"
                style={{ width: `${hydrationPercent}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-stone-500 pt-1">
              <span className="flex items-center gap-1.5">
                <button
                  onClick={() => logWater(250)}
                  className="px-2 py-0.5 rounded bg-sky-50 text-sky-700 hover:bg-sky-100 font-bold text-[11px] border border-sky-200"
                >
                  +250ml
                </button>
                <button
                  onClick={() => logWater(500)}
                  className="px-2 py-0.5 rounded bg-stone-100 text-stone-700 hover:bg-stone-200 font-bold text-[11px]"
                >
                  +500ml
                </button>
              </span>
              <button
                onClick={() => setActivePatientTab('hydration')}
                className="text-teal-700 font-bold hover:underline"
              >
                Details
              </button>
            </div>
          </div>

          {/* Activity Progress */}
          <div className="bg-white border border-stone-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Footprints className="w-4 h-4 text-emerald-700" />
                <span className="text-sm font-bold text-stone-900">Activity</span>
              </div>
              <span className="text-xs font-extrabold text-stone-700">
                {currentSteps.toLocaleString()} / {goalSteps.toLocaleString()} steps
              </span>
            </div>
            <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-600 transition-all duration-500 rounded-full"
                style={{ width: `${activityPercent}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-stone-500 pt-1">
              <span>{activity?.activeMinutes || 0} active mins</span>
              <button
                onClick={() => startActivitySession('walk')}
                className="text-teal-700 font-bold hover:underline flex items-center gap-1"
              >
                <Play className="w-3 h-3 fill-current" />
                Start Walk
              </button>
            </div>
          </div>

          {/* Routine Progress */}
          <div className="bg-white border border-stone-200/90 rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-indigo-700" />
                <span className="text-sm font-bold text-stone-900">Routines</span>
              </div>
              <span className="text-xs font-extrabold text-stone-700">
                {completedRoutines} / {totalRoutines} done
              </span>
            </div>
            <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-600 transition-all duration-500 rounded-full"
                style={{ width: `${routinePercent}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-stone-500 pt-1">
              <span>Daily checklist</span>
              <button
                onClick={() => setActivePatientTab('routine')}
                className="text-teal-700 font-bold hover:underline"
              >
                View all
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 4. TODAY'S ROUTINE LIST */}
      {routineItems && routineItems.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-widest text-teal-800">
              Today's Routine
            </h2>
            <button
              onClick={() => setActivePatientTab('routine')}
              className="text-xs font-bold text-teal-700 hover:text-teal-800 flex items-center gap-1"
            >
              Full Routine View
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="bg-white border border-stone-200/90 rounded-2xl divide-y divide-stone-100 shadow-xs overflow-hidden">
            {routineItems.slice(0, 5).map((item) => (
              <div
                key={item.id}
                onClick={() => toggleRoutineItem(item.id)}
                className="p-4 sm:p-5 flex items-center justify-between hover:bg-stone-50/80 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-3.5">
                  <div
                    className={`w-6 h-6 rounded-lg flex items-center justify-center transition-colors ${
                      item.completed
                        ? 'bg-teal-700 text-white'
                        : 'border-2 border-stone-300 bg-white'
                    }`}
                  >
                    {item.completed && <CheckCircle2 className="w-4 h-4" />}
                  </div>
                  <div>
                    <h4
                      className={`text-sm font-semibold ${
                        item.completed ? 'line-through text-stone-400' : 'text-stone-900'
                      }`}
                    >
                      {item.title}
                    </h4>
                    <span className="text-xs text-stone-500">{item.time}</span>
                  </div>
                </div>

                <span
                  className={`text-xs font-bold px-2.5 py-1 rounded-full uppercase tracking-wider text-[10px] ${
                    item.category === 'medication'
                      ? 'bg-amber-50 text-amber-800'
                      : item.category === 'hydration'
                      ? 'bg-sky-50 text-sky-700'
                      : item.category === 'activity'
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-indigo-50 text-indigo-700'
                  }`}
                >
                  {item.category}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 5. GENTLE DAILY OBSERVATION */}
      <section className="bg-stone-100/70 border border-stone-200/90 rounded-2xl p-6 space-y-2">
        <div className="text-xs font-bold uppercase tracking-widest text-teal-800 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-teal-700" />
          Daily Observation
        </div>
        <p className="text-base font-semibold text-stone-800 italic">
          "Morning routine consistency has been steady this week. Keep up the gentle rhythm!"
        </p>
        <div className="flex items-center gap-2 pt-1 text-xs text-stone-500">
          <HeartHandshake className="w-3.5 h-3.5 text-stone-400 shrink-0" />
          <span>Non-diagnostic wellness and routine observation.</span>
        </div>
      </section>
    </div>
  );
};
