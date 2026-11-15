import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { t, TranslationKey } from '../utils/i18n';
import { INITIAL_APP_DATA } from '../data/initialData';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { DEMO_LIMITS, getCustomCategoryCount } from '../utils/demoLimits';
import {
  loadOutboxFromIndexedDB,
  loadOutboxFromLocalStorage,
  loadStateFromIndexedDB,
  saveOutboxToIndexedDB,
  saveOutboxToLocalStorage,
  saveStateToIndexedDB,
  STATE_STORAGE_KEY,
  SyncOutboxMeta,
} from '../services/offlineStorage';
import {
  AppDataState,
  BillSubscription,
  BudgetCategory,
  DebtAccount,
  PageId,
  SavingsGoal,
  SplitExpense,
  SplitParticipant,
  SyncStatus,
  Transaction,
  UserSettings,
} from '../types/finance';

interface FinanceContextType {
  data: AppDataState;
  activePage: PageId;
  setActivePage: (page: PageId) => void;
  selectedMonth: string; // YYYY-MM e.g. '2026-11'
  setSelectedMonth: (month: string) => void;
  isOnline: boolean;
  syncStatus: SyncStatus;
  syncMessage: string;
  lastSyncedAt: string | null;
  syncPending: boolean;
  pendingChangesCount: number;
  storageEngine: string;
  flushOfflineQueue: () => Promise<boolean>;
  triggerManualPush: () => Promise<boolean>;
  triggerManualPull: (overrideUrl?: string) => Promise<boolean>;
  resetToDemoData: () => void;

  // Quick Transaction Modal
  isTxModalOpen: boolean;
  txModalDefaultDate?: string;
  editingTransaction: Transaction | null;
  openTxModal: (defaultDate?: string) => void;
  openEditTxModal: (tx: Transaction) => void;
  closeTxModal: () => void;

  // Transactions CRUD
  addTransaction: (tx: Omit<Transaction, 'id'>) => void;
  updateTransaction: (tx: Transaction) => void;
  deleteTransaction: (id: string) => void;
  clearAllTransactions: () => void;

  // Budget Categories CRUD
  addCategory: (cat: Omit<BudgetCategory, 'id'>) => void;
  updateCategory: (cat: BudgetCategory) => void;
  deleteCategory: (id: string) => void;

  // Savings Goals CRUD
  addSavingsGoal: (goal: Omit<SavingsGoal, 'id' | 'history'>) => void;
  updateSavingsGoal: (goal: SavingsGoal) => void;
  deleteSavingsGoal: (id: string) => void;
  recordGoalContribution: (
    goalId: string,
    amount: number,
    type: 'deposit' | 'withdrawal',
    note: string,
    date: string,
    alsoLogTransaction?: boolean
  ) => void;
  revertGoalContribution: (goalId: string, entryId: string) => void;

  // Bills & Subscriptions CRUD
  addBill: (bill: Omit<BillSubscription, 'id'>) => void;
  updateBill: (bill: BillSubscription) => void;
  deleteBill: (id: string) => void;
  markBillPaid: (
    billId: string,
    paidDate?: string,
    customAmount?: number
  ) => void;
  revertBillPayment: (
    txId: string,
    adjustment?: { amount?: number; nextDueDate?: string }
  ) => void;
  updateBillPayment: (
    txId: string,
    updates: {
      txAmount: number;
      txDate: string;
      billAmount?: number;
      billNextDueDate?: string;
    }
  ) => void;
  changeBillStatus: (
    billId: string,
    status: 'active' | 'paused' | 'cancelled'
  ) => void;

  // Debt Accounts CRUD
  addDebt: (debt: Omit<DebtAccount, 'id'>) => void;
  updateDebt: (debt: DebtAccount) => void;
  deleteDebt: (id: string) => void;
  recordDebtPayment: (debtId: string, amount: number, date: string) => void;
  revertDebtPayment: (txId: string, adjustedDebtBalance?: number) => void;
  updateDebtPayment: (
    txId: string,
    updates: {
      txAmount: number;
      txDate: string;
      adjustedDebtBalance?: number;
    }
  ) => void;

  // Split Bills CRUD
  addParticipant: (participant: Omit<SplitParticipant, 'id'>) => void;
  updateParticipant: (participant: SplitParticipant) => void;
  removeParticipant: (id: string) => void;
  addSplitExpense: (expense: Omit<SplitExpense, 'id'>) => void;
  updateSplitExpensePayer: (expenseId: string, paidById: string) => void;
  toggleSplitSettled: (expenseId: string, participantId: string) => void;
  settleAllForParticipant: (participantId: string) => void;
  deleteSplitExpense: (id: string) => void;

  // Settings
  updateSettings: (partial: Partial<UserSettings>) => void;
  toggleTheme: () => void;
}

const DEVICE_LOCAL_SETTING_KEYS = new Set<keyof UserSettings>([
  'userName',
  'userEmail',
  'householdName',
  'currency',
  'language',
  'theme',
  'googleScriptUrl',
  'autoSync',
  'syncIntervalSec',
]);

const FinanceContext = createContext<FinanceContextType | undefined>(undefined);

