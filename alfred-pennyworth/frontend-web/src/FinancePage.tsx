import { useState, useMemo } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

const FIN_KEY = 'alfred_finance_v1';

type AssetLayer = 1 | 2 | 3 | 4;
type AssetType  = 'checking' | 'savings' | 'brokerage' | '401k' | 'roth_ira' | 'hsa' | 'crypto' | 'real_estate' | 'equity' | 'startup' | 'other';
type IncomeType = 'salary' | 'freelance' | 'dividends' | 'rental' | 'business' | 'other';
type ExpCat     = 'housing' | 'food' | 'transport' | 'utilities' | 'subscriptions' | 'health' | 'entertainment' | 'other';
type InsightUrgency = 'critical' | 'warning' | 'tip';

interface Asset        { id: string; name: string; value: number; type: AssetType; layer: AssetLayer; }
interface Liability    { id: string; name: string; balance: number; rate: number; }
interface IncomeStream { id: string; name: string; monthlyAmount: number; type: IncomeType; isPassive: boolean; }
interface Expense      { id: string; name: string; monthlyAmount: number; category: ExpCat; isFixed: boolean; }
interface NWSnapshot   { date: string; value: number; }
interface AllocationTargets { core: number; growth: number; asymmetric: number; }
interface Insight      { msg: string; urgency: InsightUrgency; }

interface FinanceState {
  assets: Asset[];
  liabilities: Liability[];
  income: IncomeStream[];
  expenses: Expense[];
  nwHistory: NWSnapshot[];
  allocation: AllocationTargets;
  budgetLimits: Partial<Record<ExpCat, number>>;
}

// ─── Persistence ──────────────────────────────────────────────────────────────

const DEFAULT_STATE: FinanceState = {
  assets: [], liabilities: [], income: [], expenses: [], nwHistory: [],
  allocation: { core: 75, growth: 15, asymmetric: 10 },
  budgetLimits: {},
};

function loadFinance(): FinanceState {
  try {
    const raw = localStorage.getItem(FIN_KEY);
    return raw ? { ...DEFAULT_STATE, ...JSON.parse(raw) } : DEFAULT_STATE;
  } catch { return DEFAULT_STATE; }
}
function saveFinance(s: FinanceState) { localStorage.setItem(FIN_KEY, JSON.stringify(s)); }
function uid() { return crypto.randomUUID().slice(0, 8); }

// ─── Finance Engine ───────────────────────────────────────────────────────────

