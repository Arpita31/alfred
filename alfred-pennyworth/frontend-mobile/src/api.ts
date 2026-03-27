const BASE = 'http://192.168.0.80:8000/api/v1';

async function api(path: string, options?: RequestInit) {
  const response = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  if (response.status === 204) {
    return { detail: 'No intervention needed at this time' };
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API error ${response.status}: ${text}`);
  }

  return response.json();
}

export const getHealth = () => api('/health/status');
export const generateIntervention = (userId: number) => api(`/interventions/generate?user_id=${userId}`, { method: 'POST' });
export const createMeal = (userId: number, data: any) => api(`/meals?user_id=${userId}`, { method: 'POST', body: JSON.stringify(data) });
export const createSleep = (userId: number, data: any) => api(`/sleep?user_id=${userId}`, { method: 'POST', body: JSON.stringify(data) });
export const createActivity = (userId: number, data: any) => api(`/activities?user_id=${userId}`, { method: 'POST', body: JSON.stringify(data) });
