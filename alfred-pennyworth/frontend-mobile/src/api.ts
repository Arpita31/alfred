// Base URL: set EXPO_PUBLIC_API_BASE_URL in .env, or defaults to local network
const BASE = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://192.168.0.80:8000/api/v1';

async function api(path: string, options?: RequestInit) {
  const response = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (response.status === 204) return { detail: 'No intervention needed at this time' };
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API error ${response.status}: ${text}`);
  }
  return response.json();
}

export const getHealth = () => api('/health/status');

export const generateIntervention = (userId: number) =>
  api(`/interventions/generate?user_id=${userId}`, { method: 'POST' });

export const submitFeedback = (interventionId: number, response: 'accepted' | 'snoozed') =>
  api(`/interventions/${interventionId}/feedback?response=${response}`, { method: 'POST' });

export const createMeal = (userId: number, data: {
  meal_time: string; meal_type: string; description: string;
  calories?: number; protein_g?: number; carbs_g?: number; fat_g?: number; fiber_g?: number;
}) => api(`/meals?user_id=${userId}`, { method: 'POST', body: JSON.stringify(data) });

export const getMeals = async (userId: number): Promise<any[]> => {
  try {
    const res = await fetch(`${BASE}/meals?user_id=${userId}&limit=50`);
    if (!res.ok) return [];
    return res.json();
  } catch { return []; }
};

export const parseMeal = (description: string, servings = 1) =>
  api('/meals/parse', { method: 'POST', body: JSON.stringify({ description, servings }) });

export const createSleep = (userId: number, data: {
  sleep_start: string; sleep_end: string; quality_score?: number;
}) => api(`/sleep?user_id=${userId}`, { method: 'POST', body: JSON.stringify(data) });

export const createActivity = (userId: number, data: {
  activity_type: string; start_time: string; duration_minutes: number; calories_burned?: number;
}) => api(`/activities?user_id=${userId}`, { method: 'POST', body: JSON.stringify(data) });

export const logWater = (userId: number, waterMl: number) => {
  const now = new Date().toISOString();
  return api(`/meals?user_id=${userId}`, {
    method: 'POST',
    body: JSON.stringify({
      meal_time: now, meal_type: 'water',
      description: `Water intake: ${waterMl}ml`, water_ml: waterMl,
    }),
  });
};

export const chatMessage = (message: string, userId: number): Promise<{ reply: string }> =>
  api(`/chat?user_id=${userId}`, { method: 'POST', body: JSON.stringify({ message }) });
