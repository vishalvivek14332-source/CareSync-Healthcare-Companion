import {
  Medication,
  HydrationState,
  ActivityState,
  AlertItem,
  EscalationRules,
  UserProfile,
} from '../types';

let authToken: string | null = typeof window !== 'undefined' && window.localStorage ? localStorage.getItem('caresync_token') : null;

export function setAuthToken(token: string | null) {
  authToken = token;
  if (typeof window !== 'undefined' && window.localStorage) {
    if (token) {
      localStorage.setItem('caresync_token', token);
    } else {
      localStorage.removeItem('caresync_token');
    }
  }
}

export function getAuthToken(): string | null {
  if (authToken) return authToken;
  if (typeof window !== 'undefined' && window.localStorage) {
    return localStorage.getItem('caresync_token');
  }
  return null;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || `Request failed with status ${response.status}`);
  }

  return response.json();
}

// AUTH API
export async function signupApi(data: {
  email: string;
  password: string;
  name: string;
  role: 'patient' | 'caregiver';
  age?: number;
  phone?: string;
  primaryCaregiver?: string;
  caregiverPhone?: string;
  caregiverEmail?: string;
}) {
  const res = await request<{ token: string; user: UserProfile; connectionCode?: { code: string; expiresAt: string } }>('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  setAuthToken(res.token);
  return res;
}

export async function loginApi(email: string, password: string) {
  const data = await request<{ token: string; user: UserProfile; connectionCode?: { code: string; expiresAt: string } }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  setAuthToken(data.token);
  return data;
}

export async function switchDemoUserApi(role: 'patient' | 'caregiver') {
  const data = await request<{ token: string; user: UserProfile }>('/api/auth/switch-demo', {
    method: 'POST',
    body: JSON.stringify({ role }),
  });
  setAuthToken(data.token);
  return data;
}

export async function fetchCurrentUserApi(): Promise<{ user: UserProfile; connectionCode?: { code: string; expiresAt: string } }> {
  return request<{ user: UserProfile; connectionCode?: { code: string; expiresAt: string } }>('/api/auth/me');
}

// PATIENT CONNECTION CODES API
export async function fetchConnectionCodeApi(): Promise<{ code: string; expiresAt: string; createdAt?: string }> {
  return request<{ code: string; expiresAt: string; createdAt?: string }>('/api/patient/connection-code');
}

export async function generateConnectionCodeApi(): Promise<{ success: boolean; code: string; expiresAt: string }> {
  return request<{ success: boolean; code: string; expiresAt: string }>('/api/patient/connection-code/generate', {
    method: 'POST',
  });
}

export async function revokeConnectionCodeApi(): Promise<{ success: boolean; revoked: boolean }> {
  return request<{ success: boolean; revoked: boolean }>('/api/patient/connection-code/revoke', {
    method: 'POST',
  });
}

// MEDICATIONS API
export async function fetchMedicationsApi(patientId?: string): Promise<Medication[]> {
  const query = patientId ? `?patientId=${patientId}` : '';
  return request<Medication[]>(`/api/medications${query}`);
}

export async function createMedicationApi(med: Partial<Medication> & { patientId?: string }): Promise<Medication> {
  return request<Medication>('/api/medications', {
    method: 'POST',
    body: JSON.stringify(med),
  });
}

export async function updateMedicationApi(id: string, updates: Partial<Medication>): Promise<{ message: string; medication?: Medication }> {
  return request<{ message: string; medication?: Medication }>(`/api/medications/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
}

export async function deleteMedicationApi(id: string): Promise<{ message: string }> {
  return request<{ message: string }>(`/api/medications/${id}`, {
    method: 'DELETE',
  });
}

export async function logMedicationDoseApi(id: string, status: 'taken' | 'snoozed', takenAt?: string) {
  return request<{ success: boolean; medicationId: string; status: string }>(`/api/medications/${id}/log`, {
    method: 'POST',
    body: JSON.stringify({ status, takenAt }),
  });
}

// HYDRATION API
export async function fetchHydrationApi(patientId?: string): Promise<HydrationState> {
  const query = patientId ? `?patientId=${patientId}` : '';
  return request<HydrationState>(`/api/hydration${query}`);
}

export async function logHydrationApi(amountMl: number) {
  return request<{ id: string; amountMl: number; timestamp: string }>('/api/hydration/log', {
    method: 'POST',
    body: JSON.stringify({ amountMl }),
  });
}

// ACTIVITY API
export async function fetchActivityApi(patientId?: string): Promise<ActivityState> {
  const query = patientId ? `?patientId=${patientId}` : '';
  return request<ActivityState>(`/api/activity${query}`);
}

export async function recordActivitySessionApi(session: { addedSteps: number; addedMinutes: number; addedKm: number; addedCalories: number }) {
  return request<ActivityState>('/api/activity/session', {
    method: 'POST',
    body: JSON.stringify(session),
  });
}

// CAREGIVER API
export async function fetchLinkedPatientsApi(): Promise<UserProfile[]> {
  return request<UserProfile[]>('/api/caregiver/patients');
}

export async function linkPatientApi(connectionCode: string) {
  return request<{ success: boolean; message: string; patient: UserProfile }>('/api/caregiver/link-patient', {
    method: 'POST',
    body: JSON.stringify({ connectionCode: connectionCode.trim().toUpperCase() }),
  });
}

// ALERTS API
export async function fetchAlertsApi(patientId?: string): Promise<AlertItem[]> {
  const query = patientId ? `?patientId=${patientId}` : '';
  return request<AlertItem[]>(`/api/alerts${query}`);
}

export async function markAlertReviewedApi(id: string) {
  return request<{ success: boolean }>(`/api/alerts/${id}/review`, {
    method: 'PUT',
  });
}

export async function sendSOSApi(reason?: string) {
  return request<AlertItem>('/api/alerts/sos', {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

// ESCALATION API
export async function fetchEscalationRulesApi(patientId?: string): Promise<EscalationRules> {
  const query = patientId ? `?patientId=${patientId}` : '';
  return request<EscalationRules>(`/api/escalation${query}`);
}

export async function updateEscalationRulesApi(rules: Partial<EscalationRules>): Promise<{ success: boolean }> {
  return request<{ success: boolean }>('/api/escalation', {
    method: 'PUT',
    body: JSON.stringify(rules),
  });
}

// AI ASSISTANT API
export async function sendAssistantMessage(
  message: string,
  context: any
): Promise<{ reply: string }> {
  try {
    return await request<{ reply: string }>('/api/assistant', {
      method: 'POST',
      body: JSON.stringify({ message, context }),
    });
  } catch (error) {
    console.warn('API call failed, using client fallback:', error);
    const lower = message.toLowerCase();
    if (lower.includes('water') || lower.includes('drink')) {
      return { reply: `I've noted that. You are at ${context.hydration.current}L out of your ${context.hydration.goal}L goal!` };
    }
    if (lower.includes('medication') || lower.includes('medicine') || lower.includes('pill')) {
      return { reply: 'Your morning medication is logged. Your afternoon medication is scheduled for 1:00 PM.' };
    }
    if (lower.includes('walk') || lower.includes('step')) {
      return { reply: 'You have completed 4,821 steps! A short 10-minute stroll will help you hit your 5,000 step goal.' };
    }
    return { reply: `Good morning ${context.patientName || 'Alex'}! You are doing great today. Your CareScore is ${context.careScore}/100.` };
  }
}
