import React, { useState } from 'react';
import { useCareSync } from '../../context/CareSyncContext';
import {
  ShieldCheck,
  BellRing,
  Save,
  Clock,
  Phone,
  Moon,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  HeartHandshake,
  ArrowDown,
  User,
  Sliders,
  Bell,
} from 'lucide-react';
import { motion } from 'motion/react';

export const EscalationRulesView: React.FC = () => {
  const { escalationRules, updateEscalationRules, patient } = useCareSync();

  const [rules, setRules] = useState(escalationRules);
  const [savedSuccess, setSavedSuccess] = useState(false);

  React.useEffect(() => {
    if (escalationRules) {
      setRules(escalationRules);
    }
  }, [escalationRules]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateEscalationRules(rules);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  const levels = rules?.levels || [];
  const level1 = levels.find((l) => l.level === 1) || levels[0];
  const level2 = levels.find((l) => l.level === 2) || levels[1];
  const level3 = levels.find((l) => l.level === 3) || levels[2];
  const level4 = levels.find((l) => l.level === 4) || levels[3];

  const level1Delay = level1 ? level1.delayMinutes : 0;
  const level2Delay = level2 ? level2.delayMinutes : 15;
  const level3Delay = level3 ? level3.delayMinutes : 30;
  const level4Delay = level4 ? level4.delayMinutes : 60;

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
              Automated Protocol
            </span>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-stone-900 tracking-tight">
              Care Escalation
            </h1>
            <p className="text-base text-stone-600 font-medium mt-1">
              Choose what happens when an important routine isn't confirmed.
            </p>
          </div>

          <button
            onClick={handleSave}
            className="py-3 px-5 rounded-2xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs shadow-xs flex items-center justify-center gap-2 transition-colors shrink-0"
          >
            <Save className="w-4 h-4" />
            {savedSuccess ? 'Settings Saved ✓' : 'Save Protocol'}
          </button>
        </div>

        {/* Reassuring Banner */}
        <div className="bg-stone-100/80 border border-stone-200/90 rounded-2xl p-4 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
          <p className="text-xs text-stone-700 font-medium leading-relaxed">
            CareSync gradually increases notifications so caregivers are informed when attention is genuinely needed, without creating unnecessary alarm.
          </p>
        </div>
      </motion.section>

      {/* 2. ESCALATION TIMELINE */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold uppercase tracking-widest text-teal-800 flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5" />
            4-Stage Escalation Timeline
          </h2>
          <span className="text-xs text-stone-500 font-medium">Sequential Notification Protocol</span>
        </div>

        <div className="space-y-4 relative">
          {rules.levels.map((lvl) => {
            let borderAccent = 'border-stone-200/90 bg-white';
            let badgeBg = 'bg-stone-100 text-stone-700';

            if (lvl.level === 1) {
              badgeBg = 'bg-emerald-100 text-emerald-800 border-emerald-200';
            } else if (lvl.level === 2) {
              badgeBg = 'bg-sky-100 text-sky-800 border-sky-200';
            } else if (lvl.level === 3) {
              badgeBg = 'bg-amber-100 text-amber-900 border-amber-300';
            } else if (lvl.level === 4) {
              badgeBg = 'bg-rose-100 text-rose-800 border-rose-200';
            }

            return (
              <div
                key={lvl.level}
                className={`p-6 rounded-2xl border ${borderAccent} shadow-xs space-y-4 transition-all`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${badgeBg}`}>
                      Level {lvl.level}
                    </span>
                    <h3 className="text-base font-bold text-stone-900">{lvl.title}</h3>
                  </div>

                  <label className="flex items-center gap-2 text-xs font-bold text-stone-700 cursor-pointer shrink-0">
                    <span>{lvl.enabled ? 'Enabled' : 'Disabled'}</span>
                    <input
                      type="checkbox"
                      checked={lvl.enabled}
                      onChange={(e) => {
                        const updated = rules.levels.map((l) =>
                          l.level === lvl.level ? { ...l, enabled: e.target.checked } : l
                        );
                        setRules({ ...rules, levels: updated });
                      }}
                      className="w-4 h-4 text-teal-700 rounded border-stone-300 focus:ring-teal-700"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div className="md:col-span-2 space-y-1">
                    <p className="text-stone-600 font-medium leading-relaxed">{lvl.description}</p>
                    <span className="text-[11px] text-stone-400 block font-semibold">
                      Recipient Target: <strong className="text-stone-700">{lvl.target}</strong>
                    </span>
                  </div>

                  <div className="bg-stone-50 border border-stone-200/80 rounded-xl p-3 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-stone-400 block">Delay After Due Time</span>
                      <span className="text-sm font-extrabold text-stone-900">{lvl.delayMinutes} Minutes</span>
                    </div>
                    <Clock className="w-4 h-4 text-stone-400" />
                  </div>
                </div>

                {lvl.level === 4 && (
                  <p className="text-[11px] text-stone-500 italic bg-amber-50/80 border border-amber-200/80 p-2.5 rounded-xl">
                    Note: The emergency workflow is a user-configured escalation rule and does not automatically diagnose medical emergencies.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 3. CURRENT CONFIGURATION & HOW IT WORKS PREVIEW */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* CURRENT POLICY SUMMARY */}
        <section className="bg-white border border-stone-200/90 rounded-2xl p-6 shadow-xs space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-teal-800 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-teal-700" />
            Current Escalation Policy
          </h2>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between p-3 rounded-xl bg-stone-50 border border-stone-200/70">
              <span className="font-bold text-stone-700">Patient Reminder</span>
              <span className="font-semibold text-stone-900">
                {level1?.enabled ? `After ${level1Delay} mins` : 'Disabled'}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-stone-50 border border-stone-200/70">
              <span className="font-bold text-stone-700">Second Reminder</span>
              <span className="font-semibold text-stone-900">
                {level2?.enabled ? `After ${level2Delay} mins` : 'Disabled'}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-stone-50 border border-stone-200/70">
              <span className="font-bold text-stone-700">Caregiver Alert</span>
              <span className="font-semibold text-stone-900">
                {level3?.enabled ? `After ${level3Delay} mins` : 'Disabled'}
              </span>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-stone-50 border border-stone-200/70">
              <span className="font-bold text-stone-700">Emergency Workflow</span>
              <span className="font-semibold text-stone-900">
                {level4?.enabled ? `After ${level4Delay} mins` : 'Disabled'}
              </span>
            </div>
          </div>
        </section>

        {/* HOW IT WORKS VISUAL PREVIEW */}
        <section className="bg-white border border-stone-200/90 rounded-2xl p-6 shadow-xs space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-teal-800 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-teal-700" />
            How It Works (Preview)
          </h2>

          <div className="space-y-2 text-xs">
            <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-200/70 flex items-center justify-between font-bold text-stone-800">
              <span>8:00 PM</span>
              <span className="text-stone-600 font-medium">Medication Due</span>
            </div>

            <div className="flex justify-center my-0.5">
              <ArrowDown className="w-3.5 h-3.5 text-stone-400" />
            </div>

            <div className="p-2.5 rounded-xl bg-emerald-50/70 border border-emerald-200/70 flex items-center justify-between font-bold text-emerald-900">
              <span>8:10 PM</span>
              <span className="font-semibold">Patient Reminder Sent</span>
            </div>

            <div className="flex justify-center my-0.5">
              <ArrowDown className="w-3.5 h-3.5 text-stone-400" />
            </div>

            <div className="p-2.5 rounded-xl bg-sky-50/70 border border-sky-200/70 flex items-center justify-between font-bold text-sky-900">
              <span>8:25 PM</span>
              <span className="font-semibold">Second Patient Reminder</span>
            </div>

            <div className="flex justify-center my-0.5">
              <ArrowDown className="w-3.5 h-3.5 text-stone-400" />
            </div>

            <div className="p-2.5 rounded-xl bg-amber-50/70 border border-amber-200/70 flex items-center justify-between font-bold text-amber-900">
              <span>8:40 PM</span>
              <span className="font-semibold">Caregiver Notified</span>
            </div>
          </div>
        </section>
      </div>

      {/* 4. SETTINGS CONTROLS */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-stone-200/90 rounded-2xl p-6 shadow-xs space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-teal-800 flex items-center gap-1.5">
            <Bell className="w-3.5 h-3.5" />
            Reminder Frequency
          </h2>

          <div className="space-y-4 text-xs">
            <div>
              <label className="font-bold text-stone-700 block mb-1.5">
                Max Patient Reminders Before Caregiver Alert
              </label>
              <select
                value={rules.maxRemindersBeforeEscalation}
                onChange={(e) => setRules({ ...rules, maxRemindersBeforeEscalation: parseInt(e.target.value) })}
                className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 font-semibold text-stone-800 focus:outline-none focus:ring-1 focus:ring-teal-700"
              >
                <option value={2}>2 Reminders (Aggressive)</option>
                <option value={3}>3 Reminders (Standard)</option>
                <option value={4}>4 Reminders (Relaxed)</option>
              </select>
            </div>

            <div>
              <label className="font-bold text-stone-700 block mb-1.5">
                Interval Between Repeat Reminders
              </label>
              <select
                value={rules.repeatReminderIntervalMinutes}
                onChange={(e) => setRules({ ...rules, repeatReminderIntervalMinutes: parseInt(e.target.value) })}
                className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 font-semibold text-stone-800 focus:outline-none focus:ring-1 focus:ring-teal-700"
              >
                <option value={10}>Every 10 minutes</option>
                <option value={15}>Every 15 minutes</option>
                <option value={30}>Every 30 minutes</option>
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white border border-stone-200/90 rounded-2xl p-6 shadow-xs space-y-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-teal-800 flex items-center gap-1.5">
            <Phone className="w-3.5 h-3.5" />
            Emergency Contacts & Quiet Hours
          </h2>

          <div className="space-y-4 text-xs">
            <div>
              <label className="font-bold text-stone-700 block mb-1.5">Caregiver Emergency Phone</label>
              <input
                type="text"
                value={rules.caregiverPhone}
                onChange={(e) => setRules({ ...rules, caregiverPhone: e.target.value })}
                className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 font-semibold text-stone-800 focus:outline-none focus:ring-1 focus:ring-teal-700"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-stone-700 block mb-1.5">Quiet Hours Start</label>
                <input
                  type="text"
                  value={rules.quietHoursStart}
                  onChange={(e) => setRules({ ...rules, quietHoursStart: e.target.value })}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 font-semibold text-stone-800 focus:outline-none focus:ring-1 focus:ring-teal-700"
                />
              </div>
              <div>
                <label className="font-bold text-stone-700 block mb-1.5">Quiet Hours End</label>
                <input
                  type="text"
                  value={rules.quietHoursEnd}
                  onChange={(e) => setRules({ ...rules, quietHoursEnd: e.target.value })}
                  className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 font-semibold text-stone-800 focus:outline-none focus:ring-1 focus:ring-teal-700"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER CAPTION */}
      <div className="flex items-center gap-2 text-xs text-stone-500 pt-2 border-t border-stone-200/80">
        <HeartHandshake className="w-3.5 h-3.5 text-stone-400 shrink-0" />
        <span>Configured protocols are executed automatically by CareSync's notification service.</span>
      </div>
    </div>
  );
};

