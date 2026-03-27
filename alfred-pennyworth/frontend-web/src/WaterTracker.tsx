import { useState, useEffect, useCallback, useRef } from 'react';
import { logWater } from './api';

// ─── Constants ────────────────────────────────────────────────────────────────

const DAILY_GOAL_ML  = 2000;
const USER_ID        = 1;
const STORAGE_KEY    = 'alfred_water';
const HISTORY_KEY    = 'alfred_water_history';
const CONTEXT_KEY    = 'alfred_context';

const DAY_START_H  = 8;
const DAY_END_H    = 22;
const CHECK_MS     = 15 * 60 * 1000;
const COOLDOWN_MS  = 60 * 60 * 1000;
const SIP_GRACE_MS = 40 * 60 * 1000;

const QUICK_ADD = [
  { label: '200 ml', ml: 200 },
  { label: '350 ml', ml: 350 },
  { label: '500 ml', ml: 500 },
  { label: '750 ml', ml: 750 },
];

const BADGES = [
  { id: 'first_glass',  label: 'First Drop',  icon: '💧', threshold: 250,  streakReq: 0 },
  { id: 'halfway',      label: 'Halfway',      icon: '⚡', threshold: 1000, streakReq: 0 },
  { id: 'goal',         label: 'Goal Hit',     icon: '🏅', threshold: 2000, streakReq: 0 },
  { id: 'overachiever', label: 'Overachiever', icon: '🔥', threshold: 3000, streakReq: 0 },
  { id: 'streak3',      label: '3-Day Run',    icon: '🌊', threshold: 0,    streakReq: 3 },
  { id: 'streak7',      label: 'Week Warrior', icon: '🏆', threshold: 0,    streakReq: 7 },
  { id: 'streak14',     label: 'Hydro Legend', icon: '✦',  threshold: 0,    streakReq: 14 },
];

// Streak milestones that unlock XP bonuses
const STREAK_MILESTONES: Record<number, number> = { 3: 50, 7: 150, 14: 400, 30: 1000 };

// ─── Types ────────────────────────────────────────────────────────────────────

interface WaterState {
  date: string;
  totalMl: number;
  streak: number;
  lastGoalDate: string;
  points: number;
  earnedBadges: string[];
  lastSipTs: number;
}

interface WaterHistory { date: string; totalMl: number; goalHit: boolean; }

interface AppContext {
  lastSleepQuality: number | null;
  lastSleepHours: number | null;
  activityMinutesToday: number;
  lastActivityTs: number;
  lastMealTs: number;
}

interface Prediction {
  text: string;
  sub: string;
  type: 'ok' | 'warn' | 'late';
}

// ─── Persistence ──────────────────────────────────────────────────────────────

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function loadState(): WaterState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved: WaterState = JSON.parse(raw);
      if (saved.date === todayStr()) return { ...saved, lastSipTs: saved.lastSipTs ?? 0 };
      // New day — archive yesterday to history before resetting
      archiveToHistory(saved);
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yd = `${yesterday.getFullYear()}-${String(yesterday.getMonth()+1).padStart(2,'0')}-${String(yesterday.getDate()).padStart(2,'0')}`;
      const wasYesterday = saved.lastGoalDate === yd;
      return {
        date: todayStr(), totalMl: 0,
        streak: wasYesterday ? saved.streak : 0,
        lastGoalDate: saved.lastGoalDate,
        points: saved.points, earnedBadges: saved.earnedBadges, lastSipTs: 0,
      };
    }
  } catch {}
  return { date: todayStr(), totalMl: 0, streak: 0, lastGoalDate: '', points: 0, earnedBadges: [], lastSipTs: 0 };
}

function archiveToHistory(s: WaterState) {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const hist: WaterHistory[] = raw ? JSON.parse(raw) : [];
    if (!hist.find((h) => h.date === s.date)) {
      hist.push({ date: s.date, totalMl: s.totalMl, goalHit: s.totalMl >= DAILY_GOAL_ML });
      localStorage.setItem(HISTORY_KEY, JSON.stringify(hist.slice(-60))); // keep 60 days
    }
  } catch {}
}

