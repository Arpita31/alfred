export type AssetLayer = 1 | 2 | 3 | 4;
export type AssetType  = 'checking' | 'savings' | 'brokerage' | '401k' | 'roth_ira' | 'hsa' | 'crypto' | 'real_estate' | 'equity' | 'startup' | 'other';
export type IncomeType = 'salary' | 'freelance' | 'dividends' | 'rental' | 'business' | 'other';
export type ExpCat     = 'housing' | 'food' | 'transport' | 'utilities' | 'subscriptions' | 'health' | 'entertainment' | 'other';

export interface Asset {
  id: string;
  name: string;
  value: number;
  type: AssetType;
  layer: AssetLayer;
}

export interface Liability {
  id: string;
  name: string;
  balance: number;
  rate: number;
}

export interface IncomeStream {
  id: string;
  name: string;
  monthlyAmount: number;
  type: IncomeType;
  isPassive: boolean;
}

export interface Expense {
  id: string;
  name: string;
  monthlyAmount: number;
  category: ExpCat;
  isFixed: boolean;
}

export interface NWSnapshot {
  date: string;
  value: number;
}

export interface AllocationTargets {
  core: number;
  growth: number;
  asymmetric: number;
}

export interface FinanceState {
  assets: Asset[];
  liabilities: Liability[];
  income: IncomeStream[];
  expenses: Expense[];
  nwHistory: NWSnapshot[];
  allocation: AllocationTargets;
}
