import React, { useState, useEffect } from 'react';
import { useCareSync } from '../../context/CareSyncContext';
import { Footprints, Play, Square, Flame, MapPin, Clock, Trophy, Award, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const ActivityView: React.FC = () => {
  const { activity, startActivitySession, stopActivitySession } = useCareSync();
  const [seconds, setSeconds] = useState<number>(0);

  useEffect(() => {
    let interval: any = null;
    if (activity.isTrackingActive) {
      interval = setInterval(() => {
        setSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setSeconds(0);
    }
    return () => clearInterval(interval);
  }, [activity.isTrackingActive]);

  const formatTimer = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const remainder = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header Banner */}
      <div className="bg-gradient-to-br from-emerald-700 via-emerald-600 to-teal-800 rounded-3xl p-6 md:p-8 text-white shadow-xl shadow-emerald-700/15 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-2 text-center md:text-left">
          <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-200 bg-white/10 px-3 py-1 rounded-full border border-white/20">
            Daily Movement Routine
          </span>
          <h1 className="text-3xl font-extrabold tracking-tight">
            {activity.steps.toLocaleString()} <span className="text-xl font-medium text-emerald-100">/ {activity.stepGoal.toLocaleString()} Steps</span>
          </h1>
          <p className="text-emerald-100 text-xs font-medium">
            Great rhythm today! You are only {Math.max(0, activity.stepGoal - activity.steps)} steps away from your daily goal.
          </p>
        </div>

        {/* Start Walk / Start Jog buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => startActivitySession('walk')}
            className="px-5 py-3.5 rounded-2xl bg-white text-emerald-900 font-extrabold text-xs shadow-lg shadow-emerald-900/20 hover:bg-emerald-50 transition-all flex items-center gap-2"
          >
            <Play className="w-4 h-4 fill-emerald-800" />
            Start Walk
          </button>

          <button
            onClick={() => startActivitySession('jog')}
            className="px-5 py-3.5 rounded-2xl bg-emerald-950/40 hover:bg-emerald-950/60 text-white font-extrabold text-xs border border-white/20 transition-all flex items-center gap-2"
          >
            <Play className="w-4 h-4 fill-white" />
            Start Jog
          </button>
        </div>
      </div>

      {/* ACTIVE TRACKING MODAL */}
      <AnimatePresence>
        {activity.isTrackingActive && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-slate-900 text-white p-6 rounded-3xl shadow-2xl border border-emerald-500/40 flex flex-col md:flex-row items-center justify-between gap-6"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500 text-slate-950 flex items-center justify-center font-bold text-xl animate-pulse">
                <Footprints className="w-7 h-7" />
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                  Live {activity.activeSessionType === 'walk' ? 'Walking' : 'Jogging'} Session Active
                </span>
                <div className="text-3xl font-extrabold text-white tracking-mono mt-0.5">
                  {formatTimer(seconds)}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-6 text-xs text-slate-300">
              <div className="text-center">
                <div className="font-bold text-lg text-white">~450</div>
                <span>Estimated Steps</span>
              </div>
              <div className="text-center">
                <div className="font-bold text-lg text-white">0.4 km</div>
                <span>Distance</span>
              </div>
              <button
                onClick={stopActivitySession}
                className="px-6 py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs shadow-lg flex items-center gap-2 transition-all"
              >
                <Square className="w-4 h-4 fill-white" />
                Finish Session
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* METRIC CARDS GRID */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Steps</span>
            <Footprints className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900">{activity.steps.toLocaleString()}</div>
          <p className="text-[11px] text-slate-400 font-medium">Goal: {activity.stepGoal.toLocaleString()}</p>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Active Time</span>
            <Clock className="w-4 h-4 text-teal-600" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900">{activity.activeMinutes} min</div>
          <p className="text-[11px] text-slate-400 font-medium">Goal: 30 mins</p>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Distance</span>
            <MapPin className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900">{activity.distanceKm} km</div>
          <p className="text-[11px] text-slate-400 font-medium">Outdoor walking</p>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-bold uppercase tracking-wider">Calories</span>
            <Flame className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-extrabold text-slate-900">{activity.caloriesBurned} kcal</div>
          <p className="text-[11px] text-slate-400 font-medium">Active burn</p>
        </div>
      </div>

      {/* WEEKLY ACTIVITY GRAPH */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-600" />
            Weekly Steps History
          </h2>
          <span className="text-xs font-bold text-slate-500">Goal: 5,000 steps/day</span>
        </div>

        <div className="grid grid-cols-7 gap-2 pt-2 text-center">
          {activity.weeklySteps.map((item, idx) => (
            <div key={idx} className="flex flex-col items-center gap-2">
              <div className="w-full h-32 bg-slate-100 rounded-xl p-1 flex items-end">
                <div
                  className={`w-full rounded-lg transition-all ${
                    item.steps >= item.goal ? 'bg-emerald-600' : 'bg-emerald-400'
                  }`}
                  style={{ height: `${Math.min(100, (item.steps / 6000) * 100)}%` }}
                />
              </div>
              <span className="text-xs font-bold text-slate-700">{item.day}</span>
              <span className="text-[10px] text-slate-400 font-semibold">{item.steps}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
