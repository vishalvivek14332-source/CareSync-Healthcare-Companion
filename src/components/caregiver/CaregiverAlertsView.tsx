import React, { useState } from 'react';
import { useCareSync } from '../../context/CareSyncContext';
import { Bell, CheckCircle2, Phone, Sparkles, HeartHandshake, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';

export const CaregiverAlertsView: React.FC = () => {
  const { alerts, markAlertReviewed, patient } = useCareSync();
  const [filterSeverity, setFilterSeverity] = useState<string>('all');

  const unreadCount = alerts.filter((a) => !a.reviewed).length;
  const importantCount = alerts.filter((a) => a.severity === 'high' || a.severity === 'emergency').length;
  const attentionCount = alerts.filter((a) => a.severity === 'medium').length;
  const normalCount = alerts.filter((a) => a.severity === 'low' || a.severity === 'info').length;
  const resolvedCount = alerts.filter((a) => a.reviewed).length;

  const filteredAlerts = alerts.filter((a) => {
    if (filterSeverity === 'unreviewed') return !a.reviewed;
    if (filterSeverity === 'reviewed') return a.reviewed;
    if (filterSeverity === 'important' || filterSeverity === 'high') {
      return a.severity === 'high' || a.severity === 'emergency';
    }
    if (filterSeverity === 'attention' || filterSeverity === 'medium') {
      return a.severity === 'medium';
    }
    if (filterSeverity === 'normal' || filterSeverity === 'low') {
      return a.severity === 'low' || a.severity === 'info';
    }
    return true;
  });

  const medAlertsCount = alerts.filter((a) => a.title.toLowerCase().includes('medication') || a.description.toLowerCase().includes('medication')).length;

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
              Care Center
            </span>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-stone-900 tracking-tight">
              Care Alerts
            </h1>
            <p className="text-base text-stone-600 font-medium mt-1">
              Important updates about {patient?.name?.split(' ')[0] || 'your patient'}'s daily routine.
            </p>
          </div>

          {/* Compact Summary Pills */}
          <div className="flex items-center gap-2.5 shrink-0 bg-stone-100/80 border border-stone-200 p-2 rounded-2xl">
            <div className="px-3 py-1.5 rounded-xl bg-white border border-stone-200/80 text-center">
              <span className="text-[10px] font-bold uppercase text-stone-400 block">Unread</span>
              <span className="text-sm font-extrabold text-amber-700">{unreadCount}</span>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-white border border-stone-200/80 text-center">
              <span className="text-[10px] font-bold uppercase text-stone-400 block">Important</span>
              <span className="text-sm font-extrabold text-rose-700">{importantCount}</span>
            </div>
            <div className="px-3 py-1.5 rounded-xl bg-white border border-stone-200/80 text-center">
              <span className="text-[10px] font-bold uppercase text-stone-400 block">Resolved</span>
              <span className="text-sm font-extrabold text-emerald-800">{resolvedCount}</span>
            </div>
          </div>
        </div>
      </motion.section>

      {/* 2. FILTER CONTROLS */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-widest text-teal-800 flex items-center gap-1.5">
            <Bell className="w-3.5 h-3.5" />
            Filter Notifications
          </span>
          <span className="text-xs text-stone-500 font-medium">
            Showing {filteredAlerts.length} of {alerts.length}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {[
            { id: 'all', label: `All (${alerts.length})` },
            { id: 'important', label: `Important (${importantCount})` },
            { id: 'attention', label: `Attention (${attentionCount})` },
            { id: 'normal', label: `Normal (${normalCount})` },
            { id: 'unreviewed', label: `Unread (${unreadCount})` },
            { id: 'reviewed', label: `Reviewed (${resolvedCount})` },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setFilterSeverity(f.id)}
              className={`py-2 px-3.5 rounded-xl text-xs font-bold transition-colors ${
                filterSeverity === f.id
                  ? 'bg-teal-700 text-white shadow-xs'
                  : 'bg-white border border-stone-200 text-stone-600 hover:bg-stone-50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </section>

      {/* 3. ALERT LIST */}
      <section className="space-y-4">
        {filteredAlerts.length === 0 ? (
          <div className="bg-white border border-stone-200/90 rounded-2xl p-10 text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 mx-auto flex items-center justify-center">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-stone-900">You're all caught up</h3>
              <p className="text-xs text-stone-500 font-medium mt-0.5">
                No new care alerts for {patient.name} in this view.
              </p>
            </div>
          </div>
        ) : (
          filteredAlerts.map((alt) => {
            const isHigh = alt.severity === 'high' || alt.severity === 'emergency';
            const isMedium = alt.severity === 'medium';

            let cardBg = 'bg-white border-stone-200/90';
            let badgeBg = 'bg-emerald-50 text-emerald-800 border-emerald-200';
            let badgeText = '🟢 Normal';

            if (isHigh) {
              cardBg = 'bg-rose-50/60 border-rose-200';
              badgeBg = 'bg-rose-700 text-white border-rose-700';
              badgeText = '🔴 Important';
            } else if (isMedium) {
              cardBg = 'bg-amber-50/60 border-amber-200';
              badgeBg = 'bg-amber-600 text-white border-amber-600';
              badgeText = '🟡 Attention';
            }

            return (
              <motion.div
                key={alt.id}
                whileHover={{ y: -1 }}
                className={`p-6 rounded-2xl border ${cardBg} shadow-xs space-y-4 transition-all`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase border tracking-wider ${badgeBg}`}>
                      {badgeText}
                    </span>
                    <span className="text-xs font-bold text-stone-500">
                      Patient: <strong className="text-stone-800 font-semibold">{alt.patientName || patient.name}</strong>
                    </span>
                  </div>
                  <span className="text-xs font-medium text-stone-400">{alt.timestamp}</span>
                </div>

                <div className="space-y-1.5">
                  <h3 className="text-lg font-bold text-stone-900">{alt.title}</h3>
                  <p className="text-xs text-stone-600 leading-relaxed">{alt.description}</p>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                  <span className="text-[11px] font-semibold text-stone-500">
                    Status: {alt.reviewed ? <span className="text-emerald-800 font-bold">Reviewed ✓</span> : <span className="text-amber-800 font-bold">Action Pending</span>}
                  </span>

                  <div className="flex items-center gap-2">
                    <a
                      href={`tel:${patient.emergencyPhone}`}
                      className="py-2 px-3.5 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-800 font-bold text-xs transition-colors flex items-center gap-1.5"
                    >
                      <Phone className="w-3.5 h-3.5 text-teal-700" />
                      Call Patient
                    </a>

                    {!alt.reviewed ? (
                      <button
                        onClick={() => markAlertReviewed(alt.id)}
                        className="py-2 px-4 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs shadow-xs transition-colors flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Mark Reviewed
                      </button>
                    ) : (
                      <span className="py-2 px-3.5 rounded-xl bg-emerald-50 text-emerald-800 font-bold text-xs border border-emerald-200">
                        Reviewed ✓
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </section>

      {/* 4. EDITORIAL INSIGHT */}
      <section className="bg-stone-100/70 border border-stone-200/90 rounded-2xl p-6 space-y-2">
        <div className="text-xs font-bold uppercase tracking-widest text-teal-800 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-teal-700" />
          Alert Summary Insight
        </div>
        <p className="text-base font-semibold text-stone-800 italic">
          "Medication and routine timing notifications accounted for {medAlertsCount} of {alerts.length} alerts recorded this week."
        </p>
        <div className="flex items-center gap-2 pt-1 text-xs text-stone-500">
          <HeartHandshake className="w-3.5 h-3.5 text-stone-400 shrink-0" />
          <span>Automated wellness logs generated by CareSync monitoring matrix.</span>
        </div>
      </section>
    </div>
  );
};

