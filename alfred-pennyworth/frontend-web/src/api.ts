/// <reference types="vite/client" />

import { getToken, saveToken, saveUserId, clearSession } from './auth';

const BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1';

// Subscribers notified on 401 — App.tsx wires this to logout
type LogoutListener = () => void;
const logoutListeners = new Set<LogoutListener>();
export const onUnauthorized = (fn: LogoutListener) => {
  logoutListeners.add(fn);
  return () => logoutListeners.delete(fn);
};

/** All API calls go through here so the Authorization header is always attached. */
async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string>),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(input, { ...init, headers });

  if (res.status === 401) {
    clearSession();
    logoutListeners.forEach(fn => fn());
    throw new Error('Session expired. Please sign in again.');
  }

  return res;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export interface LoginParams   { username: string; password: string }
export interface AuthResponse  { access_token: string; token_type: string; user_id: number }

export interface RegisterParams { username: string; email: string; password: string }

export async function register({ username, email, password }: RegisterParams): Promise<AuthResponse> {
  const res = await fetch(`${BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, email, password }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail ?? 'Registration failed');
  }

  const data: AuthResponse = await res.json();
  saveToken(data.access_token);
  saveUserId(data.user_id);
  return data;
}

export async function login({ username, password }: LoginParams): Promise<AuthResponse> {
  const body = new URLSearchParams({ username, password, grant_type: 'password' });
  const res = await fetch(`${BASE}/auth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { detail?: string }).detail ?? 'Login failed');
  }

  const data: AuthResponse = await res.json();
  saveToken(data.access_token);
  saveUserId(data.user_id);
  return data;
}

// ─── Health ───────────────────────────────────────────────────────────────────

export async function getHealth() {
  const res = await apiFetch(`${BASE}/health/status`);
  return res.json();
}

// ─── Interventions ────────────────────────────────────────────────────────────

export async function getInterventions(userId: number) {
  const res = await apiFetch(`${BASE}/interventions?user_id=${userId}`);
  return res.json();
}

export async function generateIntervention(userId: number) {
  const res = await apiFetch(`${BASE}/interventions/generate?user_id=${userId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (res.status === 204) return { detail: 'No intervention needed at this time' };
  if (!res.ok) { const t = await res.text(); throw new Error(`${res.status} ${t}`); }
  return res.json();
}

export async function submitFeedback(interventionId: number, response: 'accepted' | 'snoozed') {
  const res = await apiFetch(`${BASE}/interventions/${interventionId}/feedback?response=${response}`, {
    method: 'POST',
  });
  return res.json();
}

// ─── Meals / Nutrition ────────────────────────────────────────────────────────

export interface ParsedIngredient {
  name: string; matched_key: string | null; amount_g: number; confidence: number;
}

export interface NutritionPreview {
  calories: number; protein_g: number; carbs_g: number; fat_g: number; fiber_g: number;
  confidence: number; method: 'template' | 'parsed' | 'fallback' | 'ai';
  dish_matched: string | null; ingredients: ParsedIngredient[];
}

export async function parseMeal(description: string, servings = 1): Promise<NutritionPreview> {
  const res = await apiFetch(`${BASE}/meals/parse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description, servings }),
  });
  if (!res.ok) throw new Error('Parse failed');
  return res.json();
}

export async function createMeal(userId: number, data: {
  meal_time: string; meal_type: string; description: string;
  calories?: number; protein_g?: number; carbs_g?: number; fat_g?: number; fiber_g?: number;
}) {
  const res = await apiFetch(`${BASE}/meals?user_id=${userId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function getMeals(userId: number): Promise<unknown[]> {
  try {
    const res = await apiFetch(`${BASE}/meals?user_id=${userId}&limit=50`);
    if (!res.ok) return [];
    return res.json();
  } catch { return []; }
}

export async function logWater(userId: number, waterMl: number) {
  const now = new Date().toISOString();
  const res = await apiFetch(`${BASE}/meals?user_id=${userId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      meal_time: now, meal_type: 'water',
      description: `Water intake: ${waterMl}ml`, water_ml: waterMl,
    }),
  });
  return res.json();
}

// ─── Sleep ────────────────────────────────────────────────────────────────────

export async function createSleep(userId: number, data: { sleep_start: string; sleep_end: string; quality_score?: number }) {
  const res = await apiFetch(`${BASE}/sleep?user_id=${userId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

// ─── Activity ─────────────────────────────────────────────────────────────────

export async function createActivity(userId: number, data: { activity_type: string; start_time: string; duration_minutes: number; calories_burned?: number }) {
  const res = await apiFetch(`${BASE}/activities?user_id=${userId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

export async function chatMessage(message: string, userId: number): Promise<{ reply: string }> {
  const res = await apiFetch(`${BASE}/chat?user_id=${userId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });
  if (!res.ok) throw new Error('Chat request failed');
  return res.json();
}
