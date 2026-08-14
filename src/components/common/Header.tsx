import React, { useState } from 'react';
import { useCareSync } from '../../context/CareSyncContext';
import {
  Activity,
  Bell,
  ShieldAlert,
  Calendar,
  HelpCircle,
  LogOut,
  User,
  Users,
  WifiOff,
  RefreshCw,
} from 'lucide-react';
import { NotificationDrawer } from './NotificationDrawer';

export const Header: React.FC = () => {
  const {
    currentUser,
    activeRole,
    patient,
    notifications,
    syncStatus,
    triggerManualSync,
    setSosModalOpen,
    setOnboardingCompleted,
    setActivePatientTab,
    setActiveCaregiverTab,
    logout,
  } = useCareSync();

  const [notificationOpen, setNotificationOpen] = useState<boolean>(false);

  const unreadNotifications = notifications.filter((n) => !n.read).length;
  const currentDateFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  return (
    <>
      <header className="bg-white/90 backdrop-blur-md sticky top-0 z-30 border-b border-slate-200/80 px-3 sm:px-6 py-2.5 sm:py-3.5 transition-all overflow-hidden">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
          {/* Logo & Brand */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-teal-700 text-white flex items-center justify-center shadow-md shadow-teal-700/20 shrink-0">
              <Activity className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">CareSync</span>
                <span className={`text-[10px] uppercase font-extrabold tracking-wider px-2.5 py-0.5 rounded-full border ${
                  activeRole === 'patient'
                    ? 'bg-teal-50 text-teal-800 border-teal-200'
                    : 'bg-indigo-50 text-indigo-800 border-indigo-200'
                }`}>
                  {activeRole === 'patient' ? 'Patient App' : 'Caregiver Hub'}
                </span>
                {syncStatus === 'OFFLINE' && (
                  <button
                    onClick={() => triggerManualSync()}
                    title="You are offline. Click to retry connection."
                    className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100 transition-colors"
                  >
                    <WifiOff className="w-3 h-3 text-amber-600" />
                    <span>Offline</span>
                  </button>
                )}
                {syncStatus === 'SYNCING' && (
                  <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-50 text-sky-800 border border-sky-300 animate-pulse">
                    <RefreshCw className="w-3 h-3 text-sky-600 animate-spin" />
                    <span>Syncing...</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 font-medium hidden lg:block">
                Personal Healthcare Companion
              </p>
            </div>
          </div>

          {/* Center User Profile Badge */}
          <div className="hidden sm:flex items-center gap-2 bg-slate-50 border border-slate-200/80 px-3 py-1.5 rounded-2xl text-xs">
            {activeRole === 'patient' ? (
              <User className="w-4 h-4 text-teal-700 shrink-0" />
            ) : (
              <Users className="w-4 h-4 text-indigo-700 shrink-0" />
            )}
            <span className="font-bold text-slate-800">
              {currentUser?.name || (activeRole === 'patient' ? 'Alex Johnson' : 'Sarah Johnson')}
            </span>
          </div>

          {/* Right Action Icons & SOS */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
            {/* Date Tag */}
            <div className="hidden xl:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-600 font-medium">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>{currentDateFormatted}</span>
            </div>

            {/* Notification Bell */}
            <button
              onClick={() => setNotificationOpen(true)}
              className="relative p-2 sm:p-2.5 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors border border-transparent hover:border-slate-200"
              aria-label="Open notifications"
            >
              <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
              {unreadNotifications > 0 && (
                <span className="absolute top-1 right-1 w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-rose-600 text-white text-[9px] sm:text-[10px] font-bold flex items-center justify-center animate-pulse">
                  {unreadNotifications}
                </span>
              )}
            </button>

            {/* SOS Emergency Button (Only for Patient) */}
            {activeRole === 'patient' && (
              <button
                onClick={() => setSosModalOpen(true)}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold transition-all shadow-2xs hover:scale-[1.02] active:scale-95"
              >
                <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                <span className="hidden md:inline">SOS Help</span>
              </button>
            )}

            {/* Logout Button */}
            {/* Onboarding Help */}
            <button
              onClick={() => setOnboardingCompleted(false)}
              className="p-1.5 sm:p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
              title="Re-open Onboarding Walkthrough"
            >
              <HelpCircle className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            {/* Logout Button */}
            <button
              onClick={logout}
              className="p-1.5 sm:p-2 text-slate-500 hover:text-rose-700 rounded-xl hover:bg-rose-50 transition-colors border border-transparent hover:border-rose-100"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            
            {/* User Avatar */}
            <button
              onClick={() => {
                if (activeRole === 'patient') {
                  setActivePatientTab('profile');
                } else {
                  setActiveCaregiverTab('settings');
                }
              }}
              title="Go to Profile Settings"
              className="relative shrink-0 transition-transform active:scale-95 focus:outline-none ml-1"
            >
              <img
                src={currentUser?.avatarUrl || patient.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250'}
                alt={currentUser?.name || patient.name}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-full object-cover border-2 border-white shadow-sm ring-2 ring-teal-600/30 hover:ring-teal-600"
              />
              <span className="absolute bottom-0 right-0 w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
            </button>
          </div>
        </div>
      </header>

      {/* Notification Drawer */}
      <NotificationDrawer isOpen={notificationOpen} onClose={() => setNotificationOpen(false)} />
    </>
  );
};
