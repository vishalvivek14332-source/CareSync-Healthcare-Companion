import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import {
  UserRole,
  PatientTab,
  CaregiverTab,
  Medication,
  HydrationState,
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
} from '../types';
import {
  signupApi,
  loginApi,
  fetchCurrentUserApi,
  switchDemoUserApi,
  setAuthToken,
  getAuthToken,
  fetchConnectionCodeApi,
  generateConnectionCodeApi,
  revokeConnectionCodeApi,
  fetchMedicationsApi,
  createMedicationApi,
  updateMedicationApi,
  deleteMedicationApi,
  logMedicationDoseApi,
  fetchHydrationApi,
  logHydrationApi,
  fetchActivityApi,
  recordActivitySessionApi,
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

  // Core Data States
  patient: UserProfile;
  medications: Medication[];
  hydration: HydrationState;
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
  startActivitySession: (type: 'walk' | 'jog') => void;
  stopActivitySession: () => void;
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
  id: 'p-1',
  role: 'patient',
  name: 'Alex Johnson',
  age: 72,
  avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250',
  primaryCaregiver: 'Sarah Johnson',
  caregiverPhone: '(555) 019-2831',
  emergencyContact: 'Sarah Johnson (Daughter)',
  emergencyPhone: '(555) 019-2831',
  quietHours: '10:00 PM - 7:00 AM',
  medicationCount: 3,
  lastActive: 'Just now',
  status: 'normal',
};

