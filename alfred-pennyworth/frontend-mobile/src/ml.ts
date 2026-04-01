// ─── Shared ML utilities (identical logic to web, platform-agnostic) ──────────

// ── Sleep ──────────────────────────────────────────────────────────────────

export type SleepRecord = {
  date: string; start: string; end: string;
  hours: number; quality: number; score: number; tags: string[];
};

export const SLEEP_TAGS = ['Caffeine', 'Alcohol', 'Stress', 'Late workout', 'Screen time', 'Restless'];

export function calcSleepScore(hours: number, quality: number, history: SleepRecord[]): number {
  const dur  = hours >= 7 && hours <= 9 ? 40 : hours >= 6.5 ? 32 : hours >= 6 ? 22 : hours >= 5 ? 10 : 0;
  const qual = Math.round((quality / 10) * 30);
  let cons   = 15;
  if (history.length >= 3) {
    const beds = history.slice(0, 7).map(r => { const h = new Date(r.start).getHours(); return h < 12 ? h + 24 : h; });
    const avg  = beds.reduce((a, b) => a + b, 0) / beds.length;
    const sd   = Math.sqrt(beds.reduce((a, b) => a + (b - avg) ** 2, 0) / beds.length);
    cons = Math.max(0, Math.round(20 - sd * 4));
  }
  const bonus = hours >= 7.5 && hours <= 8.5 ? 10 : hours >= 7 ? 5 : 0;
  return Math.min(100, dur + qual + cons + bonus);
}

export function calcSleepDebt(history: SleepRecord[]): number {
  const r = history.slice(0, 7);
  return r.length ? Math.max(0, Math.round(r.reduce((a, e) => a + Math.max(0, 7.5 - e.hours), 0) * 10) / 10) : 0;
}

export function getChronotype(history: SleepRecord[]): string | null {
  if (history.length < 5) return null;
  const beds = history.slice(0, 14).map(r => { const h = new Date(r.start).getHours(); return h < 12 ? h + 24 : h; });
  const avg  = beds.reduce((a, b) => a + b, 0) / beds.length;
  return avg < 22.5 ? 'Early bird' : avg > 25 ? 'Night owl' : 'Intermediate';
}

