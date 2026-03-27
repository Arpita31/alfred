/// <reference types="vite/client" />

const BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1';

function queryString(params: Record<string, string | number | boolean>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => search.append(key, String(value)));
  return search.toString();
}

export async function getHealth() {
  const res = await fetch(`${BASE}/health/status`);
  return res.json();
}

export async function getInterventions(userId: number) {
  const res = await fetch(`${BASE}/interventions?user_id=${userId}`);
  return res.json();
}

export async function generateIntervention(userId: number) {
  const res = await fetch(`${BASE}/interventions/generate?user_id=${userId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (res.status === 204) {
    return { detail: 'No intervention needed at this time' };
  }

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Generate intervention failed: ${res.status} ${errText}`);
  }

  return res.json();
}

export interface ParsedIngredient {
  name: string;
  matched_key: string | null;
  amount_g: number;
  confidence: number;
}

export interface NutritionPreview {
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  confidence: number;
  method: 'template' | 'parsed' | 'fallback' | 'ai';
  dish_matched: string | null;
  ingredients: ParsedIngredient[];
}

export async function parseMeal(description: string, servings = 1): Promise<NutritionPreview> {
  const res = await fetch(`${BASE}/meals/parse`, {
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
  const res = await fetch(`${BASE}/meals?user_id=${userId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function createSleep(userId: number, data: { sleep_start: string; sleep_end: string; quality_score?: number }) {
  const res = await fetch(`${BASE}/sleep?user_id=${userId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function submitFeedback(interventionId: number, response: 'accepted' | 'snoozed') {
  const res = await fetch(`${BASE}/interventions/${interventionId}/feedback?response=${response}`, {
    method: 'POST',
  });
  return res.json();
}

export async function logWater(userId: number, waterMl: number) {
  const now = new Date().toISOString();
  const res = await fetch(`${BASE}/meals?user_id=${userId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      meal_time: now,
      meal_type: 'water',
      description: `Water intake: ${waterMl}ml`,
      water_ml: waterMl,
    }),
  });
  return res.json();
}

export async function createActivity(userId: number, data: { activity_type: string; start_time: string; duration_minutes: number; calories_burned?: number }) {
  const res = await fetch(`${BASE}/activities?user_id=${userId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function chatMessage(message: string, userId: number): Promise<{ reply: string }> {
  const res = await fetch(`${BASE}/chat?user_id=${userId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });
  if (!res.ok) throw new Error('Chat request failed');
  return res.json();
}

export async function getMeals(userId: number): Promise<any[]> {
  try {
    const res = await fetch(`${BASE}/meals?user_id=${userId}&limit=50`);
    if (!res.ok) return [];
    return res.json();
  } catch { return []; }
}
