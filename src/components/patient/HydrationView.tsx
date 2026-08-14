import React, { useState } from 'react';
import { useCareSync } from '../../context/CareSyncContext';
import { Droplet, Plus, Clock, TrendingUp, CheckCircle2, Sparkles, HeartHandshake, Calendar } from 'lucide-react';
import { motion } from 'motion/react';

export const HydrationView: React.FC = () => {
  const { hydration, logWater } = useCareSync();
  const [customMl, setCustomMl] = useState<number>(250);

  const percent = Math.min(100, Math.round((hydration.currentLiters / hydration.goalLiters) * 100));
  const remainingLiters = Math.max(0, Number((hydration.goalLiters - hydration.currentLiters).toFixed(1)));
  const todayDateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  const weeklyData = [
    { day: 'Mon', liters: 2.1, goalReached: true },
    { day: 'Tue', liters: 1.8, goalReached: false },
    { day: 'Wed', liters: 2.0, goalReached: true },
    { day: 'Thu', liters: 1.4, goalReached: false },
    { day: 'Fri', liters: 2.2, goalReached: true },
    { day: 'Sat', liters: 1.9, goalReached: false },
    { day: 'Today', liters: hydration.currentLiters, goalReached: hydration.currentLiters >= hydration.goalLiters },
  ];

  const avgIntake = (
    weeklyData.reduce((acc, curr) => acc + curr.liters, 0) / weeklyData.length
  ).toFixed(1);
  const daysReached = weeklyData.filter((d) => d.liters >= hydration.goalLiters).length;

  const handleCustomLog = () => {
    if (customMl > 0) {
      logWater(customMl);
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
              Hydration Tracker
            </span>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-stone-900 tracking-tight">
              Stay hydrated
            </h1>
            <p className="text-base text-stone-600 font-medium mt-1">
              Small, regular sips help you stay on track throughout the day.
            </p>
          </div>

          <div className="flex items-center gap-2 bg-stone-100/80 border border-stone-200 px-3 py-1.5 rounded-2xl text-xs font-semibold text-stone-700 shrink-0">
            <Calendar className="w-3.5 h-3.5 text-stone-500" />
            <span>{todayDateStr}</span>
          </div>
        </div>
      </motion.section>

      {/* 2. TODAY'S HYDRATION HERO & QUICK LOGGING */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main Hydration Card */}
        <div className="md:col-span-2 bg-white border border-stone-200/90 rounded-2xl p-6 sm:p-7 shadow-xs space-y-6 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-sky-800 flex items-center gap-1.5">
                <Droplet className="w-4 h-4 text-sky-600" />
                Today's Progress
              </span>
              <span className="text-xs font-bold text-stone-500">{percent}% of goal</span>
            </div>

            <div className="flex items-baseline gap-3 pt-2">
              <span className="text-4xl sm:text-5xl font-extrabold text-stone-900 tracking-tight">
                {hydration.currentLiters} L
              </span>
              <span className="text-base font-semibold text-stone-500">
                of {hydration.goalLiters} L goal
              </span>
            </div>

            <p className="text-xs text-stone-600 font-medium">
              {remainingLiters > 0
                ? `${remainingLiters} L remaining to reach your target`
                : 'Daily goal completed! Keep sipping as needed.'}
            </p>
          </div>

          {/* Minimal Elegant Progress Bar */}
          <div className="space-y-2">
            <div className="w-full h-3 bg-stone-100 rounded-full overflow-hidden p-0.5 border border-stone-200/60">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${percent}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="h-full bg-gradient-to-r from-sky-500 to-teal-600 rounded-full"
              />
            </div>
            <div className="flex justify-between text-[11px] font-semibold text-stone-400">
              <span>0 L</span>
              <span>1.0 L</span>
              <span>{hydration.goalLiters} L Goal</span>
            </div>
          </div>

          {/* Quick Logging Buttons */}
          <div className="pt-2 border-t border-stone-100 space-y-3">
            <span className="text-xs font-bold text-stone-500 uppercase tracking-wider block">
              Quick Water Entry
            </span>
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => logWater(250)}
                className="flex-1 py-3 px-4 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-xs"
              >
                <Plus className="w-4 h-4" />
                +250 ml (Glass)
              </button>
              <button
                onClick={() => logWater(500)}
                className="flex-1 py-3 px-4 rounded-xl bg-stone-100 border border-stone-200 hover:bg-stone-200/70 text-stone-800 font-bold text-xs transition-colors flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4 text-teal-700" />
                +500 ml (Bottle)
              </button>
            </div>

            {/* Custom Log Input */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="number"
                min={50}
                max={1000}
                step={50}
                value={customMl}
                onChange={(e) => setCustomMl(Number(e.target.value))}
                className="w-28 bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs font-bold text-stone-800 focus:outline-none focus:ring-1 focus:ring-teal-700"
              />
              <span className="text-xs text-stone-500 font-semibold">ml</span>
              <button
                onClick={handleCustomLog}
                className="py-2 px-3.5 rounded-xl border border-stone-200 hover:bg-stone-100 text-stone-800 font-bold text-xs transition-colors ml-auto"
              >
                + Add Custom
              </button>
            </div>
          </div>
        </div>

        {/* Next Reminder Card */}
        <div className="bg-white border border-stone-200/90 rounded-2xl p-6 shadow-xs space-y-5 flex flex-col justify-between">
          <div className="space-y-3">
            <span className="text-xs font-bold uppercase tracking-widest text-teal-800 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              Next Reminder
            </span>

            <div className="space-y-1">
              <h3 className="text-lg font-bold text-stone-900">Drink some water</h3>
              <p className="text-xs text-stone-600 leading-relaxed font-medium">
                Gentle prompt configured to support your routine sips.
              </p>
            </div>
          </div>

          <div className="bg-stone-50 border border-stone-200/80 rounded-xl p-4 text-center space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block">
              Scheduled Time
            </span>
            <span className="text-2xl font-extrabold text-stone-900">
              {hydration.nextReminderTime}
            </span>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-stone-500 pt-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>Automatic reminder active</span>
          </div>
        </div>
      </div>

      {/* 3. TODAY'S HISTORY TIMELINE */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-widest text-teal-800 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            Today's Hydration Logs
          </h2>
          <span className="text-xs text-stone-500 font-medium">
            {hydration.logs.length} entries recorded
          </span>
        </div>

        <div className="bg-white border border-stone-200/90 rounded-2xl p-6 shadow-xs space-y-3">
          {hydration.logs.length === 0 ? (
            <div className="text-center py-8 text-stone-400 space-y-1">
              <p className="text-xs font-semibold text-stone-500">No water logged yet today.</p>
              <p className="text-[11px]">Use the buttons above to record your first glass.</p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
              {hydration.logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-3.5 bg-stone-50 rounded-xl border border-stone-200/70 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-sky-50 text-sky-700 border border-sky-100">
                      <Droplet className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="font-bold text-stone-900">+{log.amountMl} ml logged</span>
                      <p className="text-[11px] text-stone-400 font-medium">{log.timestamp}</p>
                    </div>
                  </div>
                  <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                    Confirmed ✓
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 4. WEEKLY PROGRESS */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-widest text-teal-800 flex items-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5" />
            Weekly Hydration Pattern
          </h2>
          <div className="flex items-center gap-4 text-xs text-stone-600 font-semibold">
            <span>Avg: <strong>{avgIntake} L/day</strong></span>
            <span>Goal Reached: <strong>{daysReached}/7 days</strong></span>
          </div>
        </div>

        <div className="bg-white border border-stone-200/90 rounded-2xl p-6 shadow-xs space-y-6">
          <div className="grid grid-cols-7 gap-2 pt-2 text-center">
            {weeklyData.map((item, idx) => (
              <div key={idx} className="flex flex-col items-center gap-2">
                <div className="w-full h-24 bg-stone-50 rounded-xl p-1 border border-stone-200/60 flex items-end">
                  <div
                    className={`w-full rounded-lg transition-all ${
                      item.goalReached ? 'bg-teal-700' : 'bg-sky-400/80'
                    }`}
                    style={{ height: `${Math.min(100, (item.liters / 2.5) * 100)}%` }}
                  />
                </div>
                <span className="text-xs font-bold text-stone-800">{item.day}</span>
                <span className="text-[10px] font-semibold text-stone-400">{item.liters} L</span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between text-xs text-stone-500 pt-2 border-t border-stone-100">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-teal-700" />
              <span>Goal Reached (≥ 2.0 L)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-400/80" />
              <span>Partial Goal</span>
            </div>
          </div>
        </div>
      </section>

      {/* 5. HYDRATION INSIGHT */}
      <section className="bg-stone-100/70 border border-stone-200/90 rounded-2xl p-6 space-y-2">
        <div className="text-xs font-bold uppercase tracking-widest text-teal-800 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-teal-700" />
          Hydration Insight
        </div>
        <p className="text-base font-semibold text-stone-800 italic">
          {percent >= 70
            ? '"You are drinking water consistently throughout the day, helping maintain steady hydration."'
            : '"Your hydration intake is slightly below your average daily pattern today. Consider taking a glass of water soon."'}
        </p>
        <div className="flex items-center gap-2 pt-1 text-xs text-stone-500">
          <HeartHandshake className="w-3.5 h-3.5 text-stone-400 shrink-0" />
          <span>Routine wellness observations based on daily logged intake. Non-diagnostic.</span>
        </div>
      </section>
    </div>
  );
};

