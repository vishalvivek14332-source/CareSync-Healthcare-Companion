import React, { useState, useEffect } from 'react';
import { CareSyncProvider, useCareSync } from './context/CareSyncContext';
import { Header } from './components/common/Header';
import { Navigation } from './components/common/Navigation';
import { ToastContainer } from './components/common/ToastContainer';
import { SOSModal } from './components/common/SOSModal';
import { OnboardingModal } from './components/common/OnboardingModal';
import { AssistantDrawer } from './components/assistant/AssistantDrawer';
import { AuthLandingView } from './components/auth/AuthLandingView';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { WifiOff } from 'lucide-react';

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

const MainContent: React.FC = () => {
  const { isAuthenticated, currentUser, activeRole, activePatientTab, activeCaregiverTab } = useCareSync();

  // If user is not authenticated, display First-Launch Role Selection and Auth view
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
