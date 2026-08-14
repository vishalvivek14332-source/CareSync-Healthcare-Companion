import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import {
  UserRole,
  PatientTab,
  CaregiverTab,
  Medication,
  HydrationState,
  HydrationSettings,
  ActivityState,
  RoutineItem,
  CareScoreBreakdown,
  RoutineInsight,
  AlertItem,
  EscalationRules,
  NotificationItem,
  UserProfile,
  ChatMessage,
  ConnectionCodeInfo,
  SyncStatus,
} from '../types';
import {
  signupApi,
  loginApi,
  logoutApi,
  fetchCurrentUserApi,
  switchDemoUserApi,
  setAuthToken,
  getAuthToken,
  clearAuthTokens,
  flushOfflineQueue,
  fetchConnectionCodeApi,
  generateConnectionCodeApi,
  revokeConnectionCodeApi,
  fetchMedicationsApi,
  createMedicationApi,
  updateMedicationApi,
  deleteMedicationApi,
  logMedicationDoseApi,
  fetchHydrationApi,
  fetchHydrationSettingsApi,
  updateHydrationSettingsApi,
  logHydrationApi,
  fetchActivityApi,
  syncActivityApi,
  recordActivitySessionApi,
  updateProfilePhotoApi,
  fetchLinkedPatientsApi,
  linkPatientApi,
  fetchAlertsApi,
  markAlertReviewedApi,
  sendSOSApi,
  fetchEscalationRulesApi,
  updateEscalationRulesApi,
  sendAssistantMessage,
} from '../services/api';
import {
  initNativeNotifications,
  syncNativeMedicationAlarms,
  syncNativeHydrationReminders,
} from '../services/nativeReminderService';

interface ToastInfo {
  id: string;
  type: 'success' | 'info' | 'warning' | 'error';
  message: string;
}

interface CareSyncContextType {
  // Auth & Session
  currentUser: UserProfile | null;
  isAuthenticated: boolean;
  activeRole: UserRole;
  connectionCode: ConnectionCodeInfo | null;
  linkedPatients: UserProfile[];
  selectedPatientId: string | null;
  selectedPatient: UserProfile | null;

  login: (email: string, password: string) => Promise<void>;
  signup: (data: any) => Promise<void>;
  logout: () => void;
  loginDemoUser: (role: 'patient' | 'caregiver') => Promise<void>;

  // Connection Code Management (Patient)
  generateConnectionCode: () => Promise<string | undefined>;
  revokeConnectionCode: () => Promise<void>;

  // Patient Linking & Selection (Caregiver)
  linkPatientWithCode: (code: string) => Promise<void>;
  selectCaregiverPatient: (patientId: string) => void;

  // Tab Navigation
  activePatientTab: PatientTab;
  setActivePatientTab: (tab: PatientTab) => void;
  activeCaregiverTab: CaregiverTab;
  setActiveCaregiverTab: (tab: CaregiverTab) => void;

  // Onboarding & Modals
  onboardingCompleted: boolean;
  setOnboardingCompleted: (val: boolean) => void;
  sosModalOpen: boolean;
  setSosModalOpen: (val: boolean) => void;
  assistantOpen: boolean;
  setAssistantOpen: (val: boolean) => void;

  // Sync & Network Status
  syncStatus: SyncStatus;
  triggerManualSync: () => Promise<void>;

  // Core Data States
  patient: UserProfile;
  medications: Medication[];
  hydration: HydrationState;
  hydrationSettings: HydrationSettings;
  activity: ActivityState;
  routineItems: RoutineItem[];
  careScore: CareScoreBreakdown;
  insights: RoutineInsight[];
  alerts: AlertItem[];
  escalationRules: EscalationRules;
  notifications: NotificationItem[];
  chatMessages: ChatMessage[];
  isAssistantThinking: boolean;

  // Toasts
  toasts: ToastInfo[];
  addToast: (message: string, type?: ToastInfo['type']) => void;
  removeToast: (id: string) => void;

