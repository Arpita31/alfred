import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  getHealth, createMeal, createSleep, createActivity,
  generateIntervention, submitFeedback, logWater, parseMeal, getMeals,
  type NutritionPreview, type ParsedIngredient,
} from './api';
import WaterTracker from './WaterTracker';
import ChatAssistant from './ChatAssistant';
import FinancePage from './FinancePage';
import { ProgressRing } from './components/ProgressRing';
import { Sparkline }    from './components/Sparkline';
import './App.css';

// ─── Types ────────────────────────────────────────────────────────────────────

type Page = 'dashboard' | 'hydration' | 'nutrition' | 'sleep' | 'activity' | 'ai' | 'timeline' | 'finance';
type BackendStatus = 'loading' | 'healthy' | 'error';
type Intervention = {
  id: number; title: string; message: string;
  confidence_score: number; status: string; signal_type?: string;
};

interface Stats {
  mealsToday: number;
  lastSleepHours: number | null;
  lastSleepQuality: number | null;
  activityMinutesToday: number;
  waterStreak: number;
}

interface BodyState {
  energy: number; recovery: number; hydration: number; focus: number;
  label: string; color: string;
}

interface PredictiveAlert {
  type: string; icon: string; message: string;
  urgency: 'low' | 'med' | 'high'; eta: string;
}

interface TimelineEvent {
  id: string; time: Date; icon: string;
  label: string; detail: string;
  type: 'meal' | 'water' | 'sleep' | 'activity' | 'insight';
}

// ─── Constants ────────────────────────────────────────────────────────────────

const USER_ID = 1;

const NAV_GROUPS = [
  {
    label: 'OVERVIEW',
    items: [
      { id: 'dashboard' as Page, icon: '⊟', label: 'Dashboard' },
      { id: 'timeline'  as Page, icon: '📅', label: 'Timeline'  },
    ],
  },
  {
    label: 'HEALTH',
    items: [
      { id: 'hydration' as Page, icon: '💧', label: 'Hydration' },
      { id: 'nutrition' as Page, icon: '🍽', label: 'Nutrition' },
      { id: 'sleep'     as Page, icon: '🌙', label: 'Sleep'     },
      { id: 'activity'  as Page, icon: '⚡', label: 'Activity'  },
    ],
  },
  {
    label: 'WEALTH',
    items: [
      { id: 'finance' as Page, icon: '◈', label: 'Finance' },
    ],
  },
  {
    label: 'ALFRED',
    items: [
      { id: 'ai' as Page, icon: '✦', label: 'AI Insights' },
    ],
  },
];

