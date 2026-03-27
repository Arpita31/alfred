import { useState, useMemo } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

const FIN_KEY = 'alfred_finance_v1';

type AssetLayer = 1 | 2 | 3 | 4;
type AssetType  = 'checking' | 'savings' | 'brokerage' | '401k' | 'roth_ira' | 'hsa' | 'crypto' | 'real_estate' | 'equity' | 'startup' | 'other';
type IncomeType = 'salary' | 'freelance' | 'dividends' | 'rental' | 'business' | 'other';
type ExpCat     = 'housing' | 'food' | 'transport' | 'utilities' | 'subscriptions' | 'health' | 'entertainment' | 'other';

interface Asset      { id: string; name: string; value: number; type: AssetType; layer: AssetLayer; }
interface Liability  { id: string; name: string; balance: number; rate: number; }
interface IncomeStream { id: string; name: string; monthlyAmount: number; type: IncomeType; isPassive: boolean; }
interface Expense    { id: string; name: string; monthlyAmount: number; category: ExpCat; isFixed: boolean; }
interface NWSnapshot { date: string; value: number; }        // YYYY-MM
interface AllocationTargets { core: number; growth: number; asymmetric: number; }

interface FinanceState {
  assets: Asset[];
  liabilities: Liability[];
  income: IncomeStream[];
  expenses: Expense[];
  nwHistory: NWSnapshot[];
  allocation: AllocationTargets;
}

// ─── Persistence ──────────────────────────────────────────────────────────────

const DEFAULT_STATE: FinanceState = {
  assets: [], liabilities: [], income: [], expenses: [], nwHistory: [],
  allocation: { core: 75, growth: 15, asymmetric: 10 },
};

function loadFinance(): FinanceState {
  try {
    const raw = localStorage.getItem(FIN_KEY);
    return raw ? { ...DEFAULT_STATE, ...JSON.parse(raw) } : DEFAULT_STATE;
  } catch { return DEFAULT_STATE; }
}
function saveFinance(s: FinanceState) { localStorage.setItem(FIN_KEY, JSON.stringify(s)); }
function uid() { return Math.random().toString(36).slice(2, 9); }

// ─── Finance Engine (ML models) ───────────────────────────────────────────────

// NET WORTH: sum all assets, subtract all debts
function calcNetWorth(assets: Asset[], liabilities: Liability[]): number {
  return assets.reduce((s, a) => s + a.value, 0) - liabilities.reduce((s, l) => s + l.balance, 0);
}

// SAVINGS RATE: what % of income you keep (target: 30–60%)
function calcSavingsRate(income: number, expenses: number): number {
  if (!income) return 0;
  return Math.max(0, Math.round(((income - expenses) / income) * 100));
}

// PASSIVE INCOME RATIO: % of income that flows without you working
function calcPassiveRatio(streams: IncomeStream[]): number {
  const total = streams.reduce((s, i) => s + i.monthlyAmount, 0);
  if (!total) return 0;
  const passive = streams.filter(s => s.isPassive).reduce((s, i) => s + i.monthlyAmount, 0);
  return Math.round((passive / total) * 100);
}

// FI NUMBER: how much you need invested to never need to work again
// Formula: annual_expenses × 25 (based on 4% safe withdrawal rate)
// Example: $3k/mo expenses → $36k/yr → $900k FI number
function calcFINumber(monthlyExpenses: number): number {
  return monthlyExpenses * 12 * 25;
}

// YEARS TO FI: uses compound interest formula solved with binary search
// Accounts for: current net worth, monthly contributions, expected 8% return
function calcYearsToFI(netWorth: number, fiNumber: number, monthlyContrib: number, annualReturn = 0.08): number {
  if (netWorth >= fiNumber) return 0;
  if (monthlyContrib <= 0) return 999;
  const r = annualReturn / 12;
  let lo = 0, hi = 100;
  // Binary search: find n years where FV = fiNumber
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const n   = mid * 12;
    const fv  = netWorth * Math.pow(1 + r, n) + monthlyContrib * (Math.pow(1 + r, n) - 1) / r;
    if (fv >= fiNumber) hi = mid;
    else lo = mid;
  }
  return Math.round((lo + hi) / 2 * 10) / 10;
}

