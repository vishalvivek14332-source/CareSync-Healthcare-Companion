import React from 'react';
import { useCareSync } from '../../context/CareSyncContext';
import { CareScoreRing } from '../common/CareScoreRing';
import { Activity, ShieldCheck, AlertCircle, Info, Sparkles, CheckCircle2, TrendingUp, HeartHandshake } from 'lucide-react';

export const RoutineView: React.FC = () => {
  const { careScore, insights, medications, hydration, activity, routineItems } = useCareSync();

  const takenMeds = medications ? medications.filter((m) => m.status === 'taken').length : 0;
  const totalMeds = medications ? medications.length : 0;
  const currentLiters = hydration?.currentLiters || 0;
  const goalLiters = hydration?.goalLiters || 2.0;
  const currentSteps = activity?.steps || 0;
  const goalSteps = activity?.stepGoal || 5000;
  const completedRoutines = routineItems ? routineItems.filter((r) => r.completed).length : 0;
  const totalRoutines = routineItems ? routineItems.length : 0;

  return (
    <div className="space-y-6 pb-20">
      {/* Header Banner */}
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-2 text-center md:text-left">
          <span className="text-xs font-extrabold uppercase tracking-wider text-teal-600 bg-teal-50 px-3 py-1 rounded-full border border-teal-200">
            Wellness Consistency Metric
          </span>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">CareScore Analysis</h1>
          <p className="text-xs text-slate-500 font-medium max-w-md leading-relaxed">
            CareScore combines your medication confirmation, hydration, daily movement, and routine checklists into one easy score.
          </p>
        </div>

        {/* Central Ring */}
        <div className="p-4 bg-slate-50 rounded-3xl border border-slate-100 flex flex-col items-center">
          <CareScoreRing score={careScore?.totalScore ?? 100} size={130} strokeWidth={11} showDetails={true} />
        </div>
      </div>

      {/* 4 CARESCORE BREAKDOWN CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm space-y-2">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Medication</div>
          <div className="text-2xl font-extrabold text-teal-700">{careScore?.medicationScore ?? 100}%</div>
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-teal-600" style={{ width: `${careScore?.medicationScore ?? 100}%` }} />
          </div>
          <p className="text-[11px] text-slate-400 font-medium">
            {totalMeds > 0 ? `${takenMeds} of ${totalMeds} doses confirmed` : 'No doses scheduled'}
          </p>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm space-y-2">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Hydration</div>
          <div className="text-2xl font-extrabold text-sky-700">{careScore?.hydrationScore ?? 100}%</div>
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-sky-500" style={{ width: `${careScore?.hydrationScore ?? 100}%` }} />
          </div>
          <p className="text-[11px] text-slate-400 font-medium">
            {currentLiters} L of {goalLiters} L goal
          </p>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm space-y-2">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Activity</div>
          <div className="text-2xl font-extrabold text-emerald-700">{careScore?.activityScore ?? 100}%</div>
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500" style={{ width: `${careScore?.activityScore ?? 100}%` }} />
          </div>
          <p className="text-[11px] text-slate-400 font-medium">
            {currentSteps.toLocaleString()} of {goalSteps.toLocaleString()} steps
          </p>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm space-y-2">
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Routine Checklist</div>
          <div className="text-2xl font-extrabold text-indigo-700">{careScore?.routineScore ?? 100}%</div>
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-indigo-500" style={{ width: `${careScore?.routineScore ?? 100}%` }} />
          </div>
          <p className="text-[11px] text-slate-400 font-medium">
            {totalRoutines > 0 ? `${completedRoutines} of ${totalRoutines} checklist completed` : '0 completed'}
          </p>
        </div>
      </div>

      {/* WEEKLY CARESCORE GRAPH */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-teal-600" />
            Weekly CareScore Stability
          </h2>
          <span className="text-xs font-bold text-teal-700 bg-teal-50 px-3 py-1 rounded-full border border-teal-200">
            7-Day Average: 86 / 100
          </span>
        </div>

        <div className="grid grid-cols-7 gap-2 pt-2 text-center">
          {careScore.weeklyScores.map((item, idx) => (
            <div key={idx} className="flex flex-col items-center gap-2">
              <div className="w-full h-28 bg-slate-100 rounded-xl p-1 flex items-end">
                <div
                  className="w-full bg-gradient-to-t from-teal-700 to-teal-500 rounded-lg transition-all duration-500"
                  style={{ height: `${item.score}%` }}
                />
              </div>
              <span className="text-xs font-bold text-slate-700">{item.day}</span>
              <span className="text-[10px] text-slate-400 font-semibold">{item.score}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ROUTINE INSIGHTS SECTION */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            Routine Insights & Observations
          </h2>
          <span className="text-xs font-semibold text-slate-400">Routine Analytics</span>
        </div>

        <div className="space-y-3">
          {insights.map((ins) => {
            let borderCol = 'border-slate-200 bg-slate-50';
            let icon = <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />;

            if (ins.type === 'warning') {
              borderCol = 'border-amber-200 bg-amber-50/60';
              icon = <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />;
            } else if (ins.type === 'info') {
              borderCol = 'border-sky-200 bg-sky-50/60';
              icon = <Info className="w-5 h-5 text-sky-600 shrink-0" />;
            }

            return (
              <div
                key={ins.id}
                className={`p-4 rounded-2xl border ${borderCol} flex items-start gap-3 text-xs leading-relaxed`}
              >
                {icon}
                <div className="space-y-1">
                  <div className="font-bold text-slate-900 text-sm">{ins.title}</div>
                  <p className="text-slate-600">{ins.description}</p>
                  <span className="text-[10px] text-slate-400 font-medium block pt-1">{ins.timestamp}</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* NON-DIAGNOSTIC DISCLAIMER */}
        <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center gap-2 text-[11px] text-slate-500">
          <HeartHandshake className="w-4 h-4 text-slate-400 shrink-0" />
          <span>
            <strong>Wellness Disclaimer:</strong> CareSync insights are automatic observations based strictly on daily routine tracking and timestamps. They are non-diagnostic and intended purely for wellness habit encouragement.
          </span>
        </div>
      </div>
    </div>
  );
};