function calcNetWorth(assets: Asset[], liabilities: Liability[]): number {
  return assets.reduce((s, a) => s + a.value, 0) - liabilities.reduce((s, l) => s + l.balance, 0);
}
function calcSavingsRate(income: number, expenses: number): number {
  if (!income) return 0;
  return Math.max(0, Math.round(((income - expenses) / income) * 100));
}
function calcPassiveRatio(streams: IncomeStream[]): number {
  const total = streams.reduce((s, i) => s + i.monthlyAmount, 0);
  if (!total) return 0;
  return Math.round((streams.filter(s => s.isPassive).reduce((s, i) => s + i.monthlyAmount, 0) / total) * 100);
}
function calcFINumber(monthlyExpenses: number): number { return monthlyExpenses * 12 * 25; }
function calcYearsToFI(netWorth: number, fiNumber: number, monthlyContrib: number, annualReturn = 0.08): number {
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
function cashFlowSplit(monthly: number) {
  return { buffer: Math.round(monthly * 0.10), invest: Math.round(monthly * 0.60), lifestyle: Math.round(monthly * 0.30) };
}
function calcActualAllocation(assets: Asset[]) {
  const inv   = assets.filter(a => a.layer === 3 || a.layer === 4);
  const total = inv.reduce((s, a) => s + a.value, 0);
  if (!total) return { core: 0, growth: 0, asymmetric: 0 };
  const core       = inv.filter(a => ['brokerage','401k','roth_ira'].includes(a.type)).reduce((s,a) => s+a.value, 0);
  const growth     = inv.filter(a => a.type === 'hsa').reduce((s,a) => s+a.value, 0);
  const asymmetric = inv.filter(a => ['crypto','startup','equity'].includes(a.type)).reduce((s,a) => s+a.value, 0);
  return { core: Math.round((core/total)*100), growth: Math.round((growth/total)*100), asymmetric: Math.round((asymmetric/total)*100) };
}
function calcRunway(assets: Asset[], monthlyExpenses: number): number {
  return monthlyExpenses > 0 ? assets.filter(a => a.layer <= 2).reduce((s, a) => s + a.value, 0) / monthlyExpenses : 0;
}
function calcTaxEfficiency(assets: Asset[]): number {
  const investable = assets.filter(a => a.layer >= 3).reduce((s, a) => s + a.value, 0);
  if (!investable) return 0;
  const taxAdv = assets.filter(a => ['401k','roth_ira','hsa'].includes(a.type)).reduce((s, a) => s + a.value, 0);
  return Math.round((taxAdv / investable) * 100);
}

// Debt payoff simulation (cascade model)
interface DebtSimResult {
  totalInterest: number; totalMonths: number;
  perDebt: Record<string, { payoffMonth: number; interest: number }>;
  order: string[];
}
function simulatePayoff(liabilities: Liability[], strategy: 'avalanche' | 'snowball', extraMonthly: number): DebtSimResult {
  if (!liabilities.length) return { totalInterest: 0, totalMonths: 0, perDebt: {}, order: [] };
  const debts = liabilities.map(l => ({
    id: l.id, balance: l.balance,
    rate: l.rate / 100 / 12,
    minPay: Math.max(25, Math.round(l.balance * 0.02)),
    interest: 0, paid: false,
  }));
  const sorted = strategy === 'avalanche'
    ? [...debts].sort((a, b) => b.rate - a.rate)
    : [...debts].sort((a, b) => a.balance - b.balance);
  const order = sorted.map(d => d.id);
  let freedExtra = 0, month = 0, totalInterest = 0;
  const perDebt: Record<string, { payoffMonth: number; interest: number }> = {};
  const markPaid = (d: typeof sorted[0]) => {
    d.paid = true;
    d.balance = 0;
    perDebt[d.id] = { payoffMonth: month, interest: Math.round(d.interest) };
    freedExtra += d.minPay;
  };

  while (sorted.some(d => d.balance > 0.01) && month < 600) {
    month++;

    // Accrue interest
    sorted.forEach(d => {
      if (d.balance > 0.01) {
        const int = d.balance * d.rate;
        d.balance += int;
        d.interest += int;
        totalInterest += int;
      }
    });

    // Apply minimum payments
    sorted.forEach(d => {
      if (d.balance > 0.01) {
        const pay = Math.min(d.balance, d.minPay);
        d.balance -= pay;
        if (d.balance <= 0.01 && !d.paid) markPaid(d);
      }
    });

    // Apply extra payment to the priority target
    const target = sorted.find(d => d.balance > 0.01);
    if (target) {
      target.balance = Math.max(0, target.balance - (extraMonthly + freedExtra));
      if (target.balance <= 0.01 && !target.paid) markPaid(target);
    }
  }

  sorted.forEach(d => {
    if (!perDebt[d.id]) perDebt[d.id] = { payoffMonth: 600, interest: Math.round(d.interest) };
  });
  return { totalInterest: Math.round(totalInterest), totalMonths: month, perDebt, order };
}

// Compound growth projection
interface ProjectionPoint { year: number; value: number; }
function projectGrowth(startNW: number, monthlyContrib: number, years: number, annualReturn: number): ProjectionPoint[] {
  const r = annualReturn / 12;
  return Array.from({ length: years + 1 }, (_, y) => {
    const n = y * 12;
    const fv = startNW * Math.pow(1 + r, n) + (r > 0 ? monthlyContrib * (Math.pow(1 + r, n) - 1) / r : monthlyContrib * n);
    return { year: y, value: Math.round(fv) };
  });
}

// AI Insights — all urgency levels, no cap
function generateInsights(state: FinanceState, netWorth: number, savingsRate: number, cashFlow: number, fiProgress: number): Insight[] {
  const tips: Insight[] = [];
  const income   = state.income.reduce((s, i) => s + i.monthlyAmount, 0);
  const expenses = state.expenses.reduce((s, e) => s + e.monthlyAmount, 0);
  const runway   = calcRunway(state.assets, expenses);
  const passiveRatio = calcPassiveRatio(state.income);
  const taxEff   = calcTaxEfficiency(state.assets);
  const subTotal = state.expenses.filter(e => e.category === 'subscriptions').reduce((s, e) => s + e.monthlyAmount, 0);
  const highDebt = state.liabilities.filter(l => l.rate > 10);
  const medDebt  = state.liabilities.filter(l => l.rate > 7 && l.rate <= 10);

  if (income > 0 && cashFlow < 0)
    tips.push({ msg: 'Negative cash flow — spending exceeds income. Fix this before investing anything.', urgency: 'critical' });
  if (highDebt.length > 0)
    tips.push({ msg: `High-interest debt at ${highDebt[0].rate}% APR — paying it off is a guaranteed ${highDebt[0].rate}% return.`, urgency: 'critical' });
  if (expenses > 0 && runway < 3)
    tips.push({ msg: `Only ${runway.toFixed(1)} months runway — build a 3–6 month emergency fund before investing.`, urgency: 'warning' });
  if (income > 0 && savingsRate < 20)
    tips.push({ msg: `Savings rate is ${savingsRate}% — below 30% threshold for meaningful wealth building.`, urgency: 'warning' });
  if (medDebt.length > 0)
    tips.push({ msg: `Debt at ${medDebt[0].rate}% APR — consider payoff over taxable brokerage contributions.`, urgency: 'warning' });
  if (expenses > 0 && runway > 12)
    tips.push({ msg: `${Math.round(runway)} months cash is excess — cash loses 3–4% to inflation. Invest the surplus.`, urgency: 'warning' });
  if (!state.assets.some(a => a.type === '401k') && income > 0)
    tips.push({ msg: 'No 401(k) detected — employer match is instant 50–100% return. Max it first.', urgency: 'tip' });
  if (!state.assets.some(a => a.type === 'roth_ira') && income > 0)
    tips.push({ msg: 'Open a Roth IRA — $7k/yr grows tax-free forever. Highest-leverage account you have.', urgency: 'tip' });
  if (!state.assets.some(a => a.type === 'hsa') && income > 0)
    tips.push({ msg: 'HSA = triple tax advantage: deduct on contribution, grow tax-free, withdraw tax-free for medical.', urgency: 'tip' });
  if (passiveRatio === 0 && income > 0)
    tips.push({ msg: 'Zero passive income — add one stream: dividends, rental, or SaaS. Every hour you stop, income stops.', urgency: 'tip' });
  if (passiveRatio > 0 && passiveRatio < 20)
    tips.push({ msg: `${passiveRatio}% passive income — grow this. When passive ≥ monthly expenses you achieve FI.`, urgency: 'tip' });
  if (state.assets.some(a => a.layer >= 3) && taxEff < 50)
    tips.push({ msg: `Tax efficiency is ${taxEff}% — less than half your investments are in tax-advantaged accounts.`, urgency: 'tip' });
  if (subTotal > 200)
    tips.push({ msg: `$${Math.round(subTotal)}/mo in subscriptions ($${Math.round(subTotal * 12)}/yr) — audit and cancel unused ones.`, urgency: 'tip' });
  if (fiProgress >= 50 && fiProgress < 100)
    tips.push({ msg: `${fiProgress}% to FI — past halfway. Compounding accelerates sharply from here.`, urgency: 'tip' });
  if (fiProgress >= 100)
    tips.push({ msg: 'FI number reached — you can Coast FIRE. Work becomes optional, not required.', urgency: 'tip' });
  if (income > 0 && savingsRate >= 40)
    tips.push({ msg: `Strong ${savingsRate}% savings rate — you're compounding faster than 90% of earners.`, urgency: 'tip' });
  return tips;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtMoney(n: number, compact = false): string {
  if (compact) {
    if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
    if (Math.abs(n) >= 1_000)     return `$${(n / 1_000).toFixed(1)}k`;
    return `$${Math.round(n)}`;
  }
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}
function fmtMonths(m: number): string {
  if (m >= 600) return 'Never';
  if (m < 12) return `${m}mo`;
  return `${Math.floor(m / 12)}y ${m % 12}mo`;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LAYER_META = [
  { n: 1 as AssetLayer, label: 'Operating',   sub: 'Monthly expenses only',       icon: '🏦', color: 'var(--blue)'   },
  { n: 2 as AssetLayer, label: 'Reserve',      sub: '3–6 month emergency runway',  icon: '🛡', color: 'var(--green)'  },
  { n: 3 as AssetLayer, label: 'Investments',  sub: '401k, Roth IRA, brokerage',   icon: '📈', color: 'var(--accent)' },
  { n: 4 as AssetLayer, label: 'Opportunity',  sub: 'Market dips, startups, deals',icon: '🚀', color: 'var(--purple)' },
];
const ASSET_TYPE_OPTIONS: { value: AssetType; label: string; layer: AssetLayer }[] = [
  { value: 'checking',    label: 'Checking Account',  layer: 1 },
  { value: 'savings',     label: 'Savings Account',   layer: 2 },
  { value: '401k',        label: '401(k)',             layer: 3 },
  { value: 'roth_ira',    label: 'Roth IRA',           layer: 3 },
  { value: 'hsa',         label: 'HSA',                layer: 3 },
  { value: 'brokerage',   label: 'Taxable Brokerage',  layer: 3 },
  { value: 'crypto',      label: 'Crypto',             layer: 4 },
  { value: 'startup',     label: 'Startup Equity',     layer: 4 },
  { value: 'equity',      label: 'Company Stock/RSU',  layer: 4 },
  { value: 'real_estate', label: 'Real Estate',        layer: 4 },
  { value: 'other',       label: 'Other',              layer: 1 },
];
const INCOME_OPTIONS: { value: IncomeType; label: string; passive: boolean }[] = [
  { value: 'salary',    label: 'Salary',        passive: false },
  { value: 'freelance', label: 'Freelance',     passive: false },
  { value: 'dividends', label: 'Dividends',     passive: true  },
  { value: 'rental',    label: 'Rental Income', passive: true  },
  { value: 'business',  label: 'Business',      passive: false },
  { value: 'other',     label: 'Other',         passive: false },
];
const EXP_CATS: ExpCat[] = ['housing','food','transport','utilities','subscriptions','health','entertainment','other'];
const EXP_CAT_COLORS: Record<ExpCat, string> = {
  housing: 'var(--accent)', food: 'var(--green)', transport: 'var(--blue)',
  utilities: 'var(--orange)', subscriptions: 'var(--purple)', health: 'var(--red)',
  entertainment: '#64b5f6', other: 'var(--text-muted)',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function NWChart({ history }: { history: NWSnapshot[] }) {
  if (history.length < 2) return <div className="fin-chart-empty">Save changes monthly to see your wealth curve</div>;
  const vals = history.map(h => h.value);
  const min = Math.min(...vals), max = Math.max(...vals), rng = max - min || 1;
  const W = 380, H = 90, PAD = 10;
  const x = (i: number) => PAD + (i / (history.length - 1)) * (W - PAD * 2);
  const y = (v: number) => H - PAD - ((v - min) / rng) * (H - PAD * 2);
  const pts  = history.map((h, i) => `${x(i)},${y(h.value)}`).join(' ');
  const area = `${PAD},${H} ${pts} ${W - PAD},${H}`;
  const isUp = vals[vals.length - 1] >= vals[0];
  const col  = isUp ? '#3fb950' : '#f85149';
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="fin-nw-chart">
      <defs>
        <linearGradient id="nwG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={col} stopOpacity="0.25" />
          <stop offset="100%" stopColor={col} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={area} fill="url(#nwG)" />
      <polyline points={pts} fill="none" stroke={col} strokeWidth="2" strokeLinejoin="round" />
      {history.map((h, i) => i === history.length - 1 && <circle key={i} cx={x(i)} cy={y(h.value)} r="4" fill={col} />)}
      {history.map((h, i) => i % Math.max(1, Math.floor(history.length / 4)) === 0 && (
        <text key={i} x={x(i)} y={H - 1} textAnchor="middle" fontSize="8" fill="var(--text-dim)">{h.date.slice(5)}</text>
      ))}
    </svg>
  );
}

function AllocRing({ actual, target, label, color }: { actual: number; target: number; label: string; color: string }) {
  const R = 30, SW = 7, CX = 38, CY = 38;
  const circ = 2 * Math.PI * R;
  return (
    <div className="fin-alloc-ring-wrap">
      <svg viewBox="0 0 76 76" className="fin-alloc-ring">
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="var(--surface-3)" strokeWidth={SW} />
        <circle cx={CX} cy={CY} r={R} fill="none" stroke={color} strokeWidth={SW} strokeOpacity="0.2"
          strokeDasharray={`${(target/100)*circ} ${circ-(target/100)*circ}`} strokeLinecap="round" transform={`rotate(-90 ${CX} ${CY})`} />
        <circle cx={CX} cy={CY} r={R} fill="none" stroke={color} strokeWidth={SW}
          strokeDasharray={`${(Math.min(100,actual)/100)*circ} ${circ-(Math.min(100,actual)/100)*circ}`} strokeLinecap="round" transform={`rotate(-90 ${CX} ${CY})`} />
        <text x={CX} y={CY + 4} textAnchor="middle" fontSize="12" fill="var(--text)" fontWeight="700">{actual}%</text>
      </svg>
      <div className="fin-alloc-ring-meta">
        <span className="fin-alloc-ring-label" style={{ color }}>{label}</span>
        <span className="fin-alloc-ring-target">Target: {target}%</span>
        {Math.abs(actual - target) > 10 && <span className="fin-alloc-ring-warn">⚠ Rebalance</span>}
      </div>
    </div>
  );
}

function FinBar({ pct, color = 'var(--accent)', h = 7 }: { pct: number; color?: string; h?: number }) {
  return (
    <div className="fin-bar-track" style={{ height: h }}>
      <div className="fin-bar-fill" style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: color }} />
    </div>
  );
}

// Expense breakdown: horizontal bar chart by category
function ExpenseChart({ expenses }: { expenses: Expense[] }) {
  const total = expenses.reduce((s, e) => s + e.monthlyAmount, 0);
  if (!total) return null;
  const cats = EXP_CATS
    .map(cat => ({ cat, amount: expenses.filter(e => e.category === cat).reduce((s, e) => s + e.monthlyAmount, 0) }))
    .filter(c => c.amount > 0).sort((a, b) => b.amount - a.amount);
  const max = cats[0]?.amount ?? 1;
  return (
    <div className="fin-exp-chart">
      {cats.map(({ cat, amount }) => (
        <div key={cat} className="fin-exp-chart-row">
          <span className="fin-exp-chart-label">{cat.charAt(0).toUpperCase() + cat.slice(1)}</span>
          <div className="fin-exp-chart-bar-wrap">
            <div className="fin-exp-chart-bar" style={{ width: `${(amount / max) * 100}%`, background: EXP_CAT_COLORS[cat] }} />
          </div>
          <span className="fin-exp-chart-val">{fmtMoney(amount, true)}</span>
          <span className="fin-exp-chart-pct">{Math.round((amount / total) * 100)}%</span>
        </div>
      ))}
    </div>
  );
}

// Growth projection chart
function GrowthChart({ scenarios }: { scenarios: { label: string; points: ProjectionPoint[]; color: string }[] }) {
  if (!scenarios[0]?.points.length) return null;
  const allVals = scenarios.flatMap(s => s.points.map(p => p.value));
  const maxVal  = Math.max(...allVals) || 1;
  const years   = scenarios[0].points.length - 1;
  const W = 400, H = 110, PL = 52, PR = 10, PT = 10, PB = 20;
  const iW = W - PL - PR, iH = H - PT - PB;
  const x = (yr: number) => PL + (yr / years) * iW;
  const y = (v: number)  => PT + (1 - v / maxVal) * iH;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block' }}>
      {[0, 0.25, 0.5, 0.75, 1].map(pct => {
        const yv = PT + pct * iH;
        return (
          <g key={pct}>
            <line x1={PL} y1={yv} x2={W - PR} y2={yv} stroke="var(--border)" strokeWidth="0.5" />
            <text x={PL - 4} y={yv + 3} textAnchor="end" fontSize="7" fill="var(--text-dim)">
              {fmtMoney(maxVal * (1 - pct), true)}
            </text>
          </g>
        );
      })}
      {scenarios[0].points.filter((_, i) => i % Math.max(1, Math.floor(years / 5)) === 0).map(pt => (
        <text key={pt.year} x={x(pt.year)} y={H - 2} textAnchor="middle" fontSize="7" fill="var(--text-dim)">yr{pt.year}</text>
      ))}
      {scenarios.map(sc => (
        <g key={sc.label}>
          <polyline points={sc.points.map(p => `${x(p.year)},${y(p.value)}`).join(' ')} fill="none" stroke={sc.color} strokeWidth="1.5" strokeLinejoin="round" />
          <circle cx={x(sc.points[sc.points.length - 1].year)} cy={y(sc.points[sc.points.length - 1].value)} r="3" fill={sc.color} />
        </g>
      ))}
    </svg>
  );
}