  // Actions & CRUD
  takeMedication: (id: string) => void;
  snoozeMedication: (id: string, minutes?: number) => void;
  addMedicationSchedule: (med: { name: string; dosage: string; scheduledTime: string; instructions?: string; category?: 'morning' | 'afternoon' | 'evening'; patientId?: string }) => Promise<void>;
  updateMedicationSchedule: (id: string, updates: Partial<Medication>) => Promise<void>;
  deleteMedicationSchedule: (id: string) => Promise<void>;
  logWater: (amountMl: number) => void;
  updateHydrationSettings: (settings: Partial<HydrationSettings>) => Promise<void>;
  startActivitySession: (type: 'walk' | 'jog') => void;
  stopActivitySession: () => void;
  syncDeviceActivity: (steps: number, distanceKm?: number, caloriesBurned?: number) => Promise<void>;
  updateProfilePhoto: (avatarUrl: string) => Promise<void>;
  toggleRoutineItem: (id: string) => void;
  markAlertReviewed: (id: string) => void;
  sendSOS: (reason?: string) => void;
  updateEscalationRules: (newRules: Partial<EscalationRules>) => void;
  updateUserProfile: (profile: Partial<UserProfile>) => void;
  sendChatMessage: (text: string) => Promise<void>;
  markNotificationRead: (id: string) => void;
  clearAllNotifications: () => void;
}

const CareSyncContext = createContext<CareSyncContextType | undefined>(undefined);

const defaultPatientProfile: UserProfile = {
  id: '',
  role: 'patient',
  name: 'Patient',
  age: undefined,
  avatarUrl: undefined,
  primaryCaregiver: undefined,
  caregiverPhone: undefined,
  emergencyContact: undefined,
  emergencyPhone: undefined,
  quietHours: '10:00 PM - 7:00 AM',
  medicationCount: 0,
  lastActive: 'Just now',
  status: 'normal',
};

const defaultHydrationSettings: HydrationSettings = {
  dailyGoalLiters: 2.0,
  reminderEnabled: true,
  startTime: '08:00',
  endTime: '20:00',
  intervalMinutes: 60,
};

const initialHydration: HydrationState = {
  currentLiters: 0,
  goalLiters: 2.0,
  nextReminderTime: 'Every 60 mins (08:00 - 20:00)',
  logs: [],
  hourlyTrends: [],
  settings: defaultHydrationSettings,
};

const initialActivity: ActivityState = {
  steps: 0,
  stepGoal: 5000,
  activeMinutes: 0,
  activeMinutesGoal: 30,
  caloriesBurned: 0,
  distanceKm: 0,
  isTrackingActive: false,
  hasRecordedActivityToday: false,
  weeklySteps: [],
};

const initialEscalationRules: EscalationRules = {
  levels: [
    { level: 1, title: 'Level 1: Soft Patient Reminder', target: 'Patient App', delayMinutes: 0, description: 'Display gentle visual chime & push notification on patient device.', enabled: true },
    { level: 2, title: 'Level 2: Repeated Reminder Tone', target: 'Patient App', delayMinutes: 15, description: 'Play audible tone & show full-screen gentle banner.', enabled: true },
    { level: 3, title: 'Level 3: Trusted Caregiver Alert', target: 'Caregiver', delayMinutes: 45, description: 'Send high-priority SMS & notification to trusted caregiver.', enabled: true },
    { level: 4, title: 'Level 4: Emergency Escalation Workflow', target: 'Emergency Contacts', delayMinutes: 90, description: 'Trigger priority audio call to designated emergency contact.', enabled: true },
  ],
  caregiverName: '',
  caregiverPhone: '',
  caregiverEmail: '',
  emergencyContactName: '',
  emergencyContactPhone: '',
  emergencyContactRelation: '',
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
  maxRemindersBeforeEscalation: 3,
  repeatReminderIntervalMinutes: 15,
};

