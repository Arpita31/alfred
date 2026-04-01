import { ActivityIntensity } from '../types/health';
import { AssetLayer } from '../types/finance';

export const SLEEP_TAGS = [
  'Caffeine', 'Alcohol', 'Stress', 'Late workout', 'Screen time', 'Restless',
] as const;

export const SLEEP_QUALITY_OPTIONS = [
  { value: 2,  emoji: '😫', label: 'Terrible'  },
  { value: 4,  emoji: '😔', label: 'Poor'       },
  { value: 6,  emoji: '😐', label: 'Average'    },
  { value: 8,  emoji: '😊', label: 'Good'       },
  { value: 10, emoji: '✨', label: 'Excellent'  },
] as const;

export const MEAL_TYPES = ['Breakfast', 'Lunch', 'Dinner', 'Snack'] as const;

export const WATER_AMOUNTS = [150, 250, 350, 500] as const;

export const ACTIVITY_TYPE_CHIPS = [
  'running', 'walking', 'cycling', 'gym', 'yoga', 'swimming', 'hiit',
] as const;

export const ACTIVITY_PRESETS = [
  { label: 'Run 30m',  type: 'running', duration: 30 },
  { label: 'Walk 20m', type: 'walking', duration: 20 },
  { label: 'Gym 45m',  type: 'gym',     duration: 45 },
  { label: 'Yoga 30m', type: 'yoga',    duration: 30 },
] as const;

export const INTENSITY_OPTIONS: { value: ActivityIntensity; label: string; color: string }[] = [
  { value: 'low',      label: 'Low',      color: '#3fb950' },
  { value: 'moderate', label: 'Moderate', color: '#c9a84c' },
  { value: 'high',     label: 'High',     color: '#f85149' },
];

export const FINANCE_TABS = [
  { key: 'overview'  as const, label: 'Overview'   },
  { key: 'balance'   as const, label: 'Balance'    },
  { key: 'cashflow'  as const, label: 'Cash Flow'  },
  { key: 'fi'        as const, label: 'FI Tracker' },
] as const;

export const LAYER_META: { n: AssetLayer; label: string; sub: string; color: string }[] = [
  { n: 1, label: 'Operating',   sub: 'Monthly expenses only',     color: '#58a6ff' },
  { n: 2, label: 'Reserve',     sub: '3–6 month emergency fund',  color: '#3fb950' },
  { n: 3, label: 'Investments', sub: '401k, Roth IRA, brokerage', color: '#c9a84c' },
  { n: 4, label: 'Opportunity', sub: 'Crypto, startups, deals',   color: '#a78bfa' },
];

export const QUICK_CHAT_PROMPTS = [
  'How did I sleep?',
  'Am I on track today?',
  'Suggest a workout',
] as const;

export const NAP_DURATIONS = [15, 20, 30] as const;
