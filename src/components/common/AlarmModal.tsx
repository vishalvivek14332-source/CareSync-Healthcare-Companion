import React, { useEffect, useRef } from 'react';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Pill, Droplet, Bell, Volume2, Clock, Check, X, Moon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface ActiveAlarmInfo {
  id: string;
  type: 'medication' | 'hydration';
  title: string;
  subtitle?: string;
  scheduledTime: string;
  dosageOrAmount: string;
  instructions?: string;
  extra?: any;
}

interface AlarmModalProps {
  alarm: ActiveAlarmInfo | null;
  onTaken: (alarm: ActiveAlarmInfo) => void;
  onDrank: (alarm: ActiveAlarmInfo) => void;
  onSnooze: (alarm: ActiveAlarmInfo, minutes: number) => void;
  onDismiss: (alarm: ActiveAlarmInfo) => void;
}

export const AlarmModal: React.FC<AlarmModalProps> = ({
  alarm,
  onTaken,
  onDrank,
  onSnooze,
  onDismiss,
}) => {
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioIntervalRef = useRef<any>(null);
  const vibrateIntervalRef = useRef<any>(null);

  useEffect(() => {
    if (!alarm) {
      stopAudioAndHaptics();
      return;
    }

    // 1. Play soft pulsing chime via Web Audio
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        audioCtxRef.current = new AudioCtx();
        playBeepPattern();
        audioIntervalRef.current = setInterval(() => {
          playBeepPattern();
        }, 3000);
      }
    } catch {
      // Audio context restricted or unavailable
    }

    // 2. Trigger periodic haptic feedback
    try {
      Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {});
      vibrateIntervalRef.current = setInterval(() => {
        Haptics.vibrate({ duration: 400 }).catch(() => {});
      }, 2000);
    } catch {
      // Haptics unavailable
    }

    return () => {
      stopAudioAndHaptics();
    };
  }, [alarm]);

  const stopAudioAndHaptics = () => {
    if (audioIntervalRef.current) {
      clearInterval(audioIntervalRef.current);
      audioIntervalRef.current = null;
    }
    if (vibrateIntervalRef.current) {
      clearInterval(vibrateIntervalRef.current);
      vibrateIntervalRef.current = null;
    }
    if (audioCtxRef.current) {
      try {
        audioCtxRef.current.close().catch(() => {});
      } catch {}
      audioCtxRef.current = null;
    }
  };

  const playBeepPattern = () => {
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') return;
    try {
      const ctx = audioCtxRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const now = ctx.currentTime;
      // High pitch tone
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, now); // A5
      gain1.gain.setValueAtTime(0.15, now);
      gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.35);

      // Second tone
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1174.66, now + 0.2); // D6
      gain2.gain.setValueAtTime(0.15, now + 0.2);
      gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.2);
      osc2.stop(now + 0.6);
    } catch {
      // Audio autoplay policy fallback
    }
  };

  if (!alarm) return null;

  const isMed = alarm.type === 'medication';

  const handleAction = (type: 'taken' | 'drank' | 'snooze' | 'dismiss') => {
    stopAudioAndHaptics();
    if (type === 'taken') onTaken(alarm);
    else if (type === 'drank') onDrank(alarm);
    else if (type === 'snooze') onSnooze(alarm, 10);
    else onDismiss(alarm);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className={`w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border ${
            isMed ? 'border-teal-500/30 ring-4 ring-teal-500/20' : 'border-sky-500/30 ring-4 ring-sky-500/20'
          }`}
        >
          {/* Top Banner Header */}
          <div
            className={`p-6 text-white text-center relative overflow-hidden ${
              isMed
                ? 'bg-gradient-to-br from-teal-700 via-teal-800 to-emerald-900'
                : 'bg-gradient-to-br from-sky-600 via-sky-700 to-blue-900'
            }`}
          >
            <div className="absolute -right-8 -top-8 w-32 h-32 bg-white/10 rounded-full blur-xl" />
            <div className="flex items-center justify-center gap-2 mb-2">
              <span className="text-[11px] font-extrabold uppercase tracking-widest bg-white/20 px-3 py-1 rounded-full flex items-center gap-1.5 backdrop-blur-xs">
                <Volume2 className="w-3.5 h-3.5 animate-pulse" />
                {isMed ? 'CareSync Medication Alarm' : 'CareSync Hydration Alarm'}
              </span>
            </div>

            <div className="my-4 flex items-center justify-center">
              <div className="w-20 h-20 rounded-3xl bg-white/15 backdrop-blur-md flex items-center justify-center shadow-inner border border-white/20">
                {isMed ? (
                  <Pill className="w-10 h-10 text-white" />
                ) : (
                  <Droplet className="w-10 h-10 text-white" />
                )}
              </div>
            </div>

            <h2 className="text-2xl font-black tracking-tight">{alarm.title}</h2>
            {alarm.subtitle && <p className="text-white/80 text-sm mt-0.5">{alarm.subtitle}</p>}
          </div>

          {/* Details Body */}
          <div className="p-6 space-y-6">
            <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500 font-semibold flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-slate-400" />
                  Scheduled Time:
                </span>
                <span className="font-extrabold text-slate-900">{alarm.scheduledTime}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500 font-semibold">
                  {isMed ? 'Prescribed Dosage:' : 'Target Amount:'}
                </span>
                <span className="font-extrabold text-teal-700">{alarm.dosageOrAmount}</span>
              </div>
              {alarm.instructions && (
                <div className="pt-2 border-t border-slate-200/60 text-xs text-slate-600 font-medium">
                  <strong>Instructions:</strong> {alarm.instructions}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              {isMed ? (
                <button
                  onClick={() => handleAction('taken')}
                  className="w-full py-4 px-6 rounded-2xl bg-teal-700 hover:bg-teal-800 text-white font-extrabold text-base shadow-lg shadow-teal-700/25 transition-all transform active:scale-98 flex items-center justify-center gap-2"
                >
                  <Check className="w-5 h-5 stroke-[3]" />
                  CONFIRM TAKEN
                </button>
              ) : (
                <button
                  onClick={() => handleAction('drank')}
                  className="w-full py-4 px-6 rounded-2xl bg-sky-600 hover:bg-sky-700 text-white font-extrabold text-base shadow-lg shadow-sky-600/25 transition-all transform active:scale-98 flex items-center justify-center gap-2"
                >
                  <Check className="w-5 h-5 stroke-[3]" />
                  LOG DRANK ({alarm.dosageOrAmount})
                </button>
              )}

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleAction('snooze')}
                  className="py-3 px-4 rounded-xl border border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors flex items-center justify-center gap-1.5"
                >
                  <Clock className="w-4 h-4 text-slate-500" />
                  Snooze (10 Min)
                </button>

                <button
                  onClick={() => handleAction('dismiss')}
                  className="py-3 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-bold text-xs transition-colors flex items-center justify-center gap-1.5"
                >
                  <X className="w-4 h-4 text-slate-400" />
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
