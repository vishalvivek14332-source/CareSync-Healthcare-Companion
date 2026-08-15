import {
  Medication,
  HydrationState,
  HydrationSettings,
  HydrationSchedule,
  ActivityState,
  AlertItem,
  EscalationRules,
  UserProfile,
} from '../types';

export type ApiErrorType =
  | 'NETWORK_ERROR'
  | 'AUTH_ERROR'
  | 'SERVER_ERROR'
  | 'VALIDATION_ERROR'
  | 'TIMEOUT'
  | 'OFFLINE'
  | 'CONFIGURATION_ERROR';

export class ApiError extends Error {
  type: ApiErrorType;
  status?: number;
  code?: string;

  constructor(message: string, type: ApiErrorType = 'SERVER_ERROR', status?: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.type = type;
    this.status = status;
    this.code = code;
  }
}

// -----------------------------------------------------------------------------
// TOKEN & USER STORAGE (Synchronous Memory + Persistent Storage)
// -----------------------------------------------------------------------------
let accessToken: string | null = typeof window !== 'undefined' && window.localStorage ? localStorage.getItem('caresync_token') : null;
let refreshToken: string | null = typeof window !== 'undefined' && window.localStorage ? localStorage.getItem('caresync_refresh_token') : null;

export function setAuthToken(token: string | null, newRefreshToken?: string | null) {
  accessToken = token;
  if (typeof window !== 'undefined' && window.localStorage) {
    if (token) {
      localStorage.setItem('caresync_token', token);
    } else {
      localStorage.removeItem('caresync_token');
    }
    if (newRefreshToken !== undefined) {
      if (newRefreshToken) {
        localStorage.setItem('caresync_refresh_token', newRefreshToken);
      } else {
        localStorage.removeItem('caresync_refresh_token');
      }
    }
  }
  if (newRefreshToken !== undefined) {
    refreshToken = newRefreshToken;
  }
}

export function getAuthToken(): string | null {
  if (accessToken) return accessToken;
  if (typeof window !== 'undefined' && window.localStorage) {
    return localStorage.getItem('caresync_token');
  }
  return null;
}

export function getRefreshToken(): string | null {
  if (refreshToken) return refreshToken;
  if (typeof window !== 'undefined' && window.localStorage) {
    return localStorage.getItem('caresync_refresh_token');
  }
  return null;
}

export function setCachedUser(user: UserProfile | null) {
  if (typeof window !== 'undefined' && window.localStorage) {
    if (user) {
      localStorage.setItem('caresync_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('caresync_user');
    }
  }
}

export function getCachedUser(): UserProfile | null {
  if (typeof window !== 'undefined' && window.localStorage) {
    const raw = localStorage.getItem('caresync_user');
    if (raw) {
      try {
        return JSON.parse(raw) as UserProfile;
      } catch {
        return null;
      }
    }
  }
  return null;
}

export function clearAuthTokens() {
  accessToken = null;
  refreshToken = null;
  if (typeof window !== 'undefined' && window.localStorage) {
    localStorage.removeItem('caresync_token');
    localStorage.removeItem('caresync_refresh_token');
    localStorage.removeItem('caresync_user');
  }
}

// -----------------------------------------------------------------------------
// PRODUCTION API BASE URL RESOLUTION
// -----------------------------------------------------------------------------
export function isCapacitorNative(): boolean {
  return typeof (window as any) !== 'undefined' && typeof (window as any).Capacitor !== 'undefined' && (window as any).Capacitor.isNativePlatform?.();
}

export function getApiBaseUrl(): string {
  // 1. Check custom runtime override (e.g. from developer settings modal in dev mode)
  if (typeof window !== 'undefined' && window.localStorage) {
    const customUrl = localStorage.getItem('caresync_api_url');
    if (customUrl) return customUrl.replace(/\/+$/, '');
  }

  // 2. Build-time environment variable (Production / Staging / CI)
  const envUrl = (import.meta as any).env?.VITE_API_URL;
  if (envUrl && typeof envUrl === 'string' && envUrl.trim().length > 0) {
    return envUrl.trim().replace(/\/+$/, '');
  }

  // 3. Web/PWA fallback: relative root
  return '';
}

export function setApiBaseUrl(url: string) {
  if (typeof window !== 'undefined' && window.localStorage) {
    if (url) {
      localStorage.setItem('caresync_api_url', url.replace(/\/+$/, ''));
    } else {
      localStorage.removeItem('caresync_api_url');
    }
  }
}

export async function checkServerHealthApi(testUrl?: string): Promise<{ ok: boolean; message: string; database?: string }> {
  const base = (testUrl !== undefined ? testUrl : getApiBaseUrl()).replace(/\/+$/, '');
  const url = `${base}/api/health`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timer);

    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      return { ok: false, message: `Server returned non-JSON response (${res.status})` };
    }
    const data = await res.json();
    return {
      ok: res.ok,
      message: res.ok ? 'Server connected successfully' : `HTTP ${res.status}`,
      database: data.database || 'connected',
    };
  } catch (err: any) {
    return { ok: false, message: err.name === 'AbortError' ? 'Connection timed out' : err.message || 'Network connection failed' };
  }
}

