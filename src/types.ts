export type UserRole = 'patient' | 'caregiver';

export type PatientTab = 'home' | 'medication' | 'hydration' | 'activity' | 'routine' | 'profile';
export type CaregiverTab = 'overview' | 'patient' | 'alerts' | 'escalation' | 'settings';

export type MedicationStatus = 'taken' | 'due' | 'missed' | 'upcoming';
export type SyncStatus = 'ONLINE' | 'SYNCING' | 'OFFLINE';

export interface Medication {
  id: string;
  name: string;
  dosage: string;
  scheduledTime: string; // e.g. "08:00 AM"
  timezone?: string;     // e.g. "America/New_York"
  instructions: string;  // e.g. "Take 1 tablet with warm water after food"
  status: MedicationStatus;
  takenAt?: string;
  category: 'morning' | 'afternoon' | 'evening';
  color: string;
}

export interface HydrationLog {
  id: string;
  amountMl: number;
  timestamp: string;
}

export interface HydrationSettings {
  dailyGoalLiters: number;
  reminderEnabled: boolean;
  startTime: string; // "08:00"
  endTime: string;   // "20:00"
  intervalMinutes: number; // 60
  timezone?: string;
}

export interface HydrationState {
  currentLiters: number;
  goalLiters: number;
  logs: HydrationLog[];
  nextReminderTime: string;
  hourlyTrends: { hour: string; liters: number }[];
  settings?: HydrationSettings;
}

export interface ActivityState {
  steps: number;
  stepGoal: number;
  activeMinutes: number;
  activeMinutesGoal: number;
  caloriesBurned: number;
  distanceKm: number;
  weeklySteps: { day: string; steps: number; goal: number; date?: string }[];
  isTrackingActive: boolean;
  hasRecordedActivityToday?: boolean;
  activeSessionType?: 'walk' | 'jog';
  activeSessionSeconds?: number;
}

export interface RoutineItem {
  id: string;
  patientId?: string;
  title: string;
  time: string;
  completed: boolean;
  category: 'medication' | 'hydration' | 'activity' | 'wellness';
  iconName: string;
}

export interface CareScoreBreakdown {
  totalScore: number; // 0 - 100
  medicationScore: number;
  hydrationScore: number;
  activityScore: number;
  routineScore: number;
  weeklyScores: { day: string; score: number }[];
  isNewSetup?: boolean;
}

export interface RoutineInsight {
  id: string;
  type: 'positive' | 'warning' | 'info';
  title: string;
  description: string;
  timestamp: string;
  isDiagnostic: false;
}

export type AlertSeverity = 'low' | 'medium' | 'high' | 'emergency';

export interface AlertItem {
  id: string;
  patientId: string;
  patientName: string;
  type: 'medication_reminder' | 'missed_medication' | 'hydration_low' | 'routine_insight' | 'inactivity_alert';
  severity: AlertSeverity;
  title: string;
  description: string;
  timestamp: string;
  reviewed: boolean;
  actionText?: string;
}

export interface EscalationLevel {
  level: 1 | 2 | 3 | 4;
  title: string;
  target: string;
  delayMinutes: number;
  description: string;
  enabled: boolean;
}

export interface EscalationRules {
  levels: EscalationLevel[];
  caregiverName: string;
  caregiverPhone: string;
  caregiverEmail: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelation: string;
  quietHoursStart: string; // "22:00"
  quietHoursEnd: string; // "07:00"
  maxRemindersBeforeEscalation: number;
  repeatReminderIntervalMinutes: number;
}

export interface NotificationItem {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  type: 'reminder' | 'alert' | 'system' | 'caregiver';
  read: boolean;
}

export interface ConnectionCodeInfo {
  code: string;
  expiresAt: string;
  createdAt?: string;
}

export interface UserProfile {
  id: string;
  email?: string;
  role: UserRole;
  name: string;
  age?: number;
  phone?: string;
  avatarUrl?: string;
  timezone?: string;
  primaryCaregiver?: string;
  caregiverPhone?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  quietHours?: string;
  medicationCount?: number;
  lastActive?: string;
  status?: 'normal' | 'attention' | 'alert';
}

export interface ChatMessage {
  id: string;
  sender: 'assistant' | 'user';
  text: string;
  timestamp: string;
  suggestedActions?: string[];
}