// RECOMMENDED CASH FLOW SPLIT: income pipeline allocation
function cashFlowSplit(monthly: number) {
  return {
    buffer:    Math.round(monthly * 0.10),   // 10% liquidity reserve
    invest:    Math.round(monthly * 0.60),   // 60% wealth engine
    lifestyle: Math.round(monthly * 0.30),  // 30% operations
  };
}

// ACTUAL PORTFOLIO ALLOCATION: what % is in each bucket right now
function calcActualAllocation(assets: Asset[]) {
  const inv   = assets.filter(a => a.layer === 3 || a.layer === 4);
  const total = inv.reduce((s, a) => s + a.value, 0);
  if (!total) return { core: 0, growth: 0, asymmetric: 0 };
  const core       = inv.filter(a => ['brokerage','401k','roth_ira'].includes(a.type)).reduce((s,a) => s+a.value, 0);
  const growth     = inv.filter(a => a.type === 'hsa').reduce((s,a) => s+a.value, 0);
  const asymmetric = inv.filter(a => ['crypto','startup','equity'].includes(a.type)).reduce((s,a) => s+a.value, 0);
  return {
    core:       Math.round((core / total) * 100),
    growth:     Math.round((growth / total) * 100),
    asymmetric: Math.round((asymmetric / total) * 100),
  };
}

// RUNWAY: how many months you can survive with zero income
function calcRunway(assets: Asset[], monthlyExpenses: number): number {
  const liquid = assets.filter(a => a.layer <= 2).reduce((s, a) => s + a.value, 0);
  return monthlyExpenses > 0 ? liquid / monthlyExpenses : 0;
}

// AI INSIGHTS: rule-based intelligence engine
// Each rule checks a condition → produces a specific, actionable recommendation
function generateInsights(
  state: FinanceState,
  netWorth: number,
  savingsRate: number,
  cashFlow: number,
  fiProgress: number,
): string[] {
  const tips: string[] = [];
  const income   = state.income.reduce((s, i) => s + i.monthlyAmount, 0);
  const expenses = state.expenses.reduce((s, e) => s + e.monthlyAmount, 0);

  // Savings rate check
  if (income > 0 && savingsRate < 20) tips.push(`Savings rate is ${savingsRate}% — below the 30% threshold for meaningful wealth building. Cut one major variable expense.`);
  if (income > 0 && savingsRate >= 40) tips.push(`Strong ${savingsRate}% savings rate — you're compounding faster than 90% of earners.`);

  // Tax-advantaged accounts
  const has401k = state.assets.some(a => a.type === '401k');
  const hasRoth = state.assets.some(a => a.type === 'roth_ira');
  const hasHSA  = state.assets.some(a => a.type === 'hsa');
  if (!has401k && income > 0) tips.push('No 401(k) detected — employer match is instant 50–100% return. Max it before investing anywhere else.');
  if (!hasRoth && income > 0) tips.push('Open a Roth IRA — your contributions grow tax-free forever. At your income level this is the highest-leverage account you have.');
  if (!hasHSA  && income > 0) tips.push('HSA = triple tax advantage: deduct on contribution, grow tax-free, withdraw tax-free for medical. Most underused account in the US.');

  // Emergency fund / runway
  const runway = calcRunway(state.assets, expenses);
  if (expenses > 0 && runway < 3)  tips.push(`Only ${runway.toFixed(1)} months runway — build a 3–6 month emergency fund before increasing investments.`);
  if (expenses > 0 && runway > 12) tips.push(`${runway.toFixed(0)} months cash is too much — excess cash loses 3–4% to inflation yearly. Invest the surplus in Layer 3.`);

  // FI progress
  if (fiProgress >= 50 && fiProgress < 100) tips.push(`${fiProgress}% to FI — past the halfway point. Compounding accelerates sharply from here.`);
  if (fiProgress >= 100) tips.push('FI number reached — you can Coast FIRE. Work becomes optional, not required.');

  // Passive income
  const passiveRatio = calcPassiveRatio(state.income);
  if (passiveRatio === 0 && income > 0) tips.push('Zero passive income — every hour you stop working, income stops. Add one passive stream: dividends, rental, or SaaS.');
  if (passiveRatio > 0 && passiveRatio < 20) tips.push(`${passiveRatio}% passive income — grow this. When passive income ≥ monthly expenses, you achieve FI.`);

  // High-rate debt
  const highDebt = state.liabilities.filter(l => l.rate > 7);
  if (highDebt.length > 0) tips.push(`High-rate debt (${highDebt[0].rate}% APR) detected — paying it off is a guaranteed ${highDebt[0].rate}% return, better than most investments.`);

  // Positive cash flow check
  if (income > 0 && cashFlow < 0) tips.push('Negative cash flow — spending exceeds income. Fix this immediately before investing anything.');

  return tips.slice(0, 3);
}

