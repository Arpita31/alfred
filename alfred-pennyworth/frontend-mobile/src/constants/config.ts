export const USER_ID = 1;

const _rawUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
if (__DEV__ && !_rawUrl) {
  console.warn(
    '[Alfred] EXPO_PUBLIC_API_BASE_URL is not set.\n' +
    'Copy .env.example → .env and set your local IP.\n' +
    'Falling back to localhost (will fail on a physical device).',
  );
}
export const BASE_URL = _rawUrl ?? 'http://localhost:8000/api/v1';
export const DEFAULT_WATER_GOAL  = 2000;   // ml
export const MAX_WATER_GOAL      = 3500;   // ml
export const SLEEP_TARGET_HOURS  = 7.5;
export const HISTORY_LIMIT_SLEEP = 60;
export const HISTORY_LIMIT_ACT   = 90;
export const HISTORY_LIMIT_WATER = 60;
export const INSIGHT_REFRESH_MS  = 5 * 60 * 1000;
