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
  startDate?: string;    // e.g. "2026-09-01"
  endDate?: string;      // e.g. "2026-09-30"
  repeatPattern?: 'daily' | 'weekdays' | 'weekends' | 'custom';
  daysOfWeek?: string[]; // e.g. ['Mon', 'Wed', 'Fri']
  active?: number;
}

export interface HydrationLog {
  id: string;
  amountMl: number;
  timestamp: string;
}

export interface HydrationSchedule {
  id: string;
  patientId?: string;
  scheduledTime: string; // e.g. "08:00" or "08:00 AM"
  amountMl: number;      // e.g. 250
  repeatDays: string;    // 'daily' | 'weekdays' | 'weekends'
  enabled: boolean;
  startDate?: string;
  endDate?: string;
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
  schedules?: HydrationSchedule[];
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
  title: string;
  time: string;
  completed: boolean;
  category: 'medication' | 'hydration' | 'activity' | 'wellness';
  iconName: string;
}

export interface CareScoreBreakdown {
  medicationScore: number;
  hydrationScore: number;
  activityScore: number;
  routineScore: number;
  totalScore: number;
  weeklyScores?: { day: string; score: number }[];
}

export interface RoutineInsight {
  id: string;
  type: 'encouragement' | 'warning' | 'tip' | 'info' | 'positive';
  title: string;
  message?: string;
  description?: string;
  timestamp?: string;
  actionText?: string;
  isDiagnostic?: boolean;
}

export interface AlertItem {
  id: string;
  patientId: string;
  patientName: string;
  type: 'missed_medication' | 'low_hydration' | 'inactivity' | 'irregular_routine';
  severity: 'low' | 'medium' | 'high' | 'emergency';
  title: string;
  description: string;
  timestamp: string;
  reviewed: boolean;
  actionText: string;
}

export interface EscalationLevel {
  level: number;
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
  quietHoursStart: string;
  quietHoursEnd: string;
  maxRemindersBeforeEscalation: number;
  repeatReminderIntervalMinutes: number;
}

export interface NotificationItem {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  type: 'reminder' | 'alert' | 'system' | 'caregiver' | 'emergency';
  read: boolean;
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
  status?: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  suggestedActions?: string[];
}

export interface ConnectionCodeInfo {
  code: string;
  expiresAt: string;
  createdAt?: string;
}