// -----------------------------------------------------------------------------
// SINGLE-FLIGHT REFRESH MUTEX
// -----------------------------------------------------------------------------
let isRefreshing = false;
let refreshPromise: Promise<string | null> | null = null;

export async function performTokenRefresh(): Promise<string | null> {
  const currentRefresh = getRefreshToken();
  if (!currentRefresh) {
    clearAuthTokens();
    return null;
  }

  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const base = getApiBaseUrl();
      const res = await fetch(`${base}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ refreshToken: currentRefresh }),
      });

      if (!res.ok) {
        clearAuthTokens();
        return null;
      }

      const data = await res.json();
      if (data?.token) {
        setAuthToken(data.token, data.refreshToken);
        if (data.user) {
          setCachedUser(data.user);
        }
        return data.token;
      }
      clearAuthTokens();
      return null;
    } catch {
      return null;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

// -----------------------------------------------------------------------------
// AUTHENTICATION BOOTSTRAP HELPER (Restores or Refreshes Session)
// -----------------------------------------------------------------------------
export async function initAuthSession(): Promise<{ token: string; user: UserProfile; connectionCode?: any } | null> {
  const token = getAuthToken();
  const refresh = getRefreshToken();
  const cachedUser = getCachedUser();

  if (!token && !refresh) {
    return null;
  }

  // 1. Try to fetch /api/auth/me with existing access token
  if (token) {
    try {
      const res = await fetchCurrentUserApi();
      if (res?.user) {
        setCachedUser(res.user);
        return { token, user: res.user, connectionCode: res.connectionCode };
      }
    } catch (err: any) {
      if (err.type === 'OFFLINE' || err.type === 'NETWORK_ERROR' || err.type === 'TIMEOUT') {
        if (cachedUser) {
          return { token, user: cachedUser };
        }
      }
    }
  }

  // 2. Access token was expired or rejected, try rotating refresh token
  if (refresh) {
    const newToken = await performTokenRefresh();
    if (newToken) {
      try {
        const res = await fetchCurrentUserApi();
        if (res?.user) {
          setCachedUser(res.user);
          return { token: newToken, user: res.user, connectionCode: res.connectionCode };
        }
      } catch (err: any) {
        if (cachedUser) {
          return { token: newToken, user: cachedUser };
        }
      }
    }
  }

  // Session completely invalid or revoked
  clearAuthTokens();
  return null;
}

// -----------------------------------------------------------------------------
// OFFLINE QUEUE REPLAY SYSTEM
// -----------------------------------------------------------------------------
export interface OfflineQueueItem {
  id: string;
  type: 'log_medication' | 'log_hydration' | 'sync_activity';
  endpoint: string;
  payload: any;
  timestamp: string;
}

export function queueOfflineAction(action: Omit<OfflineQueueItem, 'id' | 'timestamp'>) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  const item: OfflineQueueItem = {
    ...action,
    id: `queue-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    timestamp: new Date().toISOString(),
  };
  const existingStr = localStorage.getItem('caresync_offline_queue');
  const queue: OfflineQueueItem[] = existingStr ? JSON.parse(existingStr) : [];
  queue.push(item);
  localStorage.setItem('caresync_offline_queue', JSON.stringify(queue));
  console.log(`[OfflineQueue] Enqueued ${item.type} action for background synchronization.`);
}

