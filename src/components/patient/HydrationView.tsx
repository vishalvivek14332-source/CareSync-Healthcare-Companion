import React, { useState } from 'react';
import { useCareSync } from '../../context/CareSyncContext';
import { Droplet, Plus, Clock, TrendingUp, CheckCircle2, Sparkles, HeartHandshake, Calendar, Settings2, X, Bell, BellOff } from 'lucide-react';
import { motion } from 'motion/react';

export const HydrationView: React.FC = () => {
  const { hydration, hydrationSettings, logWater, updateHydrationSettings } = useCareSync();
  const [customMl, setCustomMl] = useState<number>(250);
  const [settingsModalOpen, setSettingsModalOpen] = useState<boolean>(false);

  // Settings form state
  const [dailyGoal, setDailyGoal] = useState<number>(hydrationSettings?.dailyGoalLiters || hydration.goalLiters || 2.0);
  const [intervalMins, setIntervalMins] = useState<number>(hydrationSettings?.intervalMinutes || 60);
  const [startTime, setStartTime] = useState<string>(hydrationSettings?.startTime || '08:00');
  const [endTime, setEndTime] = useState<string>(hydrationSettings?.endTime || '20:00');
  const [reminderEnabled, setReminderEnabled] = useState<boolean>(hydrationSettings?.reminderEnabled !== false);

  const percent = Math.min(100, Math.round((hydration.currentLiters / (hydration.goalLiters || 2.0)) * 100));
  const remainingLiters = Math.max(0, Number(((hydration.goalLiters || 2.0) - hydration.currentLiters).toFixed(1)));
  const todayDateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  const handleCustomLog = () => {
    if (customMl > 0) {
      logWater(customMl);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateHydrationSettings({
        dailyGoalLiters: Number(dailyGoal),
        intervalMinutes: Number(intervalMins),
        startTime,
        endTime,
        reminderEnabled,
      });
      setSettingsModalOpen(false);
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
              Hydration Tracker & Schedule
            </span>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-stone-900 tracking-tight">
              Daily Water Intake
            </h1>
            <p className="text-base text-stone-600 font-medium mt-1">
              Regular reminders and tracking to maintain healthy daily hydration.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => {
                setDailyGoal(hydrationSettings?.dailyGoalLiters || hydration.goalLiters || 2.0);
                setIntervalMins(hydrationSettings?.intervalMinutes || 60);
                setStartTime(hydrationSettings?.startTime || '08:00');
                setEndTime(hydrationSettings?.endTime || '20:00');
                setReminderEnabled(hydrationSettings?.reminderEnabled !== false);
                setSettingsModalOpen(true);
              }}
              className="py-2.5 px-4 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 font-bold text-xs shadow-xs transition-colors flex items-center gap-2"
            >
              <Settings2 className="w-4 h-4 text-teal-700" />
              Configure Schedule
            </button>

            <div className="flex items-center gap-2 bg-stone-100/80 border border-stone-200 px-3.5 py-2.5 rounded-xl text-xs font-semibold text-stone-700 shrink-0">
              <Calendar className="w-3.5 h-3.5 text-stone-500" />
              <span>{todayDateStr}</span>
            </div>
          </div>
        </div>
      </motion.section>

      {/* 2. TODAY'S HYDRATION HERO & REMINDER SCHEDULE */}
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
                ? `${remainingLiters} L remaining to reach your daily goal`
                : 'Daily goal completed! Keep sipping water as needed.'}
            </p>
          </div>

          {/* Minimal Elegant Progress Bar */}
          <div className="space-y-2">
            <div className="w-full h-3.5 bg-stone-100 rounded-full overflow-hidden p-0.5 border border-stone-200/60">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${percent}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="h-full bg-gradient-to-r from-sky-500 to-teal-600 rounded-full"
              />
            </div>
            <div className="flex justify-between text-[11px] font-semibold text-stone-400">
              <span>0 L</span>
              <span>{(hydration.goalLiters / 2).toFixed(1)} L</span>
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
                max={1500}
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

        {/* Reminder Schedule Card */}
        <div className="bg-white border border-stone-200/90 rounded-2xl p-6 shadow-xs space-y-5 flex flex-col justify-between">
          <div className="space-y-3">
            <span className="text-xs font-bold uppercase tracking-widest text-teal-800 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              Reminder Schedule
            </span>

            <div className="space-y-1">
              <h3 className="text-lg font-bold text-stone-900">Hydration Intervals</h3>
              <p className="text-xs text-stone-600 leading-relaxed font-medium">
                {hydrationSettings?.reminderEnabled !== false
                  ? `Automated prompts scheduled every ${hydrationSettings?.intervalMinutes || 60} minutes between ${hydrationSettings?.startTime || '08:00'} and ${hydrationSettings?.endTime || '20:00'}.`
                  : 'Hydration reminders are currently paused.'}
              </p>
            </div>
          </div>

          <div className="bg-stone-50 border border-stone-200/80 rounded-xl p-4 text-center space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block">
              Schedule Status
            </span>
            <span className="text-sm font-extrabold text-stone-900 block">
              {hydration.nextReminderTime}
            </span>
          </div>

          <div className="pt-1">
            <button
              onClick={() => setSettingsModalOpen(true)}
              className="w-full py-2.5 rounded-xl bg-stone-100 hover:bg-stone-200/70 border border-stone-200 text-stone-800 font-bold text-xs transition-colors flex items-center justify-center gap-2"
            >
              <Settings2 className="w-3.5 h-3.5 text-teal-700" />
              Adjust Schedule & Intervals
            </button>
          </div>
        </div>
      </div>

      {/* 3. TODAY'S HISTORY TIMELINE */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-widest text-teal-800 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            Today's Water Intake Log
          </h2>
          <span className="text-xs text-stone-500 font-medium">
            {hydration.logs.length} entries recorded
          </span>
        </div>

        <div className="bg-white border border-stone-200/90 rounded-2xl p-6 shadow-xs space-y-3">
          {hydration.logs.length === 0 ? (
            <div className="text-center py-8 text-stone-400 space-y-1">
              <p className="text-xs font-semibold text-stone-500">No water logged yet today.</p>
              <p className="text-[11px]">Use the quick entry buttons above to record your first glass.</p>
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

      {/* 4. MODAL: CONFIGURE HYDRATION REMINDER SCHEDULE */}
      {settingsModalOpen && (
        <div className="fixed inset-0 z-50 bg-stone-950/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full border border-stone-200 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-stone-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center">
                  <Droplet className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-stone-900">Configure Hydration Schedule</h3>
              </div>
              <button
                onClick={() => setSettingsModalOpen(false)}
                className="p-1 text-stone-400 hover:text-stone-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-4">
              {/* Daily Target */}
              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">Daily Target (Liters)</label>
                <input
                  type="number"
                  step={0.1}
                  min={0.5}
                  max={8.0}
                  required
                  value={dailyGoal}
                  onChange={(e) => setDailyGoal(Number(e.target.value))}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-xs font-medium text-stone-800 focus:outline-none focus:ring-2 focus:ring-teal-700"
                />
              </div>

              {/* Reminder Interval */}
              <div>
                <label className="text-xs font-bold text-stone-700 block mb-1">Reminder Interval</label>
                <select
                  value={intervalMins}
                  onChange={(e) => setIntervalMins(Number(e.target.value))}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-xs font-medium text-stone-800 focus:outline-none focus:ring-2 focus:ring-teal-700"
                >
                  <option value={30}>Every 30 minutes</option>
                  <option value={45}>Every 45 minutes</option>
                  <option value={60}>Every 1 hour (60 minutes)</option>
                  <option value={90}>Every 1.5 hours (90 minutes)</option>
                  <option value={120}>Every 2 hours (120 minutes)</option>
                </select>
              </div>

              {/* Start & End Times */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">Start Time</label>
                  <input
                    type="time"
                    required
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-xs font-medium text-stone-800 focus:outline-none focus:ring-2 focus:ring-teal-700"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-stone-700 block mb-1">End Time</label>
                  <input
                    type="time"
                    required
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-xs font-medium text-stone-800 focus:outline-none focus:ring-2 focus:ring-teal-700"
                  />
                </div>
              </div>

              {/* Reminder Enable/Disable Toggle */}
              <div className="flex items-center justify-between p-3.5 bg-stone-50 rounded-2xl border border-stone-200">
                <div className="flex items-center gap-2.5">
                  {reminderEnabled ? (
                    <Bell className="w-4 h-4 text-teal-700" />
                  ) : (
                    <BellOff className="w-4 h-4 text-stone-400" />
                  )}
                  <div>
                    <span className="text-xs font-bold text-stone-800 block">Water Break Notifications</span>
                    <span className="text-[11px] text-stone-500">Gentle sound / chime on device</span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={reminderEnabled}
                  onChange={(e) => setReminderEnabled(e.target.checked)}
                  className="w-5 h-5 accent-teal-700 rounded-md cursor-pointer"
                />
              </div>

              <div className="flex gap-2.5 pt-3 border-t border-stone-100">
                <button
                  type="button"
                  onClick={() => setSettingsModalOpen(false)}
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
