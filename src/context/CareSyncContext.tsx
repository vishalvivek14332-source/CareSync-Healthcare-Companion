import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import {
  UserRole,
  PatientTab,
  CaregiverTab,
  Medication,
  HydrationState,
  HydrationSettings,
  HydrationSchedule,
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
  getCachedUser,
  clearAuthTokens,
  initAuthSession,
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
  fetchHydrationSchedulesApi,
  createHydrationScheduleApi,
  updateHydrationScheduleApi,
  deleteHydrationScheduleApi,
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
  AlarmTriggerPayload,
} from '../services/nativeReminderService';
import { ActiveAlarmInfo } from '../components/common/AlarmModal';

interface ToastInfo {
  id: string;
  type: 'success' | 'info' | 'warning' | 'error';
  message: string;
}

interface CareSyncContextType {
  // Auth & Session
  currentUser: UserProfile | null;
  isAuthenticated: boolean;
  isAuthLoading: boolean;
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

  // Active Alarm Modal State
  activeAlarm: ActiveAlarmInfo | null;
  confirmAlarmTaken: (alarm: ActiveAlarmInfo) => void;
  confirmAlarmDrank: (alarm: ActiveAlarmInfo) => void;
  snoozeActiveAlarm: (alarm: ActiveAlarmInfo, minutes?: number) => void;
  dismissActiveAlarm: (alarm: ActiveAlarmInfo) => void;
  triggerAlarmTest: (type: 'medication' | 'hydration') => void;

  // Sync & Network Status
  syncStatus: SyncStatus;
  triggerManualSync: () => Promise<void>;

  // Core Data States
  patient: UserProfile;
  medications: Medication[];
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  hydration: HydrationState;
  hydrationSettings: HydrationSettings;
  hydrationSchedules: HydrationSchedule[];
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
  takeMedication: (id: string, date?: string) => void;
  snoozeMedication: (id: string, minutes?: number) => void;
  addMedicationSchedule: (med: Partial<Medication> & { patientId?: string }) => Promise<void>;
  updateMedicationSchedule: (id: string, updates: Partial<Medication>) => Promise<void>;
  deleteMedicationSchedule: (id: string) => Promise<void>;
  
  // Hydration Actions
  logWater: (amountMl: number) => void;
  updateHydrationSettings: (settings: Partial<HydrationSettings>) => Promise<void>;
  addHydrationSchedule: (schedule: Partial<HydrationSchedule>) => Promise<void>;
  updateHydrationSchedule: (id: string, updates: Partial<HydrationSchedule>) => Promise<void>;
  deleteHydrationSchedule: (id: string) => Promise<void>;

  // Activity & Routines
  startActivitySession: (type: 'walk' | 'jog') => void;
  stopActivitySession: () => void;
  syncDeviceActivity: (steps: number, distanceKm?: number, caloriesBurned?: number, activeMinutes?: number) => Promise<void>;
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
  schedules: [],
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
  const cachedUserInit = getCachedUser();
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(cachedUserInit);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
  const [connectionCode, setConnectionCode] = useState<ConnectionCodeInfo | null>(null);
  const [linkedPatients, setLinkedPatients] = useState<UserProfile[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);

  // Active Alarm State
  const [activeAlarm, setActiveAlarm] = useState<ActiveAlarmInfo | null>(null);

  // Tab Navigation
  const [activePatientTab, setActivePatientTab] = useState<PatientTab>('home');
  const [activeCaregiverTab, setActiveCaregiverTab] = useState<CaregiverTab>('overview');

  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean>(true);
  const [sosModalOpen, setSosModalOpen] = useState<boolean>(false);
  const [assistantOpen, setAssistantOpen] = useState<boolean>(false);