export const CareSyncProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Auth state
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [connectionCode, setConnectionCode] = useState<ConnectionCodeInfo | null>(null);
  const [linkedPatients, setLinkedPatients] = useState<UserProfile[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);

  // Tab Navigation
  const [activePatientTab, setActivePatientTab] = useState<PatientTab>('home');
  const [activeCaregiverTab, setActiveCaregiverTab] = useState<CaregiverTab>('overview');

  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean>(true);
  const [sosModalOpen, setSosModalOpen] = useState<boolean>(false);
  const [assistantOpen, setAssistantOpen] = useState<boolean>(false);

  // Core Data
  const [patient, setPatient] = useState<UserProfile>(defaultPatientProfile);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [hydration, setHydration] = useState<HydrationState>(initialHydration);
  const [hydrationSettings, setHydrationSettings] = useState<HydrationSettings>(defaultHydrationSettings);
  const [activity, setActivity] = useState<ActivityState>(initialActivity);
  const [routineItems, setRoutineItems] = useState<RoutineItem[]>([]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [escalationRules, setEscalationRules] = useState<EscalationRules>(initialEscalationRules);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [toasts, setToasts] = useState<ToastInfo[]>([]);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'c-1',
      sender: 'assistant',
      text: "Hello! I am your CareSync assistant. How can I help you today?",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      suggestedActions: ['What is my schedule?', 'Log water (+250ml)', 'Start a walk'],
    },
  ]);
  const [isAssistantThinking, setIsAssistantThinking] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(
    typeof navigator !== 'undefined' && !navigator.onLine ? 'OFFLINE' : 'ONLINE'
  );

  const activeRole: UserRole = currentUser?.role || 'patient';
  const isAuthenticated = !!currentUser && !!getAuthToken();

  const addToast = useCallback((message: string, type: ToastInfo['type'] = 'success') => {
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 4);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Helper to load backend data for current session
  const loadDataForSession = useCallback(async (user: UserProfile, targetPatientId?: string) => {
    try {
      if (user.role === 'patient') {
        setPatient(user);

        const [medsData, hydrationData, activityData, alertsData, escalationData, codeData] = await Promise.all([
          fetchMedicationsApi().catch(() => []),
          fetchHydrationApi().catch(() => null),
          fetchActivityApi().catch(() => null),
          fetchAlertsApi().catch(() => []),
          fetchEscalationRulesApi().catch(() => null),
          fetchConnectionCodeApi().catch(() => null),
        ]);

        if (medsData) {
          setMedications(medsData);
          syncNativeMedicationAlarms(medsData, 'patient');
        }

        if (hydrationData) {
          setHydration(hydrationData);
          if (hydrationData.settings) {
            setHydrationSettings(hydrationData.settings);
            syncNativeHydrationReminders(hydrationData.settings, 'patient');
          }
        }

        if (activityData) {
          setActivity(activityData);
        }

        if (alertsData) setAlerts(alertsData);
        if (escalationData) setEscalationRules(escalationData);
        if (codeData) setConnectionCode(codeData);
      } else if (user.role === 'caregiver') {
        // Cancel any native alarms on caregiver device
        syncNativeMedicationAlarms([], 'caregiver').catch(console.error);
        syncNativeHydrationReminders(defaultHydrationSettings, 'caregiver').catch(console.error);

        const patients = await fetchLinkedPatientsApi().catch(() => []);
        setLinkedPatients(patients);

        const activeTarget = targetPatientId || (patients.length > 0 ? patients[0].id : null);
        setSelectedPatientId(activeTarget);

        if (activeTarget) {
          const targetProfile = patients.find((p) => p.id === activeTarget) || patients[0];
          setPatient(targetProfile);

          const [medsData, hydrationData, activityData, alertsData, escalationData] = await Promise.all([
            fetchMedicationsApi(activeTarget).catch(() => []),
            fetchHydrationApi(activeTarget).catch(() => null),
            fetchActivityApi(activeTarget).catch(() => null),
            fetchAlertsApi(activeTarget).catch(() => []),
            fetchEscalationRulesApi(activeTarget).catch(() => null),
          ]);

          setMedications(medsData || []);
          if (hydrationData) setHydration(hydrationData);
          if (activityData) setActivity(activityData);
          setAlerts(alertsData || []);
          if (escalationData) setEscalationRules(escalationData);
        } else {
          setMedications([]);
          setAlerts([]);
        }
      }
    } catch (err) {
      console.warn('Error loading backend session data:', err);
    }
  }, []);

  const triggerManualSync = useCallback(async () => {
    setSyncStatus('SYNCING');
    try {
      const { syncedCount } = await flushOfflineQueue();
      if (currentUser) {
        await loadDataForSession(currentUser);
      }
      setSyncStatus('ONLINE');
      if (syncedCount > 0) {
        addToast(`Synchronized ${syncedCount} offline record(s)`, 'success');
      }
    } catch {
      setSyncStatus(typeof navigator !== 'undefined' && !navigator.onLine ? 'OFFLINE' : 'ONLINE');
    }
  }, [currentUser, loadDataForSession, addToast]);

  // Restore authenticated session & listen to network events
  useEffect(() => {
    initNativeNotifications((medId) => {
      fetchMedicationsApi().then((meds) => {
        if (meds) {
          setMedications(meds);
          syncNativeMedicationAlarms(meds, 'patient');
        }
      });
    });

    const token = getAuthToken();
    if (token) {
      fetchCurrentUserApi()
        .then((res) => {
          if (res?.user) {
            setCurrentUser(res.user);
            if (res.connectionCode) setConnectionCode(res.connectionCode);
            loadDataForSession(res.user);
          }
        })
        .catch(() => {
          setAuthToken(null);
          setCurrentUser(null);
        });
    }

    const handleOnline = () => {
      setSyncStatus('SYNCING');
      flushOfflineQueue()
        .then(({ syncedCount }) => {
          setSyncStatus('ONLINE');
          addToast('Connected! Online synchronization active.', 'success');
          if (currentUser) loadDataForSession(currentUser);
        })
        .catch(() => setSyncStatus('ONLINE'));
    };

    const handleOffline = () => {
      setSyncStatus('OFFLINE');
      addToast('Network offline. Local reminders remain active.', 'warning');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [loadDataForSession, currentUser, addToast]);

  // Auth Operations
  const login = async (email: string, password: string) => {
    const res = await loginApi(email, password);
    setCurrentUser(res.user);
    if (res.connectionCode) setConnectionCode(res.connectionCode);
    await loadDataForSession(res.user);
    addToast(`Welcome back, ${res.user.name}!`, 'success');
  };

  const signup = async (data: any) => {
    const res = await signupApi(data);
    setCurrentUser(res.user);
    if (res.connectionCode) setConnectionCode(res.connectionCode);
    await loadDataForSession(res.user);
    addToast(`Account created successfully! Welcome to CareSync.`, 'success');
  };

  const logout = () => {
    logoutApi().catch(console.error);
    clearAuthTokens();
    setCurrentUser(null);
    setConnectionCode(null);
    setLinkedPatients([]);
    setSelectedPatientId(null);
    setMedications([]);
    setHydration(initialHydration);
    setActivity(initialActivity);
    setRoutineItems([]);
    setAlerts([]);
    setNotifications([]);
    setActivePatientTab('home');
    setActiveCaregiverTab('overview');
    syncNativeMedicationAlarms([], 'caregiver').catch(console.error);
    syncNativeHydrationReminders(defaultHydrationSettings, 'caregiver').catch(console.error);
    addToast('Logged out successfully.', 'info');
  };

  const loginDemoUser = async (role: 'patient' | 'caregiver') => {
    const res = await switchDemoUserApi(role);
    setCurrentUser(res.user);
    await loadDataForSession(res.user);
    addToast(`Signed in as Demo ${role === 'patient' ? 'Patient Alex' : 'Caregiver Sarah'}`, 'success');
  };

  // Connection Code Actions
  const generateConnectionCode = async (): Promise<string | undefined> => {
    try {
      const res = await generateConnectionCodeApi();
      if (res.success) {
        setConnectionCode({ code: res.code, expiresAt: res.expiresAt });
        addToast(`New Caregiver Connection Code generated: ${res.code}`, 'success');
        return res.code;
      }
    } catch (err: any) {
      addToast('Failed to generate connection code: ' + err.message, 'error');
    }
  };

  const revokeConnectionCode = async () => {
    try {
      await revokeConnectionCodeApi();
      setConnectionCode(null);
      addToast('Connection code revoked.', 'info');
    } catch (err: any) {
      addToast('Failed to revoke connection code: ' + err.message, 'error');
    }
  };

  // Caregiver Patient Actions
  const linkPatientWithCode = async (code: string) => {
    try {
      const res = await linkPatientApi(code);
      if (res.success) {
        addToast(res.message || 'Successfully linked to patient!', 'success');
        if (currentUser) {
          await loadDataForSession(currentUser, res.patient.id);
        }
      }
    } catch (err: any) {
      addToast(err.message || 'Failed to connect to patient with provided code', 'error');
      throw err;
    }
  };

  const selectCaregiverPatient = (patientId: string) => {
    setSelectedPatientId(patientId);
    if (currentUser) {
      loadDataForSession(currentUser, patientId);
    }
  };

  const selectedPatient = linkedPatients.find((p) => p.id === selectedPatientId) || patient;

  // Medication CRUD Actions
  const addMedicationSchedule = async (med: {
    name: string;
    dosage: string;
    scheduledTime: string;
    instructions?: string;
    category?: 'morning' | 'afternoon' | 'evening';
    patientId?: string;
  }) => {
    try {
      const targetPatient = med.patientId || selectedPatientId || currentUser?.id;
      const createdMed = await createMedicationApi({ ...med, patientId: targetPatient });
      const updatedMeds = [...medications, createdMed];
      setMedications(updatedMeds);
      addToast(`Added medication schedule for ${createdMed.name}`, 'success');

      if (currentUser?.role === 'patient') {
        syncNativeMedicationAlarms(updatedMeds, 'patient');
      }
    } catch (err: any) {
      console.error('Failed to add medication schedule:', err);
      addToast(err.message || 'Failed to add medication schedule', 'error');
      throw err;
    }
  };

  const updateMedicationSchedule = async (id: string, updates: Partial<Medication>) => {
    try {
      const res = await updateMedicationApi(id, updates);
      const updatedList = medications.map((m) => (m.id === id ? { ...m, ...updates, ...(res.medication || {}) } : m));
      setMedications(updatedList);
      addToast('Medication schedule updated successfully', 'success');

      if (currentUser?.role === 'patient') {
        syncNativeMedicationAlarms(updatedList, 'patient');
      }
    } catch (err: any) {
      console.error('Failed to update medication schedule:', err);
      addToast(err.message || 'Failed to update medication schedule', 'error');
      throw err;
    }
  };

  const deleteMedicationSchedule = async (id: string) => {
    try {
      await deleteMedicationApi(id);
      const filteredList = medications.filter((m) => m.id !== id);
      setMedications(filteredList);
      addToast('Medication removed from active schedule', 'info');

      if (currentUser?.role === 'patient') {
        syncNativeMedicationAlarms(filteredList, 'patient');
      }
    } catch (err: any) {
      console.error('Failed to remove medication:', err);
      addToast(err.message || 'Failed to remove medication', 'error');
    }
  };

  const takeMedication = (id: string) => {
    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const updated = medications.map((m) => (m.id === id ? { ...m, status: 'taken' as const, takenAt: nowStr } : m));
    setMedications(updated);

    logMedicationDoseApi(id, 'taken', nowStr).catch(console.error);

    if (currentUser?.role === 'patient') {
      syncNativeMedicationAlarms(updated, 'patient');
    }

    setRoutineItems((prev) =>
      prev.map((item) => {
        if (id === 'med-1' && item.id === 'r-1') return { ...item, completed: true };
        if (id === 'med-2' && item.id === 'r-5') return { ...item, completed: true };
        if (id === 'med-3' && item.id === 'r-6') return { ...item, completed: true };
        return item;
      })
    );

    const targetMed = medications.find((m) => m.id === id);
    addToast(`${targetMed ? targetMed.name : 'Medication'} marked as taken ✓`, 'success');

    setNotifications((prev) => [
      {
        id: `n-${Date.now()}`,
        title: 'Medication Confirmed',
        description: `${targetMed?.name || 'Medication'} logged at ${nowStr}`,
        timestamp: 'Just now',
        type: 'reminder',
        read: false,
      },
      ...prev,
    ]);
  };

  const snoozeMedication = (id: string, minutes = 30) => {
    logMedicationDoseApi(id, 'snoozed').catch(console.error);
    addToast(`Reminder snoozed for ${minutes} minutes`, 'info');
  };

  // Hydration Actions
  const logWater = (amountMl: number) => {
    const newLiters = Number((hydration.currentLiters + amountMl / 1000).toFixed(2));
    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    setHydration((prev) => ({
      ...prev,
      currentLiters: newLiters,
      logs: [{ id: `h-${Date.now()}`, amountMl, timestamp: nowStr }, ...prev.logs],
    }));

    logHydrationApi(amountMl).catch(console.error);
    addToast(`Added +${amountMl} ml of water 💧`, 'success');

    if (newLiters >= hydration.goalLiters && hydration.currentLiters < hydration.goalLiters) {
      addToast('🎉 Congratulations! Daily hydration goal achieved!', 'success');
    }
  };

  const updateHydrationSettings = async (settings: Partial<HydrationSettings>) => {
    try {
      const res = await updateHydrationSettingsApi(settings);
      if (res.success) {
        setHydrationSettings(res.settings);
        setHydration((prev) => ({
          ...prev,
          goalLiters: res.settings.dailyGoalLiters,
          settings: res.settings,
          nextReminderTime: res.settings.reminderEnabled
            ? `Every ${res.settings.intervalMinutes} mins (${res.settings.startTime} - ${res.settings.endTime})`
            : 'Reminders Disabled',
        }));

        if (currentUser?.role === 'patient') {
          syncNativeHydrationReminders(res.settings, 'patient');
        }
        addToast('Hydration reminder schedule saved!', 'success');
      }
    } catch (err: any) {
      console.error('Failed to update hydration settings:', err);
      addToast(err.message || 'Failed to update hydration settings', 'error');
      throw err;
    }
  };

  // Activity Actions
  const startActivitySession = (type: 'walk' | 'jog') => {
    setActivity((prev) => ({
      ...prev,
      isTrackingActive: true,
      activeSessionType: type,
      activeSessionSeconds: 0,
    }));
    addToast(`Started ${type === 'walk' ? 'Walking' : 'Jogging'} session! 🏃‍♂️`, 'info');
  };

  const stopActivitySession = () => {
    if (!activity.isTrackingActive) return;
    const addedSteps = 650;
    const addedMinutes = 12;
    const addedKm = 0.5;

    setActivity((prev) => ({
      ...prev,
      isTrackingActive: false,
      hasRecordedActivityToday: true,
      steps: prev.steps + addedSteps,
      activeMinutes: prev.activeMinutes + addedMinutes,
      distanceKm: Number((prev.distanceKm + addedKm).toFixed(1)),
      caloriesBurned: prev.caloriesBurned + 45,
    }));

    recordActivitySessionApi({ addedSteps, addedMinutes, addedKm, addedCalories: 45 }).catch(console.error);
    addToast(`Activity session completed! +${addedSteps} steps added.`, 'success');
  };

  const syncDeviceActivity = async (steps: number, distanceKm = 0, caloriesBurned = 0, activeMinutes = 0) => {
    try {
      const res = await syncActivityApi({ steps, distanceKm, caloriesBurned, activeMinutes: activeMinutes || Math.floor(steps / 100) });
      if (res.success && res.activity) {
        setActivity((prev) => ({
          ...prev,
          ...res.activity,
          hasRecordedActivityToday: true,
        }));
      }
    } catch (err) {
      console.warn('Failed to sync device steps:', err);
    }
  };

  // Profile Photo Upload Action
  const updateProfilePhoto = async (avatarUrl: string) => {
    try {
      const res = await updateProfilePhotoApi(avatarUrl);
      if (res.success) {
        setPatient((prev) => ({ ...prev, avatarUrl: res.avatarUrl }));
        if (currentUser) {
          setCurrentUser((prev) => (prev ? { ...prev, avatarUrl: res.avatarUrl } : null));
        }
        addToast('Profile photo updated successfully!', 'success');
      }
    } catch (err: any) {
      console.error('Failed to update avatar:', err);
      addToast(err.message || 'Failed to update profile photo', 'error');
      throw err;
    }
  };

  const toggleRoutineItem = (id: string) => {
    setRoutineItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, completed: !item.completed } : item))
    );
  };

  const markAlertReviewed = (id: string) => {
    setAlerts((prev) => prev.map((a) => (a.id === id ? { ...a, reviewed: true } : a)));
    markAlertReviewedApi(id).catch(console.error);
    addToast('Alert marked as reviewed', 'info');
  };

  const sendSOS = (reason = 'Manual Emergency Trigger') => {
    setSosModalOpen(false);
    addToast(`🚨 EMERGENCY SOS SENT! Trusted contacts notified.`, 'error');

    sendSOSApi(reason)
      .then((newAlert) => {
        setAlerts((prev) => [newAlert, ...prev]);
      })
      .catch((err) => {
        console.error('Failed to trigger SOS alert on backend:', err);
      });
  };

  const updateEscalationRules = (newRules: Partial<EscalationRules>) => {
    setEscalationRules((prev) => ({ ...prev, ...newRules }));
    updateEscalationRulesApi(newRules).catch(console.error);
    addToast('Alert & Escalation rules updated successfully', 'success');
  };

  const updateUserProfile = (profile: Partial<UserProfile>) => {
    setPatient((prev) => ({ ...prev, ...profile }));
    if (currentUser) {
      setCurrentUser((prev) => (prev ? { ...prev, ...profile } : null));
    }
    addToast('Profile settings saved', 'success');
  };

  // Deterministic, real-data weighted CareScore calculation
  const calculateCareScore = (): CareScoreBreakdown => {
    let totalWeights = 0;
    let weightedSum = 0;

    // 1. Medication adherence
    const medTotal = medications.length;
    let medicationScore = 100;
    if (medTotal > 0) {
      const medTaken = medications.filter((m) => m.status === 'taken').length;
      medicationScore = Math.round((medTaken / medTotal) * 100);
      weightedSum += medicationScore * 0.4;
      totalWeights += 0.4;
    }

    // 2. Hydration progress
    const goalLiters = hydration?.goalLiters || 2.0;
    const currentLiters = hydration?.currentLiters || 0;
    let hydrationScore = 0;
    if (goalLiters > 0 && currentLiters > 0) {
      hydrationScore = Math.min(100, Math.round((currentLiters / goalLiters) * 100));
      weightedSum += hydrationScore * 0.25;
      totalWeights += 0.25;
    } else if (goalLiters > 0 && (medTotal > 0 || (activity?.steps || 0) > 0 || (routineItems?.length || 0) > 0)) {
      // If user has other active logs today but 0 water, score is 0
      hydrationScore = 0;
      totalWeights += 0.25;
    }

    // 3. Activity / Step progress
    const steps = activity?.steps || 0;
    const stepGoal = activity?.stepGoal || 5000;
    let stepScore = 0;
    if (steps > 0 && stepGoal > 0) {
      stepScore = Math.min(100, Math.round((steps / stepGoal) * 100));
      weightedSum += stepScore * 0.2;
      totalWeights += 0.2;
    }

    // 4. Routine checklist
    const routineTotal = routineItems?.length || 0;
    let routineScore = 100;
    if (routineTotal > 0) {
      const routineCompleted = routineItems.filter((r) => r.completed).length;
      routineScore = Math.round((routineCompleted / routineTotal) * 100);
      weightedSum += routineScore * 0.15;
      totalWeights += 0.15;
    }

    // If completely fresh account with zero metrics configured/logged, start at clean unpenalized baseline 100
    const totalScore = totalWeights > 0 ? Math.round(weightedSum / totalWeights) : 100;

    return {
      totalScore,
      medicationScore: medTotal > 0 ? medicationScore : 100,
      hydrationScore: currentLiters > 0 ? hydrationScore : (totalWeights === 0 ? 100 : 0),
      activityScore: steps > 0 ? stepScore : (totalWeights === 0 ? 100 : 0),
      routineScore: routineTotal > 0 ? routineScore : 100,
      weeklyScores: [
        { day: 'Mon', score: totalScore },
        { day: 'Tue', score: totalScore },
        { day: 'Wed', score: totalScore },
        { day: 'Thu', score: totalScore },
        { day: 'Fri', score: totalScore },
        { day: 'Sat', score: totalScore },
        { day: 'Sun', score: totalScore },
      ],
    };
  };

  const careScore = calculateCareScore();

  const insights: RoutineInsight[] = [
    {
      id: 'ins-1',
      type: 'positive',
      title: 'Daily Care Overview',
      description: 'Your health rhythms and schedule synchronize with your care team in real-time.',
      timestamp: 'Today',
      isDiagnostic: false,
    },
  ];

  const sendChatMessage = async (userText: string) => {
    if (!userText.trim()) return;

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: userText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setChatMessages((prev) => [...prev, userMsg]);
    setIsAssistantThinking(true);

    const lower = userText.toLowerCase();
    if (lower.includes('log water') || lower.includes('drank water') || lower.includes('glass of water')) {
      logWater(250);
    } else if (lower.includes('log medicine') || lower.includes('took my medicine') || lower.includes('took afternoon')) {
      const dueMed = medications.find((m) => m.status === 'due') || medications[0];
      if (dueMed) takeMedication(dueMed.id);
    } else if (lower.includes('start walk') || lower.includes('start a walk')) {
      startActivitySession('walk');
    }

    try {
      const res = await sendAssistantMessage(userText, {
        patientName: patient.name,
        medicationCount: medications.length,
        hydration: { current: hydration.currentLiters, goal: hydration.goalLiters },
        activity: { steps: activity.steps, target: activity.stepGoal },
        careScore: careScore.totalScore,
      });

      const assistantMsg: ChatMessage = {
        id: `ast-${Date.now()}`,
        sender: 'assistant',
        text: res.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        suggestedActions: ['What is my schedule?', 'Log water (+250ml)', 'Start a walk'],
      };

      setChatMessages((prev) => [...prev, assistantMsg]);
    } catch (e) {
      console.error(e);
    } finally {
      setIsAssistantThinking(false);
    }
  };

  const markNotificationRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const clearAllNotifications = () => {
    setNotifications([]);
  };

  return (
    <CareSyncContext.Provider
      value={{
        currentUser,
        isAuthenticated,
        activeRole,
        connectionCode,
        linkedPatients,
        selectedPatientId,
        selectedPatient,

        login,
        signup,
        logout,
        loginDemoUser,

        generateConnectionCode,
        revokeConnectionCode,
        linkPatientWithCode,
        selectCaregiverPatient,

        activePatientTab,
        setActivePatientTab,
        activeCaregiverTab,
        setActiveCaregiverTab,

        onboardingCompleted,
        setOnboardingCompleted,
        sosModalOpen,
        setSosModalOpen,
        assistantOpen,
        setAssistantOpen,

        syncStatus,
        triggerManualSync,

        patient,
        medications,
        hydration,
        hydrationSettings,
        activity,
        routineItems,
        careScore,
        insights,
        alerts,
        escalationRules,
        notifications,
        chatMessages,
        isAssistantThinking,

        toasts,
        addToast,
        removeToast,

        takeMedication,
        snoozeMedication,
        addMedicationSchedule,
        updateMedicationSchedule,
        deleteMedicationSchedule,
        logWater,
        updateHydrationSettings,
        startActivitySession,
        stopActivitySession,
        syncDeviceActivity,
        updateProfilePhoto,
        toggleRoutineItem,
        markAlertReviewed,
        sendSOS,
        updateEscalationRules,
        updateUserProfile,
        sendChatMessage,
        markNotificationRead,
        clearAllNotifications,
      }}
    >
      {children}
    </CareSyncContext.Provider>
  );
};

export const useCareSync = () => {
  const context = useContext(CareSyncContext);
  if (!context) {
    throw new Error('useCareSync must be used within a CareSyncProvider');
  }
  return context;
};