// ─── Format helpers ───────────────────────────────────────────────────────────

function fmtMoney(n: number, compact = false): string {
  if (compact) {
    if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
    if (Math.abs(n) >= 1_000)     return `$${(n / 1_000).toFixed(1)}k`;
    return `$${Math.round(n)}`;
  }
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LAYER_META = [
  { n: 1 as AssetLayer, label: 'Operating',   sub: 'Monthly expenses only',      icon: '🏦', color: 'var(--blue)'   },
  { n: 2 as AssetLayer, label: 'Reserve',     sub: '3–6 month emergency runway',  icon: '🛡', color: 'var(--green)'  },
  { n: 3 as AssetLayer, label: 'Investments', sub: '401k, Roth IRA, brokerage',   icon: '📈', color: 'var(--accent)' },
  { n: 4 as AssetLayer, label: 'Opportunity', sub: 'Market dips, startups, deals',icon: '🚀', color: 'var(--purple)' },
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

// ─── Sub-components ───────────────────────────────────────────────────────────

// Net worth sparkline (SVG area chart)
function NWChart({ history }: { history: NWSnapshot[] }) {
  if (history.length < 2) {
    return <div className="fin-chart-empty">Save changes monthly to see your wealth curve</div>;
  }
  const vals = history.map(h => h.value);
  const min  = Math.min(...vals);
  const max  = Math.max(...vals);
  const rng  = max - min || 1;
  const W = 380, H = 90, PAD = 10;
  const x = (i: number) => PAD + (i / (history.length - 1)) * (W - PAD * 2);
  const y = (v: number) => H - PAD - ((v - min) / rng) * (H - PAD * 2);
  const pts  = history.map((h, i) => `${x(i)},${y(h.value)}`).join(' ');
  const area = `${PAD},${H} ${pts} ${W - PAD},${H}`;
  const isUp = vals[vals.length - 1] >= vals[0];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="fin-nw-chart">
      <defs>
        <linearGradient id="nwG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={isUp ? '#3fb950' : '#f85149'} stopOpacity="0.25" />
          <stop offset="100%" stopColor={isUp ? '#3fb950' : '#f85149'} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={area} fill="url(#nwG)" />
      <polyline points={pts} fill="none"
        stroke={isUp ? '#3fb950' : '#f85149'} strokeWidth="2" strokeLinejoin="round" />
      {history.map((_, i) => i === history.length - 1 && (
        <circle key={i} cx={x(i)} cy={y(history[i].value)} r="4"
          fill={isUp ? '#3fb950' : '#f85149'} />
      ))}
      {history.map((h, i) => i % Math.max(1, Math.floor(history.length / 4)) === 0 && (
        <text key={i} x={x(i)} y={H - 1} textAnchor="middle" fontSize="8"
          fill="var(--text-dim)">{h.date.slice(5)}</text>
      ))}
    </svg>
  );
}

// Portfolio allocation ring
function AllocRing({ actual, target, label, color }: { actual: number; target: number; label: string; color: string }) {
  const R = 30, SW = 7, CX = 38, CY = 38;
  const circ = 2 * Math.PI * R;
  const targetDash  = (target / 100) * circ;
  const actualDash  = (Math.min(100, actual) / 100) * circ;
  const drift = Math.abs(actual - target);

  return (
    <div className="fin-alloc-ring-wrap">
      <svg viewBox="0 0 76 76" className="fin-alloc-ring">
        {/* Target (dim track) */}
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="var(--surface-3)" strokeWidth={SW} />
        {/* Target line */}
        <circle cx={CX} cy={CY} r={R} fill="none" stroke={color} strokeWidth={SW}
          strokeOpacity="0.2"
          strokeDasharray={`${targetDash} ${circ - targetDash}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${CX} ${CY})`} />
        {/* Actual fill */}
        <circle cx={CX} cy={CY} r={R} fill="none" stroke={color} strokeWidth={SW}
          strokeDasharray={`${actualDash} ${circ - actualDash}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${CX} ${CY})`} />
        <text x={CX} y={CY + 4} textAnchor="middle" fontSize="12" fill="var(--text)" fontWeight="700">
          {actual}%
        </text>
      </svg>
      <div className="fin-alloc-ring-meta">
        <span className="fin-alloc-ring-label" style={{ color }}>{label}</span>
        <span className="fin-alloc-ring-target">Target: {target}%</span>
        {drift > 10 && <span className="fin-alloc-ring-warn">⚠ Rebalance</span>}
      </div>
    </div>
  );
}

// Simple progress bar
function FinBar({ pct, color = 'var(--accent)', h = 7 }: { pct: number; color?: string; h?: number }) {
  return (
    <div className="fin-bar-track" style={{ height: h }}>
      <div className="fin-bar-fill" style={{ width: `${Math.min(100, Math.max(0, pct))}%`, background: color }} />
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function FinancePage() {
  const [state, setState]   = useState<FinanceState>(loadFinance);
  const [tab, setTab]       = useState<'overview' | 'balance' | 'cashflow' | 'portfolio' | 'fi'>('overview');
  const [showAddAsset, setShowAddAsset]       = useState(false);
  const [showAddLiab, setShowAddLiab]         = useState(false);
  const [showAddIncome, setShowAddIncome]     = useState(false);
  const [showAddExpense, setShowAddExpense]   = useState(false);

  const [assetForm,   setAssetForm]   = useState({ name: '', value: '', type: 'checking' as AssetType });
  const [liabForm,    setLiabForm]    = useState({ name: '', balance: '', rate: '' });
  const [incomeForm,  setIncomeForm]  = useState({ name: '', monthlyAmount: '', type: 'salary' as IncomeType });
  const [expenseForm, setExpenseForm] = useState({ name: '', monthlyAmount: '', category: 'housing' as ExpCat, isFixed: true });

  const save = (next: FinanceState) => { saveFinance(next); setState(next); };

  // ── Core computed metrics ─────────────────────────────────────────────────
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
  const insights      = useMemo(() => generateInsights(state, netWorth, savingsRate, cashFlow, fiProgress), [state, netWorth, savingsRate, cashFlow, fiProgress]);

  const layerTotals = useMemo(() => {
    const t: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 };
    state.assets.forEach(a => { t[a.layer] += a.value; });
    return t;
  }, [state.assets]);

  const nwGrowthPct = useMemo(() => {
    if (state.nwHistory.length < 2) return null;
    const oldest = state.nwHistory[0].value;
    if (!oldest) return null;
    return Math.round(((netWorth - oldest) / Math.abs(oldest)) * 100);
  }, [state.nwHistory, netWorth]);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const snapshotNW = (next: FinanceState) => {
    const month = new Date().toISOString().slice(0, 7);
    const nw    = calcNetWorth(next.assets, next.liabilities);
    const hist  = next.nwHistory.filter(h => h.date !== month);
    return { ...next, nwHistory: [...hist, { date: month, value: nw }].slice(-24) };
  };

  const addAsset = () => {
    if (!assetForm.name || !assetForm.value) return;
    const layer = ASSET_TYPE_OPTIONS.find(t => t.value === assetForm.type)?.layer ?? 1;
    const next = snapshotNW({ ...state, assets: [...state.assets, { id: uid(), name: assetForm.name, value: Number(assetForm.value), type: assetForm.type, layer }] });
    save(next);
    setAssetForm({ name: '', value: '', type: 'checking' }); setShowAddAsset(false);
  };

  const addLiab = () => {
    if (!liabForm.name || !liabForm.balance) return;
    const next = snapshotNW({ ...state, liabilities: [...state.liabilities, { id: uid(), name: liabForm.name, balance: Number(liabForm.balance), rate: Number(liabForm.rate) }] });
    save(next);
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

  const TABS = [
    { id: 'overview'  as const, label: 'Overview',     icon: '⊟' },
    { id: 'balance'   as const, label: 'Balance Sheet', icon: '🏦' },
    { id: 'cashflow'  as const, label: 'Cash Flow',    icon: '💸' },
    { id: 'portfolio' as const, label: 'Portfolio',    icon: '📈' },
    { id: 'fi'        as const, label: 'FI Tracker',   icon: '🎯' },
  ];

  const isEmpty = state.assets.length === 0 && state.income.length === 0;

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="page fin-page">
      {/* ── Page header ── */}
      <div className="fin-page-header">
        <div>
          <h2 className="page-title">Finance</h2>
          <p className="page-sub">Personal balance sheet · Capital allocation · Wealth architecture</p>
        </div>
        {!isEmpty && (
          <div className="fin-nw-hero">
            <span className="fin-nw-hero-label">Net Worth</span>
            <span className="fin-nw-hero-val" style={{ color: netWorth >= 0 ? 'var(--text)' : 'var(--red)' }}>
              {fmtMoney(netWorth, true)}
            </span>
            {nwGrowthPct !== null && (
              <span className={`fin-nw-hero-growth ${nwGrowthPct >= 0 ? 'fin-growth--up' : 'fin-growth--down'}`}>
                {nwGrowthPct >= 0 ? '↑' : '↓'} {Math.abs(nwGrowthPct)}% all-time
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Tabs ── */}
      <div className="fin-tabs">
        {TABS.map(t => (
          <button key={t.id} className={`fin-tab ${tab === t.id ? 'fin-tab--active' : ''}`}
            onClick={() => setTab(t.id)}>
            <span>{t.icon}</span> {t.label}
          </button>
        ))}
      </div>

      {/* ══════════════════ OVERVIEW ══════════════════ */}
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
              {/* Key metrics */}
              <div className="fin-metric-grid">
                {[
                  { label: 'Monthly Cash Flow', val: `${cashFlow >= 0 ? '+' : ''}${fmtMoney(cashFlow, true)}`, sub: cashFlow >= 0 ? 'surplus' : 'deficit',                      color: cashFlow >= 0 ? 'var(--green)' : 'var(--red)' },
                  { label: 'Savings Rate',       val: `${savingsRate}%`,   sub: savingsRate >= 40 ? '🔥 Aggressive' : savingsRate >= 20 ? 'Moderate' : 'Below target', color: savingsRate >= 30 ? 'var(--green)' : savingsRate >= 15 ? 'var(--accent)' : 'var(--red)' },
                  { label: 'Passive Income',     val: `${passiveRatio}%`,  sub: `of ${fmtMoney(totalIncome, true)}/mo`,   color: 'var(--purple)' },
                  { label: 'Emergency Runway',   val: `${runway.toFixed(1)}mo`, sub: runway >= 6 ? '✓ Secure' : runway >= 3 ? 'Adequate' : 'Too thin', color: runway >= 6 ? 'var(--green)' : runway >= 3 ? 'var(--accent)' : 'var(--red)' },
                ].map((m, i) => (
                  <div key={i} className="fin-metric-card">
                    <span className="fin-metric-label">{m.label}</span>
                    <span className="fin-metric-val" style={{ color: m.color }}>{m.val}</span>
                    <span className="fin-metric-sub">{m.sub}</span>
                  </div>
                ))}
              </div>

              {/* NW Chart */}
              <div className="fin-chart-card">
                <span className="fin-card-title">Net Worth Trajectory</span>
                <NWChart history={state.nwHistory} />
              </div>

              {/* AI Insights */}
              {insights.length > 0 && (
                <div className="fin-insights-card">
                  <span className="fin-card-title">✦ Alfred's Wealth Intelligence</span>
                  {insights.map((tip, i) => (
                    <div key={i} className="fin-insight-row">
                      <span className="fin-insight-bullet" />
                      <span>{tip}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Cash Flow Pipeline */}
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

      {/* ══════════════════ BALANCE SHEET ══════════════════ */}
      {tab === 'balance' && (
        <div className="fin-balance">
          {LAYER_META.map(layer => {
            const layerAssets = state.assets.filter(a => a.layer === layer.n);
            const total = layerTotals[layer.n] ?? 0;
            return (
              <div key={layer.n} className="fin-layer-card">
                <div className="fin-layer-head">
                  <span className="fin-layer-icon" style={{ color: layer.color }}>{layer.icon}</span>
                  <div className="fin-layer-text">
                    <span className="fin-layer-name">Layer {layer.n} · {layer.label}</span>
                    <span className="fin-layer-sub">{layer.sub}</span>
                  </div>
                  <span className="fin-layer-total" style={{ color: layer.color }}>{fmtMoney(total, true)}</span>
                </div>
                {layerAssets.length > 0 && (
                  <div className="fin-asset-list">
                    {layerAssets.map(a => (
                      <div key={a.id} className="fin-asset-row">
                        <span className="fin-asset-name">{a.name}</span>
                        <span className="fin-asset-type">{ASSET_TYPE_OPTIONS.find(t => t.value === a.type)?.label}</span>
                        <span className="fin-asset-val">{fmtMoney(a.value, true)}</span>
                        <button className="fin-rm-btn" onClick={() => save({ ...state, assets: state.assets.filter(x => x.id !== a.id) })}>×</button>
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
                  <div key={l.id} className="fin-asset-row">
                    <span className="fin-asset-name">{l.name}</span>
                    <span className="fin-asset-type">{l.rate}% APR</span>
                    <span className="fin-asset-val fin-asset-val--red">−{fmtMoney(l.balance, true)}</span>
                    <button className="fin-rm-btn" onClick={() => save({ ...state, liabilities: state.liabilities.filter(x => x.id !== l.id) })}>×</button>
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
                <input placeholder="Name (e.g. Fidelity Roth IRA)" value={assetForm.name}
                  onChange={e => setAssetForm(f => ({ ...f, name: e.target.value }))} />
                <select value={assetForm.type}
                  onChange={e => setAssetForm(f => ({ ...f, type: e.target.value as AssetType }))}>
                  {ASSET_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label} (Layer {o.layer})</option>)}
                </select>
                <input type="number" placeholder="Current value ($)" value={assetForm.value}
                  onChange={e => setAssetForm(f => ({ ...f, value: e.target.value }))} />
                <button className="btn-primary" onClick={addAsset}>Add Asset</button>
              </div>
            </div>
          )}

          {showAddLiab && (
            <div className="fin-add-form">
              <p className="fin-add-form-title">New Liability</p>
              <div className="fin-add-form-grid">
                <input placeholder="Name (e.g. Student Loan)" value={liabForm.name}
                  onChange={e => setLiabForm(f => ({ ...f, name: e.target.value }))} />
                <input type="number" placeholder="Balance ($)" value={liabForm.balance}
                  onChange={e => setLiabForm(f => ({ ...f, balance: e.target.value }))} />
                <input type="number" placeholder="Interest rate (APR %)" value={liabForm.rate}
                  onChange={e => setLiabForm(f => ({ ...f, rate: e.target.value }))} />
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

      {/* ══════════════════ CASH FLOW ══════════════════ */}
      {tab === 'cashflow' && (
        <div className="fin-cashflow">
          <div className="fin-cf-section">
            <div className="fin-cf-head">
              <span className="fin-cf-title">Income Streams</span>
              <span className="fin-cf-total fin-cf-total--green">{fmtMoney(totalIncome)}/mo</span>
            </div>
            {state.income.map(s => (
              <div key={s.id} className="fin-cf-row">
                <span className={`fin-cf-badge ${s.isPassive ? 'fin-cf-badge--purple' : 'fin-cf-badge--blue'}`}>
                  {s.isPassive ? 'passive' : 'active'}
                </span>
                <span className="fin-cf-name">{s.name}</span>
                <span className="fin-cf-type">{INCOME_OPTIONS.find(o => o.value === s.type)?.label}</span>
                <span className="fin-cf-amt">{fmtMoney(s.monthlyAmount)}</span>
                <button className="fin-rm-btn" onClick={() => save({ ...state, income: state.income.filter(x => x.id !== s.id) })}>×</button>
              </div>
            ))}
            <button className="fin-add-btn" onClick={() => { setShowAddIncome(s => !s); setShowAddExpense(false); }}>+ Income Stream</button>
            {showAddIncome && (
              <div className="fin-add-form">
                <div className="fin-add-form-grid">
                  <input placeholder="Name (e.g. Salary — Google)" value={incomeForm.name}
                    onChange={e => setIncomeForm(f => ({ ...f, name: e.target.value }))} />
                  <select value={incomeForm.type}
                    onChange={e => setIncomeForm(f => ({ ...f, type: e.target.value as IncomeType }))}>
                    {INCOME_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label} ({o.passive ? 'passive' : 'active'})</option>)}
                  </select>
                  <input type="number" placeholder="Monthly amount ($)" value={incomeForm.monthlyAmount}
                    onChange={e => setIncomeForm(f => ({ ...f, monthlyAmount: e.target.value }))} />
                  <button className="btn-primary" onClick={addIncome}>Add</button>
                </div>
              </div>
            )}
          </div>

          <div className="fin-cf-section">
            <div className="fin-cf-head">
              <span className="fin-cf-title">Monthly Expenses</span>
              <span className="fin-cf-total fin-cf-total--red">−{fmtMoney(totalExpenses)}/mo</span>
            </div>
            {state.expenses.map(e => (
              <div key={e.id} className="fin-cf-row">
                <span className={`fin-cf-badge ${e.isFixed ? 'fin-cf-badge--amber' : 'fin-cf-badge--gray'}`}>{e.isFixed ? 'fixed' : 'variable'}</span>
                <span className="fin-cf-name">{e.name}</span>
                <span className="fin-cf-type">{e.category}</span>
                <span className="fin-cf-amt fin-cf-amt--red">−{fmtMoney(e.monthlyAmount)}</span>
                <button className="fin-rm-btn" onClick={() => save({ ...state, expenses: state.expenses.filter(x => x.id !== e.id) })}>×</button>
              </div>
            ))}
            <button className="fin-add-btn" onClick={() => { setShowAddExpense(s => !s); setShowAddIncome(false); }}>+ Expense</button>
            {showAddExpense && (
              <div className="fin-add-form">
                <div className="fin-add-form-grid">
                  <input placeholder="Name (e.g. Rent)" value={expenseForm.name}
                    onChange={e => setExpenseForm(f => ({ ...f, name: e.target.value }))} />
                  <select value={expenseForm.category}
                    onChange={e => setExpenseForm(f => ({ ...f, category: e.target.value as ExpCat }))}>
                    {(['housing','food','transport','utilities','subscriptions','health','entertainment','other'] as ExpCat[])
                      .map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase()+c.slice(1)}</option>)}
                  </select>
                  <input type="number" placeholder="Monthly amount ($)" value={expenseForm.monthlyAmount}
                    onChange={e => setExpenseForm(f => ({ ...f, monthlyAmount: e.target.value }))} />
                  <label className="fin-checkbox-label">
                    <input type="checkbox" checked={expenseForm.isFixed}
                      onChange={e => setExpenseForm(f => ({ ...f, isFixed: e.target.checked }))} />
                    Fixed expense
                  </label>
                  <button className="btn-primary" onClick={addExpense}>Add</button>
                </div>
              </div>
            )}
          </div>

          {(totalIncome > 0 || totalExpenses > 0) && (
            <div className="fin-cf-summary">
              <div className="fin-cf-sum-row"><span>Income</span><span className="fin-sum-green">{fmtMoney(totalIncome)}</span></div>
              <div className="fin-cf-sum-row"><span>Expenses</span><span className="fin-sum-red">−{fmtMoney(totalExpenses)}</span></div>
              <div className="fin-cf-sum-row fin-cf-sum-row--total">
                <span>Net Cash Flow</span>
                <span style={{ color: cashFlow >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  {cashFlow >= 0 ? '+' : ''}{fmtMoney(cashFlow)}
                </span>
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

      {/* ══════════════════ PORTFOLIO ══════════════════ */}
      {tab === 'portfolio' && (
        <div className="fin-portfolio">
          <div className="fin-alloc-grid">
            {[
              { key: 'core'        as const, label: 'Core',        desc: 'Broad index funds — stability + compounding', color: 'var(--accent)' },
              { key: 'growth'      as const, label: 'Growth',      desc: 'Tech ETFs, high-conviction — acceleration',   color: 'var(--blue)'   },
              { key: 'asymmetric'  as const, label: 'Asymmetric',  desc: 'Startups, crypto — explosive upside',         color: 'var(--purple)' },
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
                { num: '01', label: '401(k) match',  desc: 'Instant 50–100% return — always max employer match first',         done: state.assets.some(a => a.type === '401k') },
                { num: '02', label: 'HSA',            desc: 'Triple tax advantage — deduct, grow, withdraw tax-free',           done: state.assets.some(a => a.type === 'hsa') },
                { num: '03', label: 'Roth IRA',       desc: 'Tax-free growth forever — max $7k/yr ($8k if 50+)',               done: state.assets.some(a => a.type === 'roth_ira') },
                { num: '04', label: 'Taxable Brokerage', desc: 'After tax-advantaged accounts are maxed — long-term holds',    done: state.assets.some(a => a.type === 'brokerage') },
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

      {/* ══════════════════ FI TRACKER ══════════════════ */}
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
                { icon: '💰', label: 'Saving is linear',    desc: 'Each dollar saved = 1 unit. Important but limited.' },
                { icon: '📈', label: 'Investing is exponential', desc: 'Each invested dollar compounds — the longer, the more powerful.' },
                { icon: '🚀', label: 'Ownership is explosive', desc: 'Equity in products/companies = unlimited upside. Alfred is this.' },
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
    </div>
  );
}
