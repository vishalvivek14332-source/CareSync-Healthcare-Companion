import React from 'react';
import { useCareSync } from '../../context/CareSyncContext';
import {
  Home,
  Pill,
  Droplet,
  Footprints,
  Activity,
  User,
  ShieldAlert,
  Sliders,
  TrendingUp,
  Bot,
  BellRing,
} from 'lucide-react';
import { PatientTab, CaregiverTab } from '../../types';

export const Navigation: React.FC = () => {
  const {
    activeRole,
    activePatientTab,
    setActivePatientTab,
    activeCaregiverTab,
    setActiveCaregiverTab,
    setAssistantOpen,
  } = useCareSync();

  const patientTabs: { id: PatientTab; label: string; icon: React.ReactNode }[] = [
    { id: 'home', label: 'Home', icon: <Home className="w-5 h-5" /> },
    { id: 'medication', label: 'Medication', icon: <Pill className="w-5 h-5" /> },
    { id: 'hydration', label: 'Hydration', icon: <Droplet className="w-5 h-5" /> },
    { id: 'activity', label: 'Activity', icon: <Footprints className="w-5 h-5" /> },
    { id: 'routine', label: 'CareScore', icon: <Activity className="w-5 h-5" /> },
    { id: 'profile', label: 'Profile', icon: <User className="w-5 h-5" /> },
  ];

  const caregiverTabs: { id: CaregiverTab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Overview', icon: <Home className="w-5 h-5" /> },
    { id: 'alerts', label: 'Alerts', icon: <BellRing className="w-5 h-5" /> },
    { id: 'escalation', label: 'Escalation', icon: <ShieldAlert className="w-5 h-5" /> },
    { id: 'patient', label: 'Patient Data', icon: <Activity className="w-5 h-5" /> },
    { id: 'settings', label: 'Settings', icon: <Sliders className="w-5 h-5" /> },
  ];

  return (
    <>
      {/* Desktop Sidebar Navigation */}
      <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-slate-200/80 p-4 shrink-0 min-h-[calc(100vh-65px)]">
        <div className="mb-4 px-3 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
          {activeRole === 'patient' ? 'Patient Navigation' : 'Caregiver Controls'}
        </div>

        <nav className="space-y-1.5 flex-1">
          {activeRole === 'patient'
            ? patientTabs.map((tab) => {
                const isActive = activePatientTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActivePatientTab(tab.id)}
                    className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-sm font-semibold transition-all ${
                      isActive
                        ? 'bg-teal-600 text-white shadow-md shadow-teal-600/20'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <span className={isActive ? 'text-white' : 'text-slate-500'}>{tab.icon}</span>
                    <span>{tab.label}</span>
                  </button>
                );
              })
            : caregiverTabs.map((tab) => {
                const isActive = activeCaregiverTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveCaregiverTab(tab.id)}
                    className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-sm font-semibold transition-all ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <span className={isActive ? 'text-white' : 'text-slate-500'}>{tab.icon}</span>
                    <span>{tab.label}</span>
                  </button>
                );
              })}
        </nav>

        {/* AI Assistant Callout Box in Desktop Sidebar */}
        {activeRole === 'patient' && (
          <div className="mt-auto bg-gradient-to-br from-teal-50 to-sky-50 border border-teal-200/80 rounded-2xl p-4 text-center">
            <div className="w-10 h-10 rounded-xl bg-teal-600 text-white flex items-center justify-center mx-auto mb-2.5 shadow-sm">
              <Bot className="w-5 h-5" />
            </div>
            <h4 className="font-bold text-slate-900 text-sm">CareSync Assistant</h4>
            <p className="text-xs text-slate-600 mt-1 mb-3 leading-tight">
              Ask questions or use voice commands to log routines.
            </p>
            <button
              onClick={() => setAssistantOpen(true)}
              className="w-full py-2 px-3 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-xs transition-colors flex items-center justify-center gap-1.5"
            >
              <Bot className="w-4 h-4" />
              Open Assistant
            </button>
          </div>
        )}
      </aside>

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur-lg border-t border-slate-200 px-1 py-1 shadow-lg">
        <div className={`grid ${activeRole === 'patient' ? 'grid-cols-6' : 'grid-cols-5'} gap-0.5 items-center w-full`}>
          {activeRole === 'patient'
            ? patientTabs.map((tab) => {
                const isActive = activePatientTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActivePatientTab(tab.id)}
                    className={`flex flex-col items-center justify-center py-1.5 px-0.5 rounded-xl transition-all min-h-[44px] ${
                      isActive ? 'text-teal-700 font-bold bg-teal-50/80' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <span className={isActive ? 'scale-105 transition-transform' : ''}>{tab.icon}</span>
                    <span className="text-[9px] sm:text-[10px] mt-0.5 font-medium truncate w-full text-center">{tab.label}</span>
                  </button>
                );
              })
            : caregiverTabs.map((tab) => {
                const isActive = activeCaregiverTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveCaregiverTab(tab.id)}
                    className={`flex flex-col items-center justify-center py-1.5 px-0.5 rounded-xl transition-all min-h-[44px] ${
                      isActive ? 'text-indigo-700 font-bold bg-indigo-50/80' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <span className={isActive ? 'scale-105 transition-transform' : ''}>{tab.icon}</span>
                    <span className="text-[9px] sm:text-[10px] mt-0.5 font-medium truncate w-full text-center">{tab.label}</span>
                  </button>
                );
              })}
        </div>
      </nav>
    </>
  );
};