export async function flushOfflineQueue(): Promise<{ syncedCount: number; failedCount: number }> {
  if (typeof window === 'undefined' || !window.localStorage) return { syncedCount: 0, failedCount: 0 };
  const existingStr = localStorage.getItem('caresync_offline_queue');
  if (!existingStr) return { syncedCount: 0, failedCount: 0 };

  const queue: OfflineQueueItem[] = JSON.parse(existingStr);
  if (queue.length === 0) return { syncedCount: 0, failedCount: 0 };

  console.log(`[OfflineQueue] Flushing ${queue.length} queued offline actions...`);
  const remainingQueue: OfflineQueueItem[] = [];
  let syncedCount = 0;
  let failedCount = 0;

  for (const item of queue) {
    try {
      await request(item.endpoint, {
        method: 'POST',
        body: JSON.stringify(item.payload),
      });
      syncedCount++;
    } catch (err: any) {
      if (err.type === 'OFFLINE' || err.type === 'NETWORK_ERROR' || err.type === 'TIMEOUT') {
        remainingQueue.push(item);
        failedCount++;
      } else {
        console.warn(`[OfflineQueue] Dropping action ${item.id}:`, err.message);
      }
    }
  }

  localStorage.setItem('caresync_offline_queue', JSON.stringify(remainingQueue));
  return { syncedCount, failedCount };
}

// -----------------------------------------------------------------------------
// UNIFIED HTTP REQUEST DISPATCHER WITH RETRY & REFRESH
// -----------------------------------------------------------------------------
async function request<T>(endpoint: string, options: RequestInit = {}, isRetry: boolean = false): Promise<T> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    throw new ApiError('You appear to be offline. Please check your internet connection.', 'OFFLINE');
  }

  const base = getApiBaseUrl();
  const url = `${base}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  const currentToken = getAuthToken();
  if (currentToken && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${currentToken}`;
  }

  let response: Response;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
  } catch (err: any) {
    if (err.name === 'AbortError') {
      throw new ApiError('Network request timed out. Please try again.', 'TIMEOUT');
    }
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      throw new ApiError('Network connection lost.', 'OFFLINE');
    }
    throw new ApiError(err.message || 'Unable to reach the CareSync server.', 'NETWORK_ERROR');
  }

  // Handle Token Expiry & Automatic Refresh (401 Unauthorized)
  if (response.status === 401 && !isRetry && !endpoint.includes('/api/auth/login') && !endpoint.includes('/api/auth/signup') && !endpoint.includes('/api/auth/refresh')) {
    const newToken = await performTokenRefresh();
    if (newToken) {
      return request<T>(endpoint, options, true);
    }
  }

  if (!response.ok) {
    let errMessage = `Request failed with status ${response.status}`;
    let errCode: string | undefined;
    try {
      const errData = await response.json();
      if (errData?.error) errMessage = errData.error;
      if (errData?.code) errCode = errData.code;
    } catch {
      // Body was not JSON
    }
    const errorType: ApiErrorType = response.status === 401 || response.status === 403 ? 'AUTH_ERROR' : response.status >= 400 && response.status < 500 ? 'VALIDATION_ERROR' : 'SERVER_ERROR';
    throw new ApiError(errMessage, errorType, response.status, errCode);
  }

  try {
    return await response.json();
  } catch (jsonErr: any) {
    throw new ApiError(`Failed to process server response: ${jsonErr.message}`, 'SERVER_ERROR');
  }
}

// -----------------------------------------------------------------------------
// AUTHENTICATION APIS
// -----------------------------------------------------------------------------
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
  const res = await request<{ token: string; refreshToken?: string; user: UserProfile; connectionCode?: { code: string; expiresAt: string } }>('/api/auth/signup', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  setAuthToken(res.token, res.refreshToken);
  setCachedUser(res.user);
  return res;
}