function loadHistory(): WaterHistory[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

const DEFAULT_CONTEXT: AppContext = {
  lastSleepQuality: null,
  lastSleepHours: null,
  activityMinutesToday: 0,
  lastActivityTs: 0,
  lastMealTs: 0,
};

function loadContext(): AppContext {
  try {
    const raw = localStorage.getItem(CONTEXT_KEY);
    return raw ? { ...DEFAULT_CONTEXT, ...JSON.parse(raw) } : DEFAULT_CONTEXT;
  } catch { return DEFAULT_CONTEXT; }
}

function saveState(s: WaterState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

// ─── Water Sound (Web Audio API) ──────────────────────────────────────────────

const _audioCtxRef: { ctx: AudioContext | null } = { ctx: null };

function getAudioCtx(): AudioContext | null {
  try {
    if (!_audioCtxRef.ctx || _audioCtxRef.ctx.state === 'closed') {
      const AC = window.AudioContext ?? (window as unknown as Record<string, typeof AudioContext>)['webkitAudioContext'];
      _audioCtxRef.ctx = new AC();
    }
    return _audioCtxRef.ctx;
  } catch { return null; }
}

function playWaterSound(ml: number) {
  const ctx = getAudioCtx();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume();

  const dur = Math.min(0.85, 0.18 + ml / 1800);
  const rate = ctx.sampleRate;
  const len  = Math.floor(rate * dur);
  const buf  = ctx.createBuffer(1, len, rate);
  const data = buf.getChannelData(0);

  // White noise + shaped amplitude envelope (attack-sustain-decay)
  for (let i = 0; i < len; i++) {
    const t  = i / len;
    const at = Math.min(1, t / 0.06);                        // fast attack
    const dc = Math.pow(Math.max(0, 1 - (t - 0.25) / 0.75), 1.8); // decay
    const env = at * (t < 0.25 ? 1 : dc);
    // Add slight pitch wobble to sound like dripping/pouring
    const wobble = 1 + 0.08 * Math.sin(t * 60);
    data[i] = (Math.random() * 2 - 1) * env * wobble;
  }

  const src = ctx.createBufferSource();
  src.buffer = buf;

  // Bandpass — bigger amounts = lower, fuller pitch; small sip = higher pitch
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = Math.max(400, 1800 - ml * 1.4);
  bp.Q.value = 0.9;

  // Low-pass to soften harsh frequencies
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 2800;

  // Master gain
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.45, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);

  src.connect(bp); bp.connect(lp); lp.connect(gain); gain.connect(ctx.destination);
  src.start();
  src.stop(ctx.currentTime + dur + 0.05);
}

// ─── Context-Aware Suggestions ────────────────────────────────────────────────

interface Suggestion { text: string; icon: string; tag: string; }

function getContextSuggestion(state: WaterState, ctx: AppContext): Suggestion {
  const h    = new Date().getHours();
  const pct  = state.totalMl / DAILY_GOAL_ML;
  const mins = ctx.activityMinutesToday ?? 0;

  // Morning first-glass nudge
  if (h < 10 && state.totalMl < 300) {
    return { icon: '🌅', tag: 'Morning', text: 'Your body lost ~500ml during sleep. Start with a full glass now.' };
  }
  // Post-workout replenishment
  if (mins > 20 && (Date.now() - (ctx.lastActivityTs ?? 0)) < 3 * 3600_000) {
    const extra = Math.round(mins * 7.5);
    return { icon: '⚡', tag: 'Recovery', text: `Active ${mins} min → drink +${extra} ml to replenish. Muscles need it.` };
  }
  // Poor sleep hydration compensation
  if ((ctx.lastSleepQuality ?? 10) < 6) {
    return { icon: '😴', tag: 'Sleep', text: 'Poor sleep raises cortisol, which dehydrates you faster. Sip more often today.' };
  }
  // Pre-meal tip
  if ((h === 11 || h === 17 || h === 19) && state.totalMl > 0) {
    return { icon: '🍽', tag: 'Nutrition', text: '30 min before a meal, drink a glass. It aids digestion and prevents overeating.' };
  }
  // Afternoon slump
  if (h >= 14 && h <= 16 && pct < 0.55) {
    return { icon: '🧠', tag: 'Focus', text: '2% dehydration = 20% drop in concentration. Your afternoon slump might just be thirst.' };
  }
  // Streak motivation
  if (state.streak >= 3) {
    const next = [3, 7, 14, 30].find((m) => m > state.streak) ?? 30;
    return { icon: '🔥', tag: 'Streak', text: `${state.streak}-day streak! ${next - state.streak} more days to unlock the next milestone badge.` };
  }
  // Evening catch-up
  if (h >= 18 && DAILY_GOAL_ML - state.totalMl > 400) {
    return { icon: '🌙', tag: 'Evening', text: `${DAILY_GOAL_ML - state.totalMl} ml left. Spread across 2–3 glasses before bed.` };
  }
  // Default rotating science facts
  const facts: Suggestion[] = [
    { icon: '🔬', tag: 'Science',  text: 'Hydrated people think clearer and perform better at every task.' },
    { icon: '💪', tag: 'Identity', text: 'I am a healthy person who stays hydrated — every sip reinforces this.' },
    { icon: '🧬', tag: 'Biology',  text: 'Your brain is 75% water. Even mild dehydration shrinks brain tissue.' },
    { icon: '⏱', tag: 'Habit',    text: 'Small consistent habits compound. 8 glasses a day = 2920 glasses a year.' },
    { icon: '🌡', tag: 'Health',   text: 'Proper hydration can reduce headache risk by up to 40%.' },
  ];
  return facts[Math.floor(Date.now() / 60_000) % facts.length];
}

// ─── Prediction Engine ────────────────────────────────────────────────────────

function getPrediction(totalMl: number): Prediction {
  if (totalMl >= DAILY_GOAL_ML) {
    return { type: 'ok', text: '🏆 Daily goal achieved!', sub: 'Outstanding — keep going if you were active.' };
  }

  const h     = new Date().getHours();
  const m     = new Date().getMinutes();
  const now   = h + m / 60;
  if (now < DAY_START_H) return { type: 'ok', text: 'Day hasn\'t started', sub: 'Your hydration window opens at 8 AM.' };

  const hoursLeft = Math.max(0.5, DAY_END_H - now);
  const remaining = DAILY_GOAL_ML - totalMl;
  const mlPerHr   = remaining / hoursLeft;
  const paceHr    = totalMl / Math.max(0.5, now - DAY_START_H);

  if (mlPerHr <= 80) {
    // Easy to hit even at low pace
    const eta = now + remaining / Math.max(paceHr, 100);
    const etaH = Math.floor(eta), etaM = Math.round((eta - etaH) * 60);
    return { type: 'ok', text: `On pace → goal by ~${etaH}:${String(etaM).padStart(2,'0')}`, sub: 'Keep your current rhythm.' };
  } else if (mlPerHr <= 250) {
    return { type: 'warn', text: `Drink ~${Math.round(mlPerHr)} ml/hr to hit goal`, sub: `${Math.round(hoursLeft * 10) / 10}h left, ${remaining} ml remaining.` };
  } else {
    const shortfall = Math.round(remaining - hoursLeft * 200);
    return { type: 'late', text: `At this pace, you'll miss by ~${shortfall} ml`, sub: 'Pick up the pace — try a 500 ml glass now.' };
  }
}

// ─── Habit Learning ───────────────────────────────────────────────────────────

interface HabitInsight { text: string; icon: string; }

function useHabitLearning(streak: number): HabitInsight | null {
  return useState<HabitInsight | null>(() => {
    const hist = loadHistory();
    if (hist.length < 5) return null;

    const goalDays  = hist.filter((h) => h.goalHit).length;
    const goalRate  = Math.round((goalDays / hist.length) * 100);
    const avgMl     = Math.round(hist.reduce((s, h) => s + h.totalMl, 0) / hist.length);
    const weekdays  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    // Best day of week
    const byDay: Record<number, number[]> = {};
    hist.forEach((h) => {
      const d = new Date(h.date).getDay();
      (byDay[d] = byDay[d] ?? []).push(h.totalMl);
    });
    const bestDay = Object.entries(byDay).sort(
      ([,a],[,b]) => (b.reduce((s,v)=>s+v,0)/b.length) - (a.reduce((s,v)=>s+v,0)/a.length)
    )[0];

    if (streak >= 7) return { icon: '🔬', text: `${streak} days in a row — you've built a real habit. Keep it going.` };
    if (goalRate >= 70) return { icon: '📈', text: `${goalRate}% goal rate over ${hist.length} days. You're a consistent hydrator.` };
    if (avgMl < 1200) return { icon: '⚠️', text: `Your avg is ${avgMl} ml/day. Aim for 2000 ml to see real benefits.` };
    if (bestDay) return { icon: '📅', text: `Your best hydration day is usually ${weekdays[Number(bestDay[0])]}. Set a reminder for other days.` };
    return { icon: '💡', text: `You've logged ${hist.length} days. Keep building your streak for personalised insights.` };
  })[0];
}

// ─── Notification Hook ────────────────────────────────────────────────────────

type NotifPerm = 'granted' | 'denied' | 'default' | 'unsupported';

function useWaterReminders(totalMl: number, lastSipTs: number, goalDone: boolean) {
  const [perm, setPerm] = useState<NotifPerm>(() => {
    if (!('Notification' in window)) return 'unsupported';
    return Notification.permission as NotifPerm;
  });
  const lastNotifTs = useRef<number>(0);

  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) return;
    const result = await Notification.requestPermission();
    setPerm(result as NotifPerm);
  }, []);

  useEffect(() => {
    if (perm !== 'granted' || goalDone) return;
    const check = () => {
      const now  = Date.now();
      const hour = new Date().getHours();
      if (hour < DAY_START_H || hour >= DAY_END_H) return;
      if (now - lastNotifTs.current < COOLDOWN_MS) return;
      if (now - lastSipTs < SIP_GRACE_MS) return;
      const minSince   = (hour - DAY_START_H) * 60 + new Date().getMinutes();
      const dayWindow  = (DAY_END_H - DAY_START_H) * 60;
      const expected   = Math.round(DAILY_GOAL_ML * Math.min(1, minSince / dayWindow));
      const deficit    = expected - totalMl;
      if (deficit < 200) return;
      lastNotifTs.current = now;
      const urg = deficit > 700 ? '🚨' : deficit > 400 ? '⚠️' : '💧';
      const msgs = [
        `${urg} ${deficit} ml behind pace — time for a glass!`,
        `${urg} Hydration check: ${deficit} ml to catch up.`,
        `${urg} Alfred: ~${deficit} ml more to stay on track today.`,
      ];
      new Notification('Alfred · Hydration', {
        body: msgs[Math.floor(Math.random() * msgs.length)],
        icon: '/favicon.ico', tag: 'alfred-water', silent: false,
      });
    };
    check();
    const id = setInterval(check, CHECK_MS);
    return () => clearInterval(id);
  }, [perm, totalMl, lastSipTs, goalDone]);

  return { perm, requestPermission };
}