// Layer breakdown stacked bar
function LayerBreakdown({ assets }: { assets: Asset[] }) {
  const total = assets.reduce((s, a) => s + a.value, 0);
  if (!total) return null;
  const layers = LAYER_META.map(l => ({ ...l, amount: assets.filter(a => a.layer === l.n).reduce((s, a) => s + a.value, 0) })).filter(l => l.amount > 0);
  return (
    <div className="fin-layer-breakdown">
      <div className="fin-lb-bar">
        {layers.map(l => <div key={l.n} className="fin-lb-seg" style={{ width: `${(l.amount / total) * 100}%`, background: l.color }} />)}
      </div>
      <div className="fin-lb-legend">
        {layers.map(l => (
          <div key={l.n} className="fin-lb-item">
            <span className="fin-lb-dot" style={{ background: l.color }} />
            <span className="fin-lb-label">L{l.n} {l.label}</span>
            <span className="fin-lb-val">{fmtMoney(l.amount, true)}</span>
            <span className="fin-lb-pct">{Math.round((l.amount / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function FinancePage() {
  const [state, setState] = useState<FinanceState>(loadFinance);
  const [tab, setTab]     = useState<'overview' | 'balance' | 'cashflow' | 'portfolio' | 'fi' | 'debt'>('overview');

  // Add form visibility
  const [showAddAsset,   setShowAddAsset]   = useState(false);
  const [showAddLiab,    setShowAddLiab]    = useState(false);
  const [showAddIncome,  setShowAddIncome]  = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);

  // Add forms
  const [assetForm,   setAssetForm]   = useState({ name: '', value: '', type: 'checking' as AssetType });
  const [liabForm,    setLiabForm]    = useState({ name: '', balance: '', rate: '' });
  const [incomeForm,  setIncomeForm]  = useState({ name: '', monthlyAmount: '', type: 'salary' as IncomeType });
  const [expenseForm, setExpenseForm] = useState({ name: '', monthlyAmount: '', category: 'housing' as ExpCat, isFixed: true });

  // Edit state
  const [editAssetId,    setEditAssetId]    = useState<string | null>(null);
  const [editLiabId,     setEditLiabId]     = useState<string | null>(null);
  const [editIncomeId,   setEditIncomeId]   = useState<string | null>(null);
  const [editExpenseId,  setEditExpenseId]  = useState<string | null>(null);
  const [editAssetForm,  setEditAssetForm]  = useState({ name: '', value: '', type: 'checking' as AssetType });
  const [editLiabForm,   setEditLiabForm]   = useState({ name: '', balance: '', rate: '' });
  const [editIncomeForm, setEditIncomeForm] = useState({ name: '', monthlyAmount: '', type: 'salary' as IncomeType });
  const [editExpForm,    setEditExpForm]    = useState({ name: '', monthlyAmount: '', category: 'housing' as ExpCat, isFixed: true });

  // Projector
  const [projContrib, setProjContrib] = useState(1000);
  const [projReturn,  setProjReturn]  = useState(8);
  const [projYears,   setProjYears]   = useState(30);

  // Debt
  const [debtStrategy, setDebtStrategy] = useState<'avalanche' | 'snowball'>('avalanche');
  const [debtExtra,    setDebtExtra]    = useState(200);

  // Cashflow filters
  const [showSubsOnly, setShowSubsOnly] = useState(false);
  const [showBudgets,  setShowBudgets]  = useState(false);

  const save = (next: FinanceState) => { saveFinance(next); setState(next); };

  // ── Metrics ───────────────────────────────────────────────────────────────
  const totalAssets   = useMemo(() => state.assets.reduce((s, a) => s + a.value, 0), [state.assets]);
  const totalLiabs    = useMemo(() => state.liabilities.reduce((s, l) => s + l.balance, 0), [state.liabilities]);
  const netWorth      = totalAssets - totalLiabs;
  const totalIncome   = useMemo(() => state.income.reduce((s, i) => s + i.monthlyAmount, 0), [state.income]);
  const totalExpenses = useMemo(() => state.expenses.reduce((s, e) => s + e.monthlyAmount, 0), [state.expenses]);
  const cashFlow      = totalIncome - totalExpenses;
  const savingsRate   = useMemo(() => calcSavingsRate(totalIncome, totalExpenses), [totalIncome, totalExpenses]);
  const passiveRatio  = useMemo(() => calcPassiveRatio(state.income), [state.income]);
  const fiNumber      = useMemo(() => calcFINumber(totalExpenses), [totalExpenses]);
  const fiProgress    = fiNumber > 0 ? Math.min(100, Math.round((netWorth / fiNumber) * 100)) : 0;
  const yearsToFI     = useMemo(() => calcYearsToFI(netWorth, fiNumber, Math.max(0, cashFlow)), [netWorth, fiNumber, cashFlow]);
  const runway        = useMemo(() => calcRunway(state.assets, totalExpenses), [state.assets, totalExpenses]);
  const split         = useMemo(() => cashFlowSplit(totalIncome), [totalIncome]);
  const actualAlloc   = useMemo(() => calcActualAllocation(state.assets), [state.assets]);
  const taxEff        = useMemo(() => calcTaxEfficiency(state.assets), [state.assets]);
  const insights      = useMemo(() => generateInsights(state, netWorth, savingsRate, cashFlow, fiProgress), [state, netWorth, savingsRate, cashFlow, fiProgress]);
  const layerTotals   = useMemo(() => { const t: Record<number,number> = {1:0,2:0,3:0,4:0}; state.assets.forEach(a => { t[a.layer] += a.value; }); return t; }, [state.assets]);
  const nwGrowthPct   = useMemo(() => { if (state.nwHistory.length < 2) return null; const o = state.nwHistory[0].value; return o ? Math.round(((netWorth - o) / Math.abs(o)) * 100) : null; }, [state.nwHistory, netWorth]);
  const subTotal      = useMemo(() => state.expenses.filter(e => e.category === 'subscriptions').reduce((s, e) => s + e.monthlyAmount, 0), [state.expenses]);
  const displayedExp  = useMemo(() => showSubsOnly ? state.expenses.filter(e => e.category === 'subscriptions') : state.expenses, [state.expenses, showSubsOnly]);

  const debtAvalanche = useMemo(() => simulatePayoff(state.liabilities, 'avalanche', debtExtra), [state.liabilities, debtExtra]);
  const debtSnowball  = useMemo(() => simulatePayoff(state.liabilities, 'snowball',  debtExtra), [state.liabilities, debtExtra]);
  const activeSim     = debtStrategy === 'avalanche' ? debtAvalanche : debtSnowball;

  const projScenarios = useMemo(() => [
    { label: `$${projContrib}/mo`,        points: projectGrowth(Math.max(0, netWorth), projContrib,       projYears, projReturn / 100), color: 'var(--accent)' },
    { label: `$${projContrib + 500}/mo`,  points: projectGrowth(Math.max(0, netWorth), projContrib + 500, projYears, projReturn / 100), color: 'var(--green)'  },
    { label: `$${Math.max(0, projContrib - 500)}/mo`, points: projectGrowth(Math.max(0, netWorth), Math.max(0, projContrib - 500), projYears, projReturn / 100), color: 'var(--text-dim)' },
  ], [netWorth, projContrib, projYears, projReturn]);

  // ── NW snapshot ───────────────────────────────────────────────────────────
  const snapshotNW = (next: FinanceState) => {
    const month = new Date().toISOString().slice(0, 7);
    const nw    = calcNetWorth(next.assets, next.liabilities);
    return { ...next, nwHistory: [...next.nwHistory.filter(h => h.date !== month), { date: month, value: nw }].slice(-24) };
  };

  // ── Add handlers ──────────────────────────────────────────────────────────
  const addAsset = () => {
    if (!assetForm.name || !assetForm.value) return;
    const layer = ASSET_TYPE_OPTIONS.find(t => t.value === assetForm.type)?.layer ?? 1;
    save(snapshotNW({ ...state, assets: [...state.assets, { id: uid(), name: assetForm.name, value: Number(assetForm.value), type: assetForm.type, layer }] }));
    setAssetForm({ name: '', value: '', type: 'checking' }); setShowAddAsset(false);
  };
  const addLiab = () => {
    if (!liabForm.name || !liabForm.balance) return;
    save(snapshotNW({ ...state, liabilities: [...state.liabilities, { id: uid(), name: liabForm.name, balance: Number(liabForm.balance), rate: Number(liabForm.rate) }] }));
    setLiabForm({ name: '', balance: '', rate: '' }); setShowAddLiab(false);
  };
  const addIncome = () => {
    if (!incomeForm.name || !incomeForm.monthlyAmount) return;
    const isPassive = INCOME_OPTIONS.find(o => o.value === incomeForm.type)?.passive ?? false;
    save({ ...state, income: [...state.income, { id: uid(), name: incomeForm.name, monthlyAmount: Number(incomeForm.monthlyAmount), type: incomeForm.type, isPassive }] });
    setIncomeForm({ name: '', monthlyAmount: '', type: 'salary' }); setShowAddIncome(false);
  };
  const addExpense = () => {
    if (!expenseForm.name || !expenseForm.monthlyAmount) return;
    save({ ...state, expenses: [...state.expenses, { id: uid(), name: expenseForm.name, monthlyAmount: Number(expenseForm.monthlyAmount), category: expenseForm.category, isFixed: expenseForm.isFixed }] });
    setExpenseForm({ name: '', monthlyAmount: '', category: 'housing', isFixed: true }); setShowAddExpense(false);
  };

  // ── Edit handlers ─────────────────────────────────────────────────────────
  const startEditAsset = (a: Asset) => { setEditAssetId(a.id); setEditAssetForm({ name: a.name, value: String(a.value), type: a.type }); setEditLiabId(null); setEditIncomeId(null); setEditExpenseId(null); };
  const saveEditAsset  = () => {
    if (!editAssetId) return;
    const layer = ASSET_TYPE_OPTIONS.find(t => t.value === editAssetForm.type)?.layer ?? 1;
    save(snapshotNW({ ...state, assets: state.assets.map(a => a.id === editAssetId ? { ...a, name: editAssetForm.name, value: Number(editAssetForm.value), type: editAssetForm.type, layer } : a) }));
    setEditAssetId(null);
  };
  const startEditLiab = (l: Liability) => { setEditLiabId(l.id); setEditLiabForm({ name: l.name, balance: String(l.balance), rate: String(l.rate) }); setEditAssetId(null); setEditIncomeId(null); setEditExpenseId(null); };
  const saveEditLiab  = () => {
    if (!editLiabId) return;
    save(snapshotNW({ ...state, liabilities: state.liabilities.map(l => l.id === editLiabId ? { ...l, name: editLiabForm.name, balance: Number(editLiabForm.balance), rate: Number(editLiabForm.rate) } : l) }));
    setEditLiabId(null);
  };
  const startEditIncome = (s: IncomeStream) => { setEditIncomeId(s.id); setEditIncomeForm({ name: s.name, monthlyAmount: String(s.monthlyAmount), type: s.type }); setEditAssetId(null); setEditLiabId(null); setEditExpenseId(null); };
  const saveEditIncome  = () => {
    if (!editIncomeId) return;
    const isPassive = INCOME_OPTIONS.find(o => o.value === editIncomeForm.type)?.passive ?? false;
    save({ ...state, income: state.income.map(s => s.id === editIncomeId ? { ...s, name: editIncomeForm.name, monthlyAmount: Number(editIncomeForm.monthlyAmount), type: editIncomeForm.type, isPassive } : s) });
    setEditIncomeId(null);
  };
  const startEditExpense = (e: Expense) => { setEditExpenseId(e.id); setEditExpForm({ name: e.name, monthlyAmount: String(e.monthlyAmount), category: e.category, isFixed: e.isFixed }); setEditAssetId(null); setEditLiabId(null); setEditIncomeId(null); };
  const saveEditExpense  = () => {
    if (!editExpenseId) return;
    save({ ...state, expenses: state.expenses.map(e => e.id === editExpenseId ? { ...e, name: editExpForm.name, monthlyAmount: Number(editExpForm.monthlyAmount), category: editExpForm.category, isFixed: editExpForm.isFixed } : e) });
    setEditExpenseId(null);
  };

  const TABS = [
    { id: 'overview'  as const, label: 'Overview',     icon: '⊟' },
    { id: 'balance'   as const, label: 'Balance Sheet', icon: '🏦' },
    { id: 'cashflow'  as const, label: 'Cash Flow',    icon: '💸' },
    { id: 'portfolio' as const, label: 'Portfolio',    icon: '📈' },
    { id: 'fi'        as const, label: 'FI Tracker',   icon: '🎯' },
    { id: 'debt'      as const, label: 'Debt',         icon: '📉' },
  ];
  const isEmpty = state.assets.length === 0 && state.income.length === 0;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="page fin-page">

      {/* Header */}
      <div className="fin-page-header">
        <div>
          <h2 className="page-title">Finance</h2>
          <p className="page-sub">Personal balance sheet · Capital allocation · Wealth architecture</p>
        </div>
        {!isEmpty && (
          <div className="fin-nw-hero">
            <span className="fin-nw-hero-label">Net Worth</span>
            <span className="fin-nw-hero-val" style={{ color: netWorth >= 0 ? 'var(--text)' : 'var(--red)' }}>{fmtMoney(netWorth, true)}</span>
            {nwGrowthPct !== null && (
              <span className={`fin-nw-hero-growth ${nwGrowthPct >= 0 ? 'fin-growth--up' : 'fin-growth--down'}`}>
                {nwGrowthPct >= 0 ? '↑' : '↓'} {Math.abs(nwGrowthPct)}% all-time
              </span>
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="fin-tabs">
        {TABS.map(t => (
          <button key={t.id} className={`fin-tab ${tab === t.id ? 'fin-tab--active' : ''}`} onClick={() => setTab(t.id)}>
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {/* ══════════════ OVERVIEW ══════════════ */}
      {tab === 'overview' && (
        <div className="fin-overview">
          {isEmpty ? (
            <div className="fin-empty">
              <p className="fin-empty-title">Operate like a portfolio manager</p>
              <p className="fin-empty-sub">Set up your financial baseline — Alfred will generate personalized wealth intelligence.</p>
              <div className="fin-empty-actions">
                <button className="btn-primary" onClick={() => setTab('balance')}>Add Assets →</button>
                <button className="fin-btn-secondary" onClick={() => setTab('cashflow')}>Add Income →</button>
              </div>
            </div>
          ) : (
            <>
              <div className="fin-metric-grid">
                {[
                  { label: 'Monthly Cash Flow', val: `${cashFlow >= 0 ? '+' : ''}${fmtMoney(cashFlow, true)}`, sub: cashFlow >= 0 ? 'surplus' : 'deficit', color: cashFlow >= 0 ? 'var(--green)' : 'var(--red)' },
                  { label: 'Savings Rate',       val: `${savingsRate}%`, sub: savingsRate >= 40 ? '🔥 Aggressive' : savingsRate >= 20 ? 'Moderate' : 'Below target', color: savingsRate >= 30 ? 'var(--green)' : savingsRate >= 15 ? 'var(--accent)' : 'var(--red)' },
                  { label: 'Passive Income',     val: `${passiveRatio}%`, sub: `of ${fmtMoney(totalIncome, true)}/mo`, color: 'var(--purple)' },
                  { label: 'Emergency Runway',   val: `${runway.toFixed(1)}mo`, sub: runway >= 6 ? '✓ Secure' : runway >= 3 ? 'Adequate' : 'Too thin', color: runway >= 6 ? 'var(--green)' : runway >= 3 ? 'var(--accent)' : 'var(--red)' },
                ].map((m, i) => (
                  <div key={i} className="fin-metric-card">
                    <span className="fin-metric-label">{m.label}</span>
                    <span className="fin-metric-val" style={{ color: m.color }}>{m.val}</span>
                    <span className="fin-metric-sub">{m.sub}</span>
                  </div>
                ))}
              </div>

              {/* Layer breakdown */}
              {state.assets.length > 0 && (
                <div className="fin-chart-card">
                  <span className="fin-card-title">Asset Layer Breakdown</span>
                  <LayerBreakdown assets={state.assets} />
                </div>
              )}

              {/* NW chart */}
              <div className="fin-chart-card">
                <span className="fin-card-title">Net Worth Trajectory</span>
                <NWChart history={state.nwHistory} />
              </div>

              {/* All insights */}
              {insights.length > 0 && (
                <div className="fin-insights-card">
                  <span className="fin-card-title">✦ Alfred's Wealth Intelligence</span>
                  {insights.map((tip, i) => (
                    <div key={i} className="fin-insight-row">
                      <span className={`fin-insight-badge fin-badge--${tip.urgency}`}>
                        {tip.urgency === 'critical' ? '⚠' : tip.urgency === 'warning' ? '!' : '→'}
                      </span>
                      <span>{tip.msg}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Pipeline */}
              {totalIncome > 0 && (
                <div className="fin-pipeline-card">
                  <span className="fin-card-title">Recommended Income Pipeline</span>
                  <div className="fin-pipeline">
                    <div className="fin-pipe-source">
                      <span className="fin-pipe-amt">{fmtMoney(totalIncome)}</span>
                      <span className="fin-pipe-lbl">/ month</span>
                    </div>
                    <span className="fin-pipe-arrow">→</span>
                    <div className="fin-pipe-splits">
                      {[
                        { pct: '10%', label: 'Liquidity Buffer', val: split.buffer,    color: 'var(--blue)',   desc: 'Layer 2 reserve' },
                        { pct: '60%', label: 'Invest',           val: split.invest,    color: 'var(--accent)', desc: 'Layer 3 wealth engine' },
                        { pct: '30%', label: 'Lifestyle',        val: split.lifestyle, color: 'var(--purple)', desc: 'Layer 1 operations' },
                      ].map((s, i) => (
                        <div key={i} className="fin-pipe-split" style={{ '--pipe-color': s.color } as React.CSSProperties}>
                          <span className="fin-pipe-split-pct" style={{ color: s.color }}>{s.pct}</span>
                          <span className="fin-pipe-split-label">{s.label}</span>
                          <span className="fin-pipe-split-val">{fmtMoney(s.val, true)}</span>
                          <span className="fin-pipe-split-desc">{s.desc}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ══════════════ BALANCE SHEET ══════════════ */}
      {tab === 'balance' && (
        <div className="fin-balance">
          {LAYER_META.map(layer => {
            const layerAssets = state.assets.filter(a => a.layer === layer.n);
            return (
              <div key={layer.n} className="fin-layer-card">
                <div className="fin-layer-head">
                  <span className="fin-layer-icon" style={{ color: layer.color }}>{layer.icon}</span>
                  <div className="fin-layer-text">
                    <span className="fin-layer-name">Layer {layer.n} · {layer.label}</span>
                    <span className="fin-layer-sub">{layer.sub}</span>
                  </div>
                  <span className="fin-layer-total" style={{ color: layer.color }}>{fmtMoney(layerTotals[layer.n] ?? 0, true)}</span>
                </div>
                {layerAssets.length > 0 && (
                  <div className="fin-asset-list">
                    {layerAssets.map(a => (
                      <div key={a.id}>
                        {editAssetId === a.id ? (
                          <div className="fin-inline-edit">
                            <input value={editAssetForm.name} onChange={e => setEditAssetForm(f => ({ ...f, name: e.target.value }))} placeholder="Name" />
                            <select value={editAssetForm.type} onChange={e => setEditAssetForm(f => ({ ...f, type: e.target.value as AssetType }))}>
                              {ASSET_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                            <input type="number" value={editAssetForm.value} onChange={e => setEditAssetForm(f => ({ ...f, value: e.target.value }))} placeholder="Value ($)" />
                            <button className="fin-save-btn" onClick={saveEditAsset}>Save</button>
                            <button className="fin-cancel-btn" onClick={() => setEditAssetId(null)}>Cancel</button>
                          </div>
                        ) : (
                          <div className="fin-asset-row">
                            <span className="fin-asset-name">{a.name}</span>
                            <span className="fin-asset-type">{ASSET_TYPE_OPTIONS.find(t => t.value === a.type)?.label}</span>
                            <span className="fin-asset-val">{fmtMoney(a.value, true)}</span>
                            <button className="fin-edit-btn" onClick={() => startEditAsset(a)}>✎</button>
                            <button className="fin-rm-btn" onClick={() => save(snapshotNW({ ...state, assets: state.assets.filter(x => x.id !== a.id) }))}>×</button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          {state.liabilities.length > 0 && (
            <div className="fin-layer-card fin-layer-card--liab">
              <div className="fin-layer-head">
                <span className="fin-layer-icon" style={{ color: 'var(--red)' }}>📉</span>
                <div className="fin-layer-text">
                  <span className="fin-layer-name">Liabilities</span>
                  <span className="fin-layer-sub">Reduces net worth — prioritize high-rate debt</span>
                </div>
                <span className="fin-layer-total" style={{ color: 'var(--red)' }}>−{fmtMoney(totalLiabs, true)}</span>
              </div>
              <div className="fin-asset-list">
                {state.liabilities.map(l => (
                  <div key={l.id}>
                    {editLiabId === l.id ? (
                      <div className="fin-inline-edit">
                        <input value={editLiabForm.name} onChange={e => setEditLiabForm(f => ({ ...f, name: e.target.value }))} placeholder="Name" />
                        <input type="number" value={editLiabForm.balance} onChange={e => setEditLiabForm(f => ({ ...f, balance: e.target.value }))} placeholder="Balance ($)" />
                        <input type="number" value={editLiabForm.rate} onChange={e => setEditLiabForm(f => ({ ...f, rate: e.target.value }))} placeholder="APR %" />
                        <button className="fin-save-btn" onClick={saveEditLiab}>Save</button>
                        <button className="fin-cancel-btn" onClick={() => setEditLiabId(null)}>Cancel</button>
                      </div>
                    ) : (
                      <div className="fin-asset-row">
                        <span className="fin-asset-name">{l.name}</span>
                        <span className="fin-asset-type">{l.rate}% APR</span>
                        <span className="fin-asset-val fin-asset-val--red">−{fmtMoney(l.balance, true)}</span>
                        <button className="fin-edit-btn" onClick={() => startEditLiab(l)}>✎</button>
                        <button className="fin-rm-btn" onClick={() => save(snapshotNW({ ...state, liabilities: state.liabilities.filter(x => x.id !== l.id) }))}>×</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="fin-add-row">
            <button className="fin-add-btn" onClick={() => { setShowAddAsset(s => !s); setShowAddLiab(false); }}>+ Asset</button>
            <button className="fin-add-btn fin-add-btn--red" onClick={() => { setShowAddLiab(s => !s); setShowAddAsset(false); }}>+ Liability</button>
          </div>
          {showAddAsset && (
            <div className="fin-add-form">
              <p className="fin-add-form-title">New Asset</p>
              <div className="fin-add-form-grid">
                <input placeholder="Name" value={assetForm.name} onChange={e => setAssetForm(f => ({ ...f, name: e.target.value }))} />
                <select value={assetForm.type} onChange={e => setAssetForm(f => ({ ...f, type: e.target.value as AssetType }))}>
                  {ASSET_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label} (Layer {o.layer})</option>)}
                </select>
                <input type="number" placeholder="Current value ($)" value={assetForm.value} onChange={e => setAssetForm(f => ({ ...f, value: e.target.value }))} />
                <button className="btn-primary" onClick={addAsset}>Add Asset</button>
              </div>
            </div>
          )}
          {showAddLiab && (
            <div className="fin-add-form">
              <p className="fin-add-form-title">New Liability</p>
              <div className="fin-add-form-grid">
                <input placeholder="Name (e.g. Student Loan)" value={liabForm.name} onChange={e => setLiabForm(f => ({ ...f, name: e.target.value }))} />
                <input type="number" placeholder="Balance ($)" value={liabForm.balance} onChange={e => setLiabForm(f => ({ ...f, balance: e.target.value }))} />
                <input type="number" placeholder="Interest rate (APR %)" value={liabForm.rate} onChange={e => setLiabForm(f => ({ ...f, rate: e.target.value }))} />
                <button className="btn-primary" onClick={addLiab}>Add Liability</button>
              </div>
            </div>
          )}
          <div className="fin-nw-summary">
            <div className="fin-nw-sum-row"><span>Total Assets</span><span className="fin-sum-green">{fmtMoney(totalAssets)}</span></div>
            <div className="fin-nw-sum-row"><span>Total Liabilities</span><span className="fin-sum-red">−{fmtMoney(totalLiabs)}</span></div>
            <div className="fin-nw-sum-row fin-nw-sum-row--total">
              <span>Net Worth</span>
              <span style={{ color: netWorth >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmtMoney(netWorth)}</span>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════ CASH FLOW ══════════════ */}
      {tab === 'cashflow' && (
        <div className="fin-cashflow">
          {/* Income */}
          <div className="fin-cf-section">
            <div className="fin-cf-head">
              <span className="fin-cf-title">Income Streams</span>
              <span className="fin-cf-total fin-cf-total--green">{fmtMoney(totalIncome)}/mo</span>
            </div>
            {state.income.map(s => (
              <div key={s.id}>
                {editIncomeId === s.id ? (
                  <div className="fin-inline-edit">
                    <input value={editIncomeForm.name} onChange={e => setEditIncomeForm(f => ({ ...f, name: e.target.value }))} placeholder="Name" />
                    <select value={editIncomeForm.type} onChange={e => setEditIncomeForm(f => ({ ...f, type: e.target.value as IncomeType }))}>
                      {INCOME_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <input type="number" value={editIncomeForm.monthlyAmount} onChange={e => setEditIncomeForm(f => ({ ...f, monthlyAmount: e.target.value }))} placeholder="$/mo" />
                    <button className="fin-save-btn" onClick={saveEditIncome}>Save</button>
                    <button className="fin-cancel-btn" onClick={() => setEditIncomeId(null)}>Cancel</button>
                  </div>
                ) : (
                  <div className="fin-cf-row">
                    <span className={`fin-cf-badge ${s.isPassive ? 'fin-cf-badge--purple' : 'fin-cf-badge--blue'}`}>{s.isPassive ? 'passive' : 'active'}</span>
                    <span className="fin-cf-name">{s.name}</span>
                    <span className="fin-cf-type">{INCOME_OPTIONS.find(o => o.value === s.type)?.label}</span>
                    <span className="fin-cf-amt">{fmtMoney(s.monthlyAmount)}</span>
                    <button className="fin-edit-btn" onClick={() => startEditIncome(s)}>✎</button>
                    <button className="fin-rm-btn" onClick={() => save({ ...state, income: state.income.filter(x => x.id !== s.id) })}>×</button>
                  </div>
                )}
              </div>
            ))}
            <button className="fin-add-btn" onClick={() => { setShowAddIncome(s => !s); setShowAddExpense(false); }}>+ Income Stream</button>
            {showAddIncome && (
              <div className="fin-add-form">
                <div className="fin-add-form-grid">
                  <input placeholder="Name (e.g. Salary — Google)" value={incomeForm.name} onChange={e => setIncomeForm(f => ({ ...f, name: e.target.value }))} />
                  <select value={incomeForm.type} onChange={e => setIncomeForm(f => ({ ...f, type: e.target.value as IncomeType }))}>
                    {INCOME_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label} ({o.passive ? 'passive' : 'active'})</option>)}
                  </select>
                  <input type="number" placeholder="Monthly amount ($)" value={incomeForm.monthlyAmount} onChange={e => setIncomeForm(f => ({ ...f, monthlyAmount: e.target.value }))} />
                  <button className="btn-primary" onClick={addIncome}>Add</button>
                </div>
              </div>
            )}
          </div>

          {/* Expenses */}
          <div className="fin-cf-section">
            <div className="fin-cf-head">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="fin-cf-title">Monthly Expenses</span>
                {subTotal > 0 && (
                  <button className={`fin-filter-btn ${showSubsOnly ? 'fin-filter-btn--active' : ''}`} onClick={() => setShowSubsOnly(s => !s)}>
                    {showSubsOnly ? '◈ All' : `🔔 Subs ($${Math.round(subTotal)}/mo)`}
                  </button>
                )}
                <button className={`fin-filter-btn ${showBudgets ? 'fin-filter-btn--active' : ''}`} onClick={() => setShowBudgets(s => !s)}>
                  {showBudgets ? '✕ Budgets' : '≡ Budgets'}
                </button>
              </div>
              <span className="fin-cf-total fin-cf-total--red">−{fmtMoney(totalExpenses)}/mo</span>
            </div>

            {/* Budget limits */}
            {showBudgets && (
              <div className="fin-budget-grid">
                {EXP_CATS.map(cat => {
                  const actual = state.expenses.filter(e => e.category === cat).reduce((s, e) => s + e.monthlyAmount, 0);
                  const budget = state.budgetLimits[cat] ?? 0;
                  const over   = budget > 0 && actual > budget;
                  return (
                    <div key={cat} className={`fin-budget-row ${over ? 'fin-budget-row--over' : ''}`}>
                      <span className="fin-budget-cat" style={{ color: EXP_CAT_COLORS[cat] }}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</span>
                      <span className="fin-budget-actual">{fmtMoney(actual, true)}</span>
                      <span className="fin-budget-sep">/</span>
                      <input type="number" className="fin-budget-input" placeholder="Budget $"
                        value={budget || ''}
                        onChange={e => save({ ...state, budgetLimits: { ...state.budgetLimits, [cat]: Number(e.target.value) || 0 } })} />
                      {over && <span className="fin-budget-warn">↑{fmtMoney(actual - budget, true)}</span>}
                    </div>
                  );
                })}
              </div>
            )}

            {displayedExp.map(e => (
              <div key={e.id}>
                {editExpenseId === e.id ? (
                  <div className="fin-inline-edit">
                    <input value={editExpForm.name} onChange={ev => setEditExpForm(f => ({ ...f, name: ev.target.value }))} placeholder="Name" />
                    <select value={editExpForm.category} onChange={ev => setEditExpForm(f => ({ ...f, category: ev.target.value as ExpCat }))}>
                      {EXP_CATS.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                    </select>
                    <input type="number" value={editExpForm.monthlyAmount} onChange={ev => setEditExpForm(f => ({ ...f, monthlyAmount: ev.target.value }))} placeholder="$/mo" />
                    <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      <input type="checkbox" checked={editExpForm.isFixed} onChange={ev => setEditExpForm(f => ({ ...f, isFixed: ev.target.checked }))} /> Fixed
                    </label>
                    <button className="fin-save-btn" onClick={saveEditExpense}>Save</button>
                    <button className="fin-cancel-btn" onClick={() => setEditExpenseId(null)}>Cancel</button>
                  </div>
                ) : (
                  <div className="fin-cf-row">
                    <span className={`fin-cf-badge ${e.isFixed ? 'fin-cf-badge--amber' : 'fin-cf-badge--gray'}`}>{e.isFixed ? 'fixed' : 'var'}</span>
                    <span className="fin-cf-name">{e.name}</span>
                    <span className="fin-cf-type" style={{ color: EXP_CAT_COLORS[e.category] }}>{e.category}</span>
                    <span className="fin-cf-amt fin-cf-amt--red">−{fmtMoney(e.monthlyAmount)}</span>
                    <button className="fin-edit-btn" onClick={() => startEditExpense(e)}>✎</button>
                    <button className="fin-rm-btn" onClick={() => save({ ...state, expenses: state.expenses.filter(x => x.id !== e.id) })}>×</button>
                  </div>
                )}
              </div>
            ))}
            {showSubsOnly && subTotal > 0 && (
              <div className="fin-subs-summary">
                <span>📺 {state.expenses.filter(e => e.category === 'subscriptions').length} subscriptions</span>
                <span>{fmtMoney(subTotal)}/mo · {fmtMoney(subTotal * 12)}/yr</span>
              </div>
            )}
            <button className="fin-add-btn" onClick={() => { setShowAddExpense(s => !s); setShowAddIncome(false); }}>+ Expense</button>
            {showAddExpense && (
              <div className="fin-add-form">
                <div className="fin-add-form-grid">
                  <input placeholder="Name (e.g. Rent)" value={expenseForm.name} onChange={e => setExpenseForm(f => ({ ...f, name: e.target.value }))} />
                  <select value={expenseForm.category} onChange={e => setExpenseForm(f => ({ ...f, category: e.target.value as ExpCat }))}>
                    {EXP_CATS.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                  </select>
                  <input type="number" placeholder="Monthly amount ($)" value={expenseForm.monthlyAmount} onChange={e => setExpenseForm(f => ({ ...f, monthlyAmount: e.target.value }))} />
                  <label className="fin-checkbox-label">
                    <input type="checkbox" checked={expenseForm.isFixed} onChange={e => setExpenseForm(f => ({ ...f, isFixed: e.target.checked }))} /> Fixed expense
                  </label>
                  <button className="btn-primary" onClick={addExpense}>Add</button>
                </div>
              </div>
            )}
          </div>

          {/* Spending chart */}
          {state.expenses.length > 0 && (
            <div className="fin-chart-card">
              <span className="fin-card-title">Spending by Category</span>
              <ExpenseChart expenses={state.expenses} />
            </div>
          )}

          {(totalIncome > 0 || totalExpenses > 0) && (
            <div className="fin-cf-summary">
              <div className="fin-cf-sum-row"><span>Income</span><span className="fin-sum-green">{fmtMoney(totalIncome)}</span></div>
              <div className="fin-cf-sum-row"><span>Expenses</span><span className="fin-sum-red">−{fmtMoney(totalExpenses)}</span></div>
              <div className="fin-cf-sum-row fin-cf-sum-row--total">
                <span>Net Cash Flow</span>
                <span style={{ color: cashFlow >= 0 ? 'var(--green)' : 'var(--red)' }}>{cashFlow >= 0 ? '+' : ''}{fmtMoney(cashFlow)}</span>
              </div>
              <div className="fin-sr-row">
                <span>Savings Rate</span>
                <span style={{ color: savingsRate >= 30 ? 'var(--green)' : 'var(--accent)' }}>{savingsRate}%</span>
              </div>
              <FinBar pct={savingsRate} color={savingsRate >= 40 ? 'var(--green)' : savingsRate >= 20 ? 'var(--accent)' : 'var(--red)'} h={8} />
              <p className="fin-sr-sub">Target: 30–60% savings rate for aggressive wealth building</p>
            </div>
          )}
        </div>
      )}

      {/* ══════════════ PORTFOLIO ══════════════ */}
      {tab === 'portfolio' && (
        <div className="fin-portfolio">

          {/* Tax efficiency score */}
          {state.assets.some(a => a.layer >= 3) && (
            <div className="fin-chart-card">
              <span className="fin-card-title">Tax Efficiency Score</span>
              <div className="fin-tax-eff">
                <div className="fin-tax-eff-score" style={{ color: taxEff >= 70 ? 'var(--green)' : taxEff >= 40 ? 'var(--accent)' : 'var(--red)' }}>
                  {taxEff}%
                </div>
                <div className="fin-tax-eff-detail">
                  <span className="fin-tax-eff-label">{taxEff >= 70 ? '✓ Well-optimized' : taxEff >= 40 ? 'Room to improve' : 'Under-optimized'}</span>
                  <span className="fin-tax-eff-sub">of investable assets in tax-advantaged accounts (401k, Roth, HSA)</span>
                  <FinBar pct={taxEff} color={taxEff >= 70 ? 'var(--green)' : taxEff >= 40 ? 'var(--accent)' : 'var(--red)'} h={6} />
                </div>
              </div>
            </div>
          )}

          <div className="fin-alloc-grid">
            {[
              { key: 'core'       as const, label: 'Core',       desc: 'Broad index funds — stability + compounding', color: 'var(--accent)' },
              { key: 'growth'     as const, label: 'Growth',     desc: 'Tech ETFs, high-conviction — acceleration',   color: 'var(--blue)'   },
              { key: 'asymmetric' as const, label: 'Asymmetric', desc: 'Startups, crypto — explosive upside',         color: 'var(--purple)' },
            ].map(a => (
              <div key={a.key} className="fin-alloc-card">
                <AllocRing actual={actualAlloc[a.key]} target={state.allocation[a.key]} label={a.label} color={a.color} />
                <div className="fin-alloc-detail">
                  <span className="fin-alloc-name" style={{ color: a.color }}>{a.label}</span>
                  <span className="fin-alloc-desc">{a.desc}</span>
                  <div className="fin-alloc-target-row">
                    <span>Target:</span>
                    <input type="number" min="0" max="100" className="fin-alloc-input"
                      value={state.allocation[a.key]}
                      onChange={e => save({ ...state, allocation: { ...state.allocation, [a.key]: Number(e.target.value) } })} />
                    <span>%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="fin-strat-card">
            <span className="fin-card-title">Strategy Reference</span>
            <div className="fin-strat-rows">
              {[
                { color: 'var(--accent)', label: 'Core  70–80%',     desc: 'S&P 500, Total Market ETF, International — slow and powerful' },
                { color: 'var(--blue)',   label: 'Growth 10–20%',    desc: 'QQQ, ARKK, individual high-conviction stocks — acceleration' },
                { color: 'var(--purple)', label: 'Asymmetric 5–10%', desc: 'Angel deals, crypto, your own products — where breakout wealth happens' },
              ].map((s, i) => (
                <div key={i} className="fin-strat-row">
                  <span className="fin-strat-dot" style={{ background: s.color }} />
                  <span className="fin-strat-label" style={{ color: s.color }}>{s.label}</span>
                  <span className="fin-strat-desc">{s.desc}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="fin-tax-card">
            <span className="fin-card-title">Tax-Advantaged Priority Stack</span>
            <div className="fin-tax-rows">
              {[
                { num: '01', label: '401(k) match',      desc: 'Instant 50–100% return — always max employer match first',  done: state.assets.some(a => a.type === '401k')      },
                { num: '02', label: 'HSA',               desc: 'Triple tax advantage — deduct, grow, withdraw tax-free',    done: state.assets.some(a => a.type === 'hsa')       },
                { num: '03', label: 'Roth IRA',          desc: 'Tax-free growth forever — max $7k/yr ($8k if 50+)',         done: state.assets.some(a => a.type === 'roth_ira')  },
                { num: '04', label: 'Taxable Brokerage', desc: 'After tax-advantaged accounts are maxed — long-term holds', done: state.assets.some(a => a.type === 'brokerage') },
              ].map((t, i) => (
                <div key={i} className={`fin-tax-row ${t.done ? 'fin-tax-row--done' : ''}`}>
                  <span className="fin-tax-num">{t.num}</span>
                  <div className="fin-tax-text">
                    <span className="fin-tax-label">{t.label}</span>
                    <span className="fin-tax-desc">{t.desc}</span>
                  </div>
                  {t.done && <span className="fin-tax-check">✓</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════ FI TRACKER ══════════════ */}
      {tab === 'fi' && (
        <div className="fin-fi">
          <div className="fin-fi-hero-card">
            <div className="fin-fi-left">
              <span className="fin-fi-label">FI Number</span>
              <span className="fin-fi-number">{fiNumber > 0 ? fmtMoney(fiNumber) : '—'}</span>
              <span className="fin-fi-sub">{totalExpenses > 0 ? `${fmtMoney(totalExpenses)}/mo × 12 × 25 (4% rule)` : 'Add monthly expenses to calculate'}</span>
            </div>
            {fiNumber > 0 && (
              <div className="fin-fi-right">
                <span className="fin-fi-prog-label">{fiProgress}% there</span>
                <FinBar pct={fiProgress} color="var(--accent)" h={10} />
                <div className="fin-fi-prog-vals">
                  <span>{fmtMoney(netWorth, true)}</span>
                  <span>{fmtMoney(fiNumber, true)}</span>
                </div>
              </div>
            )}
          </div>

          {yearsToFI > 0 && yearsToFI < 999 && cashFlow > 0 && (
            <div className="fin-fi-eta-card">
              <div className="fin-fi-eta-num">{yearsToFI}</div>
              <div className="fin-fi-eta-detail">
                <span className="fin-fi-eta-unit">years to FI</span>
                <span className="fin-fi-eta-sub">Investing {fmtMoney(cashFlow, true)}/mo · 8% annual return</span>
                <span className="fin-fi-eta-year">Target year: {new Date().getFullYear() + Math.ceil(yearsToFI)}</span>
              </div>
            </div>
          )}

          {/* Growth Projector */}
          <div className="fin-chart-card">
            <span className="fin-card-title">Growth Projector</span>
            <div className="fin-proj-controls">
              {[
                { label: 'Monthly contribution', val: fmtMoney(projContrib), min: 0, max: 5000, step: 100, value: projContrib, set: setProjContrib },
                { label: 'Annual return',        val: `${projReturn}%`,      min: 2, max: 15,   step: 0.5, value: projReturn,  set: setProjReturn  },
                { label: 'Time horizon',         val: `${projYears} years`,  min: 5, max: 40,   step: 1,   value: projYears,   set: setProjYears   },
              ].map(s => (
                <div key={s.label} className="fin-proj-slider-group">
                  <label className="fin-proj-label">{s.label}: <strong>{s.val}</strong></label>
                  <input type="range" min={s.min} max={s.max} step={s.step} value={s.value}
                    onChange={e => s.set(Number(e.target.value))} className="fin-slider" />
                </div>
              ))}
            </div>
            <GrowthChart scenarios={projScenarios} />
            <div className="fin-proj-legend">
              {projScenarios.map(sc => (
                <div key={sc.label} className="fin-proj-legend-item">
                  <span className="fin-proj-legend-dot" style={{ background: sc.color }} />
                  <span className="fin-proj-legend-label">{sc.label}</span>
                  <span className="fin-proj-legend-val" style={{ color: sc.color }}>
                    → {fmtMoney(sc.points[sc.points.length - 1]?.value ?? 0, true)} in {projYears}y
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="fin-phases-card">
            <span className="fin-card-title">Phase Roadmap</span>
            {([
              { phase: '01', label: 'Foundation',   target: 25_000,  milestone: '$25k',  desc: 'Emergency fund full · 401k match · Roth opened' },
              { phase: '02', label: 'Accumulation', target: 100_000, milestone: '$100k', desc: 'All tax accounts maxed · Debt-free · Brokerage active' },
              { phase: '03', label: 'Acceleration', target: 500_000, milestone: '$500k', desc: 'Compounding visible · Second income stream live' },
              { phase: '04', label: 'FI Zone',      target: fiNumber, milestone: 'FI#',  desc: 'Portfolio covers expenses · Work becomes optional' },
            ] as const).map((p, i) => {
              const reached = netWorth >= p.target;
              return (
                <div key={i} className={`fin-phase-row ${reached ? 'fin-phase-row--reached' : ''}`}>
                  <div className="fin-phase-num">{p.phase}</div>
                  <div className="fin-phase-body">
                    <div className="fin-phase-head">
                      <span className="fin-phase-label">{p.label}</span>
                      <span className="fin-phase-milestone">{p.milestone}</span>
                    </div>
                    <span className="fin-phase-desc">{p.desc}</span>
                  </div>
                  {reached && <span className="fin-phase-check">✓</span>}
                </div>
              );
            })}
          </div>

          <div className="fin-formula-card">
            <span className="fin-card-title">The Wealth Equation</span>
            <p className="fin-formula-eq">Wealth = (Income − Expenses) × Return × Time × Discipline</p>
            <div className="fin-levers">
              {[
                { icon: '💰', label: 'Saving is linear',      desc: 'Each dollar saved = 1 unit. Important but limited.' },
                { icon: '📈', label: 'Investing is exponential', desc: 'Each invested dollar compounds — longer = more powerful.' },
                { icon: '🚀', label: 'Ownership is explosive', desc: 'Equity in products/companies = unlimited upside.' },
              ].map((l, i) => (
                <div key={i} className="fin-lever">
                  <span className="fin-lever-icon">{l.icon}</span>
                  <div className="fin-lever-text">
                    <span className="fin-lever-label">{l.label}</span>
                    <span className="fin-lever-desc">{l.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════ DEBT ══════════════ */}
      {tab === 'debt' && (
        <div className="fin-debt">
          {state.liabilities.length === 0 ? (
            <div className="fin-empty">
              <p className="fin-empty-title">No liabilities tracked</p>
              <p className="fin-empty-sub">Add your debts in the Balance Sheet tab to see payoff strategies.</p>
              <button className="btn-primary" onClick={() => setTab('balance')}>Add Liabilities →</button>
            </div>
          ) : (
            <>
              {/* Controls */}
              <div className="fin-debt-controls">
                <div className="fin-debt-toggle">
                  <button className={`fin-strat-btn ${debtStrategy === 'avalanche' ? 'fin-strat-btn--active' : ''}`} onClick={() => setDebtStrategy('avalanche')}>
                    🏔 Avalanche
                  </button>
                  <button className={`fin-strat-btn ${debtStrategy === 'snowball' ? 'fin-strat-btn--active' : ''}`} onClick={() => setDebtStrategy('snowball')}>
                    ❄ Snowball
                  </button>
                </div>
                <div className="fin-proj-slider-group">
                  <label className="fin-proj-label">Extra payment/mo: <strong>{fmtMoney(debtExtra)}</strong></label>
                  <input type="range" min="0" max="2000" step="50" value={debtExtra} onChange={e => setDebtExtra(Number(e.target.value))} className="fin-slider" />
                </div>
              </div>

              <div className="fin-debt-strat-desc">
                {debtStrategy === 'avalanche'
                  ? <p><strong>Avalanche:</strong> Highest interest rate first. Minimizes total interest paid — mathematically optimal.</p>
                  : <p><strong>Snowball:</strong> Smallest balance first. Builds momentum through quick wins — psychologically powerful.</p>}
              </div>

              {/* Comparison */}
              <div className="fin-debt-compare">
                <div className={`fin-debt-cmp-card ${debtStrategy === 'avalanche' ? 'fin-debt-cmp-card--active' : ''}`}>
                  <span className="fin-debt-cmp-label">🏔 Avalanche</span>
                  <span className="fin-debt-cmp-val">{fmtMoney(debtAvalanche.totalInterest, true)}</span>
                  <span className="fin-debt-cmp-sub">interest · {fmtMonths(debtAvalanche.totalMonths)}</span>
                </div>
                <div className="fin-debt-cmp-vs">vs</div>
                <div className={`fin-debt-cmp-card ${debtStrategy === 'snowball' ? 'fin-debt-cmp-card--active' : ''}`}>
                  <span className="fin-debt-cmp-label">❄ Snowball</span>
                  <span className="fin-debt-cmp-val">{fmtMoney(debtSnowball.totalInterest, true)}</span>
                  <span className="fin-debt-cmp-sub">interest · {fmtMonths(debtSnowball.totalMonths)}</span>
                </div>
              </div>

              {debtAvalanche.totalInterest !== debtSnowball.totalInterest && (
                <div className="fin-debt-savings">
                  {debtAvalanche.totalInterest < debtSnowball.totalInterest
                    ? <>Avalanche saves <strong style={{ color: 'var(--green)' }}>{fmtMoney(debtSnowball.totalInterest - debtAvalanche.totalInterest)}</strong> in interest over Snowball.</>
                    : <>Strategies yield equal interest — Snowball wins on psychology.</>}
                </div>
              )}

              {/* Payoff order */}
              <div className="fin-chart-card">
                <span className="fin-card-title">
                  Payoff Order — {debtStrategy === 'avalanche' ? 'Highest Rate → Lowest' : 'Smallest Balance → Largest'}
                </span>
                <div className="fin-debt-list">
                  {activeSim.order.map((id, idx) => {
                    const liab = state.liabilities.find(l => l.id === id);
                    if (!liab) return null;
                    const info   = activeSim.perDebt[id];
                    const minPay = Math.max(25, Math.round(liab.balance * 0.02));
                    return (
                      <div key={id} className="fin-debt-row">
                        <span className="fin-debt-order">{idx + 1}</span>
                        <div className="fin-debt-info">
                          <span className="fin-debt-name">{liab.name}</span>
                          <span className="fin-debt-meta">{fmtMoney(liab.balance, true)} · {liab.rate}% APR · min ${minPay}/mo</span>
                        </div>
                        <div className="fin-debt-result">
                          <span className="fin-debt-payoff">{fmtMonths(info?.payoffMonth ?? 600)}</span>
                          <span className="fin-debt-interest">{fmtMoney(info?.interest ?? 0, true)} interest</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Extra payment impact */}
              {debtExtra > 0 && (() => {
                const minOnly = simulatePayoff(state.liabilities, debtStrategy, 0);
                const saved   = minOnly.totalInterest - activeSim.totalInterest;
                const months  = minOnly.totalMonths  - activeSim.totalMonths;
                return saved > 0 ? (
                  <div className="fin-debt-savings">
                    Extra {fmtMoney(debtExtra)}/mo saves <strong style={{ color: 'var(--green)' }}>{fmtMoney(saved)}</strong> in interest
                    {months > 0 && <> and <strong style={{ color: 'var(--green)' }}>{fmtMonths(months)}</strong></>} vs minimum payments only.
                  </div>
                ) : null;
              })()}
            </>
          )}
        </div>
      )}
    </div>
  );
}