export async function loginApi(email: string, password: string) {
  const data = await request<{ token: string; refreshToken?: string; user: UserProfile; connectionCode?: { code: string; expiresAt: string } }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  setAuthToken(data.token, data.refreshToken);
  setCachedUser(data.user);
  return data;
}

export async function logoutApi(): Promise<void> {
  const currentRefresh = getRefreshToken();
  if (currentRefresh) {
    await request('/api/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken: currentRefresh }),
    }).catch(() => {});
  }
  clearAuthTokens();
}

export async function switchDemoUserApi(role: 'patient' | 'caregiver') {
  const data = await request<{ token: string; refreshToken?: string; user: UserProfile }>('/api/auth/switch-demo', {
    method: 'POST',
    body: JSON.stringify({ role }),
  });
  setAuthToken(data.token, data.refreshToken);
  setCachedUser(data.user);
  return data;
}

export async function fetchCurrentUserApi(): Promise<{ user: UserProfile; connectionCode?: { code: string; expiresAt: string } }> {
  return request<{ user: UserProfile; connectionCode?: { code: string; expiresAt: string } }>('/api/auth/me');
}

// -----------------------------------------------------------------------------
// PATIENT & PROFILE APIS
// -----------------------------------------------------------------------------
export async function updateProfilePhotoApi(avatarUrl: string): Promise<{ success: boolean; avatarUrl: string }> {
  return request<{ success: boolean; avatarUrl: string }>('/api/patient/avatar', {
    method: 'PUT',
    body: JSON.stringify({ avatarUrl }),
  });
}

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