const initialMedications: Medication[] = [
  {
    id: 'med-1',
    name: 'Morning Medication',
    dosage: 'Vitamin D3 (2,000 IU) + Lisinopril 10mg',
    scheduledTime: '08:00 AM',
    instructions: 'Take with full glass of water after breakfast',
    status: 'taken',
    takenAt: '08:02 AM',
    category: 'morning',
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  {
    id: 'med-2',
    name: 'Afternoon Medication',
    dosage: 'Calcium Citrate 500mg',
    scheduledTime: '01:00 PM',
    instructions: 'Take 1 tablet with light snack',
    status: 'due',
    category: 'afternoon',
    color: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  {
    id: 'med-3',
    name: 'Evening Medication',
    dosage: 'Atorvastatin 20mg + Multivitamin',
    scheduledTime: '08:00 PM',
    instructions: 'Take before bed with water',
    status: 'upcoming',
    category: 'evening',
    color: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  },
];

const initialHydration: HydrationState = {
  currentLiters: 1.4,
  goalLiters: 2.0,
  nextReminderTime: 'In 45 minutes',
  logs: [
    { id: 'h-1', amountMl: 250, timestamp: '08:15 AM' },
    { id: 'h-2', amountMl: 400, timestamp: '10:30 AM' },
    { id: 'h-3', amountMl: 250, timestamp: '12:15 PM' },
    { id: 'h-4', amountMl: 500, timestamp: '02:00 PM' },
  ],
  hourlyTrends: [
    { hour: '8 AM', liters: 0.25 },
    { hour: '10 AM', liters: 0.65 },
    { hour: '12 PM', liters: 0.9 },
    { hour: '2 PM', liters: 1.4 },
    { hour: '4 PM', liters: 1.4 },
    { hour: '6 PM', liters: 1.4 },
  ],
};

const initialActivity: ActivityState = {
  steps: 4821,
  stepGoal: 5000,
  activeMinutes: 32,
  activeMinutesGoal: 30,
  caloriesBurned: 185,
  distanceKm: 3.2,
  isTrackingActive: false,
  weeklySteps: [
    { day: 'Mon', steps: 5120, goal: 5000 },
    { day: 'Tue', steps: 4900, goal: 5000 },
    { day: 'Wed', steps: 5400, goal: 5000 },
    { day: 'Thu', steps: 4821, goal: 5000 },
    { day: 'Fri', steps: 3900, goal: 5000 },
    { day: 'Sat', steps: 4200, goal: 5000 },
    { day: 'Sun', steps: 4600, goal: 5000 },
  ],
};

const initialRoutineItems: RoutineItem[] = [
  { id: 'r-1', title: 'Morning medication', time: '8:00 AM', completed: true, category: 'medication', iconName: 'Pill' },
  { id: 'r-2', title: 'Healthy Breakfast', time: '8:30 AM', completed: true, category: 'wellness', iconName: 'Utensils' },
  { id: 'r-3', title: 'Hydration goal (1.4L achieved)', time: '10:00 AM', completed: true, category: 'hydration', iconName: 'Droplet' },
  { id: 'r-4', title: 'Morning 20-min Walk', time: '10:30 AM', completed: true, category: 'activity', iconName: 'Footprints' },
  { id: 'r-5', title: 'Afternoon medication', time: '1:00 PM', completed: false, category: 'medication', iconName: 'Pill' },
  { id: 'r-6', title: 'Evening medication', time: '8:00 PM', completed: false, category: 'medication', iconName: 'Pill' },
  { id: 'r-7', title: 'Gentle Sleep Routine', time: '10:00 PM', completed: false, category: 'wellness', iconName: 'Moon' },
];

const initialAlerts: AlertItem[] = [
  {
    id: 'alt-1',
    patientId: 'p-1',
    patientName: 'Alex Johnson',
    type: 'medication_reminder',
    severity: 'medium',
    title: 'Medication Reminder',
    description: 'Evening medication has not been confirmed yet.',
    timestamp: 'Yesterday at 8:45 PM',
    reviewed: false,
    actionText: 'Send Gentle Reminder',
  },
  {
    id: 'alt-2',
    patientId: 'p-1',
    patientName: 'Alex Johnson',
    type: 'missed_medication',
    severity: 'high',
    title: 'Missed Medication Alert',
    description: 'Evening medication was not confirmed after 3 repeated reminders.',
    timestamp: '2 days ago',
    reviewed: false,
    actionText: 'Contact Alex',
  },
  {
    id: 'alt-3',
    patientId: 'p-1',
    patientName: 'Alex Johnson',
    type: 'routine_insight',
    severity: 'low',
    title: 'Routine Pattern Observation',
    description: 'Walking activity has been slightly lower than average for the last 3 days.',
    timestamp: '3 days ago',
    reviewed: true,
    actionText: 'View Activity Graph',
  },
];

const initialEscalationRules: EscalationRules = {
  levels: [
    { level: 1, title: 'Level 1: Soft Patient Reminder', target: 'Alex (Patient App)', delayMinutes: 0, description: 'Display gentle visual chime & push notification on patient device.', enabled: true },
    { level: 2, title: 'Level 2: Repeated Reminder Tone', target: 'Alex (Patient App)', delayMinutes: 15, description: 'Play audible tone & show full-screen gentle banner.', enabled: true },
    { level: 3, title: 'Level 3: Trusted Caregiver Alert', target: 'Sarah Johnson (Caregiver)', delayMinutes: 45, description: 'Send high-priority SMS & notification to trusted caregiver Sarah.', enabled: true },
    { level: 4, title: 'Level 4: Emergency Escalation Workflow', target: 'Emergency Contacts', delayMinutes: 90, description: 'Trigger priority audio call to designated emergency contact.', enabled: true },
  ],
  caregiverName: 'Sarah Johnson',
  caregiverPhone: '(555) 019-2831',
  caregiverEmail: 'sarah.johnson@example.com',
  emergencyContactName: 'Sarah Johnson (Daughter)',
  emergencyContactPhone: '(555) 019-2831',
  emergencyContactRelation: 'Daughter & Primary Caregiver',
  quietHoursStart: '22:00',
  quietHoursEnd: '07:00',
  maxRemindersBeforeEscalation: 3,
  repeatReminderIntervalMinutes: 15,
};

const initialNotifications: NotificationItem[] = [
  { id: 'n-1', title: 'Morning Medication Logged', description: 'Vitamin D + Lisinopril confirmed at 8:02 AM', timestamp: '8:02 AM', type: 'reminder', read: false },
  { id: 'n-2', title: 'Hydration Target Reached (70%)', description: '1.4 L logged. 600 ml remaining today.', timestamp: '2:00 PM', type: 'reminder', read: false },
  { id: 'n-3', title: 'Walking Milestone!', description: 'You achieved 32 active minutes today!', timestamp: '11:00 AM', type: 'reminder', read: true },
  { id: 'n-4', title: 'Caregiver Check-in Synchronized', description: 'Sarah reviewed your daily CareScore (86/100).', timestamp: 'Yesterday', type: 'caregiver', read: true },
];

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
  const [medications, setMedications] = useState<Medication[]>(initialMedications);
  const [hydration, setHydration] = useState<HydrationState>(initialHydration);
  const [activity, setActivity] = useState<ActivityState>(initialActivity);
  const [routineItems, setRoutineItems] = useState<RoutineItem[]>(initialRoutineItems);
  const [alerts, setAlerts] = useState<AlertItem[]>(initialAlerts);
  const [escalationRules, setEscalationRules] = useState<EscalationRules>(initialEscalationRules);
  const [notifications, setNotifications] = useState<NotificationItem[]>(initialNotifications);
  const [toasts, setToasts] = useState<ToastInfo[]>([]);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: 'c-1',
      sender: 'assistant',
      text: "Good morning! You're on track with your health routines.",
      timestamp: '08:30 AM',
      suggestedActions: ['What do I need to do?', 'Log medicine', 'Log water', 'Start a walk'],
    },
  ]);
  const [isAssistantThinking, setIsAssistantThinking] = useState<boolean>(false);

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
        const medsData = await fetchMedicationsApi();
        if (medsData) {
          setMedications(medsData);
          syncNativeMedicationAlarms(medsData, 'patient').catch(console.error);
        }

        const hydrationData = await fetchHydrationApi();
        if (hydrationData) setHydration(hydrationData);

        const activityData = await fetchActivityApi();
        if (activityData) setActivity(activityData);

        const alertsData = await fetchAlertsApi();
        if (alertsData) setAlerts(alertsData);

        const escalationData = await fetchEscalationRulesApi();
        if (escalationData) setEscalationRules(escalationData);

        const codeData = await fetchConnectionCodeApi().catch(() => null);
        if (codeData) setConnectionCode(codeData);

        setPatient(user);
      } else if (user.role === 'caregiver') {
        // Cancel any native alarms on caregiver device
        syncNativeMedicationAlarms([], 'caregiver').catch(console.error);

        const patients = await fetchLinkedPatientsApi().catch(() => []);
        setLinkedPatients(patients);

        const activeTarget = targetPatientId || (patients.length > 0 ? patients[0].id : null);
        setSelectedPatientId(activeTarget);

        if (activeTarget) {
          const targetProfile = patients.find((p) => p.id === activeTarget) || patients[0];
          setPatient(targetProfile);

          const medsData = await fetchMedicationsApi(activeTarget).catch(() => []);
          setMedications(medsData);

          const hydrationData = await fetchHydrationApi(activeTarget).catch(() => null);
          if (hydrationData) setHydration(hydrationData);

          const activityData = await fetchActivityApi(activeTarget).catch(() => null);
          if (activityData) setActivity(activityData);

          const alertsData = await fetchAlertsApi(activeTarget).catch(() => []);
          setAlerts(alertsData);

          const escalationData = await fetchEscalationRulesApi(activeTarget).catch(() => null);
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

  // Restore authenticated session on initial mount
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
  }, [loadDataForSession]);

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
    setAuthToken(null);
    setCurrentUser(null);
    setConnectionCode(null);
    setLinkedPatients([]);
    setSelectedPatientId(null);
    setMedications([]);
    setAlerts([]);
    setNotifications([]);
    setActivePatientTab('home');
    setActiveCaregiverTab('overview');
    syncNativeMedicationAlarms([], 'caregiver').catch(console.error);
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
      setMedications((prev) => [...prev, createdMed]);
      addToast(`Added medication schedule for ${createdMed.name}`, 'success');

      // If on patient device, sync local alarms
      if (currentUser?.role === 'patient') {
        syncNativeMedicationAlarms([...medications, createdMed], 'patient');
      }
    } catch (err: any) {
      console.error('Failed to add medication schedule:', err);
      addToast(err.message || 'Failed to add medication schedule', 'error');
    }
  };

  const updateMedicationSchedule = async (id: string, updates: Partial<Medication>) => {
    try {
      const res = await updateMedicationApi(id, updates);
      setMedications((prev) =>
        prev.map((m) => (m.id === id ? { ...m, ...updates, ...(res.medication || {}) } : m))
      );
      addToast('Medication schedule updated successfully', 'success');

      if (currentUser?.role === 'patient') {
        const updatedList = medications.map((m) => (m.id === id ? { ...m, ...updates } : m));
        syncNativeMedicationAlarms(updatedList, 'patient');
      }
    } catch (err: any) {
      console.error('Failed to update medication schedule:', err);
      addToast(err.message || 'Failed to update medication schedule', 'error');
    }
  };

  const deleteMedicationSchedule = async (id: string) => {
    try {
      await deleteMedicationApi(id);
      setMedications((prev) => prev.filter((m) => m.id !== id));
      addToast('Medication deactivated / removed', 'info');

      if (currentUser?.role === 'patient') {
        const filteredList = medications.filter((m) => m.id !== id);
        syncNativeMedicationAlarms(filteredList, 'patient');
      }
    } catch (err: any) {
      console.error('Failed to remove medication:', err);
      addToast(err.message || 'Failed to remove medication', 'error');
    }
  };

  const takeMedication = (id: string) => {
    const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setMedications((prev) =>
      prev.map((m) => (m.id === id ? { ...m, status: 'taken', takenAt: nowStr } : m))
    );

    logMedicationDoseApi(id, 'taken', nowStr).catch(console.error);

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
      steps: prev.steps + addedSteps,
      activeMinutes: prev.activeMinutes + addedMinutes,
      distanceKm: Number((prev.distanceKm + addedKm).toFixed(1)),
      caloriesBurned: prev.caloriesBurned + 45,
    }));

    recordActivitySessionApi({ addedSteps, addedMinutes, addedKm, addedCalories: 45 }).catch(console.error);
    addToast(`Activity session completed! +${addedSteps} steps added.`, 'success');
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

  const calculateCareScore = (): CareScoreBreakdown => {
    const medTaken = medications.filter((m) => m.status === 'taken').length;
    const medTotal = medications.length;
    const medicationScore = medTotal > 0 ? Math.round((medTaken / medTotal) * 100) : 100;
    const hydrationScore = Math.min(100, Math.round((hydration.currentLiters / hydration.goalLiters) * 100));
    const stepScore = Math.min(100, Math.round((activity.steps / activity.stepGoal) * 100));
    const completedRoutines = routineItems.filter((r) => r.completed).length;
    const routineScore = routineItems.length > 0 ? Math.round((completedRoutines / routineItems.length) * 100) : 100;

    const totalScore = Math.round(
      medicationScore * 0.35 + hydrationScore * 0.25 + stepScore * 0.2 + routineScore * 0.2
    );

    return {
      totalScore,
      medicationScore,
      hydrationScore,
      activityScore: stepScore,
      routineScore,
      weeklyScores: [
        { day: 'Mon', score: 88 },
        { day: 'Tue', score: 82 },
        { day: 'Wed', score: 90 },
        { day: 'Thu', score: totalScore },
        { day: 'Fri', score: 85 },
        { day: 'Sat', score: 80 },
        { day: 'Sun', score: 86 },
      ],
    };
  };

  const careScore = calculateCareScore();

  const insights: RoutineInsight[] = [
    {
      id: 'ins-1',
      type: 'positive',
      title: 'Consistent Morning Routine',
      description: 'Morning medication adherence has remained consistent this week. Excellent job!',
      timestamp: 'Today',
      isDiagnostic: false,
    },
    {
      id: 'ins-2',
      type: 'warning',
      title: 'Evening Reminder Observation',
      description: 'Attention: Evening medication was missed twice over the last 5 days. Consider adjusting reminder 15 minutes earlier.',
      timestamp: 'Yesterday',
      isDiagnostic: false,
    },
    {
      id: 'ins-3',
      type: 'info',
      title: 'Hydration & Activity Rhythm',
      description: 'Higher activity scores tend to follow days when morning hydration is logged before 10 AM.',
      timestamp: '2 days ago',
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
      const dueMed = medications.find((m) => m.status === 'due') || medications[1];
      if (dueMed) takeMedication(dueMed.id);
    } else if (lower.includes('start walk') || lower.includes('start a walk')) {
      startActivitySession('walk');
    }

    try {
      const res = await sendAssistantMessage(userText, {
        patientName: patient.name,
        medicationStatus: {
          morning: medications[0]?.status,
          afternoon: medications[1]?.status,
          evening: medications[2]?.status,
        },
        hydration: { current: hydration.currentLiters, goal: hydration.goalLiters },
        activity: { steps: activity.steps, target: activity.stepGoal },
        careScore: careScore.totalScore,
      });

      const assistantMsg: ChatMessage = {
        id: `ast-${Date.now()}`,
        sender: 'assistant',
        text: res.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        suggestedActions: ['What do I need to do?', 'Log medicine', 'Log water (+250ml)', 'Start a walk'],
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

        patient,
        medications,
        hydration,
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
        startActivitySession,
        stopActivitySession,
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
