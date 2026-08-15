import React, { useState, useEffect } from 'react';
import { CareSyncProvider, useCareSync } from './context/CareSyncContext';
import { Header } from './components/common/Header';
import { Navigation } from './components/common/Navigation';
import { ToastContainer } from './components/common/ToastContainer';
import { SOSModal } from './components/common/SOSModal';
import { OnboardingModal } from './components/common/OnboardingModal';
import { AssistantDrawer } from './components/assistant/AssistantDrawer';
import { AuthLandingView } from './components/auth/AuthLandingView';
import { AlarmModal } from './components/common/AlarmModal';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { WifiOff, HeartPulse } from 'lucide-react';
import { motion } from 'motion/react';

// Patient Views
import { PatientHomeView } from './components/patient/PatientHomeView';
import { MedicationView } from './components/patient/MedicationView';
import { HydrationView } from './components/patient/HydrationView';
import { ActivityView } from './components/patient/ActivityView';
import { RoutineView } from './components/patient/RoutineView';
import { ProfileView } from './components/patient/ProfileView';

// Caregiver Views
import { CaregiverDashboardView } from './components/caregiver/CaregiverDashboardView';
import { CaregiverAlertsView } from './components/caregiver/CaregiverAlertsView';
import { EscalationRulesView } from './components/caregiver/EscalationRulesView';
import { CaregiverPatientView } from './components/caregiver/CaregiverPatientView';

const OfflineBanner: React.FC = () => {
  const [isOffline, setIsOffline] = useState<boolean>(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div className="bg-amber-500 text-amber-950 px-4 py-2 text-xs sm:text-sm font-medium flex items-center justify-center gap-2 shadow-sm border-b border-amber-600/20">
      <WifiOff className="w-4 h-4 shrink-0" />
      <span>
        <strong>Offline Mode:</strong> Displaying cached health records. Reconnect to sync live medication status and caregiver alerts.
      </span>
    </div>
  );
};

const CareSyncSplashScreen: React.FC = () => (
  <div className="min-h-screen bg-gradient-to-b from-slate-900 via-teal-950 to-slate-950 flex flex-col items-center justify-center p-6 text-white text-center select-none">
    <motion.div
      initial={{ scale: 0.85, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="space-y-6 flex flex-col items-center"
    >
      <div className="relative">
        <div className="w-24 h-24 rounded-3xl bg-teal-600/30 border border-teal-400/40 flex items-center justify-center shadow-2xl backdrop-blur-md">
          <HeartPulse className="w-12 h-12 text-teal-300 animate-pulse" />
        </div>
        <div className="absolute -inset-2 bg-teal-500/20 rounded-3xl blur-xl -z-10 animate-pulse" />
      </div>

      <div className="space-y-1">
        <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-white via-teal-100 to-teal-300 bg-clip-text text-transparent">
          CareSync
        </h1>
        <p className="text-teal-200/70 text-xs font-semibold uppercase tracking-widest">
          Healthcare Companion
        </p>
      </div>

      <div className="flex items-center gap-2 text-xs text-teal-300/80 font-medium pt-4">
        <div className="w-2 h-2 rounded-full bg-teal-400 animate-ping" />
        <span>Restoring your secure session...</span>
      </div>
    </motion.div>
  </div>
);

const MainContent: React.FC = () => {
  const {
    isAuthenticated,
    isAuthLoading,
    currentUser,
    activeRole,
    activePatientTab,
    activeCaregiverTab,
    activeAlarm,
    confirmAlarmTaken,
    confirmAlarmDrank,
    snoozeActiveAlarm,
    dismissActiveAlarm,
  } = useCareSync();

  // 1. If session is currently bootstrapping, show loading screen
  if (isAuthLoading) {
    return <CareSyncSplashScreen />;
  }

  // 2. If user is genuinely unauthenticated, display First-Launch / Auth Landing View
  if (!isAuthenticated || !currentUser) {
    return (
      <div className="min-h-screen bg-slate-100/70 text-slate-900 font-sans selection:bg-teal-500 selection:text-white">
        <AuthLandingView />
        <ToastContainer />
      </div>
    );
  }

  const renderPatientTab = () => {
    switch (activePatientTab) {
      case 'home':
        return <PatientHomeView />;
      case 'medication':
        return <MedicationView />;
      case 'hydration':
        return <HydrationView />;
      case 'activity':
        return <ActivityView />;
      case 'routine':
        return <RoutineView />;
      case 'profile':
        return <ProfileView />;
      default:
        return <PatientHomeView />;
    }
  };

  const renderCaregiverTab = () => {
    switch (activeCaregiverTab) {
      case 'overview':
        return <CaregiverDashboardView />;
      case 'alerts':
        return <CaregiverAlertsView />;
      case 'escalation':
        return <EscalationRulesView />;
      case 'patient':
        return <CaregiverPatientView />;
      case 'settings':
        return <EscalationRulesView />;
      default:
        return <CaregiverDashboardView />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 font-sans flex flex-col selection:bg-teal-500 selection:text-white w-full overflow-x-hidden">
      {/* Offline Mode Banner */}
      <OfflineBanner />

      {/* Top Header */}
      <Header />

      {/* Main Grid: Sidebar + Content */}
      <div className="flex-1 max-w-7xl w-full mx-auto flex items-start min-w-0 overflow-x-hidden">
        <Navigation />

        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 max-w-full overflow-x-hidden">
          {activeRole === 'patient' ? renderPatientTab() : renderCaregiverTab()}
        </main>
      </div>

      {/* Global Modals & Floating Overlays */}
      <AssistantDrawer />
      <SOSModal />
      <OnboardingModal />
      <ToastContainer />

      {/* Fullscreen/Prominent Alarm Modal */}
      <AlarmModal
        alarm={activeAlarm}
        onTaken={confirmAlarmTaken}
        onDrank={confirmAlarmDrank}
        onSnooze={snoozeActiveAlarm}
        onDismiss={dismissActiveAlarm}
      />
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <CareSyncProvider>
        <MainContent />
      </CareSyncProvider>
    </ErrorBoundary>
  );
}