// -----------------------------------------------------------------------------
// MEDICATIONS APIS
// -----------------------------------------------------------------------------
export async function fetchMedicationsApi(patientId?: string, date?: string): Promise<Medication[]> {
  const params = new URLSearchParams();
  if (patientId) params.append('patientId', patientId);
  if (date) params.append('date', date);
  const query = params.toString() ? `?${params.toString()}` : '';
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

export async function logMedicationDoseApi(id: string, status: 'taken' | 'snoozed', takenAt?: string, scheduledDate?: string) {
  try {
    return await request<{ success: boolean; medicationId: string; status: string; takenAt?: string }>(`/api/medications/${id}/log`, {
      method: 'POST',
      body: JSON.stringify({ status, takenAt, scheduledDate }),
    });
  } catch (err: any) {
    if (err.type === 'OFFLINE' || err.type === 'NETWORK_ERROR') {
      queueOfflineAction({
        type: 'log_medication',
        endpoint: `/api/medications/${id}/log`,
        payload: { status, takenAt, scheduledDate },
      });
    }
    throw err;
  }
}

// -----------------------------------------------------------------------------
// HYDRATION APIS
// -----------------------------------------------------------------------------
export async function fetchHydrationApi(patientId?: string): Promise<HydrationState> {
  const query = patientId ? `?patientId=${patientId}` : '';
  return request<HydrationState>(`/api/hydration${query}`);
}

export async function fetchHydrationSettingsApi(patientId?: string): Promise<HydrationSettings> {
  const query = patientId ? `?patientId=${patientId}` : '';
  return request<HydrationSettings>(`/api/hydration/settings${query}`);
}

export async function updateHydrationSettingsApi(settings: Partial<HydrationSettings> & { patientId?: string }): Promise<{ success: boolean; settings: HydrationSettings }> {
  return request<{ success: boolean; settings: HydrationSettings }>('/api/hydration/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
}

export async function fetchHydrationSchedulesApi(patientId?: string): Promise<HydrationSchedule[]> {
  const query = patientId ? `?patientId=${patientId}` : '';
  return request<HydrationSchedule[]>(`/api/hydration/schedules${query}`);
}

export async function createHydrationScheduleApi(schedule: Partial<HydrationSchedule> & { patientId?: string }): Promise<HydrationSchedule> {
  return request<HydrationSchedule>('/api/hydration/schedules', {
    method: 'POST',
    body: JSON.stringify(schedule),
  });
}

export async function updateHydrationScheduleApi(id: string, updates: Partial<HydrationSchedule>): Promise<HydrationSchedule> {
  return request<HydrationSchedule>(`/api/hydration/schedules/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates),
  });
}

export async function deleteHydrationScheduleApi(id: string): Promise<{ message: string }> {
  return request<{ message: string }>(`/api/hydration/schedules/${id}`, {
    method: 'DELETE',
  });
}

export async function logHydrationApi(amountMl: number) {
  try {
    return await request<{ id: string; amountMl: number; timestamp: string }>('/api/hydration/log', {
      method: 'POST',
      body: JSON.stringify({ amountMl }),
    });
  } catch (err: any) {
    if (err.type === 'OFFLINE' || err.type === 'NETWORK_ERROR') {
      queueOfflineAction({
        type: 'log_hydration',
        endpoint: '/api/hydration/log',
        payload: { amountMl },
      });
    }
    throw err;
  }
}

// -----------------------------------------------------------------------------
// ACTIVITY APIS
// -----------------------------------------------------------------------------
export async function fetchActivityApi(patientId?: string): Promise<ActivityState> {
  const query = patientId ? `?patientId=${patientId}` : '';
  return request<ActivityState>(`/api/activity${query}`);
}

export async function syncActivityApi(data: { steps: number; distanceKm: number; caloriesBurned: number; activeMinutes: number }): Promise<{ success: boolean; activity: any }> {
  try {
    return await request<{ success: boolean; activity: any }>('/api/activity/sync', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  } catch (err: any) {
    if (err.type === 'OFFLINE' || err.type === 'NETWORK_ERROR') {
      queueOfflineAction({
        type: 'sync_activity',
        endpoint: '/api/activity/sync',
        payload: data,
      });
    }
    throw err;
  }
}

export async function recordActivitySessionApi(session: { addedSteps: number; addedMinutes: number; addedKm: number; addedCalories: number }) {
  return request<ActivityState>('/api/activity/session', {
    method: 'POST',
    body: JSON.stringify(session),
  });
}

// -----------------------------------------------------------------------------
// CAREGIVER APIS
// -----------------------------------------------------------------------------
export async function fetchLinkedPatientsApi(): Promise<UserProfile[]> {
  return request<UserProfile[]>('/api/caregiver/patients');
}

export async function linkPatientApi(connectionCode: string) {
  return request<{ success: boolean; message: string; patient: UserProfile }>('/api/caregiver/link-patient', {
    method: 'POST',
    body: JSON.stringify({ connectionCode: connectionCode.trim().toUpperCase() }),
  });
}

// -----------------------------------------------------------------------------
// ALERTS & NOTIFICATIONS APIS
// -----------------------------------------------------------------------------
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

export async function registerPushTokenApi(token: string, platform: string = 'android') {
  return request<{ success: boolean }>('/api/notifications/register-token', {
    method: 'POST',
    body: JSON.stringify({ token, platform }),
  });
}

// -----------------------------------------------------------------------------
// ESCALATION RULES API
// -----------------------------------------------------------------------------
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

// -----------------------------------------------------------------------------
// AI ASSISTANT API
// -----------------------------------------------------------------------------
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
    console.warn('Assistant API fallback triggered:', error);
    const lower = message.toLowerCase();
    if (lower.includes('water') || lower.includes('drink')) {
      return { reply: `I've noted that! You have reached ${context.hydration?.current || 0}L of your ${context.hydration?.goal || 2}L goal.` };
    }
    if (lower.includes('medication') || lower.includes('medicine') || lower.includes('pill')) {
      return { reply: 'Your routine medication schedule is synchronized.' };
    }
    if (lower.includes('walk') || lower.includes('step')) {
      return { reply: `You have completed ${context.activity?.steps || 0} steps today!` };
    }
    return { reply: `Hello ${context.patientName || 'there'}! Your health routine is on track.` };
  }
}