// Mock 7-day sparkline seeds (deterministic but look realistic)
const SPARKS: Record<string, number[]> = {
  water:    [1200, 1500, 1800, 1400, 1750, 1600, 2000],
  sleep:    [6.5, 7, 5.5, 8, 7.5, 6, 7.2],
  meals:    [2, 3, 2, 3, 3, 2, 3],
  activity: [0, 30, 20, 45, 0, 60, 30],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function localDateStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function getWaterToday(): number {
  try {
    const raw = localStorage.getItem('alfred_water');
    if (raw) {
      const s = JSON.parse(raw);
      if (s.date === localDateStr()) return s.totalMl ?? 0;
    }
  } catch {}
  return 0;
}

function getWaterStreak(): number {
  try {
    const raw = localStorage.getItem('alfred_water');
    if (raw) return JSON.parse(raw).streak ?? 0;
  } catch {}
  return 0;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function fmtDate() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

function fmtTime(d: Date) {
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function inferBodyState(stats: Stats, waterMl: number): BodyState {
  const hour = new Date().getHours();

  let energy = 60;
  if (stats.lastSleepQuality != null) {
    energy = Math.round(stats.lastSleepQuality * 10);
    if (hour >= 14 && hour <= 16) energy = Math.max(energy - 20, 10); // afternoon dip
    if (stats.lastSleepHours != null && stats.lastSleepHours < 6) energy = Math.min(energy, 40);
  }

  const recovery = stats.activityMinutesToday > 0
    ? Math.max(20, 100 - Math.round(stats.activityMinutesToday * 0.6))
    : 85;

  const hydration = Math.round(Math.min(100, (waterMl / 2000) * 100));

  const focus = Math.round(energy * 0.4 + recovery * 0.3 + hydration * 0.3);

  let label = 'Balanced';
  let color = '#c9a84c';
  if (energy > 75)      { label = 'Energized';  color = '#3fb950'; }
  else if (energy < 35) { label = 'Fatigued';   color = '#f85149'; }
  else if (hydration < 30) { label = 'Thirsty'; color = '#58a6ff'; }
  else if (recovery < 40)  { label = 'Recovering'; color = '#a78bfa'; }

  return { energy, recovery, hydration, focus, label, color };
}

function computeAlerts(stats: Stats, waterMl: number, timeline: TimelineEvent[]): PredictiveAlert[] {
  const now   = new Date();
  const hour  = now.getHours();
  const out: PredictiveAlert[] = [];

  // Hunger
  const lastMeal = [...timeline].reverse().find((e) => e.type === 'meal');
  if (lastMeal) {
    const hrs = (now.getTime() - lastMeal.time.getTime()) / 3_600_000;
    if (hrs > 3.5 && hour >= 6 && hour <= 22) {
      out.push({
        type: 'hunger', icon: '🍽',
        message: `${Math.round(hrs)}h since last meal — hunger likely`,
        urgency: hrs > 5 ? 'high' : 'med',
        eta: hrs > 5 ? 'Now' : '~30 min',
      });
    }
  } else if (stats.mealsToday === 0 && hour >= 10) {
    out.push({ type: 'hunger', icon: '🍽', message: 'No meals logged — fuel up soon', urgency: 'med', eta: 'Now' });
  }

  // Hydration deficit
  const expected = Math.min(2000, Math.max(0, ((hour - 8) / 14)) * 2000);
  if (hour >= 8 && waterMl < expected * 0.6 && expected > 0) {
    out.push({
      type: 'hydration', icon: '💧',
      message: `${Math.round(Math.max(0, expected - waterMl))} ml behind hydration pace`,
      urgency: waterMl < expected * 0.3 ? 'high' : 'med',
      eta: 'Now',
    });
  }

  // Afternoon energy dip
  if (hour >= 13 && hour <= 15 && (stats.lastSleepQuality ?? 7) < 7) {
    out.push({ type: 'energy', icon: '⚡', message: 'Afternoon dip likely — consider a short walk', urgency: 'low', eta: hour < 14 ? '~1 hour' : 'Soon' });
  }

  return out.slice(0, 3);
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function Skeleton({ w = '100%', h = 18, radius = 6 }: { w?: string | number; h?: number; radius?: number }) {
  return <div className="skeleton" style={{ width: w, height: h, borderRadius: radius }} />;
}

// ─── Page Header ──────────────────────────────────────────────────────────────

function PageHeader({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="page-header">
      <div><h2 className="page-title">{title}</h2>{sub && <p className="page-sub">{sub}</p>}</div>
      {action}
    </div>
  );
}

// ─── Form Card ────────────────────────────────────────────────────────────────

function FormCard({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div className="form-card card">
      <div className="card-header">
        <div className="card-icon">{icon}</div>
        <span className="card-title">{title}</span>
      </div>
      {children}
    </div>
  );
}

// ─── Stat Card (with ring + sparkline) ────────────────────────────────────────

function StatCard({
  icon, label, value, sub, accent, pct, sparkData, loading, onClick, emptyNudge,
}: {
  icon: string; label: string; value: string; sub?: string;
  accent: string; pct: number; sparkData: number[];
  loading?: boolean; onClick?: () => void; emptyNudge?: string;
}) {
  const isEmpty = value === '—';
  return (
    <button className="stat-card" onClick={onClick} style={{ '--accent-rgb': accent } as React.CSSProperties}>
      <div className="stat-card-top">
        <ProgressRing
          pct={pct / 100} size={52} stroke={4}
          color={`rgb(${accent})`} label={loading ? '…' : `${Math.round(pct)}%`}
          sublabel="" bg="rgba(255,255,255,0.05)"
        />
        <div className="stat-body">
          {loading ? <Skeleton w={60} h={20} /> : <p className="stat-value">{value}</p>}
          <p className="stat-label">{icon} {label}</p>
          {loading ? <Skeleton w={80} h={12} /> : (
            isEmpty && emptyNudge
              ? <p className="stat-nudge">{emptyNudge}</p>
              : <p className="stat-sub">{sub}</p>
          )}
        </div>
      </div>
      <Sparkline data={sparkData} color={`rgb(${accent})`} width={110} height={26} />
    </button>
  );
}

// ─── Today's Focus Card ───────────────────────────────────────────────────────

function TodaysFocus({
  insight, loading, onFeedback, onDismiss,
}: {
  insight: Intervention | null;
  loading: boolean;
  onFeedback: (r: 'accepted' | 'snoozed') => void;
  onDismiss: () => void;
}) {
  const [fb, setFb] = useState<'accepted' | 'snoozed' | null>(null);

  useEffect(() => { setFb(null); }, [insight]);

  if (loading && !insight) {
    return (
      <div className="focus-card card focus-card--loading">
        <div className="focus-card-inner">
          <Skeleton w={120} h={13} />
          <Skeleton w="80%" h={22} radius={4} />
          <Skeleton w="60%" h={15} radius={4} />
        </div>
      </div>
    );
  }

  if (!insight) {
    return (
      <div className="focus-card card focus-card--empty">
        <div className="focus-orb" aria-hidden>✦</div>
        <div className="focus-card-inner">
          <p className="focus-eyebrow">TODAY'S FOCUS</p>
          <p className="focus-title">Alfred is analysing your patterns…</p>
          <p className="focus-body">Insights will appear here automatically as your data builds up.</p>
        </div>
      </div>
    );
  }

  const gradients: Record<string, string> = {
    meal_gap:        'linear-gradient(135deg, rgba(201,168,76,0.15) 0%, rgba(201,168,76,0.04) 100%)',
    dehydration:     'linear-gradient(135deg, rgba(88,166,255,0.15) 0%, rgba(88,166,255,0.04) 100%)',
    poor_sleep:      'linear-gradient(135deg, rgba(168,130,255,0.15) 0%, rgba(168,130,255,0.04) 100%)',
    recovery_needed: 'linear-gradient(135deg, rgba(248,81,73,0.12) 0%, rgba(248,81,73,0.04) 100%)',
    low_energy:      'linear-gradient(135deg, rgba(63,185,80,0.12) 0%, rgba(63,185,80,0.04) 100%)',
  };
  const bg = gradients[insight.signal_type ?? ''] ?? gradients['meal_gap'];

  return (
    <div className="focus-card card" style={{ background: bg }}>
      <div className="focus-orb" aria-hidden>✦</div>
      <div className="focus-card-inner">
        <p className="focus-eyebrow">TODAY'S FOCUS · {Math.round(insight.confidence_score * 100)}% confident</p>
        <p className="focus-title">{insight.title}</p>
        <p className="focus-body">{insight.message}</p>
        {!fb ? (
          <div className="focus-actions">
            <button className="btn-primary btn-sm" onClick={() => { setFb('accepted'); onFeedback('accepted'); }}>✓ Got it</button>
            <button className="btn-ghost btn-sm"   onClick={() => { setFb('snoozed');  onFeedback('snoozed');  }}>🕐 Later</button>
            <button className="btn-ghost btn-sm focus-dismiss" onClick={onDismiss}>✕</button>
          </div>
        ) : (
          <p className="focus-fb">{fb === 'accepted' ? '✓ Noted — keep it up!' : '🕐 Alfred will remind you later'}</p>
        )}
      </div>
    </div>
  );
}

// ─── Body State Bar ───────────────────────────────────────────────────────────

function BodyStateBar({ state, loading }: { state: BodyState; loading: boolean }) {
  const rings = [
    { key: 'energy',    label: 'Energy',    pct: state.energy,    color: '#3fb950' },
    { key: 'recovery',  label: 'Recovery',  pct: state.recovery,  color: '#a78bfa' },
    { key: 'hydration', label: 'Hydration', pct: state.hydration, color: '#58a6ff' },
    { key: 'focus',     label: 'Focus',     pct: state.focus,     color: '#c9a84c' },
  ];

  return (
    <div className="body-state-bar card">
      <div className="body-state-header">
        <span className="body-state-label">Body State</span>
        <span className="body-state-pill" style={{ background: `${state.color}22`, color: state.color, borderColor: `${state.color}44` }}>
          {state.label}
        </span>
      </div>
      <div className="body-state-rings">
        {rings.map(({ key, label, pct, color }) => (
          <div key={key} className="body-ring-item">
            {loading
              ? <Skeleton w={52} h={52} radius={26} />
              : <ProgressRing pct={pct / 100} size={52} stroke={4} color={color} label={`${pct}`} bg="rgba(255,255,255,0.05)" />
            }
            <span className="body-ring-label">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Predictive Alerts ────────────────────────────────────────────────────────

function PredictiveAlerts({ alerts }: { alerts: PredictiveAlert[] }) {
  if (!alerts.length) return null;
  const urgencyColor = { low: '#c9a84c', med: '#f97316', high: '#f85149' };
  return (
    <div className="predictive-alerts">
      {alerts.map((a, i) => (
        <div key={i} className="alert-pill" style={{ '--alert-color': urgencyColor[a.urgency] } as React.CSSProperties}>
          <span className="alert-icon">{a.icon}</span>
          <span className="alert-msg">{a.message}</span>
          <span className="alert-eta">{a.eta}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Quick Actions ────────────────────────────────────────────────────────────

function QuickActions({ onNavigate, onLogWater }: { onNavigate: (p: Page) => void; onLogWater: () => void }) {
  const actions = [
    { icon: '🍽', label: 'Log Meal',     fn: () => onNavigate('nutrition') },
    { icon: '💧', label: '+250 ml',      fn: onLogWater },
    { icon: '🌙', label: 'Log Sleep',    fn: () => onNavigate('sleep') },
    { icon: '⚡', label: 'Log Activity', fn: () => onNavigate('activity') },
  ];
  return (
    <div className="quick-actions">
      <p className="quick-actions-label">1-Click Log</p>
      <div className="quick-actions-row">
        {actions.map(({ icon, label, fn }) => (
          <button key={label} className="quick-action-btn" onClick={fn}>
            <span className="qa-icon">{icon}</span>
            <span className="qa-label">{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Timeline Preview ─────────────────────────────────────────────────────────

function TimelinePreview({ events, onViewAll }: { events: TimelineEvent[]; onViewAll: () => void }) {
  const recent = events.slice(-4).reverse();
  return (
    <div className="timeline-preview card">
      <div className="tl-preview-header">
        <span className="card-title">Today's Log</span>
        <button className="btn-ghost btn-xs" onClick={onViewAll}>View all →</button>
      </div>
      {recent.length === 0 ? (
        <div className="tl-empty">
          <p className="tl-empty-icon">📋</p>
          <p className="tl-empty-title">Nothing logged yet</p>
          <p className="tl-empty-sub">Your activities will appear here as you log them.</p>
        </div>
      ) : (
        <div className="tl-list">
          {recent.map((e) => (
            <div key={e.id} className={`tl-item tl-item--${e.type}`}>
              <span className="tl-icon">{e.icon}</span>
              <div className="tl-body">
                <p className="tl-label">{e.label}</p>
                <p className="tl-detail">{e.detail}</p>
              </div>
              <span className="tl-time">{fmtTime(e.time)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Intervention Card ────────────────────────────────────────────────────────

function InterventionCard({ intervention, feedback, onFeedback, onDismiss }: {
  intervention: Intervention;
  feedback: 'accepted' | 'snoozed' | null;
  onFeedback: (r: 'accepted' | 'snoozed') => void;
  onDismiss: () => void;
}) {
  return (
    <div className="card intervention-card intervention-card--anim">
      <div className="card-header">
        <div className="card-icon">🎯</div>
        <span className="card-title">Alfred's Recommendation</span>
        <button className="dismiss-btn" onClick={onDismiss}>✕</button>
      </div>
      <p className="intervention-title">{intervention.title}</p>
      <p className="intervention-message">{intervention.message}</p>
      <div className="intervention-meta">
        <div className="confidence-bar-wrap">
          <span className="confidence-label">Confidence</span>
          <div className="confidence-bar">
            <div className="confidence-fill" style={{ width: `${Math.round(intervention.confidence_score * 100)}%` }} />
          </div>
          <span className="confidence-label">{Math.round(intervention.confidence_score * 100)}%</span>
        </div>
        <span className="status-tag">{feedback ?? intervention.status}</span>
      </div>
      {!feedback && (
        <div className="actions-row" style={{ marginTop: 16 }}>
          <button className="btn-primary btn-sm"   onClick={() => onFeedback('accepted')}>✓ Accept</button>
          <button className="btn-secondary btn-sm" onClick={() => onFeedback('snoozed')}>🕐 Remind me later</button>
        </div>
      )}
      {feedback === 'accepted' && <p className="feedback-ok">✓ Accepted — well done!</p>}
    </div>
  );
}

// ─── Dashboard Page ───────────────────────────────────────────────────────────

function DashboardPage({
  stats, insight, insightLoading, timeline, alerts, bodyState,
  onNavigate, onFeedback, onDismiss, onLogWater,
}: {
  stats: Stats; insight: Intervention | null; insightLoading: boolean;
  timeline: TimelineEvent[]; alerts: PredictiveAlert[]; bodyState: BodyState;
  onNavigate: (p: Page) => void;
  onFeedback: (r: 'accepted' | 'snoozed') => void;
  onDismiss: () => void;
  onLogWater: () => void;
}) {
  const waterMl   = getWaterToday();
  const waterPct  = Math.min(100, (waterMl / 2000) * 100);

  return (
    <div className="page">
      {/* Greeting */}
      <div className="dashboard-greeting">
        <div>
          <h2 className="greeting-text">{greeting()}.</h2>
          <p className="greeting-date">{fmtDate()}</p>
        </div>
        {stats.waterStreak > 0 && (
          <div className="streak-badge">🔥 {stats.waterStreak} day streak</div>
        )}
      </div>

      {/* Today's Focus (auto insight) */}
      <TodaysFocus insight={insight} loading={insightLoading} onFeedback={onFeedback} onDismiss={onDismiss} />

      {/* Body state */}
      <BodyStateBar state={bodyState} loading={insightLoading && !insight} />

      {/* Predictive alerts */}
      <PredictiveAlerts alerts={alerts} />

      {/* Stat cards */}
      <div className="stat-grid">
        <StatCard icon="💧" label="Hydration" value={`${Math.round(waterPct)}%`}
          sub={`${(waterMl/1000).toFixed(1)} L of 2 L`} accent="88,166,255"
          pct={waterPct} sparkData={SPARKS.water}
          emptyNudge="Start logging water"
          onClick={() => onNavigate('hydration')} />
        <StatCard icon="🌙" label="Sleep"
          value={stats.lastSleepHours != null ? `${stats.lastSleepHours}h` : '—'}
          sub={stats.lastSleepQuality != null ? `Quality ${stats.lastSleepQuality}/10` : ''}
          accent="168,130,255"
          pct={stats.lastSleepHours != null ? Math.min(100, (stats.lastSleepHours / 8) * 100) : 0}
          sparkData={SPARKS.sleep}
          emptyNudge="Log last night's sleep"
          onClick={() => onNavigate('sleep')} />
        <StatCard icon="🍽" label="Nutrition"
          value={stats.mealsToday > 0 ? `${stats.mealsToday}` : '—'}
          sub={stats.mealsToday > 0 ? `meal${stats.mealsToday > 1 ? 's' : ''} today` : ''}
          accent="201,168,76"
          pct={Math.min(100, (stats.mealsToday / 3) * 100)}
          sparkData={SPARKS.meals}
          emptyNudge="Log your first meal"
          onClick={() => onNavigate('nutrition')} />
        <StatCard icon="⚡" label="Activity"
          value={stats.activityMinutesToday > 0 ? `${stats.activityMinutesToday}m` : '—'}
          sub={stats.activityMinutesToday > 0 ? 'active today' : ''}
          accent="63,185,80"
          pct={Math.min(100, (stats.activityMinutesToday / 30) * 100)}
          sparkData={SPARKS.activity}
          emptyNudge="Move for 30 minutes"
          onClick={() => onNavigate('activity')} />
      </div>

      {/* Quick actions */}
      <QuickActions onNavigate={onNavigate} onLogWater={onLogWater} />

      {/* Timeline preview */}
      <TimelinePreview events={timeline} onViewAll={() => onNavigate('timeline')} />
    </div>
  );
}

// ─── Timeline Page ────────────────────────────────────────────────────────────

function TimelinePage({ events }: { events: TimelineEvent[] }) {
  const byHour = events.reduce<Record<number, TimelineEvent[]>>((acc, e) => {
    const h = e.time.getHours();
    (acc[h] = acc[h] ?? []).push(e);
    return acc;
  }, {});
  const hours = Object.keys(byHour).map(Number).sort((a, b) => b - a);

  return (
    <div className="page">
      <PageHeader title="Daily Timeline" sub={`Everything logged on ${fmtDate()}`} />
      {hours.length === 0 ? (
        <div className="empty-state card">
          <div className="empty-state-icon">📅</div>
          <p className="empty-state-title">Your day is a blank canvas</p>
          <p className="empty-state-sub">Log meals, water, sleep and activities — they'll appear here in a chronological story of your day.</p>
        </div>
      ) : (
        <div className="timeline-full">
          {hours.map((h) => (
            <div key={h} className="tl-hour-group">
              <div className="tl-hour-label">{`${h % 12 || 12}${h < 12 ? ' AM' : ' PM'}`}</div>
              <div className="tl-hour-events">
                {byHour[h].sort((a, b) => a.time.getTime() - b.time.getTime()).map((e) => (
                  <div key={e.id} className={`tl-item tl-item--${e.type} tl-item--full`}>
                    <span className="tl-icon">{e.icon}</span>
                    <div className="tl-body">
                      <p className="tl-label">{e.label}</p>
                      <p className="tl-detail">{e.detail}</p>
                    </div>
                    <span className="tl-time">{fmtTime(e.time)}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── AI Insights Page ─────────────────────────────────────────────────────────

function AIPage({
  insight, insightLoading, feedback, onRefresh, onFeedback, onDismiss,
}: {
  insight: Intervention | null; insightLoading: boolean;
  feedback: 'accepted' | 'snoozed' | null;
  onRefresh: () => void; onFeedback: (r: 'accepted' | 'snoozed') => void; onDismiss: () => void;
}) {
  return (
    <div className="page">
      <PageHeader title="Alfred AI" sub="Your personal AI wellness advisor — insights are generated automatically." />

      <div className="ai-generate-area">
        <div className={`ai-orb ${insightLoading ? 'ai-orb--pulse' : ''}`} aria-hidden>
          <div className="ai-orb-ring" />
          <div className="ai-orb-ring ai-orb-ring--2" />
          <span className="ai-orb-icon">✦</span>
        </div>
        <div className="ai-generate-text">
          <p className="ai-headline">{insightLoading ? 'Analysing your patterns…' : 'Insights update automatically'}</p>
          <p className="ai-sub">Alfred monitors your nutrition, sleep, hydration and activity in real time to surface the most impactful action right now.</p>
        </div>
        <button className="btn-secondary btn-lg" onClick={onRefresh} disabled={insightLoading}>
          {insightLoading ? <><span className="spinner" /> Analysing…</> : '↻ Refresh Insight'}
        </button>
      </div>

      {insight && (
        <InterventionCard intervention={insight} feedback={feedback}
          onFeedback={onFeedback} onDismiss={onDismiss} />
      )}
    </div>
  );
}

// ─── Nutrition Page ───────────────────────────────────────────────────────────

function ConfidenceDots({ conf }: { conf: number }) {
  const filled = conf >= 0.75 ? 5 : conf >= 0.60 ? 4 : conf >= 0.45 ? 3 : conf >= 0.30 ? 2 : 1;
  const label  = conf >= 0.75 ? 'high' : conf >= 0.45 ? 'medium' : 'estimate';
  return (
    <span className="conf-dots" title={`Confidence: ${Math.round(conf * 100)}%`}>
      {[1,2,3,4,5].map(i => <span key={i} className={`conf-dot${i <= filled ? ' conf-dot--on' : ''}`} />)}
      <span className="conf-label">{label}</span>
    </span>
  );
}

function MacroBar({ calories, protein_g, carbs_g, fat_g, fiber_g }: Pick<NutritionPreview, 'calories'|'protein_g'|'carbs_g'|'fat_g'|'fiber_g'>) {
  return (
    <div className="macro-bar">
      <div className="macro-cell macro-cell--cal">
        <span className="macro-val">{Math.round(calories)}</span>
        <span className="macro-lbl">kcal</span>
      </div>
      <div className="macro-sep" />
      <div className="macro-cell">
        <span className="macro-val">{protein_g.toFixed(1)}<span className="macro-unit">g</span></span>
        <span className="macro-lbl">protein</span>
      </div>
      <div className="macro-cell">
        <span className="macro-val">{carbs_g.toFixed(1)}<span className="macro-unit">g</span></span>
        <span className="macro-lbl">carbs</span>
      </div>
      <div className="macro-cell">
        <span className="macro-val">{fat_g.toFixed(1)}<span className="macro-unit">g</span></span>
        <span className="macro-lbl">fat</span>
      </div>
      <div className="macro-cell">
        <span className="macro-val">{fiber_g.toFixed(1)}<span className="macro-unit">g</span></span>
        <span className="macro-lbl">fiber</span>
      </div>
    </div>
  );
}

const METHOD_BADGE: Record<string, string> = {
  template: 'np-badge--green',
  parsed:   'np-badge--blue',
  fallback: 'np-badge--amber',
  ai:       'np-badge--purple',
};

function NutritionPage({ onSaved }: { onSaved: () => void }) {
  const [form, setForm] = useState({
    meal_time: '', meal_type: '', description: '', servings: 1,
  });
  const [saving, setSaving]   = useState(false);
  const [done, setDone]       = useState(false);
  const [parsing, setParsing] = useState(false);
  const [preview, setPreview] = useState<NutritionPreview | null>(null);
  const [ings, setIngs]       = useState<ParsedIngredient[]>([]);
  const [newIng, setNewIng]   = useState('');
  // Calories can be manually overridden; null = use preview value
  const [calOverride, setCalOverride] = useState<string>('');
  const parseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Live parse on description change ──────────────────────────────────────
  const triggerParse = useCallback((desc: string, servings: number) => {
    if (parseTimer.current) clearTimeout(parseTimer.current);
    if (!desc.trim()) { setPreview(null); setIngs([]); return; }
    parseTimer.current = setTimeout(async () => {
      setParsing(true);
      try {
        const res = await parseMeal(desc, servings);
        setPreview(res);
        setIngs(res.ingredients.map(i => ({ ...i })));
        if (!calOverride) { /* let preview drive */ }
      } catch {
        setPreview(null);
      } finally {
        setParsing(false);
      }
    }, 480);
  }, [calOverride]);

  // ── Recalculate from edited ingredient list ────────────────────────────────
  const recalc = async () => {
    if (!ings.length) return;
    const desc = ings.map(i => `${Math.round(i.amount_g)}g ${i.matched_key ?? i.name}`).join(', ');
    setParsing(true);
    try {
      const res = await parseMeal(desc, form.servings);
      setPreview(res);
      setIngs(res.ingredients.map(i => ({ ...i })));
    } finally {
      setParsing(false);
    }
  };

  // ── Add custom ingredient ──────────────────────────────────────────────────
  const addIngredient = () => {
    const t = newIng.trim();
    if (!t) return;
    setIngs(prev => [...prev, { name: t, matched_key: null, amount_g: 100, confidence: 0 }]);
    setNewIng('');
  };

  // ── Submit ─────────────────────────────────────────────────────────────────
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const calories  = calOverride ? Number(calOverride) : preview?.calories;
    await createMeal(USER_ID, {
      meal_time:  form.meal_time,
      meal_type:  form.meal_type,
      description: form.description,
      calories,
      protein_g: preview?.protein_g,
      carbs_g:   preview?.carbs_g,
      fat_g:     preview?.fat_g,
      fiber_g:   preview?.fiber_g,
    });
    setSaving(false); setDone(true); onSaved();
    setForm({ meal_time: '', meal_type: '', description: '', servings: 1 });
    setPreview(null); setIngs([]); setCalOverride('');
    setTimeout(() => setDone(false), 3000);
  };

  const QUICK_MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
  const displayPreview = preview ? {
    ...preview,
    calories: calOverride ? Number(calOverride) : preview.calories,
  } : null;

  return (
    <div className="page page--form">
      <PageHeader title="Log a Meal" sub="Track what you eat to help Alfred understand your nutrition patterns." />
      <FormCard icon="🍽" title="Meal Details">
        <div className="quick-type-row">
          {QUICK_MEALS.map((t) => (
            <button key={t} type="button"
              className={`quick-type-btn ${form.meal_type === t.toLowerCase() ? 'quick-type-btn--active' : ''}`}
              onClick={() => setForm((f) => ({ ...f, meal_type: t.toLowerCase() }))}>
              {t}
            </button>
          ))}
        </div>
        <form onSubmit={onSubmit}>
          <div className="form-grid">
            <div className="form-group">
              <label>Time</label>
              <input type="datetime-local" value={form.meal_time}
                onChange={(e) => setForm((f) => ({ ...f, meal_time: e.target.value }))} required />
            </div>
            <div className="form-group">
              <label>Type</label>
              <input placeholder="e.g. Lunch" value={form.meal_type}
                onChange={(e) => setForm((f) => ({ ...f, meal_type: e.target.value }))} required />
            </div>
            <div className="form-group full">
              <label className="label-with-status">
                Description
                {parsing && <span className="parse-spinner">analysing…</span>}
              </label>
              <input placeholder="e.g. chicken fried rice, or 200g grilled salmon with 150g rice"
                value={form.description}
                onChange={(e) => {
                  const v = e.target.value;
                  setForm((f) => ({ ...f, description: v }));
                  triggerParse(v, form.servings);
                }} required />
            </div>
            <div className="form-group">
              <label>Servings</label>
              <input type="number" min="0.5" max="10" step="0.5" value={form.servings}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setForm((f) => ({ ...f, servings: v }));
                  triggerParse(form.description, v);
                }} />
            </div>
            <div className="form-group">
              <label>Calories override</label>
              <input type="number" placeholder={preview ? `~${Math.round(preview.calories)} estimated` : 'kcal'}
                value={calOverride}
                onChange={(e) => setCalOverride(e.target.value)} />
            </div>
          </div>

          {/* ── Nutrition Preview ── */}
          {displayPreview && (
            <div className="np-preview">
              <div className="np-preview-header">
                <span className="np-dish">
                  {displayPreview.dish_matched ?? 'Custom meal'}
                </span>
                <span className={`np-badge ${METHOD_BADGE[displayPreview.method] ?? ''}`}>
                  {displayPreview.method}
                </span>
                <ConfidenceDots conf={displayPreview.confidence} />
              </div>

              <MacroBar
                calories={displayPreview.calories}
                protein_g={displayPreview.protein_g}
                carbs_g={displayPreview.carbs_g}
                fat_g={displayPreview.fat_g}
                fiber_g={displayPreview.fiber_g}
              />

              {/* ── Ingredient editor ── */}
              {ings.length > 0 && (
                <div className="ing-editor">
                  <div className="ing-editor-title">Ingredients</div>
                  {ings.map((ing, idx) => (
                    <div key={idx} className="ing-row">
                      <span className={`ing-name ${ing.matched_key ? '' : 'ing-name--unknown'}`}>
                        {ing.matched_key ?? ing.name}
                        {!ing.matched_key && <span className="ing-unknown-badge">?</span>}
                      </span>
                      <input
                        className="ing-amount"
                        type="number" min="0" step="1"
                        value={Math.round(ing.amount_g)}
                        onChange={(e) => setIngs(prev =>
                          prev.map((it, i) => i === idx ? { ...it, amount_g: Number(e.target.value) } : it)
                        )}
                      />
                      <span className="ing-unit">g</span>
                      <button type="button" className="ing-remove"
                        onClick={() => setIngs(prev => prev.filter((_, i) => i !== idx))}>
                        ×
                      </button>
                    </div>
                  ))}

                  {/* Add custom ingredient row */}
                  <div className="ing-add-row">
                    <input className="ing-add-input" placeholder="Add ingredient…"
                      value={newIng}
                      onChange={(e) => setNewIng(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addIngredient())}
                    />
                    <button type="button" className="ing-add-btn" onClick={addIngredient}>+</button>
                    <button type="button" className="ing-recalc-btn" onClick={recalc} disabled={parsing}>
                      {parsing ? '…' : '↻ Recalculate'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="form-footer">
            {done && <span className="save-ok">✓ Saved</span>}
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save Meal →'}
            </button>
          </div>
        </form>
      </FormCard>
    </div>
  );
}

// ─── Sleep Utilities ──────────────────────────────────────────────────────────

const SLEEP_HIST_KEY = 'alfred_sleep_v1';

type SleepRecord = {
  date: string; start: string; end: string;
  hours: number; quality: number; score: number; tags: string[];
};

function loadSleepHistory(): SleepRecord[] {
  try { return JSON.parse(localStorage.getItem(SLEEP_HIST_KEY) || '[]'); }
  catch { return []; }
}
function saveSleepHistory(r: SleepRecord[]) {
  localStorage.setItem(SLEEP_HIST_KEY, JSON.stringify(r.slice(0, 60)));
}
function fmtDur(h: number): string {
  const hh = Math.floor(h), mm = Math.round((h - hh) * 60);
  return mm > 0 ? `${hh}h ${mm}m` : `${hh}h`;
}
function calcSleepScore(hours: number, quality: number, history: SleepRecord[]): number {
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
function calcSleepDebt(history: SleepRecord[]): number {
  const r = history.slice(0, 7);
  return r.length ? Math.max(0, Math.round(r.reduce((a, e) => a + Math.max(0, 7.5 - e.hours), 0) * 10) / 10) : 0;
}
function getChronotype(history: SleepRecord[]): string | null {
  if (history.length < 5) return null;
  const beds = history.slice(0, 14).map(r => { const h = new Date(r.start).getHours(); return h < 12 ? h + 24 : h; });
  const avg  = beds.reduce((a, b) => a + b, 0) / beds.length;
  return avg < 22.5 ? '🌅 Early bird' : avg > 25 ? '🦉 Night owl' : '🌤 Intermediate';
}
function getBedtimeRec(history: SleepRecord[]): string {
  if (history.length < 3) return '11:00 PM';
  const wakes = history.slice(0, 7).map(r => { const d = new Date(r.end); return d.getHours() + d.getMinutes() / 60; });
  const avg   = wakes.reduce((a, b) => a + b, 0) / wakes.length;
  const bed   = ((avg - 8) + 24) % 24;
  const h     = Math.floor(bed), m = Math.round((bed - h) * 60);
  const h12   = bed > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${h12}:${m.toString().padStart(2, '0')} ${bed >= 12 && bed < 24 ? 'PM' : 'AM'}`;
}

// ─── Sleep ML ─────────────────────────────────────────────────────────────────
// Compare last 3 nights score vs the 3 before that → trend direction
function sleepTrend(history: SleepRecord[]): { dir: 'up' | 'down' | 'flat'; desc: string; color: string } {
  if (history.length < 6) return { dir: 'flat', desc: 'Not enough data yet', color: 'var(--text-muted)' };
  const recent = history.slice(0, 3).reduce((s, r) => s + r.score, 0) / 3;
  const older  = history.slice(3, 6).reduce((s, r) => s + r.score, 0) / 3;
  const delta  = Math.round(recent - older);
  if (delta >  4) return { dir: 'up',   desc: `↑ Improving (+${delta} pts)`,  color: 'var(--green)'     };
  if (delta < -4) return { dir: 'down', desc: `↓ Declining (${delta} pts)`,   color: 'var(--red)'       };
  return             { dir: 'flat', desc: '→ Stable',                          color: 'var(--text-muted)' };
}

// For each tag the user has ever selected, compute average quality delta vs baseline
// e.g. { "Caffeine": -1.8 } means caffeine nights scored 1.8 pts below average
function tagImpactMap(history: SleepRecord[]): Record<string, number> {
  if (history.length < 4) return {};
  const overall = history.reduce((s, r) => s + r.quality, 0) / history.length;
  const result: Record<string, number> = {};
  SLEEP_TAGS.forEach(tag => {
    const hits = history.filter(r => r.tags.includes(tag));
    if (hits.length < 2) return; // need at least 2 samples per tag
    result[tag] = Math.round((hits.reduce((s, r) => s + r.quality, 0) / hits.length - overall) * 10) / 10;
  });
  return result;
}

// Given tonight's tags + planned hours, predict quality using personal history
// Returns null when not enough history (< 3 nights)
function predictSleepQuality(
  tags: string[], hours: number,
  history: SleepRecord[], impacts: Record<string, number>,
): number | null {
  if (history.length < 3) return null;
  // Start from personal 7-night average quality
  let base = history.slice(0, 7).reduce((s, r) => s + r.quality, 0) / Math.min(7, history.length);
  // Apply learned tag impact
  tags.forEach(tag => { if (impacts[tag] !== undefined) base += impacts[tag]; });
  // Adjust for duration
  if (hours >= 7.5 && hours <= 8.5) base += 0.5;
  else if (hours > 0 && hours < 6.5) base -= 1.0;
  else if (hours > 0 && hours < 5.5) base -= 2.0;
  return Math.max(1, Math.min(10, Math.round(base * 10) / 10));
}

// ─── Sleep Timeline Bar ───────────────────────────────────────────────────────

function SleepTimelineBar({ start, end }: { start: string; end: string }) {
  const s = new Date(start), e = new Date(end);
  // Window: 8 PM → 12 PM next day (16 h)
  const WINDOW = 16;
  const norm   = (h: number) => ((h - 20 + 24) % 24);
  const sOff   = norm(s.getHours() + s.getMinutes() / 60);
  const eOff   = norm(e.getHours() + e.getMinutes() / 60);
  if (eOff <= sOff || eOff > WINDOW) return null;
  const left  = Math.max(0, (sOff / WINDOW) * 100);
  const width = Math.min(100 - left, ((eOff - sOff) / WINDOW) * 100);

  return (
    <div className="sleep-timeline">
      <div className="sleep-tl-track">
        <div className="sleep-tl-fill" style={{ left: `${left}%`, width: `${width}%` }} />
        <div className="sleep-tl-pin" style={{ left: `${left}%` }}>
          <span className="sleep-tl-time">{s.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        <div className="sleep-tl-pin sleep-tl-pin--end" style={{ left: `${Math.min(99, left + width)}%` }}>
          <span className="sleep-tl-time">{e.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </div>
      <div className="sleep-tl-axis">
        <span>8 PM</span><span>12 AM</span><span>4 AM</span><span>8 AM</span><span>12 PM</span>
      </div>
    </div>
  );
}

// ─── Sleep 7-day Chart ────────────────────────────────────────────────────────

function SleepWeekChart({ history }: { history: SleepRecord[] }) {
  const DAY = ['Su','Mo','Tu','We','Th','Fr','Sa'];
  const W = 300, H = 90, BW = 30, GAP = 12, PAD = 6, MAX = 10;
  const slots = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i));
    return { label: DAY[d.getDay()], rec: history.find(r => r.date === d.toISOString().slice(0,10)) ?? null, today: i === 6 };
  });
  const targetY = H - PAD - (7.5 / MAX) * (H - PAD * 2);

  return (
    <svg viewBox={`0 0 ${W} ${H + 18}`} className="sleep-week-svg">
      <line x1={0} y1={targetY} x2={W} y2={targetY} stroke="rgba(201,168,76,0.3)" strokeWidth={1} strokeDasharray="4 3" />
      <text x={W - 2} y={targetY - 3} fill="rgba(201,168,76,0.55)" fontSize={9} textAnchor="end">7.5h</text>
      {slots.map((slot, i) => {
        const x    = i * (BW + GAP) + PAD;
        const hrs  = slot.rec?.hours ?? 0;
        const bH   = Math.max(3, (hrs / MAX) * (H - PAD * 2));
        const clr  = !slot.rec ? 'rgba(255,255,255,0.06)' : hrs >= 7 ? '#3fb950' : hrs >= 6 ? '#f97316' : '#f85149';
        return (
          <g key={i}>
            <rect x={x} y={H - PAD - bH} width={BW} height={bH} fill={clr} rx={5} opacity={slot.today ? 1 : 0.72} />
            {slot.rec && <text x={x + BW/2} y={H - PAD - bH - 4} fill={clr} fontSize={9} textAnchor="middle" fontWeight="600">{fmtDur(hrs)}</text>}
            <text x={x + BW/2} y={H + 13} fill={slot.today ? 'var(--text)' : 'rgba(122,136,153,0.8)'} fontSize={10} textAnchor="middle" fontWeight={slot.today ? '700' : '400'}>{slot.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── Sleep Page ───────────────────────────────────────────────────────────────

const SLEEP_QUALITY_OPTIONS = [
  { v: 2,  e: '😫', l: 'Terrible' },
  { v: 4,  e: '😔', l: 'Poor'     },
  { v: 6,  e: '😐', l: 'Average'  },
  { v: 8,  e: '😊', l: 'Good'     },
  { v: 10, e: '✨', l: 'Excellent' },
];
const SLEEP_TAGS = ['Caffeine', 'Alcohol', 'Stress', 'Late workout', 'Screen time', 'Restless'];

// Format local date as "YYYY-MM-DD" (for history keys)
function toLocalDT(d: Date): string {
  const p = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

// "23:00" → "11:00 PM"
function fmt12(t: string): string {
  const [h, m] = t.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const h12    = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${h12}:${m.toString().padStart(2, '0')} ${suffix}`;
}

// Given time strings ("23:00", "07:00"), compute actual Date objects.
// Sleep hour >= 20 → started last night; otherwise started today (early morning).
function computeSleepDates(sleepT: string, wakeT: string): { start: Date; end: Date } {
  const now = new Date();
  const [sh, sm] = sleepT.split(':').map(Number);
  const [wh, wm] = wakeT.split(':').map(Number);

  const start = new Date(now);
  if (sh >= 20) start.setDate(start.getDate() - 1); // PM bedtime → yesterday
  start.setHours(sh, sm, 0, 0);

  const end = new Date(now);
  end.setHours(wh, wm, 0, 0);
  if (end.getTime() <= start.getTime()) end.setDate(end.getDate() + 1); // next day

  return { start, end };
}

function mkDefaultSleepForm() {
  const now  = new Date();
  const hour = now.getHours();
  // Morning (4-14h): user just woke up → wake = now; otherwise → 07:30 AM default
  const wakeT = (hour >= 4 && hour < 14)
    ? `${hour.toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}`
    : '07:30';
  return { sleep_time: '23:00', wake_time: wakeT, quality: 7, tags: [] as string[] };
}

function SleepPage({ onSaved }: { onSaved: (hours: number, quality: number) => void }) {
  const [history, setHistory] = useState<SleepRecord[]>(loadSleepHistory);
  const [form, setForm]       = useState(mkDefaultSleepForm);
  const [saving, setSaving]   = useState(false);
  const [done, setDone]       = useState(false);
  const [napDone, setNapDone] = useState<number | null>(null);

  // ── Computed dates (derived from time strings) ────────────────────────────
  const { start: sleepStart, end: sleepEnd } = useMemo(
    () => computeSleepDates(form.sleep_time, form.wake_time),
    [form.sleep_time, form.wake_time],
  );

  // ── Derived (live) ────────────────────────────────────────────────────────
  const hours = useMemo(() => {
    const diff = (sleepEnd.getTime() - sleepStart.getTime()) / 3_600_000;
    return diff > 0 && diff < 24 ? Math.round(diff * 10) / 10 : 0;
  }, [sleepStart, sleepEnd]);

  const score     = useMemo(() => hours > 0 ? calcSleepScore(hours, form.quality, history) : 0,   [hours, form.quality, history]);
  const debt      = useMemo(() => calcSleepDebt(history),  [history]);
  const chronotype = useMemo(() => getChronotype(history), [history]);
  const bedRec    = useMemo(() => getBedtimeRec(history),  [history]);
  const trend     = useMemo(() => sleepTrend(history),     [history]);
  const impacts   = useMemo(() => tagImpactMap(history),   [history]);
  const qualPred  = useMemo(() => predictSleepQuality(form.tags, hours, history, impacts), [form.tags, hours, history, impacts]);

  const insights = useMemo(() => {
    const out: { icon: string; text: string; type: 'green'|'orange'|'red'|'blue' }[] = [];
    if (hours > 0) {
      const diff = hours - 7.5;
      if      (diff < -2)   out.push({ icon: '⚠️', text: `${fmtDur(-diff)} below optimal — recovery impacted`,     type: 'red'    });
      else if (diff < -0.5) out.push({ icon: '🔶', text: `${fmtDur(-diff)} below your 7.5h target`,               type: 'orange' });
      else if (diff > 1.5)  out.push({ icon: '💤', text: 'Slightly long — may cause afternoon grogginess',         type: 'blue'   });
      else                  out.push({ icon: '✅', text: 'Optimal duration — great recovery ahead',                 type: 'green'  });
    }
    if      (debt > 5) out.push({ icon: '🧠', text: `${debt}h sleep debt this week — prioritise rest`,             type: 'red'    });
    else if (debt > 2) out.push({ icon: '📊', text: `${debt}h sleep debt accumulated this week`,                   type: 'orange' });
    if      (score >= 85 && hours > 0) out.push({ icon: '⚡', text: 'High recovery — great day for peak performance', type: 'green' });
    else if (score > 0 && score < 50)  out.push({ icon: '😴', text: 'Recovery likely low — consider a 20-min nap',   type: 'orange'});
    if (history.length >= 1 && hours > 0) {
      const d = hours - history[0].hours;
      if (Math.abs(d) >= 0.5) out.push({ icon: '📅', text: `${d > 0 ? '+' : ''}${fmtDur(Math.abs(d))} vs last night`, type: d > 0 ? 'green' : 'orange' });
    }
    return out;
  }, [hours, score, debt, history]);

  const scoreColor = score >= 80 ? '#3fb950' : score >= 60 ? '#c9a84c' : score >= 40 ? '#f97316' : '#f85149';

  // ── Smart shortcuts ───────────────────────────────────────────────────────
  const fillWokeNow = () => {
    const now = new Date();
    setForm(f => ({ ...f, wake_time: `${now.getHours().toString().padStart(2,'0')}:${now.getMinutes().toString().padStart(2,'0')}` }));
  };
  const fillSameAsYesterday = () => {
    const last = history[0]; if (!last) return;
    const p = (n: number) => n.toString().padStart(2, '0');
    const s = new Date(last.start), e = new Date(last.end);
    setForm(f => ({
      ...f,
      sleep_time: `${p(s.getHours())}:${p(s.getMinutes())}`,
      wake_time:  `${p(e.getHours())}:${p(e.getMinutes())}`,
      quality: last.quality,
    }));
  };

  // ── Nap quick-log ─────────────────────────────────────────────────────────
  const logNap = async (minutes: number) => {
    const end = new Date(), start = new Date(end.getTime() - minutes * 60_000);
    await createSleep(USER_ID, { sleep_start: start.toISOString(), sleep_end: end.toISOString(), quality_score: 6 });
    const entry: SleepRecord = {
      date: toLocalDT(end).slice(0, 10), start: start.toISOString(), end: end.toISOString(),
      hours: minutes / 60, quality: 6, score: 50, tags: ['nap'],
    };
    const updated = [entry, ...history];
    saveSleepHistory(updated); setHistory(updated);
    setNapDone(minutes); setTimeout(() => setNapDone(null), 2500);
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    await createSleep(USER_ID, { sleep_start: sleepStart.toISOString(), sleep_end: sleepEnd.toISOString(), quality_score: form.quality });
    const today  = toLocalDT(new Date()).slice(0, 10);
    const entry: SleepRecord = { date: today, start: sleepStart.toISOString(), end: sleepEnd.toISOString(), hours, quality: form.quality, score, tags: form.tags };
    const updated = [entry, ...history.filter(r => r.date !== today)];
    saveSleepHistory(updated); setHistory(updated);
    // Sync to alfred_context for cross-feature intelligence
    try {
      const ctx = { ...JSON.parse(localStorage.getItem('alfred_context') || '{}'), lastSleepQuality: form.quality, lastSleepHours: hours };
      localStorage.setItem('alfred_context', JSON.stringify(ctx));
    } catch { /* ignore */ }
    setSaving(false); setDone(true);
    onSaved(hours, form.quality);
    setTimeout(() => setDone(false), 3000);
  };

  return (
    <div className="page sleep-page">
      <PageHeader title="Sleep" sub="Track your rest so Alfred can optimise your recovery." />

      {/* ── Smart shortcuts ── */}
      <div className="sleep-shortcuts">
        <button type="button" className="sleep-shortcut-btn" onClick={fillWokeNow}>⏰ Woke just now</button>
        {history.length > 0 && (
          <button type="button" className="sleep-shortcut-btn" onClick={fillSameAsYesterday}>📋 Same as yesterday</button>
        )}
        <span className="sleep-shortcut-sep" />
        <span className="sleep-bed-rec">Tonight: sleep by <strong>{bedRec}</strong></span>
      </div>

      <form onSubmit={onSubmit}>
        {/* ── Score + Inputs ── */}
        <div className="sleep-main-grid">
          <div className="sleep-score-col">
            <div className="sleep-score-wrap" style={{ '--score-glow': scoreColor } as React.CSSProperties}>
              <ProgressRing pct={score} size={118} stroke={8} color={scoreColor}
                label={score > 0 ? String(score) : '—'}
                sublabel={score >= 85 ? 'Excellent' : score >= 70 ? 'Good' : score >= 55 ? 'Fair' : score > 0 ? 'Poor' : 'sleep score'} />
              {score >= 80 && <div className="sleep-score-glow" />}
            </div>
            {trend.dir !== 'flat' && (
              <div className="sleep-trend-badge" style={{ color: trend.color }}>{trend.desc}</div>
            )}
            <div className="sleep-debt-pill">
              <span className="sleep-debt-num">{debt}h</span>
              <span className="sleep-debt-txt">sleep debt</span>
            </div>
            {chronotype && <div className="sleep-chronotype">{chronotype}</div>}
          </div>

          <div className="sleep-inputs-col">
            <div className="sleep-duration-display">
              {hours > 0 ? (
                <>
                  <span className="sleep-dur-val">{fmtDur(hours)}</span>
                  <span className={`sleep-dur-tag ${hours >= 7 && hours <= 9 ? 'sleep-dur-tag--ok' : hours < 6 ? 'sleep-dur-tag--bad' : 'sleep-dur-tag--warn'}`}>
                    {hours >= 7 && hours <= 9 ? '✓ optimal' : hours < 7 ? `${fmtDur(7.5 - hours)} short` : 'slightly long'}
                  </span>
                </>
              ) : <span className="sleep-dur-empty">Set times →</span>}
            </div>
            <div className="sleep-time-inputs">
              <div className="sleep-time-group">
                <span className="sleep-time-icon">🌙</span>
                <div className="sleep-time-body">
                  <label className="sleep-time-label">Fell asleep</label>
                  <input type="time" className="sleep-time-input" value={form.sleep_time}
                    onChange={e => setForm(f => ({ ...f, sleep_time: e.target.value }))} required />
                  <span className="sleep-time-sub">{fmt12(form.sleep_time)}</span>
                </div>
              </div>
              <div className="sleep-time-arrow">→</div>
              <div className="sleep-time-group">
                <span className="sleep-time-icon">☀️</span>
                <div className="sleep-time-body">
                  <label className="sleep-time-label">Woke up</label>
                  <input type="time" className="sleep-time-input" value={form.wake_time}
                    onChange={e => setForm(f => ({ ...f, wake_time: e.target.value }))} required />
                  <span className="sleep-time-sub">{fmt12(form.wake_time)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Visual timeline ── */}
        {hours > 0 && <SleepTimelineBar start={sleepStart.toISOString()} end={sleepEnd.toISOString()} />}

        {/* ── Quality picker ── */}
        <div className="sleep-section">
          <div className="sleep-section-label">Sleep quality</div>
          <div className="sleep-quality-picker">
            {SLEEP_QUALITY_OPTIONS.map(opt => (
              <button key={opt.v} type="button"
                className={`sleep-quality-opt ${form.quality === opt.v ? 'sleep-quality-opt--active' : ''}`}
                onClick={() => setForm(f => ({ ...f, quality: opt.v }))}>
                <span className="sleep-qual-emoji">{opt.e}</span>
                <span className="sleep-qual-label">{opt.l}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ── Live insights ── */}
        {insights.length > 0 && (
          <div className="sleep-insights">
            {insights.map((ins, i) => (
              <div key={i} className={`sleep-insight sleep-insight--${ins.type}`}>
                <span className="sleep-insight-icon">{ins.icon}</span>
                <span>{ins.text}</span>
              </div>
            ))}
          </div>
        )}

        {/* ── Tags ── */}
        <div className="sleep-section">
          <div className="sleep-section-label">
            Factors (optional)
            {qualPred !== null && (
              <span className="sleep-qual-pred">
                Predicted quality: <strong style={{ color: qualPred >= 7 ? 'var(--green)' : qualPred >= 5 ? 'var(--accent)' : 'var(--red)' }}>{qualPred}/10</strong>
              </span>
            )}
          </div>
          <div className="sleep-tags">
            {SLEEP_TAGS.map(t => {
              const impact = impacts[t];
              return (
                <button key={t} type="button"
                  className={`sleep-tag ${form.tags.includes(t) ? 'sleep-tag--active' : ''}`}
                  onClick={() => setForm(f => ({
                    ...f, tags: f.tags.includes(t) ? f.tags.filter(x => x !== t) : [...f.tags, t],
                  }))}>
                  {t}
                  {impact !== undefined && (
                    <span className={`sleep-tag-impact ${impact < 0 ? 'sleep-tag-impact--neg' : 'sleep-tag-impact--pos'}`}>
                      {impact > 0 ? '+' : ''}{impact}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="form-footer">
          {done && <span className="save-ok">✓ Saved</span>}
          <button type="submit" className="btn-primary" disabled={saving || hours <= 0}>
            {saving ? 'Saving…' : 'Save Sleep →'}
          </button>
        </div>
      </form>

      {/* ── 7-day chart ── */}
      <div className="sleep-week-section">
        <div className="sleep-week-header">
          <span className="sleep-week-title">Last 7 nights</span>
          <span className="sleep-week-legend">
            <span className="sleep-legend-dot sleep-legend-dot--green" /> ≥7h
            <span className="sleep-legend-dot sleep-legend-dot--orange" /> 6–7h
            <span className="sleep-legend-dot sleep-legend-dot--red" /> &lt;6h
          </span>
        </div>
        <SleepWeekChart history={history} />
      </div>

      {/* ── Nap quick-log ── */}
      <div className="sleep-nap-section">
        <div className="sleep-section-label">Quick nap</div>
        <div className="sleep-nap-row">
          {[15, 20, 30].map(m => (
            <button key={m} type="button" className="sleep-nap-btn" onClick={() => logNap(m)}>
              💤 {m} min
            </button>
          ))}
          {napDone && <span className="save-ok">✓ {napDone}min nap logged</span>}
        </div>
      </div>
    </div>
  );
}

// ─── Activity helpers ─────────────────────────────────────────────────────────

const ACT_HIST_KEY = 'alfred_activity_v1';

type ActivityRecord = {
  date: string; type: string; duration: number;
  calories: number; intensity: 'low' | 'moderate' | 'high'; start: string;
};

function loadActivityHistory(): ActivityRecord[] {
  try { return JSON.parse(localStorage.getItem(ACT_HIST_KEY) || '[]'); }
  catch { return []; }
}
function saveActivityHistory(r: ActivityRecord[]) {
  localStorage.setItem(ACT_HIST_KEY, JSON.stringify(r.slice(0, 90)));
}

const ACT_MET: Record<string, number> = {
  running: 9.8, jogging: 7.0, walking: 3.5, cycling: 7.5, biking: 7.5,
  gym: 5.0, yoga: 2.5, swimming: 7.0, hiit: 10.0, pilates: 3.0,
  stretching: 2.3, dancing: 5.5, boxing: 9.0, rowing: 7.0,
};
const ACT_INTENSITY: Record<string, 'low' | 'moderate' | 'high'> = {
  running: 'high', jogging: 'moderate', walking: 'low', cycling: 'moderate', biking: 'moderate',
  gym: 'moderate', yoga: 'low', swimming: 'high', hiit: 'high', pilates: 'low',
  stretching: 'low', dancing: 'moderate', boxing: 'high', rowing: 'high',
};
const ACT_ICONS: Record<string, string> = {
  running: '🏃', jogging: '🏃', walking: '🚶', cycling: '🚴', biking: '🚴',
  gym: '🏋️', yoga: '🧘', swimming: '🏊', hiit: '🔥', pilates: '🧘',
  stretching: '🤸', dancing: '💃', boxing: '🥊', rowing: '🚣',
};

function actCalories(type: string, durationMin: number): number {
  const met = ACT_MET[type.toLowerCase()] ?? 5.0;
  return Math.round((met * 70 * durationMin) / 60);
}
function actIntensity(type: string): 'low' | 'moderate' | 'high' {
  return ACT_INTENSITY[type.toLowerCase()] ?? 'moderate';
}
function actIcon(type: string): string {
  return ACT_ICONS[type.toLowerCase()] ?? '⚡';
}

function parseActivityText(text: string): { type: string; duration: number } {
  const lower = text.toLowerCase();
  let duration = 0;
  const minM = lower.match(/(\d+(?:\.\d+)?)\s*min/);
  const hrM  = lower.match(/(\d+(?:\.\d+)?)\s*h(?:our)?/);
  const kmM  = lower.match(/(\d+(?:\.\d+)?)\s*km/);
  const miM  = lower.match(/(\d+(?:\.\d+)?)\s*mi(?:le)?/);
  if (minM)     duration = Math.round(parseFloat(minM[1]));
  else if (hrM) duration = Math.round(parseFloat(hrM[1]) * 60);
  else if (kmM) duration = Math.round(parseFloat(kmM[1]) * 6);
  else if (miM) duration = Math.round(parseFloat(miM[1]) * 10);
  const TYPES = ['running','jogging','walking','cycling','biking','swimming',
                 'yoga','hiit','pilates','boxing','rowing','stretching','dancing','gym'];
  const type = TYPES.find(t => lower.includes(t)) ??
    (lower.includes('run') ? 'running' : lower.includes('walk') ? 'walking' :
     lower.includes('bike') || lower.includes('cycle') ? 'cycling' :
     lower.includes('swim') ? 'swimming' : '');
  return { type, duration };
}

function actTrainingLoad(history: ActivityRecord[]): number {
  const M = { high: 3, moderate: 2, low: 1 };
  return history.slice(0, 7).reduce((s, r) => s + r.duration * (M[r.intensity] ?? 2), 0);
}

function actStreak(history: ActivityRecord[]): number {
  if (!history.length) return 0;
  const dates = new Set(history.map(r => r.date));
  let streak = 0;
  const d = new Date();
  if (!dates.has(localDateStr())) d.setDate(d.getDate() - 1);
  for (let i = 0; i < 30; i++) {
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    if (!dates.has(key)) break;
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

function actRecovery(history: ActivityRecord[], sleepHours: number | null): { label: string; score: number; color: string } {
  const load = actTrainingLoad(history);
  const now  = Date.now();
  const highRecent = history.filter(r => r.intensity === 'high' && now - new Date(r.start).getTime() < 3 * 86400_000).length;
  let score = 100 - Math.min(35, load / 25) - highRecent * 8;
  if (sleepHours !== null) score += sleepHours >= 7 ? 5 : sleepHours < 6 ? -20 : -8;
  score = Math.max(0, Math.min(100, Math.round(score)));
  if (score >= 75) return { label: 'Well Rested', score, color: 'var(--green)' };
  if (score >= 50) return { label: 'Moderate',    score, color: 'var(--accent)' };
  return { label: 'Needs Rest', score, color: 'var(--red)' };
}

function actCoachingTips(intensity: 'low' | 'moderate' | 'high', recovery: { score: number }, sleepHours: number | null): string[] {
  const tips: string[] = [];
  if (intensity === 'high' && recovery.score < 50) tips.push('Recovery is low — consider reducing intensity today.');
  if (intensity === 'high') tips.push('High intensity → protein intake recommended post-workout.');
  if (intensity === 'high') tips.push('Hydrate +500 ml above your daily goal.');
  if (intensity === 'low')  tips.push('Light activity — great choice for a recovery day.');
  if (sleepHours !== null && sleepHours < 6 && intensity === 'high') tips.push('Poor sleep detected — performance may be reduced today.');
  if (intensity === 'high') tips.push('Plan an earlier bedtime tonight for optimal recovery.');
  return tips.slice(0, 2);
}

// Compare this week's total minutes vs last week — learns volume progression
function actWeekOverWeek(history: ActivityRecord[]): { thisWeek: number; lastWeek: number; pct: number; dir: 'up' | 'down' | 'flat' } {
  const now = Date.now();
  let thisWeek = 0, lastWeek = 0;
  history.forEach(r => {
    const daysAgo = (now - new Date(r.start).getTime()) / 86400_000;
    if (daysAgo < 7)       thisWeek += r.duration;
    else if (daysAgo < 14) lastWeek += r.duration;
  });
  if (!lastWeek) return { thisWeek, lastWeek, pct: 0, dir: thisWeek > 0 ? 'up' : 'flat' };
  const pct = Math.round(((thisWeek - lastWeek) / lastWeek) * 100);
  return { thisWeek, lastWeek, pct, dir: pct > 5 ? 'up' : pct < -5 ? 'down' : 'flat' };
}

// Learn the user's typical duration for a specific activity type from history
function actPersonalBaseline(type: string, history: ActivityRecord[]): number | null {
  if (!type) return null;
  const recs = history.filter(r => r.type.toLowerCase() === type.toLowerCase());
  if (recs.length < 2) return null;
  return Math.round(recs.reduce((s, r) => s + r.duration, 0) / recs.length);
}

// Smart next workout recommendation based on last session + recovery state
function actNextWorkoutSuggestion(history: ActivityRecord[], recovery: { score: number }): string {
  if (!history.length) return 'Start with a 20-min walk — builds the habit without breaking you.';
  const last = history[0];
  const daysAgo = (Date.now() - new Date(last.start).getTime()) / 86400_000;
  if (daysAgo > 3)  return `Last session was ${Math.floor(daysAgo)} days ago — any movement counts today.`;
  if (last.intensity === 'high' && recovery.score < 55)
    return `Hard session + low recovery → active recovery today: walk, stretch, or yoga.`;
  if (last.intensity === 'high' && recovery.score >= 55)
    return `Good recovery → moderate effort today; skip a second high-intensity back-to-back.`;
  if (last.type === 'running' || last.type === 'jogging')
    return 'Alternate with strength or yoga to balance muscle groups and prevent overuse.';
  if (last.intensity === 'low')
    return 'Light session done → push a bit harder today if energy allows.';
  return 'Consistency beats intensity — any 20+ min session keeps your streak alive.';
}

// ─── Activity Page ────────────────────────────────────────────────────────────

function ActivityPage({ onSaved }: { onSaved: (minutes: number) => void }) {
  const [history, setHistory]         = useState<ActivityRecord[]>(loadActivityHistory);
  const [smartText, setSmartText]     = useState('');
  const [form, setForm]               = useState({
    activity_type: '', duration_minutes: 0, calories_burned: 0,
    intensity: 'moderate' as 'low' | 'moderate' | 'high', start_time: '',
  });
  const [saving, setSaving]           = useState(false);
  const [done, setDone]               = useState(false);
  const [timerActive, setTimerActive] = useState(false);
  const [elapsed, setElapsed]         = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const sleepHours = useMemo(() => {
    try {
      const hist = JSON.parse(localStorage.getItem(SLEEP_HIST_KEY) || '[]') as SleepRecord[];
      return hist[0]?.hours ?? null;
    } catch { return null; }
  }, []);

  const waterMlCtx  = useMemo(() => getWaterToday(), []);
  const load        = useMemo(() => actTrainingLoad(history), [history]);
  const recovery    = useMemo(() => actRecovery(history, sleepHours), [history, sleepHours]);
  const streak      = useMemo(() => actStreak(history), [history]);
  const tips        = useMemo(() => actCoachingTips(form.intensity, recovery, sleepHours), [form.intensity, recovery, sleepHours]);
  const wow         = useMemo(() => actWeekOverWeek(history), [history]);
  const baseline    = useMemo(() => actPersonalBaseline(form.activity_type, history), [form.activity_type, history]);
  const nextSuggest = useMemo(() => actNextWorkoutSuggestion(history, recovery), [history, recovery]);

  const weekData = useMemo(() => {
    const DAY = ['Su','Mo','Tu','We','Th','Fr','Sa'];
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (6 - i));
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const recs = history.filter(r => r.date === key);
      return { label: i === 6 ? 'Today' : DAY[d.getDay()], min: recs.reduce((s,r) => s+r.duration,0) };
    });
  }, [history]);

  const nudges = useMemo(() => {
    const n: string[] = [];
    if (sleepHours !== null && sleepHours < 6) n.push(`Only ${sleepHours.toFixed(1)}h sleep — suggest light workout today`);
    if (waterMlCtx < 500) n.push('Hydrate before working out (< 500 ml logged today)');
    if (recovery.score < 50) n.push('High recent load — rest day recommended');
    return n;
  }, [sleepHours, waterMlCtx, recovery.score]);

  const PRESETS = [
    { label: 'Run 30 min', type: 'running', duration: 30 },
    { label: 'Walk 20 min', type: 'walking', duration: 20 },
    { label: 'Gym 45 min', type: 'gym', duration: 45 },
    { label: 'Yoga 30 min', type: 'yoga', duration: 30 },
  ];
  const lastWorkout = history[0] ?? null;

  const applyPreset = (type: string, duration: number) => {
    setForm(f => ({ ...f, activity_type: type, duration_minutes: duration,
      intensity: actIntensity(type), calories_burned: actCalories(type, duration) }));
  };
  const onTypeChange = (t: string) => {
    setForm(f => ({ ...f, activity_type: t, intensity: actIntensity(t),
      calories_burned: f.duration_minutes ? actCalories(t, f.duration_minutes) : f.calories_burned }));
  };
  const onDurationChange = (d: number) => {
    setForm(f => ({ ...f, duration_minutes: d,
      calories_burned: f.activity_type ? actCalories(f.activity_type, d) : f.calories_burned }));
  };
  const onSmartParse = () => {
    const p = parseActivityText(smartText);
    if (p.type || p.duration) {
      const type = p.type || form.activity_type;
      const dur  = p.duration || form.duration_minutes;
      setForm(f => ({ ...f, activity_type: type, duration_minutes: dur,
        intensity: actIntensity(type), calories_burned: actCalories(type, dur) }));
      setSmartText('');
    }
  };

  const startTimer = () => {
    const now = Date.now();
    setTimerActive(true); setElapsed(0);
    setForm(f => ({ ...f, start_time: toLocalDT(new Date()) }));
    timerRef.current = setInterval(() => setElapsed(Date.now() - now), 1000);
  };
  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimerActive(false);
    const mins = Math.max(1, Math.round(elapsed / 60000));
    setForm(f => ({ ...f, duration_minutes: mins, calories_burned: actCalories(f.activity_type, mins) }));
  };
  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const fmtElapsed = (ms: number) => {
    const s = Math.floor(ms / 1000), m = Math.floor(s / 60), h = Math.floor(m / 60);
    if (h > 0) return `${h}:${String(m%60).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
    return `${String(m).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    const startISO = form.start_time ? new Date(form.start_time).toISOString() : new Date().toISOString();
    await createActivity(USER_ID, {
      activity_type: form.activity_type, start_time: startISO,
      duration_minutes: form.duration_minutes, calories_burned: form.calories_burned,
    });
    const rec: ActivityRecord = {
      date: localDateStr(), type: form.activity_type, duration: form.duration_minutes,
      calories: form.calories_burned, intensity: form.intensity, start: startISO,
    };
    const updated = [rec, ...history];
    saveActivityHistory(updated);
    setHistory(updated);
    try {
      const ctx = JSON.parse(localStorage.getItem('alfred_context') || '{}');
      ctx.activityMinutesToday = (ctx.activityMinutesToday || 0) + form.duration_minutes;
      ctx.lastActivityTs = Date.now();
      localStorage.setItem('alfred_context', JSON.stringify(ctx));
    } catch {}
    setSaving(false); setDone(true); onSaved(form.duration_minutes);
    setForm({ activity_type: '', duration_minutes: 0, calories_burned: 0, intensity: 'moderate', start_time: '' });
    setTimeout(() => setDone(false), 3000);
  };

  const maxWeekMin = Math.max(...weekData.map(d => d.min), 60);
  const INTENSITY_OPTS = [
    { value: 'low'      as const, label: 'Low',      color: 'var(--green)'  },
    { value: 'moderate' as const, label: 'Moderate', color: 'var(--accent)' },
    { value: 'high'     as const, label: 'High',     color: 'var(--red)'    },
  ];

  return (
    <div className="page page--activity">
      <PageHeader title="Activity" sub="AI-powered fitness tracker with recovery coaching." />

      {nudges.length > 0 && (
        <div className="act-nudges">
          {nudges.map((n, i) => <div key={i} className="act-nudge-item">⚡ {n}</div>)}
        </div>
      )}

      <div className="act-main-grid">
        {/* ── Left: Stats ── */}
        <div className="act-stats-col">

          {/* Load & Recovery */}
          <div className="act-load-card">
            <div className="act-load-header">
              <span className="act-load-title">Training Load</span>
              {streak > 0
                ? <span className="act-streak-chip">🔥 {streak}-day streak</span>
                : <span className="act-streak-chip act-streak-chip--zero">No streak yet</span>}
            </div>
            <div className="act-load-bar-track">
              <div className="act-load-bar-fill" style={{ width: `${Math.min(100, load / 2)}%` }} />
            </div>
            <div className="act-load-labels">
              <span>{load} pts <span className="act-muted">/ 200 this week</span></span>
              {wow.lastWeek > 0 && (
                <span className={`act-wow-chip act-wow-chip--${wow.dir}`}>
                  {wow.dir === 'up' ? '↑' : wow.dir === 'down' ? '↓' : '→'} {Math.abs(wow.pct)}% vs last week
                </span>
              )}
            </div>
            <div className="act-recovery-row">
              <span className="act-recovery-label">Recovery</span>
              <div className="act-recovery-track">
                <div className="act-recovery-fill" style={{ width: `${recovery.score}%`, background: recovery.color }} />
              </div>
              <span className="act-recovery-status" style={{ color: recovery.color }}>{recovery.label}</span>
            </div>
          </div>

          {/* Next workout suggestion */}
          <div className="act-suggest-card">
            <span className="act-suggest-icon">✦</span>
            <p className="act-suggest-text">{nextSuggest}</p>
          </div>

          {/* 7-day chart */}
          <div className="act-week-section">
            <p className="act-section-title">This Week</p>
            <div className="act-week-chart">
              {weekData.map((d, i) => (
                <div key={i} className="act-week-col">
                  <div className="act-week-bar-wrap">
                    <div className={`act-week-bar-fill ${d.min >= 30 ? 'act-bar--green' : d.min > 0 ? 'act-bar--amber' : ''}`}
                      style={{ height: d.min > 0 ? `${(d.min / maxWeekMin) * 100}%` : '0%' }} />
                  </div>
                  <span className="act-week-min">{d.min > 0 ? `${d.min}m` : '–'}</span>
                  <span className="act-week-day">{d.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent */}
          {history.length > 0 && (
            <div className="act-history-section">
              <p className="act-section-title">Recent</p>
              <div className="act-history-list">
                {history.slice(0, 4).map((r, i) => (
                  <div key={i} className="act-history-item">
                    <span className="act-history-icon">{actIcon(r.type)}</span>
                    <div className="act-history-body">
                      <span className="act-history-type">{r.type}</span>
                      <span className="act-history-meta">{r.duration} min · {r.calories} kcal</span>
                    </div>
                    <span className={`act-dot act-dot--${r.intensity}`} />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Right: Form ── */}
        <div className="act-form-col">

          {/* Smart text input */}
          <div className="act-smart-row">
            <input className="act-smart-input"
              placeholder='e.g. "ran 5km" or "yoga 45 min"'
              value={smartText}
              onChange={e => setSmartText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && onSmartParse()} />
            <button type="button" className="act-smart-btn" onClick={onSmartParse}>Auto-fill</button>
          </div>

          {/* Quick presets */}
          <div className="act-preset-grid">
            {lastWorkout && (
              <button type="button" className="act-preset-btn act-preset-btn--last"
                onClick={() => applyPreset(lastWorkout.type, lastWorkout.duration)}>
                🔁 Repeat last
              </button>
            )}
            {PRESETS.map(p => (
              <button key={p.label} type="button" className="act-preset-btn"
                onClick={() => applyPreset(p.type, p.duration)}>
                {actIcon(p.type)} {p.label}
              </button>
            ))}
          </div>

          {/* Timer mode */}
          <div className="act-timer-row">
            {!timerActive
              ? <button type="button" className="act-timer-btn" onClick={startTimer}>▶ Start Workout Timer</button>
              : <div className="act-timer-active">
                  <span className="act-timer-display">{fmtElapsed(elapsed)}</span>
                  <button type="button" className="act-timer-stop" onClick={stopTimer}>■ Stop &amp; Fill</button>
                </div>
            }
          </div>

          {/* Main form */}
          <form onSubmit={onSubmit} className="act-form">
            <div className="act-type-chips">
              {['running','walking','cycling','gym','yoga','swimming','hiit'].map(t => (
                <button key={t} type="button"
                  className={`act-type-chip ${form.activity_type === t ? 'act-type-chip--active' : ''}`}
                  onClick={() => onTypeChange(t)}>
                  {actIcon(t)} {t.charAt(0).toUpperCase()+t.slice(1)}
                </button>
              ))}
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label>Activity type</label>
                <input placeholder="e.g. running" value={form.activity_type}
                  onChange={e => onTypeChange(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Duration (min)</label>
                <input type="number" placeholder="45" value={form.duration_minutes || ''}
                  onChange={e => onDurationChange(Number(e.target.value))} required />
              </div>
              <div className="form-group">
                <label>Calories <span className="act-muted">(auto)</span></label>
                <input type="number" placeholder="kcal" value={form.calories_burned || ''}
                  onChange={e => setForm(f => ({ ...f, calories_burned: Number(e.target.value) }))} />
              </div>
              <div className="form-group">
                <label>Start time</label>
                <input type="datetime-local" value={form.start_time}
                  onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} />
              </div>
            </div>

            {/* Intensity */}
            <div className="act-intensity-row">
              <span className="act-field-label">Intensity</span>
              <div className="act-intensity-pills">
                {INTENSITY_OPTS.map(o => (
                  <button key={o.value} type="button"
                    className={`act-intensity-pill ${form.intensity === o.value ? 'act-intensity-pill--active' : ''}`}
                    style={form.intensity === o.value ? { borderColor: o.color, color: o.color } : {}}
                    onClick={() => setForm(f => ({ ...f, intensity: o.value }))}>
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            {/* AI coaching */}
            {tips.length > 0 && (
              <div className="act-coaching-panel">
                {tips.map((tip, i) => (
                  <div key={i} className="act-coaching-tip">
                    <span className="act-coaching-icon">✦</span> {tip}
                  </div>
                ))}
              </div>
            )}

            <div className="form-footer">
              {done && <span className="save-ok">✓ Saved</span>}
              <button type="submit" className="btn-primary" disabled={saving || !form.activity_type}>
                {saving ? 'Saving…' : 'Log Activity →'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function Sidebar({ page, status, onNavigate }: {
  page: Page; status: BackendStatus; onNavigate: (p: Page) => void;
}) {
  const statusLabel = { loading: 'Connecting', healthy: 'Online', error: 'Offline' }[status];
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="brand-mark">A</span>
        <div>
          <p className="brand-name">Alfred</p>
          <p className="brand-sub">Pennyworth</p>
        </div>
      </div>

      <nav className="sidebar-nav">
        {NAV_GROUPS.map(({ label, items }) => (
          <div key={label} className="nav-group">
            <p className="nav-group-label">{label}</p>
            {items.map(({ id, icon, label: lbl }) => (
              <button key={id}
                className={`nav-item ${page === id ? 'nav-item--active' : ''}`}
                onClick={() => onNavigate(id)}>
                <span className="nav-icon">{icon}</span>
                <span className="nav-label">{lbl}</span>
                {page === id && <span className="nav-indicator" />}
              </button>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className={`status-pill ${status}`}>
          <span className="status-dot" />{statusLabel}
        </div>
      </div>
    </aside>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [page, setPage]               = useState<Page>('dashboard');
  const [status, setStatus]           = useState<BackendStatus>('loading');
  const [toast, setToast]             = useState('');
  const [insight, setInsight]         = useState<Intervention | null>(null);
  const [insightLoading, setILoading] = useState(false);
  const [feedback, setFeedback]       = useState<'accepted' | 'snoozed' | null>(null);
  const [timeline, setTimeline]       = useState<TimelineEvent[]>([]);
  const [stats, setStats]             = useState<Stats>({
    mealsToday: 0, lastSleepHours: null, lastSleepQuality: null,
    activityMinutesToday: 0, waterStreak: getWaterStreak(),
  });

  const waterMl  = getWaterToday();
  const bodyState = inferBodyState(stats, waterMl);
  const alerts    = computeAlerts(stats, waterMl, timeline);

  // ─── Backend health
  useEffect(() => {
    getHealth()
      .then((d) => setStatus(d.status === 'healthy' ? 'healthy' : 'error'))
      .catch(() => setStatus('error'));
  }, []);

  // ─── Auto AI insights (on mount + every 5 min)
  const fetchInsight = useCallback(async () => {
    if (insightLoading) return;
    setILoading(true);
    try {
      const result = await generateIntervention(USER_ID);
      if (!(result as any).detail) {
        setInsight(result as Intervention);
        setFeedback(null);
        setTimeline((t) => [...t, {
          id: `insight-${Date.now()}`,
          time: new Date(),
          icon: '✦',
          label: (result as Intervention).title,
          detail: 'AI insight generated',
          type: 'insight',
        }]);
      }
    } catch {}
    finally { setILoading(false); }
  }, [insightLoading]);

  const insightRef = useRef(fetchInsight);
  insightRef.current = fetchInsight;

  useEffect(() => {
    insightRef.current();
    const id = setInterval(() => insightRef.current(), 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  // ─── Helpers
  const notify = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 4000);
  }, []);

  const onFeedback = useCallback(async (response: 'accepted' | 'snoozed') => {
    if (!insight) return;
    try {
      await submitFeedback(insight.id, response);
      setFeedback(response);
      if (response === 'accepted') notify('Alfred will keep this in mind.');
      else { notify('Noted — Alfred will remind you later.'); setTimeout(() => setInsight(null), 1500); }
    } catch { notify('Could not submit feedback.'); }
  }, [insight, notify]);

  const onDismiss = useCallback(() => { setInsight(null); setFeedback(null); }, []);

  const addTimeline = useCallback((e: Omit<TimelineEvent, 'id' | 'time'>) => {
    setTimeline((t) => [...t, { ...e, id: `${e.type}-${Date.now()}`, time: new Date() }]);
  }, []);

  // Quick 250ml water log (no nav change)
  const onLogWater = useCallback(() => {
    logWater(USER_ID, 250).catch(() => {});
    addTimeline({ icon: '💧', label: 'Water', detail: '250 ml logged', type: 'water' });
    notify('💧 +250 ml logged');
    setStats((s) => ({ ...s, waterStreak: getWaterStreak() }));
  }, [addTimeline, notify]);

  return (
    <div className="layout">
      <Sidebar page={page} status={status} onNavigate={setPage} />

      <div className="main-content">
        {toast && <div className="toast-global">{toast}</div>}

        {page === 'dashboard' && (
          <DashboardPage
            stats={stats} insight={insight} insightLoading={insightLoading}
            timeline={timeline} alerts={alerts} bodyState={bodyState}
            onNavigate={setPage} onFeedback={onFeedback} onDismiss={onDismiss}
            onLogWater={onLogWater}
          />
        )}
        {page === 'timeline' && <TimelinePage events={timeline} />}
        {page === 'hydration' && (
          <div className="page">
            <PageHeader title="Hydration" sub="Track your daily water intake and build consistent habits." />
            <WaterTracker />
          </div>
        )}
        {page === 'nutrition' && (
          <NutritionPage onSaved={() => {
            setStats((s) => ({ ...s, mealsToday: s.mealsToday + 1 }));
            addTimeline({ icon: '🍽', label: 'Meal logged', detail: 'Nutrition entry added', type: 'meal' });
          }} />
        )}
        {page === 'sleep' && (
          <SleepPage onSaved={(hrs, q) => {
            setStats((s) => ({ ...s, lastSleepHours: hrs, lastSleepQuality: q }));
            addTimeline({ icon: '🌙', label: `Slept ${hrs}h`, detail: `Quality: ${q}/10`, type: 'sleep' });
          }} />
        )}
        {page === 'activity' && (
          <ActivityPage onSaved={(min) => {
            setStats((s) => ({ ...s, activityMinutesToday: s.activityMinutesToday + min }));
            addTimeline({ icon: '⚡', label: `Activity: ${min} min`, detail: 'Workout logged', type: 'activity' });
          }} />
        )}
        {page === 'finance' && <FinancePage />}
        {page === 'ai' && (
          <AIPage insight={insight} insightLoading={insightLoading}
            feedback={feedback} onRefresh={fetchInsight}
            onFeedback={onFeedback} onDismiss={onDismiss} />
        )}
      </div>

      {/* Floating chat */}
      <ChatAssistant userId={USER_ID} />
    </div>
  );
}
