import React, { useState, useEffect } from 'react';
import { useCareSync } from '../../context/CareSyncContext';
import { Footprints, Play, Square, Flame, MapPin, Clock, Trophy, Award, TrendingUp, Smartphone, ShieldAlert, CheckCircle2, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { checkDeviceActivitySensor, requestActivityPermission, NativeActivityStatus } from '../../services/nativeActivityService';

export const ActivityView: React.FC = () => {
  const { activity, startActivitySession, stopActivitySession, syncDeviceActivity } = useCareSync();
  const [seconds, setSeconds] = useState<number>(0);
  const [sensorStatus, setSensorStatus] = useState<NativeActivityStatus>({
    isAvailable: false,
    permissionStatus: 'unavailable',
    currentDeviceSteps: 0,
  });

  useEffect(() => {
    checkDeviceActivitySensor().then(setSensorStatus);
  }, []);

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

  const handleRequestPermission = async () => {
    const status = await requestActivityPermission();
    setSensorStatus(status);
    if (status.isAvailable && status.currentDeviceSteps > 0) {
      await syncDeviceActivity(status.currentDeviceSteps);
    }
  };

  const formatTimer = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const remainder = sec % 60;
    return `${mins.toString().padStart(2, '0')}:${remainder.toString().padStart(2, '0')}`;
  };

  const hasStepsToday = activity.steps > 0 || activity.hasRecordedActivityToday;

  return (
    <div className="space-y-6 pb-20 max-w-4xl mx-auto pt-2 px-1">
      {/* Header Banner */}
      <div className="bg-gradient-to-br from-emerald-800 via-teal-700 to-emerald-900 rounded-3xl p-6 md:p-8 text-white shadow-xl shadow-emerald-900/15 flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="space-y-2 text-center md:text-left">
          <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-200 bg-white/10 px-3 py-1 rounded-full border border-white/20">
            Daily Movement & Step Tracker
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
            {activity.steps.toLocaleString()} <span className="text-xl font-medium text-emerald-200">/ {activity.stepGoal.toLocaleString()} Steps</span>
          </h1>
          <p className="text-emerald-100 text-xs font-medium max-w-md">
            {hasStepsToday
              ? `You are ${Math.max(0, activity.stepGoal - activity.steps).toLocaleString()} steps away from your daily goal.`
              : 'No activity recorded yet today. Start a walking session or sync your phone pedometer.'}
          </p>
        </div>

        {/* Start Walk / Start Jog buttons */}
        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={() => startActivitySession('walk')}
            className="px-5 py-3.5 rounded-2xl bg-white text-emerald-900 font-extrabold text-xs shadow-lg shadow-emerald-950/20 hover:bg-emerald-50 transition-all flex items-center gap-2"
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

      {/* SENSOR / HARDWARE STATUS NOTIFICATION BANNER */}
      <div className="bg-white border border-stone-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3">
          <div className={`p-2.5 rounded-xl border ${sensorStatus.isAvailable ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-stone-100 text-stone-600 border-stone-200'}`}>
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-stone-900">Phone Step Sensor Status:</span>
              <span className={`text-[11px] font-extrabold px-2 py-0.5 rounded-md ${sensorStatus.isAvailable ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-100 text-stone-600'}`}>
                {sensorStatus.isAvailable ? 'Hardware Sensor Active' : 'Web / Platform Sandbox'}
              </span>
            </div>
            <p className="text-[11px] text-stone-500 font-medium mt-0.5">
              {sensorStatus.isAvailable
                ? 'Device pedometer connected. Steps recorded by your phone automatically reflect here.'
                : 'Pedometer hardware is native to Android devices. On web, record activities using the "Start Walk" session button.'}
            </p>
          </div>
        </div>

        {sensorStatus.permissionStatus === 'prompt' && (
          <button
            onClick={handleRequestPermission}
            className="py-2 px-3.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs shadow-xs transition-colors shrink-0 flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Grant Step Permission
          </button>
        )}
      </div>

      {/* ACTIVE TRACKING MODAL */}
      <AnimatePresence>
        {activity.isTrackingActive && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-stone-900 text-white p-6 rounded-3xl shadow-2xl border border-teal-500/40 flex flex-col md:flex-row items-center justify-between gap-6"
          >
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-teal-600 text-white flex items-center justify-center font-bold text-xl animate-pulse">
                <Footprints className="w-7 h-7" />
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-teal-400">
                  Live {activity.activeSessionType === 'walk' ? 'Walking' : 'Jogging'} Session Active
                </span>
                <div className="text-3xl font-extrabold text-white tracking-mono mt-0.5">
                  {formatTimer(seconds)}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-6 text-xs text-stone-300">
              <div className="text-center">
                <div className="font-bold text-lg text-white">~650</div>
                <span>Estimated Steps</span>
              </div>
              <div className="text-center">
                <div className="font-bold text-lg text-white">0.5 km</div>
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
        <div className="bg-white p-5 rounded-3xl border border-stone-200/80 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-stone-400">
            <span className="text-xs font-bold uppercase tracking-wider">Steps</span>
            <Footprints className="w-4 h-4 text-emerald-700" />
          </div>
          <div className="text-2xl font-extrabold text-stone-900">{activity.steps.toLocaleString()}</div>
          <p className="text-[11px] text-stone-400 font-medium">Goal: {activity.stepGoal.toLocaleString()}</p>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-stone-200/80 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-stone-400">
            <span className="text-xs font-bold uppercase tracking-wider">Active Time</span>
            <Clock className="w-4 h-4 text-teal-700" />
          </div>
          <div className="text-2xl font-extrabold text-stone-900">{activity.activeMinutes} min</div>
          <p className="text-[11px] text-stone-400 font-medium">Goal: 30 mins</p>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-stone-200/80 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-stone-400">
            <span className="text-xs font-bold uppercase tracking-wider">Distance</span>
            <MapPin className="w-4 h-4 text-indigo-700" />
          </div>
          <div className="text-2xl font-extrabold text-stone-900">{activity.distanceKm} km</div>
          <p className="text-[11px] text-stone-400 font-medium">Movement distance</p>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-stone-200/80 shadow-2xs space-y-1">
          <div className="flex items-center justify-between text-stone-400">
            <span className="text-xs font-bold uppercase tracking-wider">Calories</span>
            <Flame className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-extrabold text-stone-900">{activity.caloriesBurned} kcal</div>
          <p className="text-[11px] text-stone-400 font-medium">Estimated energy</p>
        </div>
      </div>

      {/* WEEKLY ACTIVITY GRAPH */}
      <div className="bg-white p-6 rounded-3xl border border-stone-200/80 shadow-2xs space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-stone-900 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-700" />
            7-Day Activity Rhythm
          </h2>
          <span className="text-xs font-bold text-stone-500">Goal: 5,000 steps/day</span>
        </div>

        <div className="grid grid-cols-7 gap-2 pt-2 text-center">
          {activity.weeklySteps.map((item, idx) => (
            <div key={idx} className="flex flex-col items-center gap-2">
              <div className="w-full h-32 bg-stone-100 rounded-xl p-1 flex items-end">
                <div
                  className={`w-full rounded-lg transition-all ${
                    item.steps >= item.goal ? 'bg-emerald-700' : item.steps > 0 ? 'bg-teal-500' : 'bg-stone-200'
                  }`}
                  style={{ height: `${Math.max(6, Math.min(100, (item.steps / 6000) * 100))}%` }}
                />
              </div>
              <span className="text-xs font-bold text-stone-700">{item.day}</span>
              <span className="text-[10px] text-stone-400 font-semibold">{item.steps}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