// ─── useCountUp ───────────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 700) {
  const [display, setDisplay] = useState(target);
  const prev = useRef(target);
  useEffect(() => {
    if (prev.current === target) return;
    const from = prev.current;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (target - from) * eased));
      if (t < 1) requestAnimationFrame(tick);
      else prev.current = target;
    };
    requestAnimationFrame(tick);
  }, [target, duration]);
  return display;
}

// ─── Ripple Button ────────────────────────────────────────────────────────────

interface Ripple { id: number; x: number; y: number; }

function RippleButton({ ml, label, disabled, onAdd }: {
  ml: number; label: string; disabled: boolean; onAdd: (ml: number) => void;
}) {
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const id = Date.now();
    setRipples((r) => [...r, { id, x: e.clientX - rect.left, y: e.clientY - rect.top }]);
    setTimeout(() => setRipples((r) => r.filter((rp) => rp.id !== id)), 600);
    onAdd(ml);
  };
  return (
    <button className="btn-water" onClick={handleClick} disabled={disabled}>
      {ripples.map((rp) => (
        <span key={rp.id} className="btn-ripple" style={{ left: rp.x, top: rp.y }} />
      ))}
      {label}
    </button>
  );
}

// ─── Sparkles ─────────────────────────────────────────────────────────────────

