import React, { useState } from 'react';
import { useCareSync } from '../../context/CareSyncContext';
import {
  Droplet,
  Plus,
  Clock,
  TrendingUp,
  CheckCircle2,
  Calendar,
  Settings2,
  X,
  Bell,
  BellOff,
  Trash2,
  Edit2,
  Volume2,
  Sparkles,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { HydrationSchedule } from '../../types';

export const HydrationView: React.FC = () => {
  const {
    hydration,
    hydrationSettings,
    hydrationSchedules,
    logWater,
    updateHydrationSettings,
    addHydrationSchedule,
    updateHydrationSchedule,
    deleteHydrationSchedule,
    triggerAlarmTest,
  } = useCareSync();

  const [customMl, setCustomMl] = useState<number>(250);
  const [settingsModalOpen, setSettingsModalOpen] = useState<boolean>(false);
  const [slotModalOpen, setSlotModalOpen] = useState<boolean>(false);
  const [editingSlot, setEditingSlot] = useState<HydrationSchedule | null>(null);

  // Slot modal form state
  const [slotTime, setSlotTime] = useState<string>('08:00');
  const [slotAmount, setSlotAmount] = useState<number>(250);
  const [slotRepeat, setSlotRepeat] = useState<string>('daily');
  const [slotStartDate, setSlotStartDate] = useState<string>('');
  const [slotEndDate, setSlotEndDate] = useState<string>('');

  // Settings form state
  const [dailyGoal, setDailyGoal] = useState<number>(hydrationSettings?.dailyGoalLiters || hydration.goalLiters || 2.0);
  const [intervalMins, setIntervalMins] = useState<number>(hydrationSettings?.intervalMinutes || 60);
  const [startTime, setStartTime] = useState<string>(hydrationSettings?.startTime || '08:00');
  const [endTime, setEndTime] = useState<string>(hydrationSettings?.endTime || '20:00');
  const [reminderEnabled, setReminderEnabled] = useState<boolean>(hydrationSettings?.reminderEnabled !== false);

  const percent = Math.min(100, Math.round((hydration.currentLiters / (hydration.goalLiters || 2.0)) * 100));
  const remainingLiters = Math.max(0, Number(((hydration.goalLiters || 2.0) - hydration.currentLiters).toFixed(1)));
  const todayDateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

  const formatTime24to12 = (t: string) => {
    if (!t) return '08:00 AM';
    if (t.includes('AM') || t.includes('PM')) return t;
    const [hStr, mStr] = t.split(':');
    let h = parseInt(hStr, 10);
    const m = mStr || '00';
    const ampm = h >= 12 ? 'PM' : 'AM';
    if (h === 0) h = 12;
    else if (h > 12) h -= 12;
    return `${String(h).padStart(2, '0')}:${m} ${ampm}`;
  };

  const handleOpenAddSlot = () => {
    setEditingSlot(null);
    setSlotTime('08:00');
    setSlotAmount(250);
    setSlotRepeat('daily');
    setSlotStartDate('');
    setSlotEndDate('');
    setSlotModalOpen(true);
  };

  const handleOpenEditSlot = (slot: HydrationSchedule) => {
    setEditingSlot(slot);
    setSlotTime(slot.scheduledTime);
    setSlotAmount(slot.amountMl);
    setSlotRepeat(slot.repeatDays || 'daily');
    setSlotStartDate(slot.startDate || '');
    setSlotEndDate(slot.endDate || '');
    setSlotModalOpen(true);
  };

  const handleSaveSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const formattedTime = formatTime24to12(slotTime);
      if (editingSlot) {
        await updateHydrationSchedule(editingSlot.id, {
          scheduledTime: formattedTime,
          amountMl: Number(slotAmount),
          repeatDays: slotRepeat,
          startDate: slotStartDate || undefined,
          endDate: slotEndDate || undefined,
        });
      } else {
        await addHydrationSchedule({
          scheduledTime: formattedTime,
          amountMl: Number(slotAmount),
          repeatDays: slotRepeat,
          enabled: true,
          startDate: slotStartDate || undefined,
          endDate: slotEndDate || undefined,
        });
      }
      setSlotModalOpen(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleToggleSlot = (slot: HydrationSchedule) => {
    updateHydrationSchedule(slot.id, { enabled: !slot.enabled }).catch(console.error);
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
              Hydration Schedule & Tracking
            </span>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-stone-900 tracking-tight">
              Daily Water Intake
            </h1>
            <p className="text-base text-stone-600 font-medium mt-1">
              Discrete multi-slot reminders and high-priority alarms to maintain healthy daily hydration.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              onClick={() => triggerAlarmTest('hydration')}
              className="py-2.5 px-3.5 rounded-xl border border-sky-200 bg-sky-50 hover:bg-sky-100 text-sky-800 font-bold text-xs shadow-xs transition-colors flex items-center gap-1.5"
              title="Test the native alarm chime and alert experience"
            >
              <Volume2 className="w-3.5 h-3.5 text-sky-600" />
              Preview Alarm
            </button>

            <button
              onClick={() => {
                setDailyGoal(hydrationSettings?.dailyGoalLiters || hydration.goalLiters || 2.0);
                setIntervalMins(hydrationSettings?.intervalMinutes || 60);
                setStartTime(hydrationSettings?.startTime || '08:00');
                setEndTime(hydrationSettings?.endTime || '20:00');
                setReminderEnabled(hydrationSettings?.reminderEnabled !== false);
                setSettingsModalOpen(true);
              }}
              className="py-2.5 px-3.5 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 font-bold text-xs shadow-xs transition-colors flex items-center gap-1.5"
            >
              <Settings2 className="w-4 h-4 text-teal-700" />
              Goals
            </button>

            <div className="flex items-center gap-2 bg-stone-100/80 border border-stone-200 px-3 py-2.5 rounded-xl text-xs font-semibold text-stone-700 shrink-0">
              <Calendar className="w-3.5 h-3.5 text-stone-500" />
              <span>{todayDateStr}</span>
            </div>
          </div>
        </div>
      </motion.section>

      {/* 2. TODAY'S HYDRATION HERO */}
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

          {/* Minimal Progress Bar */}
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
                <Plus className="w-4 h-4" />
                +500 ml (Bottle)
              </button>
              <button
                onClick={() => logWater(100)}
                className="py-3 px-4 rounded-xl bg-stone-100 border border-stone-200 hover:bg-stone-200/70 text-stone-800 font-bold text-xs transition-colors flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                +100 ml
              </button>
            </div>
          </div>
        </div>

        {/* Next Scheduled Reminder Summary */}
        <div className="bg-stone-50 border border-stone-200/90 rounded-2xl p-6 shadow-xs flex flex-col justify-between space-y-6">
          <div className="space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-teal-800 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-teal-700" />
              Active Reminders
            </span>
            <h3 className="text-lg font-bold text-stone-900">
              {hydrationSchedules.length > 0
                ? `${hydrationSchedules.filter((s) => s.enabled).length} Active Alarm Slots`
                : hydrationSettings?.reminderEnabled
                ? 'Automated Interval Reminders'
                : 'Alarms Disabled'}
            </h3>
            <p className="text-xs text-stone-600 leading-relaxed font-medium">
              {hydrationSchedules.length > 0
                ? 'Discrete reminder alarms are set on your Android device to trigger exact alerts.'
                : hydration.nextReminderTime}
            </p>
          </div>

          <div className="p-4 rounded-xl bg-white border border-stone-200/80 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-stone-500 font-semibold">Total Intake Today:</span>
              <span className="font-extrabold text-stone-900">{hydration.currentLiters * 1000} ml</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-stone-500 font-semibold">Entries Logged:</span>
              <span className="font-extrabold text-teal-700">{hydration.logs?.length || 0} times</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. MULTI-SLOT HYDRATION SCHEDULE MANAGER */}
      <section className="bg-white border border-stone-200/90 rounded-2xl p-6 sm:p-7 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-stone-100 pb-5">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-sky-800 block mb-1">
              Custom Schedule Slots
            </span>
            <h2 className="text-xl font-extrabold text-stone-900">
              Hydration Reminder Times
            </h2>
            <p className="text-xs text-stone-500 font-medium">
              Configure exact daily times to drink specific quantities of water.
            </p>
          </div>

          <button
            onClick={handleOpenAddSlot}
            className="py-2.5 px-4 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs transition-colors flex items-center gap-1.5 shrink-0 shadow-xs"
          >
            <Plus className="w-4 h-4" />
            Add Hydration Slot
          </button>
        </div>

        {hydrationSchedules.length === 0 ? (
          <div className="py-10 text-center space-y-3 bg-stone-50/60 rounded-xl border border-dashed border-stone-200">
            <Droplet className="w-10 h-10 text-stone-300 mx-auto" />
            <p className="text-sm font-semibold text-stone-700">No custom hydration slots scheduled yet</p>
            <p className="text-xs text-stone-500 max-w-sm mx-auto">
              Add individual slots (e.g. 08:00 AM → 250ml) to receive scheduled alarms throughout the day.
            </p>
            <button
              onClick={handleOpenAddSlot}
              className="mt-2 py-2 px-3.5 rounded-lg border border-teal-200 bg-teal-50 text-teal-800 text-xs font-bold hover:bg-teal-100 transition-colors"
            >
              + Create First Slot
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {hydrationSchedules.map((slot) => (
              <div
                key={slot.id}
                className={`p-4 rounded-2xl border transition-all ${
                  slot.enabled
                    ? 'bg-white border-stone-200/90 shadow-xs'
                    : 'bg-stone-50/80 border-stone-200/50 opacity-60'
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-8 h-8 rounded-xl flex items-center justify-center font-extrabold text-xs ${
                        slot.enabled
                          ? 'bg-sky-50 text-sky-700 border border-sky-200'
                          : 'bg-stone-200 text-stone-500'
                      }`}
                    >
                      <Droplet className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-sm font-extrabold text-stone-900 block">
                        {slot.scheduledTime}
                      </span>
                      <span className="text-[11px] font-semibold text-stone-500">
                        {slot.amountMl} ml
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => handleToggleSlot(slot)}
                    className={`text-xs px-2.5 py-1 rounded-full font-extrabold uppercase tracking-wider transition-colors ${
                      slot.enabled
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300/40'
                        : 'bg-stone-200 text-stone-600'
                    }`}
                  >
                    {slot.enabled ? 'ON' : 'OFF'}
                  </button>
                </div>

                <div className="flex items-center justify-between text-xs text-stone-500 pt-2 border-t border-stone-100 font-medium">
                  <span className="capitalize">{slot.repeatDays || 'Daily'}</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleOpenEditSlot(slot)}
                      className="p-1.5 hover:bg-stone-100 rounded-lg text-stone-600 transition-colors"
                      title="Edit slot"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => deleteHydrationSchedule(slot.id)}
                      className="p-1.5 hover:bg-red-50 rounded-lg text-red-600 transition-colors"
                      title="Delete slot"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 4. TODAY'S LOGGED ENTRIES */}
      <section className="bg-white border border-stone-200/90 rounded-2xl p-6 shadow-xs space-y-4">
        <h2 className="text-lg font-bold text-stone-900">Today's Intake History</h2>
        {hydration.logs && hydration.logs.length > 0 ? (
          <div className="divide-y divide-stone-100">
            {hydration.logs.map((log) => (
              <div key={log.id} className="py-3 flex items-center justify-between text-sm">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center font-bold text-xs">
                    💧
                  </div>
                  <div>
                    <span className="font-bold text-stone-900">+{log.amountMl} ml</span>
                    <span className="text-xs text-stone-500 block">{log.timestamp}</span>
                  </div>
                </div>
                <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200/60">
                  Confirmed
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-stone-500 py-4 text-center">No water logged yet today. Use the buttons above to record intake.</p>
        )}
      </section>

      {/* MODAL: ADD / EDIT HYDRATION SLOT */}
      <AnimatePresence>
        {slotModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-7 shadow-2xl space-y-6 border border-stone-200"
            >
              <div className="flex items-center justify-between border-b border-stone-100 pb-4">
                <h3 className="text-lg font-extrabold text-stone-900">
                  {editingSlot ? 'Edit Hydration Slot' : 'Add Hydration Reminder Slot'}
                </h3>
                <button
                  onClick={() => setSlotModalOpen(false)}
                  className="p-2 text-stone-400 hover:text-stone-600 rounded-xl hover:bg-stone-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveSlot} className="space-y-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-stone-600 block mb-1.5">
                    Scheduled Time
                  </label>
                  <input
                    type="time"
                    required
                    value={slotTime}
                    onChange={(e) => setSlotTime(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-stone-900 font-semibold focus:outline-none focus:ring-2 focus:ring-teal-700"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-stone-600 block mb-1.5">
                    Target Amount (ml)
                  </label>
                  <select
                    value={slotAmount}
                    onChange={(e) => setSlotAmount(Number(e.target.value))}
                    className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-stone-900 font-semibold focus:outline-none focus:ring-2 focus:ring-teal-700"
                  >
                    <option value={150}>150 ml (Small Cup)</option>
                    <option value={200}>200 ml (Standard Cup)</option>
                    <option value={250}>250 ml (Glass)</option>
                    <option value={300}>300 ml (Mug)</option>
                    <option value={500}>500 ml (Bottle)</option>
                    <option value={750}>750 ml (Large Bottle)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-stone-600 block mb-1.5">
                    Repeat Schedule
                  </label>
                  <select
                    value={slotRepeat}
                    onChange={(e) => setSlotRepeat(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-stone-900 font-semibold focus:outline-none focus:ring-2 focus:ring-teal-700"
                  >
                    <option value="daily">Every Day</option>
                    <option value="weekdays">Weekdays (Mon - Fri)</option>
                    <option value="weekends">Weekends (Sat - Sun)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="text-[11px] font-bold text-stone-500 block mb-1">
                      Start Date (Optional)
                    </label>
                    <input
                      type="date"
                      value={slotStartDate}
                      onChange={(e) => setSlotStartDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs font-semibold text-stone-800"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-stone-500 block mb-1">
                      End Date (Optional)
                    </label>
                    <input
                      type="date"
                      value={slotEndDate}
                      onChange={(e) => setSlotEndDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs font-semibold text-stone-800"
                    />
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setSlotModalOpen(false)}
                    className="flex-1 py-3 rounded-xl border border-stone-200 text-stone-700 font-bold text-xs hover:bg-stone-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs shadow-xs transition-colors"
                  >
                    {editingSlot ? 'Save Changes' : 'Create Slot'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL: DAILY GOAL SETTINGS */}
      <AnimatePresence>
        {settingsModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-7 shadow-2xl space-y-6 border border-stone-200"
            >
              <div className="flex items-center justify-between border-b border-stone-100 pb-4">
                <h3 className="text-lg font-extrabold text-stone-900">Hydration Goals & Baseline</h3>
                <button
                  onClick={() => setSettingsModalOpen(false)}
                  className="p-2 text-stone-400 hover:text-stone-600 rounded-xl hover:bg-stone-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveSettings} className="space-y-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-stone-600 block mb-1.5">
                    Daily Goal (Liters)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.5"
                    max="10"
                    required
                    value={dailyGoal}
                    onChange={(e) => setDailyGoal(Number(e.target.value))}
                    className="w-full px-4 py-2.5 rounded-xl border border-stone-200 text-stone-900 font-semibold focus:outline-none focus:ring-2 focus:ring-teal-700"
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs font-bold text-stone-700">Enable Automated Reminders</span>
                  <input
                    type="checkbox"
                    checked={reminderEnabled}
                    onChange={(e) => setReminderEnabled(e.target.checked)}
                    className="w-4 h-4 text-teal-600 rounded"
                  />
                </div>

                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setSettingsModalOpen(false)}
                    className="flex-1 py-3 rounded-xl border border-stone-200 text-stone-700 font-bold text-xs hover:bg-stone-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs shadow-xs"
                  >
                    Save Goal
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