export const FinanceProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const isOnline = useOnlineStatus();

  const [data, setData] = useState<AppDataState>(() => {
    try {
      const saved = localStorage.getItem(STATE_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.transactions && parsed.settings) {
          const isOldSeed = parsed.lastUpdated === '2026-11-12T09:00:00.000Z';
          if (isOldSeed) {
            return INITIAL_APP_DATA;
          }
          return {
            ...parsed,
            settings: {
              ...parsed.settings,
              googleScriptUrl: DEMO_LIMITS.ALLOW_GOOGLE_SHEETS
                ? parsed.settings.googleScriptUrl
                : '',
              autoSync: DEMO_LIMITS.ALLOW_GOOGLE_SHEETS
                ? parsed.settings.autoSync
                : false,
            },
          };
        }
      }
    } catch {
      // ignore local storage errors
    }
    return INITIAL_APP_DATA;
  });

  const [outbox, setOutbox] = useState<SyncOutboxMeta>(() =>
    loadOutboxFromLocalStorage()
  );

  const [activePage, setActivePage] = useState<PageId>('dashboard');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const defaultYm = '2026-11';
    if (
      data.transactions.length > 0 &&
      !data.transactions.some((tx) => tx.date.startsWith(defaultYm))
    ) {
      const validMonths = data.transactions
        .map((tx) => tx.date.slice(0, 7))
        .filter((ym) => /^\d{4}-\d{2}$/.test(ym))
        .sort();
      if (validMonths.length > 0) {
        return validMonths[validMonths.length - 1];
      }
    }
    return defaultYm;
  });
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(() =>
    typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'idle'
  );
  type SyncMessageSpec =
    | { kind: 'key'; key: TranslationKey; vars?: Record<string, string | number> }
    | { kind: 'raw'; text: string };

  const [syncMessageSpec, setSyncMessageSpec] = useState<SyncMessageSpec>(() =>
    typeof navigator !== 'undefined' && !navigator.onLine
      ? { kind: 'key', key: 'syncMsgOfflineActive' }
      : {
          kind: 'raw',
          text: 'Demo mode active — all data is saved locally in your browser (Google Sheets sync disabled).',
        }
  );

  const syncMessage = useMemo(() => {
    if (syncMessageSpec.kind === 'raw') return syncMessageSpec.text;
    return t(syncMessageSpec.key, data.settings.language, syncMessageSpec.vars);
  }, [syncMessageSpec, data.settings.language]);

  const [lastSyncedAt] = useState<string | null>(null);

  const [isTxModalOpen, setIsTxModalOpen] = useState(false);
  const [txModalDefaultDate, setTxModalDefaultDate] = useState<
    string | undefined
  >(undefined);
  const [editingTransaction, setEditingTransaction] =
    useState<Transaction | null>(null);

  const pushTimeoutRef = useRef<number | null>(null);
  const isApplyingRemoteRef = useRef<boolean>(false);
  const selectedMonthRef = useRef<string>(selectedMonth);
  selectedMonthRef.current = selectedMonth;

  const latestDataRef = useRef<AppDataState>(data);
  latestDataRef.current = data;

  const outboxRef = useRef<SyncOutboxMeta>(outbox);
  outboxRef.current = outbox;

  const updateOutbox = useCallback(
    (updater: (prev: SyncOutboxMeta) => SyncOutboxMeta) => {
      setOutbox((prev) => {
        const next = updater(prev);
        outboxRef.current = next;
        saveOutboxToLocalStorage(next);
        void saveOutboxToIndexedDB(next);
        return next;
      });
    },
    []
  );

  const alignSelectedMonthIfEmpty = useCallback((txs: Transaction[]) => {
    if (!txs || txs.length === 0) return;
    if (txs.some((tx) => tx.date.startsWith(selectedMonthRef.current))) return;
    const validMonths = txs
      .map((tx) => tx.date.slice(0, 7))
      .filter((ym) => /^\d{4}-\d{2}$/.test(ym))
      .sort();
    if (validMonths.length > 0) {
      setSelectedMonth(validMonths[validMonths.length - 1]);
    }
  }, []);

  // Recover from IndexedDB if localStorage was wiped or is older than IndexedDB mirror
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [idbState, idbOutbox] = await Promise.all([
        loadStateFromIndexedDB(),
        loadOutboxFromIndexedDB(),
      ]);
      if (cancelled || !idbState || !idbState.transactions) return;

      const current = latestDataRef.current;
      const hadSavedLocal = Boolean(localStorage.getItem(STATE_STORAGE_KEY));
      const isOldSeed = idbState.lastUpdated === '2026-11-12T09:00:00.000Z';
      if (isOldSeed) return;

      const isIdbNewer =
        !hadSavedLocal ||
        (idbState.lastUpdated &&
          current.lastUpdated &&
          idbState.lastUpdated > current.lastUpdated);

      if (isIdbNewer) {
        isApplyingRemoteRef.current = true;
        setData({
          ...idbState,
          settings: {
            ...idbState.settings,
            googleScriptUrl: DEMO_LIMITS.ALLOW_GOOGLE_SHEETS
              ? idbState.settings.googleScriptUrl
              : '',
            autoSync: DEMO_LIMITS.ALLOW_GOOGLE_SHEETS
              ? idbState.settings.autoSync
              : false,
          },
        });
        alignSelectedMonthIfEmpty(idbState.transactions);
        if (idbOutbox) {
          setOutbox(idbOutbox);
          outboxRef.current = idbOutbox;
          saveOutboxToLocalStorage(idbOutbox);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [alignSelectedMonthIfEmpty]);

  // Sync dark mode class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (data.settings.theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [data.settings.theme]);

  // Google Sheets sync is disabled in Demo mode
  const flushOfflineQueue = useCallback(async (): Promise<boolean> => {
    return false;
  }, []);

  // Persist every update immediately to localStorage + asynchronously to IndexedDB
  useEffect(() => {
    try {
      localStorage.setItem(STATE_STORAGE_KEY, JSON.stringify(data));
    } catch {
      // ignore quota errors; IndexedDB mirror handles large datasets
    }
    void saveStateToIndexedDB(data);

    if (isApplyingRemoteRef.current) {
      isApplyingRemoteRef.current = false;
    }
  }, [data]);

  // Reflect online/offline status locally without contacting Google Sheets
  useEffect(() => {
    if (!isOnline) {
      if (pushTimeoutRef.current) {
        window.clearTimeout(pushTimeoutRef.current);
      }
      setSyncStatus('offline');
      setSyncMessageSpec({ kind: 'key', key: 'syncMsgOfflineStored' });
      return;
    }

    if (syncStatus === 'offline') {
      setSyncStatus('idle');
      setSyncMessageSpec({
        kind: 'raw',
        text: 'Demo mode active — all data is saved locally in your browser (Google Sheets sync disabled).',
      });
    }
  }, [isOnline, syncStatus]);

  const triggerManualPush = useCallback(async (): Promise<boolean> => {
    return false;
  }, []);

  const triggerManualPull = useCallback(
    async (_overrideUrl?: string): Promise<boolean> => {
      return false;
    },
    []
  );

  const mutateState = useCallback(
    (updater: (prev: AppDataState) => AppDataState) => {
      const nowIso = new Date().toISOString();
      updateOutbox((prev) => ({
        ...prev,
        syncPending: true,
        pendingChangesCount: prev.pendingChangesCount + 1,
        lastLocalEditAt: nowIso,
      }));
      setData((prev) => {
        const next = updater(prev);
        return {
          ...next,
          lastUpdated: nowIso,
        };
      });
    },
    [updateOutbox]
  );

  const openTxModal = (defaultDate?: string) => {
    setEditingTransaction(null);
    setTxModalDefaultDate(defaultDate);
    setIsTxModalOpen(true);
  };

  const openEditTxModal = (tx: Transaction) => {
    setEditingTransaction(tx);
    setTxModalDefaultDate(undefined);
    setIsTxModalOpen(true);
  };

  const closeTxModal = () => {
    setIsTxModalOpen(false);
    setTxModalDefaultDate(undefined);
    setEditingTransaction(null);
  };

  const shiftBillCycleDate = (
    dateStr: string,
    cycle: BillSubscription['billingCycle'],
    direction: 1 | -1
  ): string => {
    const parts = dateStr.split('-').map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) return dateStr;
    const [y, m, d] = parts;
    if (cycle === 'weekly') {
      const dt = new Date(Date.UTC(y, m - 1, d + 7 * direction));
      return dt.toISOString().slice(0, 10);
    }
    const monthDelta =
      cycle === 'monthly'
        ? 1 * direction
        : cycle === 'quarterly'
        ? 3 * direction
        : 12 * direction;
    const targetFirst = new Date(Date.UTC(y, m - 1 + monthDelta, 1));
    const lastDay = new Date(
      Date.UTC(targetFirst.getUTCFullYear(), targetFirst.getUTCMonth() + 1, 0)
    ).getUTCDate();
    const clampedDay = Math.min(d, lastDay);
    return new Date(
      Date.UTC(targetFirst.getUTCFullYear(), targetFirst.getUTCMonth(), clampedDay)
    )
      .toISOString()
      .slice(0, 10);
  };

  // Transactions (capped at DEMO_LIMITS.MAX_TRANSACTIONS)
  const addTransaction = (tx: Omit<Transaction, 'id'>) => {
    if (latestDataRef.current.transactions.length >= DEMO_LIMITS.MAX_TRANSACTIONS) {
      return;
    }
    const newTx: Transaction = {
      ...tx,
      id: `tx-${Date.now()}`,
    };
    mutateState((prev) => {
      if (prev.transactions.length >= DEMO_LIMITS.MAX_TRANSACTIONS) {
        return prev;
      }
      return {
        ...prev,
        transactions: [newTx, ...prev.transactions],
      };
    });
  };

  const updateTransaction = (tx: Transaction) => {
    mutateState((prev) => ({
      ...prev,
      transactions: prev.transactions.map((t) => (t.id === tx.id ? tx : t)),
    }));
  };

  const deleteTransaction = (id: string) => {
    mutateState((prev) => {
      const targetTx = prev.transactions.find((t) => t.id === id);
      if (!targetTx) return prev;

      const remainingTransactions = prev.transactions.filter(
        (t) => t.id !== id
      );

      let updatedDebts = prev.debts;
      if (targetTx.linkedDebtId) {
        updatedDebts = prev.debts.map((d) =>
          d.id === targetTx.linkedDebtId
            ? {
                ...d,
                balance: Math.max(
                  0,
                  Number((d.balance + targetTx.amount).toFixed(2))
                ),
              }
            : d
        );
      }

      let updatedBills = prev.bills;
      if (targetTx.linkedBillId) {
        const remainingLinked = remainingTransactions
          .filter((t) => t.linkedBillId === targetTx.linkedBillId)
          .sort((a, b) => b.date.localeCompare(a.date));
        const nextLastPaidDate = remainingLinked[0]?.date;

        updatedBills = prev.bills.map((b) => {
          if (b.id !== targetTx.linkedBillId) return b;
          let revertedDueDate = b.nextDueDate;
          if (targetTx.previousDueDate) {
            revertedDueDate = targetTx.previousDueDate;
          } else if (b.nextDueDate > targetTx.date) {
            revertedDueDate = shiftBillCycleDate(
              b.nextDueDate,
              b.billingCycle,
              -1
            );
          }
          return {
            ...b,
            nextDueDate: revertedDueDate,
            lastPaidDate: nextLastPaidDate,
          };
        });
      }

      let updatedGoals = prev.savingsGoals;
      if (targetTx.linkedGoalId) {
        updatedGoals = prev.savingsGoals.map((g) => {
          if (g.id !== targetTx.linkedGoalId) return g;
          let removedEntry = false;
          let runningBalance = 0;
          const nextHistory = g.history
            .filter((h) => {
              if (h.linkedTxId && h.linkedTxId === targetTx.id) {
                removedEntry = true;
                return false;
              }
              if (
                !removedEntry &&
                h.type === 'deposit' &&
                h.date === targetTx.date &&
                Math.abs(h.amount - targetTx.amount) < 0.01
              ) {
                removedEntry = true;
                return false;
              }
              return true;
            })
            .map((h) => {
              const delta =
                h.type === 'deposit'
                  ? Math.abs(h.amount)
                  : -Math.abs(h.amount);
              runningBalance = Math.max(0, runningBalance + delta);
              return { ...h, balanceAfter: runningBalance };
            });

          return removedEntry
            ? {
                ...g,
                currentAmount: runningBalance,
                history: nextHistory,
              }
            : g;
        });
      }

      return {
        ...prev,
        transactions: remainingTransactions,
        debts: updatedDebts,
        bills: updatedBills,
        savingsGoals: updatedGoals,
      };
    });
  };

  const clearAllTransactions = () => {
    mutateState((prev) => ({
      ...prev,
      transactions: [],
    }));
  };

  // Categories (custom categories capped at DEMO_LIMITS.MAX_CUSTOM_CATEGORIES)
  const addCategory = (cat: Omit<BudgetCategory, 'id'>) => {
    if (
      getCustomCategoryCount(latestDataRef.current.categories) >=
      DEMO_LIMITS.MAX_CUSTOM_CATEGORIES
    ) {
      return;
    }
    const newCat: BudgetCategory = {
      ...cat,
      id: `cat-custom-${Date.now()}`,
      isCustom: true,
    };
    mutateState((prev) => {
      if (
        getCustomCategoryCount(prev.categories) >=
        DEMO_LIMITS.MAX_CUSTOM_CATEGORIES
      ) {
        return prev;
      }
      return {
        ...prev,
        categories: [...prev.categories, newCat],
      };
    });
  };

  const updateCategory = (cat: BudgetCategory) => {
    mutateState((prev) => ({
      ...prev,
      categories: prev.categories.map((c) => (c.id === cat.id ? cat : c)),
    }));
  };

  const deleteCategory = (id: string) => {
    mutateState((prev) => ({
      ...prev,
      categories: prev.categories.filter((c) => c.id !== id),
    }));
  };

  // Savings Goals (capped at DEMO_LIMITS.MAX_SAVINGS_GOALS)
  const addSavingsGoal = (goal: Omit<SavingsGoal, 'id' | 'history'>) => {
    if (
      latestDataRef.current.savingsGoals.length >=
      DEMO_LIMITS.MAX_SAVINGS_GOALS
    ) {
      return;
    }
    const newGoal: SavingsGoal = {
      ...goal,
      id: `goal-${Date.now()}`,
      history:
        goal.currentAmount > 0
          ? [
              {
                id: `gh-${Date.now()}`,
                date: new Date().toISOString().slice(0, 10),
                amount: goal.currentAmount,
                balanceAfter: goal.currentAmount,
                note: 'Opening balance',
                type: 'deposit',
              },
            ]
          : [],
    };
    mutateState((prev) => {
      if (prev.savingsGoals.length >= DEMO_LIMITS.MAX_SAVINGS_GOALS) {
        return prev;
      }
      return {
        ...prev,
        savingsGoals: [...prev.savingsGoals, newGoal],
      };
    });
  };

  const updateSavingsGoal = (goal: SavingsGoal) => {
    mutateState((prev) => ({
      ...prev,
      savingsGoals: prev.savingsGoals.map((g) => (g.id === goal.id ? goal : g)),
    }));
  };

  const deleteSavingsGoal = (id: string) => {
    mutateState((prev) => ({
      ...prev,
      savingsGoals: prev.savingsGoals.filter((g) => g.id !== id),
    }));
  };

  const recordGoalContribution = (
    goalId: string,
    amount: number,
    type: 'deposit' | 'withdrawal',
    note: string,
    date: string,
    alsoLogTransaction = true
  ) => {
    mutateState((prev) => {
      const targetGoal = prev.savingsGoals.find((g) => g.id === goalId);
      if (!targetGoal) return prev;

      const signed = type === 'deposit' ? Math.abs(amount) : -Math.abs(amount);
      const nextBalance = Math.max(0, targetGoal.currentAmount + signed);
      const now = Date.now();
      const shouldLogTx =
        alsoLogTransaction &&
        type === 'deposit' &&
        prev.transactions.length < DEMO_LIMITS.MAX_TRANSACTIONS;
      const linkedTxId = shouldLogTx ? `tx-${now}` : undefined;

      const newEntry = {
        id: `gh-${now}`,
        date,
        amount: Math.abs(amount),
        balanceAfter: nextBalance,
        note: note || (type === 'deposit' ? 'Goal contribution' : 'Goal withdrawal'),
        type,
        ...(linkedTxId ? { linkedTxId } : {}),
      };

      const updatedGoals = prev.savingsGoals.map((g) =>
        g.id === goalId
          ? {
              ...g,
              currentAmount: nextBalance,
              history: [...g.history, newEntry],
            }
          : g
      );

      let updatedTx = prev.transactions;
      if (shouldLogTx && linkedTxId) {
        const newTx: Transaction = {
          id: linkedTxId,
          date,
          description: `${targetGoal.name} — ${note || 'Savings Contribution'}`,
          amount: Math.abs(amount),
          type: 'expense',
          category: 'Savings & Investments',
          paymentMethod: 'Savings Transfer',
          linkedGoalId: goalId,
        };
        updatedTx = [newTx, ...prev.transactions];
      }

      return {
        ...prev,
        savingsGoals: updatedGoals,
        transactions: updatedTx,
      };
    });
  };

  const revertGoalContribution = (goalId: string, entryId: string) => {
    mutateState((prev) => {
      const targetGoal = prev.savingsGoals.find((g) => g.id === goalId);
      if (!targetGoal) return prev;

      const targetEntry = targetGoal.history.find((h) => h.id === entryId);
      if (!targetEntry) return prev;

      let runningBalance = 0;
      const nextHistory = targetGoal.history
        .filter((h) => h.id !== entryId)
        .map((h) => {
          const delta =
            h.type === 'deposit' ? Math.abs(h.amount) : -Math.abs(h.amount);
          runningBalance = Math.max(0, runningBalance + delta);
          return { ...h, balanceAfter: runningBalance };
        });

      const updatedGoals = prev.savingsGoals.map((g) =>
        g.id === goalId
          ? {
              ...g,
              currentAmount: runningBalance,
              history: nextHistory,
            }
          : g
      );

      let updatedTx = prev.transactions;
      if (targetEntry.linkedTxId) {
        updatedTx = prev.transactions.filter(
          (tx) => tx.id !== targetEntry.linkedTxId
        );
      } else if (targetEntry.type === 'deposit') {
        let removed = false;
        updatedTx = prev.transactions.filter((tx) => {
          if (
            !removed &&
            tx.linkedGoalId === goalId &&
            tx.date === targetEntry.date &&
            Math.abs(tx.amount - targetEntry.amount) < 0.01
          ) {
            removed = true;
            return false;
          }
          return true;
        });
      }

      return {
        ...prev,
        savingsGoals: updatedGoals,
        transactions: updatedTx,
      };
    });
  };

  // Bills & Subscriptions (capped at DEMO_LIMITS.MAX_BILLS)
  const addBill = (bill: Omit<BillSubscription, 'id'>) => {
    if (latestDataRef.current.bills.length >= DEMO_LIMITS.MAX_BILLS) {
      return;
    }
    const newBill: BillSubscription = {
      ...bill,
      id: `bill-${Date.now()}`,
    };
    mutateState((prev) => {
      if (prev.bills.length >= DEMO_LIMITS.MAX_BILLS) {
        return prev;
      }
      return {
        ...prev,
        bills: [...prev.bills, newBill],
      };
    });
  };

  const updateBill = (bill: BillSubscription) => {
    mutateState((prev) => ({
      ...prev,
      bills: prev.bills.map((b) => (b.id === bill.id ? bill : b)),
    }));
  };

  const deleteBill = (id: string) => {
    mutateState((prev) => ({
      ...prev,
      bills: prev.bills.filter((b) => b.id !== id),
    }));
  };


  const markBillPaid = (
    billId: string,
    paidDate?: string,
    customAmount?: number
  ) => {
    if (latestDataRef.current.transactions.length >= DEMO_LIMITS.MAX_TRANSACTIONS) {
      return;
    }
    const dateStr = paidDate || '2026-11-12';
    mutateState((prev) => {
      if (prev.transactions.length >= DEMO_LIMITS.MAX_TRANSACTIONS) return prev;
      const target = prev.bills.find((b) => b.id === billId);
      if (!target) return prev;

      const nextDueStr = shiftBillCycleDate(
        target.nextDueDate,
        target.billingCycle,
        1
      );
      const txAmount =
        customAmount !== undefined && customAmount > 0
          ? customAmount
          : target.amount;

      const newTx: Transaction = {
        id: `tx-${Date.now()}`,
        date: dateStr,
        description: `${target.name} (${target.billingCycle} bill)`,
        amount: txAmount,
        type: 'expense',
        category: target.category,
        paymentMethod: target.autoPay ? 'AutoPay' : 'Manual Payment',
        linkedBillId: target.id,
        previousDueDate: target.nextDueDate,
      };

      return {
        ...prev,
        bills: prev.bills.map((b) =>
          b.id === billId
            ? { ...b, lastPaidDate: dateStr, nextDueDate: nextDueStr }
            : b
        ),
        transactions: [newTx, ...prev.transactions],
      };
    });
  };

  const revertBillPayment = (
    txId: string,
    adjustment?: { amount?: number; nextDueDate?: string }
  ) => {
    mutateState((prev) => {
      const targetTx = prev.transactions.find((t) => t.id === txId);
      if (!targetTx) return prev;

      const remainingTransactions = prev.transactions.filter(
        (t) => t.id !== txId
      );

      if (!targetTx.linkedBillId) {
        return {
          ...prev,
          transactions: remainingTransactions,
        };
      }

      const remainingLinked = remainingTransactions
        .filter((t) => t.linkedBillId === targetTx.linkedBillId)
        .sort((a, b) => b.date.localeCompare(a.date));
      const nextLastPaidDate = remainingLinked[0]?.date;

      const updatedBills = prev.bills.map((b) => {
        if (b.id !== targetTx.linkedBillId) return b;

        let revertedDueDate = b.nextDueDate;
        if (adjustment?.nextDueDate) {
          revertedDueDate = adjustment.nextDueDate;
        } else if (targetTx.previousDueDate) {
          revertedDueDate = targetTx.previousDueDate;
        } else if (b.nextDueDate > targetTx.date) {
          revertedDueDate = shiftBillCycleDate(
            b.nextDueDate,
            b.billingCycle,
            -1
          );
        }

        const adjustedAmount =
          adjustment?.amount !== undefined && adjustment.amount > 0
            ? adjustment.amount
            : b.amount;

        return {
          ...b,
          amount: adjustedAmount,
          nextDueDate: revertedDueDate,
          lastPaidDate: nextLastPaidDate,
        };
      });

      return {
        ...prev,
        bills: updatedBills,
        transactions: remainingTransactions,
      };
    });
  };

  const updateBillPayment = (
    txId: string,
    updates: {
      txAmount: number;
      txDate: string;
      billAmount?: number;
      billNextDueDate?: string;
    }
  ) => {
    mutateState((prev) => {
      const targetTx = prev.transactions.find((t) => t.id === txId);
      if (!targetTx) return prev;

      const updatedTransactions = prev.transactions.map((t) =>
        t.id === txId
          ? {
              ...t,
              amount:
                updates.txAmount > 0 ? updates.txAmount : t.amount,
              date: updates.txDate || t.date,
            }
          : t
      );

      if (!targetTx.linkedBillId) {
        return {
          ...prev,
          transactions: updatedTransactions,
        };
      }

      const latestLinkedDate = updatedTransactions
        .filter((t) => t.linkedBillId === targetTx.linkedBillId)
        .sort((a, b) => b.date.localeCompare(a.date))[0]?.date;

      const updatedBills = prev.bills.map((b) => {
        if (b.id !== targetTx.linkedBillId) return b;
        return {
          ...b,
          amount:
            updates.billAmount !== undefined && updates.billAmount > 0
              ? updates.billAmount
              : b.amount,
          nextDueDate: updates.billNextDueDate || b.nextDueDate,
          lastPaidDate: latestLinkedDate ?? b.lastPaidDate,
        };
      });

      return {
        ...prev,
        transactions: updatedTransactions,
        bills: updatedBills,
      };
    });
  };

  const changeBillStatus = (
    billId: string,
    status: 'active' | 'paused' | 'cancelled'
  ) => {
    mutateState((prev) => ({
      ...prev,
      bills: prev.bills.map((b) =>
        b.id === billId ? { ...b, status, autoPay: status === 'active' ? b.autoPay : false } : b
      ),
    }));
  };

  // Debts (capped at DEMO_LIMITS.MAX_DEBTS)
  const addDebt = (debt: Omit<DebtAccount, 'id'>) => {
    if (latestDataRef.current.debts.length >= DEMO_LIMITS.MAX_DEBTS) {
      return;
    }
    const newDebt: DebtAccount = {
      ...debt,
      id: `debt-${Date.now()}`,
    };
    mutateState((prev) => {
      if (prev.debts.length >= DEMO_LIMITS.MAX_DEBTS) {
        return prev;
      }
      return {
        ...prev,
        debts: [...prev.debts, newDebt],
      };
    });
  };

  const updateDebt = (debt: DebtAccount) => {
    mutateState((prev) => ({
      ...prev,
      debts: prev.debts.map((d) => (d.id === debt.id ? debt : d)),
    }));
  };

  const deleteDebt = (id: string) => {
    mutateState((prev) => ({
      ...prev,
      debts: prev.debts.filter((d) => d.id !== id),
    }));
  };

  const recordDebtPayment = (debtId: string, amount: number, date: string) => {
    if (latestDataRef.current.transactions.length >= DEMO_LIMITS.MAX_TRANSACTIONS) {
      return;
    }
    mutateState((prev) => {
      if (prev.transactions.length >= DEMO_LIMITS.MAX_TRANSACTIONS) return prev;
      const target = prev.debts.find((d) => d.id === debtId);
      if (!target) return prev;
      const newBalance = Math.max(0, target.balance - amount);

      const newTx: Transaction = {
        id: `tx-${Date.now()}`,
        date,
        description: `Payment toward ${target.name}`,
        amount,
        type: 'expense',
        category: 'Debt Repayment',
        paymentMethod: 'ACH Payment',
        linkedDebtId: debtId,
      };

      return {
        ...prev,
        debts: prev.debts.map((d) =>
          d.id === debtId ? { ...d, balance: newBalance } : d
        ),
        transactions: [newTx, ...prev.transactions],
      };
    });
  };

  const revertDebtPayment = (
    txId: string,
    adjustedDebtBalance?: number
  ) => {
    mutateState((prev) => {
      const targetTx = prev.transactions.find((t) => t.id === txId);
      if (!targetTx) return prev;

      const remainingTransactions = prev.transactions.filter(
        (t) => t.id !== txId
      );

      if (!targetTx.linkedDebtId) {
        return {
          ...prev,
          transactions: remainingTransactions,
        };
      }

      const updatedDebts = prev.debts.map((d) => {
        if (d.id !== targetTx.linkedDebtId) return d;
        const nextBalance =
          adjustedDebtBalance !== undefined &&
          !isNaN(adjustedDebtBalance) &&
          adjustedDebtBalance >= 0
            ? adjustedDebtBalance
            : Math.max(0, d.balance + targetTx.amount);
        return { ...d, balance: nextBalance };
      });

      return {
        ...prev,
        debts: updatedDebts,
        transactions: remainingTransactions,
      };
    });
  };

  const updateDebtPayment = (
    txId: string,
    updates: {
      txAmount: number;
      txDate: string;
      adjustedDebtBalance?: number;
    }
  ) => {
    mutateState((prev) => {
      const targetTx = prev.transactions.find((t) => t.id === txId);
      if (!targetTx) return prev;

      const nextTxAmount =
        updates.txAmount > 0 ? updates.txAmount : targetTx.amount;

      const updatedTransactions = prev.transactions.map((t) =>
        t.id === txId
          ? {
              ...t,
              amount: nextTxAmount,
              date: updates.txDate || t.date,
            }
          : t
      );

      if (!targetTx.linkedDebtId) {
        return {
          ...prev,
          transactions: updatedTransactions,
        };
      }

      const delta = targetTx.amount - nextTxAmount;
      const updatedDebts = prev.debts.map((d) => {
        if (d.id !== targetTx.linkedDebtId) return d;
        const nextBalance =
          updates.adjustedDebtBalance !== undefined &&
          !isNaN(updates.adjustedDebtBalance) &&
          updates.adjustedDebtBalance >= 0
            ? updates.adjustedDebtBalance
            : Math.max(0, d.balance + delta);
        return { ...d, balance: nextBalance };
      });

      return {
        ...prev,
        debts: updatedDebts,
        transactions: updatedTransactions,
      };
    });
  };

  // Split Bills
  const addParticipant = (participant: Omit<SplitParticipant, 'id'>) => {
    const newPart: SplitParticipant = {
      ...participant,
      id: `part-${Date.now()}`,
    };
    mutateState((prev) => ({
      ...prev,
      splitParticipants: [...prev.splitParticipants, newPart],
    }));
  };

  const updateParticipant = (participant: SplitParticipant) => {
    mutateState((prev) => ({
      ...prev,
      splitParticipants: prev.splitParticipants.map((p) =>
        p.id === participant.id ? participant : p
      ),
    }));
  };

  const removeParticipant = (id: string) => {
    mutateState((prev) => ({
      ...prev,
      splitParticipants: prev.splitParticipants.filter(
        (p) => p.id !== id || p.isSelf
      ),
    }));
  };

  const addSplitExpense = (expense: Omit<SplitExpense, 'id'>) => {
    const newExp: SplitExpense = {
      ...expense,
      id: `split-${Date.now()}`,
    };
    mutateState((prev) => ({
      ...prev,
      splitExpenses: [newExp, ...prev.splitExpenses],
    }));
  };

  const updateSplitExpensePayer = (expenseId: string, paidById: string) => {
    mutateState((prev) => ({
      ...prev,
      splitExpenses: prev.splitExpenses.map((exp) => {
        if (exp.id !== expenseId || exp.paidById === paidById) return exp;
        const previousPayerId = exp.paidById;
        return {
          ...exp,
          paidById,
          splits: exp.splits.map((s) => {
            if (s.participantId === paidById) {
              return { ...s, settled: true };
            }
            if (s.participantId === previousPayerId) {
              return { ...s, settled: false };
            }
            return s;
          }),
        };
      }),
    }));
  };

  const toggleSplitSettled = (expenseId: string, participantId: string) => {
    mutateState((prev) => ({
      ...prev,
      splitExpenses: prev.splitExpenses.map((exp) =>
        exp.id === expenseId
          ? {
              ...exp,
              splits: exp.splits.map((s) =>
                s.participantId === participantId
                  ? { ...s, settled: !s.settled }
                  : s
              ),
            }
          : exp
      ),
    }));
  };

  const settleAllForParticipant = (participantId: string) => {
    mutateState((prev) => ({
      ...prev,
      splitExpenses: prev.splitExpenses.map((exp) => ({
        ...exp,
        splits: exp.splits.map((s) =>
          s.participantId === participantId || exp.paidById === participantId
            ? { ...s, settled: true }
            : s
        ),
      })),
    }));
  };

  const deleteSplitExpense = (id: string) => {
    mutateState((prev) => ({
      ...prev,
      splitExpenses: prev.splitExpenses.filter((e) => e.id !== id),
    }));
  };

  // Settings (Google Sheets URL & autoSync are locked off in Demo mode)
  const updateSettings = (partial: Partial<UserSettings>) => {
    const sanitizedPartial: Partial<UserSettings> = { ...partial };
    if (!DEMO_LIMITS.ALLOW_GOOGLE_SHEETS) {
      delete sanitizedPartial.googleScriptUrl;
      delete sanitizedPartial.autoSync;
    }

    const changedKeys = Object.keys(sanitizedPartial) as (keyof UserSettings)[];
    if (changedKeys.length === 0) return;

    const isLocalOnly =
      changedKeys.every((key) => DEVICE_LOCAL_SETTING_KEYS.has(key));

    if (isLocalOnly) {
      isApplyingRemoteRef.current = true;
      setData((prev) => ({
        ...prev,
        settings: {
          ...prev.settings,
          ...sanitizedPartial,
        },
      }));
      return;
    }

    mutateState((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        ...sanitizedPartial,
      },
    }));
  };

  const toggleTheme = () => {
    isApplyingRemoteRef.current = true;
    setData((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        theme: prev.settings.theme === 'dark' ? 'light' : 'dark',
      },
    }));
  };

  const resetToDemoData = () => {
    const nowIso = new Date().toISOString();
    updateOutbox((prev) => ({
      ...prev,
      syncPending: true,
      pendingChangesCount: prev.pendingChangesCount + 1,
      lastLocalEditAt: nowIso,
    }));
    setData({
      ...INITIAL_APP_DATA,
      lastUpdated: nowIso,
    });
  };

  return (
    <FinanceContext.Provider
      value={{
        data,
        activePage,
        setActivePage,
        selectedMonth,
        setSelectedMonth,
        isOnline,
        syncStatus,
        syncMessage,
        lastSyncedAt,
        syncPending: outbox.syncPending,
        pendingChangesCount: outbox.pendingChangesCount,
        storageEngine: t('storageEngineName', data.settings.language),
        flushOfflineQueue,
        triggerManualPush,
        triggerManualPull,
        resetToDemoData,
        isTxModalOpen,
        txModalDefaultDate,
        editingTransaction,
        openTxModal,
        openEditTxModal,
        closeTxModal,
        addTransaction,
        updateTransaction,
        deleteTransaction,
        clearAllTransactions,
        addCategory,
        updateCategory,
        deleteCategory,
        addSavingsGoal,
        updateSavingsGoal,
        deleteSavingsGoal,
        recordGoalContribution,
        revertGoalContribution,
        addBill,
        updateBill,
        deleteBill,
        markBillPaid,
        revertBillPayment,
        updateBillPayment,
        changeBillStatus,
        addDebt,
        updateDebt,
        deleteDebt,
        recordDebtPayment,
        revertDebtPayment,
        updateDebtPayment,
        addParticipant,
        updateParticipant,
        removeParticipant,
        addSplitExpense,
        updateSplitExpensePayer,
        toggleSplitSettled,
        settleAllForParticipant,
        deleteSplitExpense,
        updateSettings,
        toggleTheme,
      }}
    >
      {children}
    </FinanceContext.Provider>
  );
};

export function useFinance() {
  const ctx = useContext(FinanceContext);
  if (!ctx) {
    throw new Error('useFinance must be used within a FinanceProvider');
  }
  return ctx;
}
