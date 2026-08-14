export type UserRole = 'patient' | 'caregiver';

export type PatientTab = 'home' | 'medication' | 'hydration' | 'activity' | 'routine' | 'profile';
export type CaregiverTab = 'overview' | 'patient' | 'alerts' | 'escalation' | 'settings';

export type MedicationStatus = 'taken' | 'due' | 'missed' | 'upcoming';

export interface Medication {
  id: string;
  name: string;
  dosage: string;
  scheduledTime: string; // e.g. "08:00 AM"
  instructions: string; // e.g. "Take 1 tablet with warm water after food"
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

export interface HydrationState {
  currentLiters: number; // e.g., 1.4
  goalLiters: number; // e.g., 2.0
  logs: HydrationLog[];
  nextReminderTime: string;
  hourlyTrends: { hour: string; liters: number }[];
}

export interface ActivityState {
  steps: number; // e.g., 4821
  stepGoal: number; // e.g., 5000
  activeMinutes: number; // e.g., 32
  activeMinutesGoal: number; // 30
  caloriesBurned: number; // e.g., 185
  distanceKm: number; // e.g., 3.2
  weeklySteps: { day: string; steps: number; goal: number }[];
  isTrackingActive: boolean;
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
  totalScore: number; // 0 - 100
  medicationScore: number; // e.g. 96
  hydrationScore: number; // e.g. 72
  activityScore: number; // e.g. 85
  routineScore: number; // e.g. 90
  weeklyScores: { day: string; score: number }[];
}

export interface RoutineInsight {
  id: string;
  type: 'positive' | 'warning' | 'info';
  title: string;
  description: string;
  timestamp: string;
  isDiagnostic: false; // Mandatory flag confirming non-diagnostic nature
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
  avatarUrl?: string;
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
