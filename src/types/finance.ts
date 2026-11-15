export type CurrencyCode = 'USD' | 'EUR' | 'GBP' | 'INR' | 'JPY' | 'CAD' | 'AUD' | 'SGD';
export type LanguageCode = 'en' | 'es' | 'fr' | 'de' | 'it' | 'nl' | 'ja' | 'hi';

export type PageId =
  | 'dashboard'
  | 'budget'
  | 'calendar'
  | 'savings'
  | 'bills'
  | 'debt'
  | 'split'
  | 'settings';

export interface Transaction {
  id: string;
  date: string; // YYYY-MM-DD
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  paymentMethod: string;
  notes?: string;
  linkedBillId?: string;
  previousDueDate?: string;
  linkedGoalId?: string;
  linkedDebtId?: string;
}

export interface BudgetCategory {
  id: string;
  name: string;
  type: 'income' | 'expense';
  group: 'Needs' | 'Wants' | 'Savings' | 'Income';
  monthlyLimit: number;
  monthlyOverrides?: Record<string, number>; // YYYY-MM -> custom budget limit for that month
  color: string;
  isCustom?: boolean;
}

export interface SavingsHistoryEntry {
  id: string;
  date: string; // YYYY-MM-DD
  amount: number; // positive for deposit, negative for withdrawal
  balanceAfter: number;
  note: string;
  type: 'deposit' | 'withdrawal';
  linkedTxId?: string;
}

export interface SavingsGoal {
  id: string;
  name: string;
  category: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string; // YYYY-MM-DD
  monthlyContributionTarget: number;
  color: string;
  notes?: string;
  history: SavingsHistoryEntry[];
}

export interface BillSubscription {
  id: string;
  name: string;
  amount: number;
  billingCycle: 'monthly' | 'yearly' | 'weekly' | 'quarterly';
  nextDueDate: string; // YYYY-MM-DD
  category: string;
  autoPay: boolean;
  reminderDaysBefore: number;
  status: 'active' | 'paused' | 'cancelled';
  providerUrl?: string;
  notes?: string;
  lastPaidDate?: string;
}

export interface DebtAccount {
  id: string;
  name: string;
  lender: string;
  category: 'Credit Card' | 'Student Loan' | 'Auto Loan' | 'Mortgage' | 'Personal Loan';
  balance: number;
  originalBalance: number;
  apr: number; // percentage e.g. 19.99
  minimumPayment: number;
  dueDateDay: number; // 1..28
}

export interface SplitParticipant {
  id: string;
  name: string;
  email: string;
  isSelf?: boolean;
}

export interface SplitLineItem {
  id: string;
  name: string;
  price: number;
  assignedToIds: string[];
}

export interface SplitShareEntry {
  participantId: string;
  amount: number;
  ratioOrPercent?: number;
  settled: boolean;
}

export interface SplitExpense {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  totalAmount: number;
  paidById: string;
  splitMethod: 'equal' | 'exact' | 'ratio' | 'itemized';
  category: string;
  splits: SplitShareEntry[];
  items?: SplitLineItem[];
  taxAmount?: number;
  tipAmount?: number;
  notes?: string;
}

export interface UserSettings {
  userName: string;
  userEmail: string;
  householdName: string;
  currency: CurrencyCode;
  language: LanguageCode;
  theme: 'light' | 'dark';
  googleScriptUrl: string;
  autoSync: boolean;
  syncIntervalSec: number;
  debtStrategy: 'snowball' | 'avalanche';
  extraDebtPayment: number;
}

export interface AppDataState {
  transactions: Transaction[];
  categories: BudgetCategory[];
  savingsGoals: SavingsGoal[];
  bills: BillSubscription[];
  debts: DebtAccount[];
  splitParticipants: SplitParticipant[];
  splitExpenses: SplitExpense[];
  settings: UserSettings;
  lastUpdated: string;
}

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'offline';