  // Core Data States
  const [patient, setPatient] = useState<UserProfile>(cachedUserInit || defaultPatientProfile);
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [hydration, setHydration] = useState<HydrationState>(initialHydration);
  const [hydrationSettings, setHydrationSettings] = useState<HydrationSettings>(defaultHydrationSettings);
  const [hydrationSchedules, setHydrationSchedules] = useState<HydrationSchedule[]>([]);
  const [activity, setActivity] = useState<ActivityState>(initialActivity);
  const [routineItems, setRoutineItems] = useState<RoutineItem[]>([
    { id: 'r-1', title: 'Morning Heart Medication', time: '08:00 AM', completed: false, category: 'medication', iconName: 'Pill' },
    { id: 'r-2', title: 'Morning Hydration Goal (500ml)', time: '09:00 AM', completed: false, category: 'hydration', iconName: 'Droplets' },
    { id: 'r-3', title: 'Daily Mobility Walk (20 mins)', time: '10:30 AM', completed: false, category: 'activity', iconName: 'Activity' },
    { id: 'r-4', title: 'Midday Blood Pressure Check', time: '01:00 PM', completed: false, category: 'wellness', iconName: 'HeartPulse' },
    { id: 'r-5', title: 'Afternoon Vitamin & Calcium', time: '02:00 PM', completed: false, category: 'medication', iconName: 'Pill' },
    { id: 'r-6', title: 'Evening Cholesterol Dose', time: '08:00 PM', completed: false, category: 'medication', iconName: 'Pill' },
  ]);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [escalationRules, setEscalationRules] = useState<EscalationRules>(initialEscalationRules);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [toasts, setToasts] = useState<ToastInfo[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'm-1',
      sender: 'assistant',
      text: 'Good morning! How are you feeling today? I am here to help coordinate your medications and daily care routine.',
      timestamp: '08:00 AM',
      suggestedActions: ['What is my schedule?', 'Log water (+250ml)', 'Start a walk'],
    },
  ]);
  const [isAssistantThinking, setIsAssistantThinking] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(
    typeof navigator !== 'undefined' && !navigator.onLine ? 'OFFLINE' : 'ONLINE'
  );

  const activeRole: UserRole = currentUser?.role || 'patient';
  const isAuthenticated = !!currentUser && (!!getAuthToken() || !!cachedUserInit);

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
  const loadDataForSession = useCallback(async (user: UserProfile, targetPatientId?: string, targetDate?: string) => {
    try {
      const dateToFetch = targetDate || selectedDate || new Date().toISOString().split('T')[0];

      if (user.role === 'patient') {
        setPatient(user);

        const [medsData, hydrationData, schedulesData, activityData, alertsData, escalationData, codeData] = await Promise.all([
          fetchMedicationsApi(undefined, dateToFetch).catch(() => []),
          fetchHydrationApi().catch(() => null),
          fetchHydrationSchedulesApi().catch(() => []),
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
            syncNativeHydrationReminders(hydrationData.settings, 'patient', schedulesData || []);
          }
        }

        if (schedulesData) {
          setHydrationSchedules(schedulesData);
        }

        if (activityData) {
          setActivity(activityData);
        }

        if (alertsData) setAlerts(alertsData);
        if (escalationData) setEscalationRules(escalationData);
        if (codeData) setConnectionCode(codeData);
      } else if (user.role === 'caregiver') {
        syncNativeMedicationAlarms([], 'caregiver').catch(console.error);
        syncNativeHydrationReminders(defaultHydrationSettings, 'caregiver').catch(console.error);

        const patients = await fetchLinkedPatientsApi().catch(() => []);
        setLinkedPatients(patients);

        const activeTarget = targetPatientId || (patients.length > 0 ? patients[0].id : null);
        setSelectedPatientId(activeTarget);

        if (activeTarget) {
          const targetProfile = patients.find((p) => p.id === activeTarget) || patients[0];
          setPatient(targetProfile);

          const [medsData, hydrationData, schedulesData, activityData, alertsData, escalationData] = await Promise.all([
            fetchMedicationsApi(activeTarget, dateToFetch).catch(() => []),
            fetchHydrationApi(activeTarget).catch(() => null),
            fetchHydrationSchedulesApi(activeTarget).catch(() => []),
            fetchActivityApi(activeTarget).catch(() => null),
            fetchAlertsApi(activeTarget).catch(() => []),
            fetchEscalationRulesApi(activeTarget).catch(() => null),
          ]);

          setMedications(medsData || []);
          if (hydrationData) setHydration(hydrationData);
          if (schedulesData) setHydrationSchedules(schedulesData);
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
  }, [selectedDate]);

  // Initial Auth Bootstrap & Native Notifications Listener Setup
  useEffect(() => {
    // 1. Setup Native Notification Listeners
    initNativeNotifications(
      (medId) => {
        fetchMedicationsApi().then((meds) => {
          if (meds) {
            setMedications(meds);
            syncNativeMedicationAlarms(meds, 'patient');
          }
        });
      },
      (alarmPayload: AlarmTriggerPayload) => {
        setActiveAlarm({
          id: alarmPayload.id,
          type: alarmPayload.type,
          title: alarmPayload.title,
          subtitle: alarmPayload.subtitle,
          scheduledTime: alarmPayload.scheduledTime,
          dosageOrAmount: alarmPayload.dosageOrAmount,
          instructions: alarmPayload.instructions,
          extra: alarmPayload.extra,
        });
      },
      (amountMl: number) => {
        logWater(amountMl);
      }
    );

    // 2. Perform Session Bootstrap
    initAuthSession()
      .then((session) => {
        if (session?.user) {
          setCurrentUser(session.user);
          if (session.connectionCode) setConnectionCode(session.connectionCode);
          loadDataForSession(session.user);
        } else {
          setCurrentUser(null);
        }
      })
      .catch((err) => {
        console.warn('[CareSync] Session bootstrap error:', err);
      })
      .finally(() => {
        setIsAuthLoading(false);
      });

    // 3. Online/Offline Network Listeners
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
    const targetPatientId = res.linkedPatient?.id;
    await loadDataForSession(res.user, targetPatientId);
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
    setHydrationSchedules([]);
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
  const addMedicationSchedule = async (med: Partial<Medication> & { patientId?: string }) => {
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
      addToast('Medication removed from schedule', 'info');

      if (currentUser?.role === 'patient') {
        syncNativeMedicationAlarms(filteredList, 'patient');
      }
    } catch (err: any) {
      console.error('Failed to remove medication:', err);
      addToast(err.message || 'Failed to remove medication', 'error');
    }
  };

  const takeMedication = (id: string, date?: string) => {
    const targetDate = date || selectedDate || new Date().toISOString().split('T')[0];
    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const updated = medications.map((m) => (m.id === id ? { ...m, status: 'taken' as const, takenAt: nowStr } : m));
    setMedications(updated);

    logMedicationDoseApi(id, 'taken', nowStr, targetDate).catch(console.error);

    if (currentUser?.role === 'patient') {
      syncNativeMedicationAlarms(updated, 'patient');
    }

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

  const snoozeMedication = (id: string, minutes = 10) => {
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
          syncNativeHydrationReminders(res.settings, 'patient', hydrationSchedules);
        }
        addToast('Hydration reminder schedule saved!', 'success');
      }
    } catch (err: any) {
      console.error('Failed to update hydration settings:', err);
      addToast(err.message || 'Failed to update hydration settings', 'error');
      throw err;
    }
  };

  const addHydrationSchedule = async (schedule: Partial<HydrationSchedule>) => {
    try {
      const res = await createHydrationScheduleApi(schedule);
      const updated = [...hydrationSchedules, res];
      setHydrationSchedules(updated);
      if (currentUser?.role === 'patient') {
        syncNativeHydrationReminders(hydrationSettings, 'patient', updated);
      }
      addToast(`Added hydration slot for ${res.scheduledTime} (${res.amountMl}ml)`, 'success');
    } catch (err: any) {
      console.error('Failed to add hydration schedule:', err);
      addToast(err.message || 'Failed to add hydration schedule', 'error');
      throw err;
    }
  };

  const updateHydrationSchedule = async (id: string, updates: Partial<HydrationSchedule>) => {
    try {
      const res = await updateHydrationScheduleApi(id, updates);
      const updated = hydrationSchedules.map((s) => (s.id === id ? res : s));
      setHydrationSchedules(updated);
      if (currentUser?.role === 'patient') {
        syncNativeHydrationReminders(hydrationSettings, 'patient', updated);
      }
      addToast('Hydration schedule updated', 'success');
    } catch (err: any) {
      console.error('Failed to update hydration schedule:', err);
      addToast(err.message || 'Failed to update hydration schedule', 'error');
      throw err;
    }
  };

  const deleteHydrationSchedule = async (id: string) => {
    try {
      await deleteHydrationScheduleApi(id);
      const updated = hydrationSchedules.filter((s) => s.id !== id);
      setHydrationSchedules(updated);
      if (currentUser?.role === 'patient') {
        syncNativeHydrationReminders(hydrationSettings, 'patient', updated);
      }
      addToast('Hydration slot deleted', 'info');
    } catch (err: any) {
      console.error('Failed to delete hydration schedule:', err);
      addToast(err.message || 'Failed to delete hydration schedule', 'error');
    }
  };

  // Alarm Modal Handlers
  const confirmAlarmTaken = (alarm: ActiveAlarmInfo) => {
    const medId = alarm.extra?.medicationId || alarm.id;
    takeMedication(medId);
    setActiveAlarm(null);
  };

  const confirmAlarmDrank = (alarm: ActiveAlarmInfo) => {
    const amountMl = alarm.extra?.amountMl || parseInt(alarm.dosageOrAmount, 10) || 250;
    logWater(amountMl);
    setActiveAlarm(null);
  };

  const snoozeActiveAlarm = (alarm: ActiveAlarmInfo, minutes = 10) => {
    if (alarm.type === 'medication') {
      const medId = alarm.extra?.medicationId || alarm.id;
      snoozeMedication(medId, minutes);
    } else {
      addToast(`Hydration reminder snoozed for ${minutes} minutes`, 'info');
    }
    setActiveAlarm(null);
  };

  const dismissActiveAlarm = (_alarm: ActiveAlarmInfo) => {
    setActiveAlarm(null);
  };

  const triggerAlarmTest = (type: 'medication' | 'hydration') => {
    if (type === 'medication') {
      const med = medications[0] || { name: 'Atorvastatin', dosage: '20 mg', scheduledTime: '08:00 AM' };
      setActiveAlarm({
        id: 'test-med',
        type: 'medication',
        title: med.name,
        subtitle: 'Medication Alarm Test',
        scheduledTime: med.scheduledTime || '08:00 AM',
        dosageOrAmount: med.dosage || '20 mg',
        instructions: 'Take with warm water after breakfast',
      });
    } else {
      setActiveAlarm({
        id: 'test-hyd',
        type: 'hydration',
        title: 'Time for a Water Break',
        subtitle: 'Hydration Alarm Test',
        scheduledTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        dosageOrAmount: '250 ml',
      });
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

    const medTotal = medications.length;
    let medicationScore = 100;
    if (medTotal > 0) {
      const medTaken = medications.filter((m) => m.status === 'taken').length;
      medicationScore = Math.round((medTaken / medTotal) * 100);
      weightedSum += medicationScore * 0.4;
      totalWeights += 0.4;
    }

    const goalLiters = hydration?.goalLiters || 2.0;
    const currentLiters = hydration?.currentLiters || 0;
    let hydrationScore = 0;
    if (goalLiters > 0 && currentLiters > 0) {
      hydrationScore = Math.min(100, Math.round((currentLiters / goalLiters) * 100));
      weightedSum += hydrationScore * 0.25;
      totalWeights += 0.25;
    } else if (goalLiters > 0 && (medTotal > 0 || (activity?.steps || 0) > 0 || (routineItems?.length || 0) > 0)) {
      hydrationScore = 0;
      totalWeights += 0.25;
    }

    const steps = activity?.steps || 0;
    const stepGoal = activity?.stepGoal || 5000;
    let stepScore = 0;
    if (steps > 0 && stepGoal > 0) {
      stepScore = Math.min(100, Math.round((steps / stepGoal) * 100));
      weightedSum += stepScore * 0.2;
      totalWeights += 0.2;
    }

    const routineTotal = routineItems?.length || 0;
    let routineScore = 100;
    if (routineTotal > 0) {
      const routineCompleted = routineItems.filter((r) => r.completed).length;
      routineScore = Math.round((routineCompleted / routineTotal) * 100);
      weightedSum += routineScore * 0.15;
      totalWeights += 0.15;
    }

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
      type: 'encouragement',
      title: 'Daily Care Overview',
      message: 'Your health rhythms and schedule synchronize with your care team in real-time.',
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
        isAuthLoading,
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

        activeAlarm,
        confirmAlarmTaken,
        confirmAlarmDrank,
        snoozeActiveAlarm,
        dismissActiveAlarm,
        triggerAlarmTest,

        syncStatus,
        triggerManualSync,

        patient,
        medications,
        selectedDate,
        setSelectedDate,
        hydration,
        hydrationSettings,
        hydrationSchedules,
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
        addHydrationSchedule,
        updateHydrationSchedule,
        deleteHydrationSchedule,

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