export function getBedtimeRec(history: SleepRecord[]): string {
  if (history.length < 3) return '11:00 PM';
  const wakes = history.slice(0, 7).map(r => { const d = new Date(r.end); return d.getHours() + d.getMinutes() / 60; });
  const avg   = wakes.reduce((a, b) => a + b, 0) / wakes.length;
  const bed   = ((avg - 8) + 24) % 24;
  const h     = Math.floor(bed), m = Math.round((bed - h) * 60);
  const h12   = bed > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${h12}:${m.toString().padStart(2, '0')} ${bed >= 12 && bed < 24 ? 'PM' : 'AM'}`;
}

export function sleepTrend(history: SleepRecord[]): { dir: 'up'|'down'|'flat'; desc: string; color: string } {
  if (history.length < 6) return { dir: 'flat', desc: 'Not enough data', color: '#7a8899' };
  const recent = history.slice(0, 3).reduce((s, r) => s + r.score, 0) / 3;
  const older  = history.slice(3, 6).reduce((s, r) => s + r.score, 0) / 3;
  const delta  = Math.round(recent - older);
  if (delta >  4) return { dir: 'up',   desc: `Improving (+${delta} pts)`, color: '#3fb950' };
  if (delta < -4) return { dir: 'down', desc: `Declining (${delta} pts)`,  color: '#f85149' };
  return             { dir: 'flat', desc: 'Stable',                         color: '#7a8899' };
}

export function tagImpactMap(history: SleepRecord[]): Record<string, number> {
  if (history.length < 4) return {};
  const overall = history.reduce((s, r) => s + r.quality, 0) / history.length;
  const result: Record<string, number> = {};
  SLEEP_TAGS.forEach(tag => {
    const hits = history.filter(r => r.tags.includes(tag));
    if (hits.length < 2) return;
    result[tag] = Math.round((hits.reduce((s, r) => s + r.quality, 0) / hits.length - overall) * 10) / 10;
  });
  return result;
}

export function predictSleepQuality(
  tags: string[], hours: number,
  history: SleepRecord[], impacts: Record<string, number>,
): number | null {
  if (history.length < 3) return null;
  let base = history.slice(0, 7).reduce((s, r) => s + r.quality, 0) / Math.min(7, history.length);
  tags.forEach(tag => { if (impacts[tag] !== undefined) base += impacts[tag]; });
  if (hours >= 7.5 && hours <= 8.5) base += 0.5;
  else if (hours > 0 && hours < 6.5) base -= 1.0;
  else if (hours > 0 && hours < 5.5) base -= 2.0;
  return Math.max(1, Math.min(10, Math.round(base * 10) / 10));
}

export function fmtDur(h: number): string {
  const hh = Math.floor(h), mm = Math.round((h - hh) * 60);
  return mm > 0 ? `${hh}h ${mm}m` : `${hh}h`;
}

// ── Activity ───────────────────────────────────────────────────────────────

export type ActivityRecord = {
  date: string; type: string; duration: number;
  calories: number; intensity: 'low' | 'moderate' | 'high'; start: string;
};

export const ACT_MET: Record<string, number> = {
  running: 9.8, jogging: 7.0, walking: 3.5, cycling: 7.5, biking: 7.5,
  gym: 5.0, yoga: 2.5, swimming: 7.0, hiit: 10.0, pilates: 3.0,
  stretching: 2.3, dancing: 5.5, boxing: 9.0, rowing: 7.0,
};
export const ACT_INTENSITY: Record<string, 'low'|'moderate'|'high'> = {
  running: 'high', jogging: 'moderate', walking: 'low', cycling: 'moderate', biking: 'moderate',
  gym: 'moderate', yoga: 'low', swimming: 'high', hiit: 'high', pilates: 'low',
  stretching: 'low', dancing: 'moderate', boxing: 'high', rowing: 'high',
};
export const ACT_ICONS: Record<string, string> = {
  running: '🏃', jogging: '🏃', walking: '🚶', cycling: '🚴', biking: '🚴',
  gym: '🏋️', yoga: '🧘', swimming: '🏊', hiit: '🔥', pilates: '🧘',
  stretching: '🤸', dancing: '💃', boxing: '🥊', rowing: '🚣',
};

export function actCalories(type: string, durationMin: number): number {
  const met = ACT_MET[type.toLowerCase()] ?? 5.0;
  return Math.round((met * 70 * durationMin) / 60);
}
export function actIntensity(type: string): 'low'|'moderate'|'high' {
  return ACT_INTENSITY[type.toLowerCase()] ?? 'moderate';
}
export function actIcon(type: string): string {
  return ACT_ICONS[type.toLowerCase()] ?? '⚡';
}

export function parseActivityText(text: string): { type: string; duration: number } {
  const lower = text.toLowerCase();
  let duration = 0;
  const minM = lower.match(/(\d+(?:\.\d+)?)\s*min/);
  const hrM  = lower.match(/(\d+(?:\.\d+)?)\s*h(?:our)?/);
  const kmM  = lower.match(/(\d+(?:\.\d+)?)\s*km/);
  if (minM) duration = Math.round(parseFloat(minM[1]));
  else if (hrM) duration = Math.round(parseFloat(hrM[1]) * 60);
  else if (kmM) duration = Math.round(parseFloat(kmM[1]) * 6);
  const TYPES = ['running','jogging','walking','cycling','biking','swimming','yoga','hiit','pilates','boxing','rowing','gym'];
  const type = TYPES.find(t => lower.includes(t)) ??
    (lower.includes('run') ? 'running' : lower.includes('walk') ? 'walking' :
     lower.includes('bike') || lower.includes('cycle') ? 'cycling' : '');
  return { type, duration };
}

export function actTrainingLoad(history: ActivityRecord[]): number {
  const M = { high: 3, moderate: 2, low: 1 };
  return history.slice(0, 7).reduce((s, r) => s + r.duration * (M[r.intensity] ?? 2), 0);
}

export function actStreak(history: ActivityRecord[], todayStr: string): number {
  if (!history.length) return 0;
  const dates = new Set(history.map(r => r.date));
  let streak = 0;
  const d = new Date();
  if (!dates.has(todayStr)) d.setDate(d.getDate() - 1);
  for (let i = 0; i < 30; i++) {
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    if (!dates.has(key)) break;
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

export function actRecovery(history: ActivityRecord[], sleepHours: number | null): { label: string; score: number; color: string } {
  const load = actTrainingLoad(history);
  const now  = Date.now();
  const highRecent = history.filter(r => r.intensity === 'high' && now - new Date(r.start).getTime() < 3 * 86400_000).length;
  let score = 100 - Math.min(35, load / 25) - highRecent * 8;
  if (sleepHours !== null) score += sleepHours >= 7 ? 5 : sleepHours < 6 ? -20 : -8;
  score = Math.max(0, Math.min(100, Math.round(score)));
  if (score >= 75) return { label: 'Well Rested',  score, color: '#3fb950' };
  if (score >= 50) return { label: 'Moderate',     score, color: '#c9a84c' };
  return               { label: 'Needs Rest',    score, color: '#f85149' };
}

export function actCoachingTips(intensity: 'low'|'moderate'|'high', recovery: { score: number }, sleepHours: number | null): string[] {
  const tips: string[] = [];
  if (intensity === 'high' && recovery.score < 50) tips.push('Recovery is low — consider reducing intensity.');
  if (intensity === 'high') tips.push('High intensity → protein intake recommended post-workout.');
  if (intensity === 'high') tips.push('Hydrate +500 ml above daily goal.');
  if (intensity === 'low')  tips.push('Light activity — great choice for a recovery day.');
  if (sleepHours !== null && sleepHours < 6 && intensity === 'high') tips.push('Poor sleep detected — performance may be reduced.');
  return tips.slice(0, 2);
}

export function actWeekOverWeek(history: ActivityRecord[]): { thisWeek: number; lastWeek: number; pct: number; dir: 'up'|'down'|'flat' } {
  const now = Date.now();
  let thisWeek = 0, lastWeek = 0;
  history.forEach(r => {
    const daysAgo = (now - new Date(r.start).getTime()) / 86400_000;
    if (daysAgo < 7) thisWeek += r.duration;
    else if (daysAgo < 14) lastWeek += r.duration;
  });
  if (!lastWeek) return { thisWeek, lastWeek, pct: 0, dir: thisWeek > 0 ? 'up' : 'flat' };
  const pct = Math.round(((thisWeek - lastWeek) / lastWeek) * 100);
  return { thisWeek, lastWeek, pct, dir: pct > 5 ? 'up' : pct < -5 ? 'down' : 'flat' };
}

export function actPersonalBaseline(type: string, history: ActivityRecord[]): number | null {
  if (!type) return null;
  const recs = history.filter(r => r.type.toLowerCase() === type.toLowerCase());
  if (recs.length < 2) return null;
  return Math.round(recs.reduce((s, r) => s + r.duration, 0) / recs.length);
}

export function actNextWorkoutSuggestion(history: ActivityRecord[], recovery: { score: number }): string {
  if (!history.length) return 'Start with a 20-min walk — builds the habit.';
  const last = history[0];
  const daysAgo = (Date.now() - new Date(last.start).getTime()) / 86400_000;
  if (daysAgo > 3) return `Last session was ${Math.floor(daysAgo)} days ago — any movement counts.`;
  if (last.intensity === 'high' && recovery.score < 55)
    return 'Hard session + low recovery → active recovery: walk, stretch, or yoga.';
  if (last.intensity === 'high' && recovery.score >= 55)
    return 'Good recovery → moderate effort; skip back-to-back high intensity.';
  if (last.type === 'running' || last.type === 'jogging')
    return 'Alternate with strength or yoga to balance muscle groups.';
  if (last.intensity === 'low')
    return 'Light session done → push a bit harder today if energy allows.';
  return 'Consistency beats intensity — any 20+ min session keeps your streak alive.';
}

// ── Hydration ML ───────────────────────────────────────────────────────────

export type WaterHistory = { date: string; totalMl: number; goalMl: number };

export function dynamicGoal(activityMinutesToday: number, lastSleepHours: number | null, lastSleepQuality: number | null): number {
  let goal = 2000;
  if (activityMinutesToday >= 60) goal += 500;
  else if (activityMinutesToday >= 30) goal += 250;
  if (lastSleepHours !== null && lastSleepHours < 6) goal += 200;
  else if (lastSleepHours !== null && lastSleepHours < 7) goal += 100;
  if (lastSleepQuality !== null && lastSleepQuality < 5) goal += 150;
  return Math.min(3500, goal);
}

export function predictFinalMl(totalMl: number, history: WaterHistory[]): number {
  const hour = new Date().getHours();
  const pace = hour > 0 ? (totalMl / hour) * 24 : 0;
  const avg14 = history.length > 0
    ? history.slice(0, 14).reduce((s, d) => s + d.totalMl, 0) / history.slice(0, 14).length
    : 2000;
  return Math.round(pace * 0.6 + avg14 * 0.4);
}

export function hydrationConsistency(history: WaterHistory[], goal: number): number {
  const last14 = history.slice(0, 14);
  if (!last14.length) return 0;
  const hits = last14.filter(d => d.totalMl >= goal * 0.8).length;
  return Math.round((hits / last14.length) * 100);
}

// ── Finance Engine ─────────────────────────────────────────────────────────

export type AssetLayer = 1 | 2 | 3 | 4;
export type AssetType  = 'checking'|'savings'|'brokerage'|'401k'|'roth_ira'|'hsa'|'crypto'|'real_estate'|'equity'|'startup'|'other';
export type IncomeType = 'salary'|'freelance'|'dividends'|'rental'|'business'|'other';
export type ExpCat     = 'housing'|'food'|'transport'|'utilities'|'subscriptions'|'health'|'entertainment'|'other';

export interface Asset        { id: string; name: string; value: number; type: AssetType; layer: AssetLayer; }
export interface Liability    { id: string; name: string; balance: number; rate: number; }
export interface IncomeStream { id: string; name: string; monthlyAmount: number; type: IncomeType; isPassive: boolean; }
export interface Expense      { id: string; name: string; monthlyAmount: number; category: ExpCat; isFixed: boolean; }
export interface NWSnapshot   { date: string; value: number; }
export interface AllocationTargets { core: number; growth: number; asymmetric: number; }
export interface FinanceState {
  assets: Asset[]; liabilities: Liability[]; income: IncomeStream[];
  expenses: Expense[]; nwHistory: NWSnapshot[]; allocation: AllocationTargets;
}

export function calcNetWorth(assets: Asset[], liabilities: Liability[]): number {
  return assets.reduce((s, a) => s + a.value, 0) - liabilities.reduce((s, l) => s + l.balance, 0);
}
export function calcSavingsRate(income: number, expenses: number): number {
  if (!income) return 0;
  return Math.max(0, Math.round(((income - expenses) / income) * 100));
}
export function calcPassiveRatio(streams: IncomeStream[]): number {
  const total = streams.reduce((s, i) => s + i.monthlyAmount, 0);
  if (!total) return 0;
  return Math.round((streams.filter(s => s.isPassive).reduce((s, i) => s + i.monthlyAmount, 0) / total) * 100);
}
export function calcFINumber(monthlyExpenses: number): number { return monthlyExpenses * 12 * 25; }
export function calcYearsToFI(netWorth: number, fiNumber: number, monthlyContrib: number, annualReturn = 0.08): number {
  if (netWorth >= fiNumber) return 0;
  if (monthlyContrib <= 0) return 999;
  const r = annualReturn / 12;
  let lo = 0, hi = 100;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const n   = mid * 12;
    const fv  = netWorth * Math.pow(1 + r, n) + monthlyContrib * (Math.pow(1 + r, n) - 1) / r;
    if (fv >= fiNumber) hi = mid; else lo = mid;
  }
  return Math.round((lo + hi) / 2 * 10) / 10;
}
export function calcRunway(assets: Asset[], monthlyExpenses: number): number {
  const liquid = assets.filter(a => a.layer <= 2).reduce((s, a) => s + a.value, 0);
  return monthlyExpenses > 0 ? Math.round(liquid / monthlyExpenses) : 0;
}
export function fmtMoney(n: number, compact = false): string {
  if (compact && Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (compact && Math.abs(n) >= 1_000)    return `$${(n / 1_000).toFixed(0)}k`;
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}
export function uid(): string { return Math.random().toString(36).slice(2, 9); }