function Sparkles() {
  return (
    <div className="sparkle-wrap" aria-hidden>
      {Array.from({ length: 12 }).map((_, i) => (
        <span key={i} className="sparkle" style={{ '--i': i } as React.CSSProperties} />
      ))}
    </div>
  );
}

// ─── Floating Quick Add ───────────────────────────────────────────────────────

function FloatingQuickAdd({ onAdd }: { onAdd: (ml: number) => void }) {
  const [open, setOpen] = useState(false);
  const opts = [200, 350, 500, 750];
  const close = useCallback(() => setOpen(false), []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (!t.closest('.fqa-wrap')) close();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, close]);

  return (
    <div className="fqa-wrap" role="region" aria-label="Floating quick add">
      {/* Speed-dial options */}
      {opts.map((ml, i) => (
        <button
          key={ml}
          className="fqa-option"
          style={{ '--idx': i, '--open': open ? 1 : 0 } as React.CSSProperties}
          onClick={() => { onAdd(ml); close(); }}
          aria-label={`Add ${ml} ml`}
        >
          +{ml}
        </button>
      ))}
      {/* Main toggle */}
      <button
        className={`fqa-btn ${open ? 'fqa-btn--open' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-label="Quick add water"
        title="Quick add water"
      >
        {open ? '✕' : '💧'}
      </button>
    </div>
  );
}

// ─── Prediction Banner ────────────────────────────────────────────────────────

function PredictionBanner({ totalMl }: { totalMl: number }) {
  const pred = getPrediction(totalMl);
  return (
    <div className={`pred-banner pred-banner--${pred.type}`}>
      <span className="pred-text">{pred.text}</span>
      <span className="pred-sub">{pred.sub}</span>
    </div>
  );
}

// ─── Cross-Feature Panel ──────────────────────────────────────────────────────

function CrossFeaturePanel({ ctx }: { ctx: AppContext }) {
  const items: { icon: string; label: string; val: string; color: string }[] = [];

  if (ctx.lastSleepHours != null) {
    const adj = ctx.lastSleepHours < 6 ? '+300 ml' : ctx.lastSleepHours >= 8 ? 'Normal' : '+100 ml';
    items.push({ icon: '🌙', label: 'Sleep adjustment', val: adj, color: '#a78bfa' });
  }
  if (ctx.activityMinutesToday > 0) {
    const extra = Math.round(ctx.activityMinutesToday * 7.5);
    items.push({ icon: '⚡', label: `${ctx.activityMinutesToday} min activity`, val: `+${extra} ml`, color: '#3fb950' });
  }
  if (ctx.lastMealTs && Date.now() - ctx.lastMealTs < 4 * 3600_000) {
    items.push({ icon: '🍽', label: 'Post-meal', val: 'Sip now', color: '#c9a84c' });
  }

  if (!items.length) return null;

  return (
    <div className="cross-feature-panel">
      <p className="cross-feature-title">🔗 Cross-Feature Intelligence</p>
      <div className="cross-feature-items">
        {items.map((it, i) => (
          <div key={i} className="cross-item" style={{ '--ci-color': it.color } as React.CSSProperties}>
            <span className="cross-item-icon">{it.icon}</span>
            <span className="cross-item-label">{it.label}</span>
            <span className="cross-item-val">{it.val}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Water Glass SVG (real-time rAF wave engine) ──────────────────────────────

const GW = 120, GH = 210;
const RIM_Y = 14, BASE_Y = 194;
const RIM_HALF = 44, BASE_HALF = 34;
const CX = GW / 2;

function wavePath(t: number, baseY: number, phase: number, amp: number, freq: number): string {
  let d = '';
  for (let x = -10; x <= GW + 10; x += 3) {
    const y = baseY
      + Math.sin(x * freq + t + phase) * amp
      + Math.sin(x * freq * 1.55 + t * 0.72 + phase + 1.4) * (amp * 0.45);
    d += `${d === '' ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(2)} `;
  }
  return `${d} L${GW + 10},${baseY + 28} L-10,${baseY + 28} Z`;
}

function WaterGlass({ pct, shaking }: { pct: number; shaking: boolean }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const rafId  = useRef(0);
  const clamp  = Math.min(1, Math.max(0, pct));

  const innerH = BASE_Y - RIM_Y;
  const wY     = BASE_Y - clamp * innerH;

  const hue   = 200 + clamp * 18;
  const wDeep = `hsl(${hue},72%,${34 + clamp * 12}%)`;
  const wMid  = `hsl(${hue},78%,${50 + clamp * 10}%)`;
  const wLt   = `hsl(${hue},85%,${66 + clamp * 6}%)`;

  const innerTrap = `${CX-RIM_HALF},${RIM_Y} ${CX+RIM_HALF},${RIM_Y} ${CX+BASE_HALF},${BASE_Y} ${CX-BASE_HALF},${BASE_Y}`;

  useEffect(() => {
    if (clamp <= 0) return;
    const get = (cls: string) => svgRef.current?.querySelector(`.${cls}`) as SVGPathElement | null;
    const tick = (ts: number) => {
      const t = ts * 0.0019;
      get('rw1')?.setAttribute('d', wavePath(t,        wY,     0,   5.2, 0.062));
      get('rw2')?.setAttribute('d', wavePath(t * 1.28, wY + 3, 2.1, 3.4, 0.091));
      get('rw3')?.setAttribute('d', wavePath(t * 1.75, wY + 1, 4.2, 2.0, 0.115));
      rafId.current = requestAnimationFrame(tick);
    };
    rafId.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId.current);
  }, [clamp, wY]);

  const bubbles = [
    { cx: CX - 22, delay: '0s',   dur: '2.4s', r: 2.2 },
    { cx: CX + 10, delay: '0.8s', dur: '3.1s', r: 1.5 },
    { cx: CX + 26, delay: '1.6s', dur: '2.8s', r: 1.9 },
    { cx: CX - 8,  delay: '2.4s', dur: '3.5s', r: 1.2 },
    { cx: CX + 36, delay: '3.2s', dur: '2.6s', r: 1.4 },
  ];

  return (
    <div className={`water-glass-wrap ${shaking ? 'water-glass--shake' : ''}`}>
      {clamp > 0 && (
        <div className="water-glow" style={{
          opacity: clamp * 0.8,
          background: `radial-gradient(ellipse 80% 32% at 50% 98%, ${wMid} 0%, transparent 68%)`,
        }} />
      )}
      <svg ref={svgRef} viewBox={`0 0 ${GW} ${GH}`} className="water-glass-svg"
        aria-label={`Water glass, ${Math.round(clamp * 100)}% full`}>
        <defs>
          <clipPath id="gcI"><polygon points={innerTrap} /></clipPath>
          <linearGradient id="wG" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={wMid} />
            <stop offset="100%" stopColor={wDeep} />
          </linearGradient>
          <linearGradient id="hlL" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor="rgba(255,255,255,0.22)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
          <linearGradient id="shR" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor="rgba(0,0,0,0)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.14)" />
          </linearGradient>
          <linearGradient id="wShim" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor="rgba(255,255,255,0)" />
            <stop offset="35%"  stopColor="rgba(255,255,255,0.35)" />
            <stop offset="65%"  stopColor="rgba(255,255,255,0.12)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
          <linearGradient id="glassG" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%"   stopColor="rgba(180,215,240,0.14)" />
            <stop offset="40%"  stopColor="rgba(230,248,255,0.06)" />
            <stop offset="100%" stopColor="rgba(140,185,220,0.10)" />
          </linearGradient>
          <radialGradient id="caustic" cx="50%" cy="100%" r="50%">
            <stop offset="0%"   stopColor={wMid} stopOpacity="0.25" />
            <stop offset="100%" stopColor={wMid} stopOpacity="0" />
          </radialGradient>
        </defs>

        <polygon points={innerTrap} fill="url(#glassG)" />

        {clamp > 0 && (
          <>
            <rect x="0" y={wY} width={GW} height={GH - wY + 4}
              fill="url(#wG)" clipPath="url(#gcI)"
              style={{ transition: 'y 0.6s cubic-bezier(.4,0,.2,1)' }} />
            <rect x="0" y={BASE_Y - 32} width={GW} height="36"
              fill="url(#caustic)" clipPath="url(#gcI)" />
          </>
        )}

        {clamp > 0.01 && (
          <g clipPath="url(#gcI)">
            <path className="rw1" fill={wLt}  opacity="0.55" />
            <path className="rw2" fill={wMid}  opacity="0.28" />
            <path className="rw3" fill="white" opacity="0.07" />
          </g>
        )}

        {clamp > 0.04 && (
          <rect x="0" y={wY - 1} width={GW} height="16"
            fill="url(#wShim)" clipPath="url(#gcI)"
            style={{ transition: 'y 0.6s cubic-bezier(.4,0,.2,1)' }} />
        )}

        <polygon points={`${CX-RIM_HALF},${RIM_Y} ${CX-RIM_HALF+14},${RIM_Y} ${CX-BASE_HALF+9},${BASE_Y} ${CX-BASE_HALF},${BASE_Y}`}
          fill="url(#hlL)" clipPath="url(#gcI)" />
        <polygon points={`${CX+RIM_HALF-14},${RIM_Y} ${CX+RIM_HALF},${RIM_Y} ${CX+BASE_HALF},${BASE_Y} ${CX+BASE_HALF-9},${BASE_Y}`}
          fill="url(#shR)" clipPath="url(#gcI)" />

        {clamp > 0.1 && bubbles.map((b, i) => (
          <circle key={i} cx={b.cx} cy={wY + clamp * innerH * 0.82} r={b.r}
            fill="rgba(255,255,255,0.45)" clipPath="url(#gcI)" className="bubble"
            style={{ '--delay': b.delay, '--dur': b.dur, '--rise': `${clamp * innerH * 0.88}px` } as React.CSSProperties} />
        ))}

        <line x1={CX-RIM_HALF}  y1={RIM_Y}  x2={CX-BASE_HALF}  y2={BASE_Y} stroke="rgba(170,205,230,0.55)" strokeWidth="2.5" strokeLinecap="round" />
        <line x1={CX+RIM_HALF}  y1={RIM_Y}  x2={CX+BASE_HALF}  y2={BASE_Y} stroke="rgba(170,205,230,0.45)" strokeWidth="2.5" strokeLinecap="round" />
        <line x1={CX-RIM_HALF}  y1={RIM_Y}  x2={CX+RIM_HALF}   y2={RIM_Y}  stroke="rgba(200,228,248,0.75)" strokeWidth="3.5" strokeLinecap="round" />
        <line x1={CX-BASE_HALF} y1={BASE_Y} x2={CX+BASE_HALF}  y2={BASE_Y} stroke="rgba(170,205,230,0.45)" strokeWidth="3"   strokeLinecap="round" />
        <line x1={CX-RIM_HALF+7}  y1={RIM_Y+6} x2={CX-BASE_HALF+6} y2={BASE_Y-4} stroke="rgba(255,255,255,0.14)" strokeWidth="2"   strokeLinecap="round" />
        <line x1={CX+RIM_HALF-7}  y1={RIM_Y+6} x2={CX+BASE_HALF-6} y2={BASE_Y-4} stroke="rgba(255,255,255,0.07)" strokeWidth="1.5" strokeLinecap="round" />
        <rect x={CX-RIM_HALF+2} y={RIM_Y-3} width={RIM_HALF*2-4} height="5" rx="2.5" fill="rgba(230,248,255,0.18)" />

        {clamp > 0.14 && (
          <text x={CX} y={Math.max(wY + 22, BASE_Y - 12)}
            textAnchor="middle" fontSize="13" fontWeight="700" fill="white" opacity="0.9"
            style={{ fontFamily: 'Inter,sans-serif', transition: 'y 0.6s cubic-bezier(.4,0,.2,1)' }}>
            {Math.round(clamp * 100)}%
          </text>
        )}
      </svg>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function WaterTracker() {
  const [state, setState]       = useState<WaterState>(loadState);
  const [shaking, setShaking]   = useState(false);
  const [floats, setFloats]     = useState<{ id: number; ml: number }[]>([]);
  const [newBadge, setNewBadge] = useState<string | null>(null);
  const [showSparkle, setShowSparkle] = useState(false);
  const [milestoneToast, setMilestoneToast] = useState<string | null>(null);
  const [appCtx]  = useState<AppContext>(loadContext);

  const displayMl = useCountUp(state.totalMl);
  const pct       = Math.min(1, state.totalMl / DAILY_GOAL_ML);
  const goalDone  = state.totalMl >= DAILY_GOAL_ML;
  const suggestion = getContextSuggestion(state, appCtx);
  const habitInsight = useHabitLearning(state.streak);
  const { perm, requestPermission } = useWaterReminders(state.totalMl, state.lastSipTs, goalDone);

  // Crossfade suggestion every 50s
  const [suggVis, setSuggVis] = useState(true);
  useEffect(() => {
    const id = setInterval(() => {
      setSuggVis(false);
      setTimeout(() => setSuggVis(true), 350);
    }, 50_000);
    return () => clearInterval(id);
  }, []);

  const add = useCallback(async (ml: number) => {
    // Haptics
    setShaking(true);
    const fid = Date.now();
    setFloats((f) => [...f, { id: fid, ml }]);
    setTimeout(() => setShaking(false), 500);
    setTimeout(() => setFloats((f) => f.filter((x) => x.id !== fid)), 900);

    // Sound
    playWaterSound(ml);

    try { await logWater(USER_ID, ml); } catch {}

    setState((prev) => {
      const newTotal  = prev.totalMl + ml;
      const goalHit   = newTotal >= DAILY_GOAL_ML;
      const alreadyHit = prev.totalMl >= DAILY_GOAL_ML;
      const newStreak = goalHit && !alreadyHit ? prev.streak + 1 : prev.streak;

      // Points (with bonus for larger drinks)
      const basePoints = Math.floor(ml / 50);
      const bonus = ml >= 500 ? 5 : ml >= 350 ? 2 : 0;
      const newPoints = prev.points + basePoints + bonus;

      // Streak milestone XP
      const streakBonus = STREAK_MILESTONES[newStreak] ?? 0;
      if (streakBonus > 0 && goalHit && !alreadyHit) {
        setMilestoneToast(`🎯 ${newStreak}-day streak! +${streakBonus} bonus XP`);
        setTimeout(() => setMilestoneToast(null), 4000);
      }

      // Badge unlocks (both ml-based and streak-based)
      const nowEarned = BADGES.filter((b) => {
        if (b.threshold > 0) return newTotal >= b.threshold;
        if (b.streakReq > 0)  return newStreak >= b.streakReq;
        return false;
      }).map((b) => b.id);
      const newOnes = nowEarned.filter((id) => !prev.earnedBadges.includes(id));

      if (newOnes.length > 0) {
        const badge = BADGES.find((b) => b.id === newOnes[0])!;
        setNewBadge(`${badge.icon} ${badge.label}`);
        setShowSparkle(true);
        setTimeout(() => { setNewBadge(null); setShowSparkle(false); }, 3500);
      }

      const next: WaterState = {
        ...prev, totalMl: newTotal, streak: newStreak,
        lastGoalDate: goalHit ? todayStr() : prev.lastGoalDate,
        points: newPoints, earnedBadges: [...new Set([...prev.earnedBadges, ...nowEarned])],
        lastSipTs: Date.now(),
      };
      saveState(next);
      return next;
    });
  }, []);

  // Streak badges check on load
  useEffect(() => {
    const streakBadges = BADGES.filter((b) => b.streakReq > 0 && state.streak >= b.streakReq).map((b) => b.id);
    const unearned = streakBadges.filter((id) => !state.earnedBadges.includes(id));
    if (unearned.length > 0) {
      setState((prev) => {
        const next = { ...prev, earnedBadges: [...new Set([...prev.earnedBadges, ...unearned])] };
        saveState(next);
        return next;
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={`water-card card ${goalDone ? 'water-card--done' : ''}`} style={{ position: 'relative' }}>

      {/* Sparkles */}
      {showSparkle && <Sparkles />}

      {/* Floating Quick Add */}
      <FloatingQuickAdd onAdd={add} />

      {/* ── Header ── */}
      <div className="water-header">
        <div className="card-header" style={{ marginBottom: 0 }}>
          <div className="card-icon">💧</div>
          <span className="card-title">Hydration</span>
        </div>
        <div className="water-meta-row">
          {state.streak > 0 && (
            <span className="water-streak" title={`${state.streak}-day streak`}>
              🔥 {state.streak} day{state.streak > 1 ? 's' : ''}
            </span>
          )}
          <span className="water-points">⚡ {state.points} pts</span>
          {perm === 'default' && (
            <button className="notif-btn notif-btn--ask" onClick={requestPermission} title="Enable drink reminders">🔔 Reminders</button>
          )}
          {perm === 'granted' && <span className="notif-pill notif-pill--on" title="Active">🔔 On</span>}
          {perm === 'denied'  && <span className="notif-pill notif-pill--off" title="Blocked">🔕 Off</span>}
        </div>
      </div>

      {/* ── Milestone toast ── */}
      {milestoneToast && (
        <div className="water-badge-toast water-badge-toast--milestone">{milestoneToast}</div>
      )}

      {/* ── Badge unlock toast ── */}
      {newBadge && (
        <div className="water-badge-toast">
          <span className="badge-toast-glow" />
          {newBadge} unlocked!
        </div>
      )}

      {/* ── Predictive banner ── */}
      <PredictionBanner totalMl={state.totalMl} />

      {/* ── Main body ── */}
      <div className="water-body">
        <div className="water-glass-container">
          <WaterGlass pct={pct} shaking={shaking} />
          {floats.map(({ id, ml }) => (
            <div key={id} className="water-float">+{ml} ml</div>
          ))}
        </div>

        <div className="water-right">
          {/* Amount */}
          <div className="water-amount">
            <span className="water-amount-current">
              {(displayMl / 1000).toFixed(displayMl < 1000 ? 0 : 2).replace(/\.?0+$/, '')}
              <span className="water-amount-unit"> L</span>
            </span>
            <span className="water-amount-goal">/ {DAILY_GOAL_ML / 1000} L</span>
          </div>

          {/* Progress bar */}
          <div className="water-progress-wrap">
            <div className="water-progress-bar">
              <div className={`water-progress-fill ${goalDone ? 'water-progress-fill--done' : ''}`}
                style={{ width: `${Math.min(100, pct * 100)}%` }} />
            </div>
            <span className="water-progress-label">{Math.round(pct * 100)}%</span>
          </div>

          {goalDone
            ? <p className="water-goal-done">✓ Daily goal reached!</p>
            : <p className="water-remaining">{DAILY_GOAL_ML - state.totalMl} ml remaining</p>
          }

          {/* Context-aware nudge */}
          <div className={`water-nudge ${suggVis ? 'nudge--in' : 'nudge--out'}`}>
            <p className="water-nudge-text">
              <span className="nudge-icon">{suggestion.icon}</span>
              {suggestion.text}
            </p>
            <span className="water-nudge-tag">— {suggestion.tag}</span>
          </div>

          {/* Quick-add buttons */}
          <div className="water-quick-add">
            {QUICK_ADD.map(({ label, ml }) => (
              <RippleButton key={ml} ml={ml} label={label} disabled={false} onAdd={add} />
            ))}
          </div>
        </div>
      </div>

      {/* ── Cross-Feature Intelligence ── */}
      <CrossFeaturePanel ctx={appCtx} />

      {/* ── Badges ── */}
      <div className="water-badges">
        {BADGES.map((b) => {
          const isEarned = b.threshold > 0
            ? state.totalMl >= b.threshold
            : b.streakReq > 0 ? state.streak >= b.streakReq : false;
          const isEarnedBadge = state.earnedBadges.includes(b.id);
          return (
            <div key={b.id}
              className={`water-badge ${isEarned || isEarnedBadge ? 'water-badge--earned' : 'water-badge--locked'}`}
              title={b.streakReq > 0 ? `${b.streakReq}-day streak` : `${b.threshold} ml`}>
              <span className="water-badge-icon">{b.icon}</span>
              <span className="water-badge-label">{b.label}</span>
              {(isEarned || isEarnedBadge) && <span className="badge-check">✓</span>}
            </div>
          );
        })}
      </div>

      {/* ── Habit Learning Insight ── */}
      {habitInsight && (
        <div className="habit-insight">
          <span className="habit-insight-icon">{habitInsight.icon}</span>
          <span className="habit-insight-text">{habitInsight.text}</span>
        </div>
      )}
    </div>
  );
}
