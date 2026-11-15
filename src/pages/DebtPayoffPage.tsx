import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, Edit3, Lock, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import { DebtPayoffTrajectoryChart } from '../components/Charts';
import { useFinance } from '../context/FinanceContext';
import { DebtAccount, Transaction } from '../types/finance';
import { DEMO_LIMITS } from '../utils/demoLimits';
import { formatCurrency, simulateDebtPayoff, t } from '../utils/formatters';

export const DebtPayoffPage: React.FC = () => {
  const {
    data,
    updateSettings,
    addDebt,
    updateDebt,
    deleteDebt,
    recordDebtPayment,
    revertDebtPayment,
    updateDebtPayment,
  } = useFinance();

  const { currency, debtStrategy, extraDebtPayment, language } = data.settings;
  const strategyLabel =
    debtStrategy === 'avalanche'
      ? t('avalancheName', language)
      : t('snowballName', language);

  // Add Debt Drawer state
  const [showAddDebt, setShowAddDebt] = useState(false);
  const [debtName, setDebtName] = useState('');
  const [lender, setLender] = useState('');
  const [category, setCategory] = useState<
    | 'Credit Card'
    | 'Student Loan'
    | 'Auto Loan'
    | 'Mortgage'
    | 'Personal Loan'
  >('Credit Card');
  const [balance, setBalance] = useState('');
  const [originalBalance, setOriginalBalance] = useState('');
  const [apr, setApr] = useState('');
  const [minPay, setMinPay] = useState('');
  const [dueDay, setDueDay] = useState('15');

  // Amortization table view count
  const [visibleScheduleRows, setVisibleScheduleRows] = useState(12);

  // Edit Debt Modal state
  const [editingDebtId, setEditingDebtId] = useState<string | null>(null);
  const [editDebtForm, setEditDebtForm] = useState<{
    name: string;
    lender: string;
    category: DebtAccount['category'];
    balance: string;
    originalBalance: string;
    apr: string;
    minimumPayment: string;
    dueDateDay: string;
  }>({
    name: '',
    lender: '',
    category: 'Credit Card',
    balance: '',
    originalBalance: '',
    apr: '',
    minimumPayment: '',
    dueDateDay: '15',
  });

  // Revert Payment Modal state
  const [revertingPayment, setRevertingPayment] = useState<{
    tx: Transaction;
    debt: DebtAccount;
    adjustedBalance: string;
  } | null>(null);

  // Adjust Payment Modal state
  const [adjustingPayment, setAdjustingPayment] = useState<{
    tx: Transaction;
    debt: DebtAccount;
    txAmount: string;
    txDate: string;
    adjustedBalance: string;
  } | null>(null);

  // Debt Transaction History Popup state
  const [historyDebtId, setHistoryDebtId] = useState<string | null>(null);

  // Run dynamic Snowball / Avalanche amortization simulation
  const sim = useMemo(() => {
    return simulateDebtPayoff(data.debts, debtStrategy, extraDebtPayment, language);
  }, [data.debts, debtStrategy, extraDebtPayment, language]);

  const trajectoryInsights = useMemo(() => {
    const avalancheSim =
      debtStrategy === 'avalanche'
        ? sim
        : simulateDebtPayoff(data.debts, 'avalanche', extraDebtPayment, language);
    const snowballSim =
      debtStrategy === 'snowball'
        ? sim
        : simulateDebtPayoff(data.debts, 'snowball', extraDebtPayment, language);

    const active = data.debts.filter((d) => d.balance > 0);
    const totalBal = active.reduce((s, d) => s + d.balance, 0);
    const weightedApr =
      totalBal > 0
        ? active.reduce((s, d) => s + d.balance * d.apr, 0) / totalBal
        : 0;

    const totalOriginal = data.debts.reduce(
      (s, d) => s + Math.max(d.originalBalance, d.balance),
      0
    );
    const totalCurrent = data.debts.reduce((s, d) => s + d.balance, 0);
    const totalPaidOff = Math.max(0, totalOriginal - totalCurrent);
    const clearedPct =
      totalOriginal > 0 ? Math.min(100, (totalPaidOff / totalOriginal) * 100) : 0;

    const interestDiff = Math.abs(
      snowballSim.totalInterestStrategy - avalancheSim.totalInterestStrategy
    );

    return {
      avalancheSim,
      snowballSim,
      weightedApr,
      totalOriginal,
      totalPaidOff,
      clearedPct,
      interestDiff,
    };
  }, [data.debts, debtStrategy, extraDebtPayment, sim, language]);

  const debtTxsByDebt = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    data.transactions
      .filter((t) => Boolean(t.linkedDebtId))
      .sort((a, b) => b.date.localeCompare(a.date))
      .forEach((tx) => {
        if (!tx.linkedDebtId) return;
        const list = map.get(tx.linkedDebtId) || [];
        list.push(tx);
        map.set(tx.linkedDebtId, list);
      });
    return map;
  }, [data.transactions]);

  const settledDebts = useMemo(
    () => data.debts.filter((d) => d.balance <= 0),
    [data.debts]
  );

  const historyDebt = useMemo(
    () =>
      historyDebtId
        ? data.debts.find((d) => d.id === historyDebtId) || null
        : null,
    [data.debts, historyDebtId]
  );

  const openEditDebtModal = (debt: DebtAccount) => {
    setHistoryDebtId(null);
    setRevertingPayment(null);
    setAdjustingPayment(null);
    setEditingDebtId(debt.id);
    setEditDebtForm({
      name: debt.name,
      lender: debt.lender,
      category: debt.category,
      balance: String(debt.balance),
      originalBalance: String(debt.originalBalance),
      apr: String(debt.apr),
      minimumPayment: String(debt.minimumPayment),
      dueDateDay: String(debt.dueDateDay),
    });
  };

  const handleSaveEditDebt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDebtId) return;
    const balNum = parseFloat(editDebtForm.balance);
    const origNum = parseFloat(editDebtForm.originalBalance);
    const aprNum = parseFloat(editDebtForm.apr);
    const minNum = parseFloat(editDebtForm.minimumPayment);
    if (
      !editDebtForm.name.trim() ||
      isNaN(balNum) ||
      balNum < 0 ||
      isNaN(aprNum) ||
      aprNum < 0 ||
      isNaN(minNum) ||
      minNum <= 0
    ) {
      return;
    }

    updateDebt({
      id: editingDebtId,
      name: editDebtForm.name.trim(),
      lender: editDebtForm.lender.trim() || 'Lender',
      category: editDebtForm.category,
      balance: balNum,
      originalBalance: !isNaN(origNum) && origNum > 0 ? origNum : balNum,
      apr: aprNum,
      minimumPayment: minNum,
      dueDateDay: Math.min(
        28,
        Math.max(1, parseInt(editDebtForm.dueDateDay, 10) || 15)
      ),
    });

    setEditingDebtId(null);
  };

  const openRevertPaymentModal = (tx: Transaction, debt: DebtAccount) => {
    setHistoryDebtId(null);
    setEditingDebtId(null);
    setAdjustingPayment(null);
    setRevertingPayment({
      tx,
      debt,
      adjustedBalance: String(
        Math.max(0, Number((debt.balance + tx.amount).toFixed(2)))
      ),
    });
  };

  const handleConfirmRevertPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!revertingPayment) return;
    const adjBal = parseFloat(revertingPayment.adjustedBalance);
    revertDebtPayment(
      revertingPayment.tx.id,
      !isNaN(adjBal) && adjBal >= 0 ? adjBal : undefined
    );
    setRevertingPayment(null);
  };

  const openAdjustPaymentModal = (tx: Transaction, debt: DebtAccount) => {
    setHistoryDebtId(null);
    setEditingDebtId(null);
    setRevertingPayment(null);
    setAdjustingPayment({
      tx,
      debt,
      txAmount: String(tx.amount),
      txDate: tx.date,
      adjustedBalance: String(debt.balance),
    });
  };

  const handleSaveAdjustPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingPayment) return;
    const txAmt = parseFloat(adjustingPayment.txAmount);
    if (isNaN(txAmt) || txAmt <= 0 || !adjustingPayment.txDate) return;
    const adjBal = parseFloat(adjustingPayment.adjustedBalance);
    updateDebtPayment(adjustingPayment.tx.id, {
      txAmount: txAmt,
      txDate: adjustingPayment.txDate,
      adjustedDebtBalance:
        !isNaN(adjBal) && adjBal >= 0 ? adjBal : undefined,
    });
    setAdjustingPayment(null);
  };

  const debtLimitReached = data.debts.length >= DEMO_LIMITS.MAX_DEBTS;
  const txLimitReached =
    data.transactions.length >= DEMO_LIMITS.MAX_TRANSACTIONS;

  const handleAddDebt = (e: React.FormEvent) => {
    e.preventDefault();
    if (debtLimitReached) return;
    const balNum = parseFloat(balance);
    const origNum = parseFloat(originalBalance) || balNum;
    const aprNum = parseFloat(apr);
    const minNum = parseFloat(minPay);
    if (
      !debtName.trim() ||
      isNaN(balNum) ||
      balNum <= 0 ||
      isNaN(aprNum) ||
      isNaN(minNum)
    ) {
      return;
    }

    addDebt({
      name: debtName.trim(),
      lender: lender.trim() || 'Lender',
      category,
      balance: balNum,
      originalBalance: origNum,
      apr: aprNum,
      minimumPayment: minNum,
      dueDateDay: Math.min(28, Math.max(1, parseInt(dueDay, 10) || 15)),
    });

    setDebtName('');
    setLender('');
    setBalance('');
    setOriginalBalance('');
    setApr('');
    setMinPay('');
    setShowAddDebt(false);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
            {t('debtTitle', language)}
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
            {t('debtSub', language)}
          </p>
        </div>

        <button
          onClick={() => setShowAddDebt((p) => !p)}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{t('addDebtAccount', language)}</span>
          <span className="ml-1 opacity-75 tabular-nums">
            ({data.debts.length}/{DEMO_LIMITS.MAX_DEBTS})
          </span>
        </button>
      </div>

      {/* Add Debt Form */}
      {showAddDebt && (
        <form
          onSubmit={handleAddDebt}
          className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 space-y-4"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              {t('addLoanCardTitle', language)}
            </div>
            <span
              className={`px-2 py-0.5 text-[11px] font-medium tabular-nums rounded-md border ${
                debtLimitReached
                  ? 'border-amber-200 dark:border-amber-800/70 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300'
                  : 'border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300'
              }`}
            >
              {data.debts.length} / {DEMO_LIMITS.MAX_DEBTS}
            </span>
          </div>

          {debtLimitReached && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 dark:border-amber-800/70 bg-amber-50/80 dark:bg-amber-950/30 p-3 text-xs text-amber-800 dark:text-amber-200">
              <Lock className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <span>
                Demo limit reached ({DEMO_LIMITS.MAX_DEBTS} /{' '}
                {DEMO_LIMITS.MAX_DEBTS} debt accounts). Delete an existing debt
                account to add a new one.
              </span>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs text-neutral-500 mb-1">
                {t('accountNameLabel', language)}
              </label>
              <input
                type="text"
                required
                placeholder={t('accountNamePlaceholder', language)}
                value={debtName}
                onChange={(e) => setDebtName(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
              />
            </div>

            <div>
              <label className="block text-xs text-neutral-500 mb-1">
                {t('lenderLabel', language)}
              </label>
              <input
                type="text"
                placeholder={t('lenderPlaceholder', language)}
                value={lender}
                onChange={(e) => setLender(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
              />
            </div>

            <div>
              <label className="block text-xs text-neutral-500 mb-1">
                {t('currentBalanceLabel', language, { currency })}
              </label>
              <input
                type="number"
                required
                min="1"
                placeholder="2500"
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
                className="w-full px-3 py-2 text-xs tabular-nums rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
              />
            </div>

            <div>
              <label className="block text-xs text-neutral-500 mb-1">
                {t('aprPctLabel', language)}
              </label>
              <input
                type="number"
                step="0.01"
                required
                min="0"
                placeholder="19.99"
                value={apr}
                onChange={(e) => setApr(e.target.value)}
                className="w-full px-3 py-2 text-xs tabular-nums rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
              />
            </div>

            <div>
              <label className="block text-xs text-neutral-500 mb-1">
                {t('minPaymentLabel', language, { currency })}
              </label>
              <input
                type="number"
                step="1"
                required
                min="1"
                placeholder="85"
                value={minPay}
                onChange={(e) => setMinPay(e.target.value)}
                className="w-full px-3 py-2 text-xs tabular-nums rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-3">
              <select
                value={category}
                onChange={(e) =>
                  setCategory(
                    e.target.value as
                      | 'Credit Card'
                      | 'Student Loan'
                      | 'Auto Loan'
                      | 'Mortgage'
                      | 'Personal Loan'
                  )
                }
                className="px-3 py-1.5 text-xs rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
              >
                <option value="Credit Card">{t('debtCatCreditCard', language)}</option>
                <option value="Student Loan">{t('debtCatStudentLoan', language)}</option>
                <option value="Auto Loan">{t('debtCatAutoLoan', language)}</option>
                <option value="Personal Loan">{t('debtCatPersonalLoan', language)}</option>
                <option value="Mortgage">{t('debtCatMortgage', language)}</option>
              </select>

              <input
                type="number"
                placeholder={t('originalBalanceOptional', language)}
                value={originalBalance}
                onChange={(e) => setOriginalBalance(e.target.value)}
                className="px-3 py-1.5 text-xs tabular-nums rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
              />

              <input
                type="number"
                min="1"
                max="28"
                placeholder={t('dueDayPlaceholder', language)}
                value={dueDay}
                onChange={(e) => setDueDay(e.target.value)}
                className="w-32 px-3 py-1.5 text-xs tabular-nums rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowAddDebt(false)}
                className="px-3 py-1.5 text-xs text-neutral-500"
              >
                {t('cancel', language)}
              </button>
              <button
                type="submit"
                disabled={debtLimitReached}
                className="px-4 py-1.5 text-xs font-medium rounded-lg bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 disabled:opacity-45 disabled:cursor-not-allowed"
              >
                {t('saveDebtAccount', language)}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Strategy Controls Bar: Snowball vs Avalanche + Extra Monthly Payment Slider */}
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Strategy Method Picker */}
          <div className="lg:col-span-6 space-y-2">
            <div className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
              {t('selectRepaymentStrategy', language)}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => updateSettings({ debtStrategy: 'avalanche' })}
                className={`p-3.5 rounded-xl border text-left transition-all ${
                  debtStrategy === 'avalanche'
                    ? 'border-neutral-900 dark:border-neutral-100 bg-neutral-50 dark:bg-neutral-800/90 ring-1 ring-neutral-900 dark:ring-neutral-100'
                    : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-400'
                }`}
              >
                <div className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                  {t('avalancheTitle', language)}
                </div>
                <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1">
                  {t('avalancheDesc', language)}
                </div>
              </button>

              <button
                type="button"
                onClick={() => updateSettings({ debtStrategy: 'snowball' })}
                className={`p-3.5 rounded-xl border text-left transition-all ${
                  debtStrategy === 'snowball'
                    ? 'border-neutral-900 dark:border-neutral-100 bg-neutral-50 dark:bg-neutral-800/90 ring-1 ring-neutral-900 dark:ring-neutral-100'
                    : 'border-neutral-200 dark:border-neutral-800 hover:border-neutral-400'
                }`}
              >
                <div className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                  {t('snowballTitle', language)}
                </div>
                <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1">
                  {t('snowballDesc', language)}
                </div>
              </button>
            </div>
          </div>

          {/* Extra Monthly Payment Slider + Input */}
          <div className="lg:col-span-6 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                {t('extraMonthlyAccelerator', language)}
              </span>
              <span className="font-mono tabular-nums text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                +{formatCurrency(extraDebtPayment, currency)} / {t('perMonthWord', language)}
              </span>
            </div>

            <div className="flex items-center gap-4">
              <input
                type="range"
                min="0"
                max="2000"
                step="25"
                value={extraDebtPayment}
                onChange={(e) =>
                  updateSettings({
                    extraDebtPayment: parseFloat(e.target.value) || 0,
                  })
                }
                className="flex-1 accent-neutral-900 dark:accent-neutral-100 cursor-pointer"
              />
              <input
                type="number"
                min="0"
                max="25000"
                step="25"
                value={extraDebtPayment}
                onChange={(e) =>
                  updateSettings({
                    extraDebtPayment: Math.max(
                      0,
                      parseFloat(e.target.value) || 0
                    ),
                  })
                }
                className="w-24 px-2.5 py-1.5 text-xs font-mono tabular-nums text-right rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-neutral-500 tabular-nums">
              <span>
                {t('baseMinimums', language, {
                  amount: formatCurrency(sim.totalMinimumPayment, currency),
                })}
              </span>
              <span>
                {t('totalMonthlyCommitment', language)}{' '}
                <strong className="text-neutral-900 dark:text-neutral-100">
                  {t('perMonth', language, {
                    amount: formatCurrency(
                      sim.totalMinimumPayment + extraDebtPayment,
                      currency
                    ),
                  })}
                </strong>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 4 Simulation Outcome KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
          <div className="text-xs text-neutral-500 dark:text-neutral-400">
            {t('totalRemainingDebt', language)}
          </div>
          <div className="mt-2 text-2xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
            {formatCurrency(sim.totalBalance, currency, {
              maximumFractionDigits: 0,
            })}
          </div>
          <div className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
            {t('acrossActiveObligations', language, { count: sim.rankedDebts.length })}
          </div>
        </div>

        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
          <div className="text-xs text-neutral-500 dark:text-neutral-400">
            {t('projectedDebtFreeDate', language)}
          </div>
          <div className="mt-2 text-2xl font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
            {sim.debtFreeDateStrategy}
          </div>
          <div className="mt-2 text-xs text-neutral-500 dark:text-neutral-400 tabular-nums">
            <span>{sim.monthsToPayoffStrategy} {t('mosUnit', language)}</span>
            <span className="mx-1.5" aria-hidden="true">
              ·
            </span>
            <span className="text-emerald-600 dark:text-emerald-400 font-medium">
              {t('monthsFaster', language, { count: sim.monthsSaved })}
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
          <div className="text-xs text-neutral-500 dark:text-neutral-400">
            {t('totalInterestSaved', language)}
          </div>
          <div className="mt-2 text-2xl font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
            {formatCurrency(sim.interestSaved, currency, {
              maximumFractionDigits: 0,
            })}
          </div>
          <div className="mt-2 text-xs text-neutral-500 dark:text-neutral-400 tabular-nums">
            {t('vsBaselineInterest', language, {
              amount: formatCurrency(sim.totalInterestBaseline, currency, {
                maximumFractionDigits: 0,
              }),
            })}
          </div>
        </div>

        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
          <div className="text-xs text-neutral-500 dark:text-neutral-400">
            {t('totalStrategyInterestCost', language)}
          </div>
          <div className="mt-2 text-2xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
            {formatCurrency(sim.totalInterestStrategy, currency, {
              maximumFractionDigits: 0,
            })}
          </div>
          <div className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
            {t('usingPriorityOrder', language, { strategy: strategyLabel })}
          </div>
        </div>
      </div>

      {/* Main Split: Animated Payoff Chart + Ranked Debt Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 7 Cols: Animated Payoff Progress Chart */}
        <div className="lg:col-span-7 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
              {t('strategyPayoffTrajectory', language, { strategy: strategyLabel })}
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              {t('strategyPayoffTrajectorySub', language, { strategy: strategyLabel })}
            </p>
          </div>

          <DebtPayoffTrajectoryChart
            schedule={sim.schedule}
            currency={currency}
            strategyName={strategyLabel}
            language={language}
          />

          {/* Key Trajectory Details */}
          {sim.rankedDebts.length > 0 && (
            <div className="mt-5 pt-5 border-t border-neutral-200 dark:border-neutral-800 space-y-5">
              {/* Key Stats Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-lg border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/40 p-3">
                  <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    {t('weightedAvgApr', language)}
                  </div>
                  <div className="mt-1 text-sm font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
                    {trajectoryInsights.weightedApr.toFixed(2)}%
                  </div>
                  <div className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5 tabular-nums">
                    {t('acrossActiveDebts', language, { count: sim.rankedDebts.length })}
                  </div>
                </div>

                <div className="rounded-lg border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/40 p-3">
                  <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    {t('rolloverCommitment', language)}
                  </div>
                  <div className="mt-1 text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                    {t('perMonth', language, {
                      amount: formatCurrency(
                        sim.totalMinimumPayment + extraDebtPayment,
                        currency,
                        { maximumFractionDigits: 0 }
                      ),
                    })}
                  </div>
                  <div className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5 tabular-nums">
                    {t('minPlusExtra', language, {
                      min: formatCurrency(sim.totalMinimumPayment, currency, {
                        maximumFractionDigits: 0,
                      }),
                      extra: formatCurrency(extraDebtPayment, currency, {
                        maximumFractionDigits: 0,
                      }),
                    })}
                  </div>
                </div>

                <div className="rounded-lg border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/40 p-3">
                  <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    {t('minOnlyHorizon', language)}
                  </div>
                  <div className="mt-1 text-sm font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
                    {sim.debtFreeDateBaseline}
                  </div>
                  <div className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5 tabular-nums">
                    {sim.monthsToPayoffBaseline} {t('mosUnit', language)} ({t('mosSlower', language, { count: sim.monthsSaved })})
                  </div>
                </div>

                <div className="rounded-lg border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/40 p-3">
                  <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    {t('principalPaidDown', language)}
                  </div>
                  <div className="mt-1 text-sm font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
                    {trajectoryInsights.clearedPct.toFixed(0)}%
                  </div>
                  <div className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-0.5 tabular-nums">
                    {formatCurrency(trajectoryInsights.totalPaidOff, currency, {
                      maximumFractionDigits: 0,
                    })}{' '}
                    {t('ofAmountLabel', language, {
                      amount: formatCurrency(trajectoryInsights.totalOriginal, currency, {
                        maximumFractionDigits: 0,
                      }),
                    })}
                  </div>
                </div>
              </div>

              {/* Payoff Milestones by Account */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                    {t('projectedPayoffMilestones', language)}
                  </span>
                  <span className="text-[11px] text-neutral-500 dark:text-neutral-400 tabular-nums">
                    {t('freedMinimumsCascade', language)}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {sim.rankedDebts.map((debt) => (
                    <div
                      key={debt.id}
                      className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs ${
                        debt.rank === 1
                          ? 'border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/40 dark:bg-emerald-950/20'
                          : 'border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/40 dark:bg-neutral-950/30'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-neutral-900 dark:text-neutral-100 truncate">
                          <span className="font-mono text-emerald-600 dark:text-emerald-400 mr-1">
                            #{debt.rank}
                          </span>
                          {debt.name}
                        </div>
                        <div className="text-[11px] text-neutral-500 dark:text-neutral-400 tabular-nums">
                          {t('aprFreesPerMo', language, {
                            apr: debt.apr,
                            amount: formatCurrency(debt.minimumPayment, currency, {
                              maximumFractionDigits: 0,
                            }),
                          })}
                        </div>
                      </div>
                      <div className="text-right shrink-0 tabular-nums">
                        <div className="font-semibold text-neutral-900 dark:text-neutral-100">
                          {t('monthLabel', language, { month: debt.payoffMonthsStrategy })}
                        </div>
                        <div className="text-[10px] text-neutral-500 dark:text-neutral-400">
                          {sim.schedule[debt.payoffMonthsStrategy]?.label ||
                            sim.debtFreeDateStrategy}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Avalanche vs Snowball Comparison */}
              <div className="rounded-lg border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/40 p-3.5 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                    {t('avalancheVsSnowball', language)}
                  </span>
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium tabular-nums">
                    {trajectoryInsights.interestDiff < 1
                      ? t('samePayoffOrder', language)
                      : t('avalancheSavesInterest', language, {
                          amount: formatCurrency(
                            trajectoryInsights.interestDiff,
                            currency,
                            { maximumFractionDigits: 0 }
                          ),
                        })}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs tabular-nums">
                  <div
                    className={`rounded-md border px-3 py-2 ${
                      debtStrategy === 'avalanche'
                        ? 'border-neutral-900 dark:border-neutral-200 bg-white dark:bg-neutral-900'
                        : 'border-neutral-200 dark:border-neutral-800'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                        {t('avalancheName', language)}
                      </span>
                      <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                        {trajectoryInsights.avalancheSim.monthsToPayoffStrategy}{' '}
                        {t('mosUnit', language)} · {trajectoryInsights.avalancheSim.debtFreeDateStrategy}
                      </span>
                    </div>
                    <div className="text-[11px] text-neutral-600 dark:text-neutral-400 mt-1">
                      {t('totalInterestMeta', language)}{' '}
                      <strong className="text-neutral-900 dark:text-neutral-100">
                        {formatCurrency(
                          trajectoryInsights.avalancheSim.totalInterestStrategy,
                          currency,
                          { maximumFractionDigits: 0 }
                        )}
                      </strong>
                    </div>
                  </div>

                  <div
                    className={`rounded-md border px-3 py-2 ${
                      debtStrategy === 'snowball'
                        ? 'border-neutral-900 dark:border-neutral-200 bg-white dark:bg-neutral-900'
                        : 'border-neutral-200 dark:border-neutral-800'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                        {t('snowballName', language)}
                      </span>
                      <span className="text-[11px] text-neutral-500 dark:text-neutral-400">
                        {trajectoryInsights.snowballSim.monthsToPayoffStrategy}{' '}
                        {t('mosUnit', language)} · {trajectoryInsights.snowballSim.debtFreeDateStrategy}
                      </span>
                    </div>
                    <div className="text-[11px] text-neutral-600 dark:text-neutral-400 mt-1">
                      {t('totalInterestMeta', language)}{' '}
                      <strong className="text-neutral-900 dark:text-neutral-100">
                        {formatCurrency(
                          trajectoryInsights.snowballSim.totalInterestStrategy,
                          currency,
                          { maximumFractionDigits: 0 }
                        )}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right 5 Cols: Ranked Debts According to Selected Method */}
        <div className="lg:col-span-5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
              {t('priorityQueueTitle', language, { strategy: strategyLabel })}
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              {debtStrategy === 'avalanche'
                ? t('avalancheRankSub', language)
                : t('snowballRankSub', language)}
            </p>
          </div>

          <div className="space-y-3">
            {sim.rankedDebts.map((debt) => {
              const paidPct =
                debt.originalBalance > 0
                  ? Math.min(
                      100,
                      Math.max(
                        0,
                        ((debt.originalBalance - debt.balance) /
                          debt.originalBalance) *
                          100
                      )
                    )
                  : 0;
              const loggedPayments = debtTxsByDebt.get(debt.id) || [];
              const latestPayment = loggedPayments[0];
              const appliedExtra = debt.rank === 1 ? extraDebtPayment : 0;
              const scheduledPayment = Number(
                Math.min(
                  debt.balance,
                  debt.minimumPayment + appliedExtra
                ).toFixed(2)
              );

              return (
                <div
                  key={debt.id}
                  className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/40 dark:bg-neutral-950/40 space-y-2.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <button
                        type="button"
                        onClick={() => setHistoryDebtId(debt.id)}
                        className="text-left text-xs font-semibold text-neutral-900 dark:text-neutral-100 hover:underline cursor-pointer"
                        title={t('viewHistoryTooltip', language)}
                      >
                        <span className="font-mono text-emerald-600 dark:text-emerald-400 mr-1.5">
                          0{debt.rank}.
                        </span>
                        {debt.name}
                      </button>
                      <div className="text-[11px] text-neutral-500 dark:text-neutral-400 tabular-nums mt-0.5">
                        <span>{debt.lender}</span>
                        <span className="mx-1.5" aria-hidden="true">
                          ·
                        </span>
                        <span className="font-medium text-neutral-700 dark:text-neutral-300">
                          {t('aprBadge', language, { apr: debt.apr })}
                        </span>
                        <span className="mx-1.5" aria-hidden="true">
                          ·
                        </span>
                        <span>
                          {t('minShortAmount', language, {
                            amount: formatCurrency(debt.minimumPayment, currency),
                          })}
                        </span>
                        {appliedExtra > 0 && (
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                            {' '}
                            {t('extraPaymentBadge', language, {
                              amount: formatCurrency(appliedExtra, currency),
                            })}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEditDebtModal(debt)}
                        title={t('editDebtTooltip', language)}
                        className="p-1 text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      {latestPayment && (
                        <button
                          type="button"
                          onClick={() =>
                            openRevertPaymentModal(latestPayment, debt)
                          }
                          title={t('undoLatestPaymentTooltip', language, { date: latestPayment.date })}
                          className="p-1 text-neutral-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={txLimitReached}
                        onClick={() =>
                          recordDebtPayment(
                            debt.id,
                            scheduledPayment,
                            '2026-11-12'
                          )
                        }
                        title={
                          txLimitReached
                            ? `Demo limit of ${DEMO_LIMITS.MAX_TRANSACTIONS} transactions reached`
                            : appliedExtra > 0
                            ? t('recordPaymentExtraTooltip', language, {
                                amount: formatCurrency(scheduledPayment, currency),
                              })
                            : t('recordMinPaymentTooltip', language, {
                                amount: formatCurrency(scheduledPayment, currency),
                              })
                        }
                        className="p-1 text-neutral-400 hover:text-emerald-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteDebt(debt.id)}
                        title={t('removeDebtTooltip', language)}
                        className="p-1 text-neutral-400 hover:text-rose-600 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="flex items-baseline justify-between tabular-nums text-xs">
                    <span className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                      {formatCurrency(debt.balance, currency, {
                        maximumFractionDigits: 0,
                      })}
                    </span>
                    <span className="text-neutral-500">
                      {t('paidOffInLabel', language)}{' '}
                      <strong className="text-emerald-600 dark:text-emerald-400">
                        {debt.payoffMonthsStrategy} {t('mosUnit', language)}
                      </strong>{' '}
                      {t('pctCleared', language, { pct: paidPct.toFixed(0) })}
                    </span>
                  </div>

                  <div className="h-1.5 w-full bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: paidPct / 100 }}
                      transition={{ duration: 0.5 }}
                      style={{ transformOrigin: 'left' }}
                      className="h-full w-full bg-emerald-600 dark:bg-emerald-500 rounded-full"
                    />
                  </div>
                </div>
              );
            })}

            {settledDebts.map((debt) => (
              <div
                key={debt.id}
                className="p-4 rounded-xl border border-emerald-200/80 dark:border-emerald-900/50 bg-emerald-50/30 dark:bg-emerald-950/15 space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <button
                      type="button"
                      onClick={() => setHistoryDebtId(debt.id)}
                      className="text-left text-xs font-semibold text-neutral-900 dark:text-neutral-100 hover:underline cursor-pointer"
                      title={t('viewHistoryTooltip', language)}
                    >
                      <span className="font-mono text-emerald-600 dark:text-emerald-400 mr-1.5">
                        {t('paidBadge', language)}
                      </span>
                      {debt.name}
                    </button>
                    <div className="text-[11px] text-neutral-500 dark:text-neutral-400 tabular-nums mt-0.5">
                      {debt.lender} · {t('aprBadge', language, { apr: debt.apr })} · {t('balanceZero', language)}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEditDebtModal(debt)}
                      title={t('editDebtTooltip', language)}
                      className="p-1 text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteDebt(debt.id)}
                      title={t('removeDebtTooltip', language)}
                      className="p-1 text-neutral-400 hover:text-rose-600 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Popup Modal: Debt Payment Transaction History */}
      {historyDebt && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
          onClick={() => setHistoryDebtId(null)}
        >
          <div
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 pb-4 border-b border-neutral-200 dark:border-neutral-800">
              <div>
                <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                  {historyDebt.name}
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 tabular-nums">
                  {historyDebt.lender} · {t('aprBadge', language, { apr: historyDebt.apr })} ·{' '}
                  {t('remainingWithColon', language)}{' '}
                  <span className="font-medium text-neutral-900 dark:text-neutral-100">
                    {formatCurrency(historyDebt.balance, currency)}
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHistoryDebtId(null)}
                className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors shrink-0"
                aria-label={t('close', language)}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                  {t('transactionHistory', language)}
                </span>
                <span className="text-xs text-neutral-500 dark:text-neutral-400 tabular-nums">
                  {t('loggedCountBadge', language, {
                    count: (debtTxsByDebt.get(historyDebt.id) || []).length,
                  })}
                </span>
              </div>

              {(debtTxsByDebt.get(historyDebt.id) || []).length === 0 ? (
                <div className="rounded-lg border border-dashed border-neutral-200 dark:border-neutral-800 px-4 py-6 text-center text-xs text-neutral-500 dark:text-neutral-400">
                  {t('noDebtTxYet', language)}
                </div>
              ) : (
                <div className="divide-y divide-neutral-100 dark:divide-neutral-800/70">
                  {(debtTxsByDebt.get(historyDebt.id) || []).map((tx) => (
                    <div
                      key={tx.id}
                      className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="font-medium text-neutral-900 dark:text-neutral-100 truncate">
                          {tx.description}
                        </div>
                        <div className="text-[11px] text-neutral-500 dark:text-neutral-400 tabular-nums mt-0.5">
                          {tx.date} · {tx.paymentMethod}
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-2.5 shrink-0">
                        <span className="font-mono tabular-nums font-semibold text-neutral-900 dark:text-neutral-100">
                          {formatCurrency(tx.amount, currency)}
                        </span>
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() =>
                              openAdjustPaymentModal(tx, historyDebt)
                            }
                            className="px-2 py-1 rounded-md border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                          >
                            {t('adjust', language)}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              openRevertPaymentModal(tx, historyDebt)
                            }
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-amber-200 dark:border-amber-900/60 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>{t('revert', language)}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-5 pt-3 border-t border-neutral-200 dark:border-neutral-800 flex justify-end">
              <button
                type="button"
                onClick={() => setHistoryDebtId(null)}
                className="px-3.5 py-2 text-xs font-medium rounded-lg border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              >
                {t('close', language)}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Popup Modal: Edit Debt Account */}
      {editingDebtId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
          onClick={() => setEditingDebtId(null)}
        >
          <div
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-4 border-b border-neutral-200 dark:border-neutral-800">
              <div>
                <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                  {t('editDebtAccount', language)}
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                  {t('editDebtAccountSub', language)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingDebtId(null)}
                className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                aria-label={t('close', language)}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditDebt} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    {t('accountNameLabel', language)}
                  </label>
                  <input
                    type="text"
                    required
                    value={editDebtForm.name}
                    onChange={(e) =>
                      setEditDebtForm((prev) => ({
                        ...prev,
                        name: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    {t('lenderLabel', language)}
                  </label>
                  <input
                    type="text"
                    value={editDebtForm.lender}
                    onChange={(e) =>
                      setEditDebtForm((prev) => ({
                        ...prev,
                        lender: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    {t('categoryLabel', language)}
                  </label>
                  <select
                    value={editDebtForm.category}
                    onChange={(e) =>
                      setEditDebtForm((prev) => ({
                        ...prev,
                        category: e.target.value as DebtAccount['category'],
                      }))
                    }
                    className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
                  >
                    <option value="Credit Card">{t('debtCatCreditCard', language)}</option>
                    <option value="Student Loan">{t('debtCatStudentLoan', language)}</option>
                    <option value="Auto Loan">{t('debtCatAutoLoan', language)}</option>
                    <option value="Personal Loan">{t('debtCatPersonalLoan', language)}</option>
                    <option value="Mortgage">{t('debtCatMortgage', language)}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    {t('currentBalanceLabel', language, { currency })}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={editDebtForm.balance}
                    onChange={(e) =>
                      setEditDebtForm((prev) => ({
                        ...prev,
                        balance: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 text-xs tabular-nums rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    {t('originalBalanceLabel', language, { currency })}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editDebtForm.originalBalance}
                    onChange={(e) =>
                      setEditDebtForm((prev) => ({
                        ...prev,
                        originalBalance: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 text-xs tabular-nums rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    {t('aprPctLabel', language)}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={editDebtForm.apr}
                    onChange={(e) =>
                      setEditDebtForm((prev) => ({
                        ...prev,
                        apr: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 text-xs tabular-nums rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    {t('minimumPaymentLabel', language, { currency })}
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    required
                    value={editDebtForm.minimumPayment}
                    onChange={(e) =>
                      setEditDebtForm((prev) => ({
                        ...prev,
                        minimumPayment: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 text-xs tabular-nums rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    {t('dueDayFullLabel', language)}
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="28"
                    value={editDebtForm.dueDateDay}
                    onChange={(e) =>
                      setEditDebtForm((prev) => ({
                        ...prev,
                        dueDateDay: e.target.value,
                      }))
                    }
                    className="w-full px-3 py-2 text-xs tabular-nums rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-200 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setEditingDebtId(null)}
                  className="px-3.5 py-2 text-xs font-medium rounded-lg border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                >
                  {t('cancel', language)}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-medium rounded-lg bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors"
                >
                  {t('saveDebtChanges', language)}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Popup Modal: Undo / Revert Debt Payment & Adjust Balance */}
      {revertingPayment && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
          onClick={() => setRevertingPayment(null)}
        >
          <div
            className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 pb-4 border-b border-neutral-200 dark:border-neutral-800">
              <div>
                <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                  {t('undoDebtPaymentTitle', language)}
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 tabular-nums">
                  {t('undoDebtPaymentBody', language, {
                    amount: formatCurrency(revertingPayment.tx.amount, currency),
                    date: revertingPayment.tx.date,
                    name: revertingPayment.debt.name,
                  })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRevertingPayment(null)}
                className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors shrink-0"
                aria-label={t('close', language)}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={handleConfirmRevertPayment}
              className="mt-4 space-y-4"
            >
              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  {t('adjustedDebtBalance', language, { currency })}
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={revertingPayment.adjustedBalance}
                  onChange={(e) =>
                    setRevertingPayment((prev) =>
                      prev ? { ...prev, adjustedBalance: e.target.value } : null
                    )
                  }
                  className="w-full px-3 py-2 text-xs tabular-nums rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-200 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setRevertingPayment(null)}
                  className="px-3.5 py-2 text-xs font-medium rounded-lg border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                >
                  {t('keepPayment', language)}
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{t('confirmUndoUpdateDebt', language)}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Popup Modal: Adjust Payment Amount & Debt Balance */}
      {adjustingPayment && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
          onClick={() => setAdjustingPayment(null)}
        >
          <div
            className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 pb-4 border-b border-neutral-200 dark:border-neutral-800">
              <div>
                <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                  {t('adjustDebtPaymentTitle', language)}
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                  {t('adjustDebtPaymentBody', language, {
                    name: adjustingPayment.debt.name,
                  })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAdjustingPayment(null)}
                className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors shrink-0"
                aria-label={t('close', language)}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form
              onSubmit={handleSaveAdjustPayment}
              className="mt-4 space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    {t('paymentAmountLabel', language, { currency })}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={adjustingPayment.txAmount}
                    onChange={(e) => {
                      const val = e.target.value;
                      const parsed = parseFloat(val);
                      setAdjustingPayment((prev) => {
                        if (!prev) return null;
                        const nextBal =
                          !isNaN(parsed) && parsed > 0
                            ? Math.max(
                                0,
                                Number(
                                  (
                                    prev.debt.balance +
                                    (prev.tx.amount - parsed)
                                  ).toFixed(2)
                                )
                              )
                            : prev.debt.balance;
                        return {
                          ...prev,
                          txAmount: val,
                          adjustedBalance: String(nextBal),
                        };
                      });
                    }}
                    className="w-full px-3 py-2 text-xs tabular-nums rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    {t('paymentDateLabel', language)}
                  </label>
                  <input
                    type="date"
                    required
                    value={adjustingPayment.txDate}
                    onChange={(e) =>
                      setAdjustingPayment((prev) =>
                        prev ? { ...prev, txDate: e.target.value } : null
                      )
                    }
                    className="w-full px-3 py-2 text-xs tabular-nums rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                    {t('adjustedDebtBalance', language, { currency })}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={adjustingPayment.adjustedBalance}
                    onChange={(e) =>
                      setAdjustingPayment((prev) =>
                        prev
                          ? { ...prev, adjustedBalance: e.target.value }
                          : null
                      )
                    }
                    className="w-full px-3 py-2 text-xs tabular-nums rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-200 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setAdjustingPayment(null)}
                  className="px-3.5 py-2 text-xs font-medium rounded-lg border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                >
                  {t('cancel', language)}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-medium rounded-lg bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors"
                >
                  {t('saveAdjustment', language)}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Dynamic Month-by-Month Amortization Schedule Table */}
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
              {t('dynamicAmortizationSchedule', language)}
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              {t('dynamicAmortizationSub', language)}
            </p>
          </div>
          <span className="text-xs text-neutral-500 tabular-nums">
            {t('totalHorizonMonths', language, { count: sim.monthsToPayoffStrategy })}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-800 text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                <th className="py-2.5 pr-4">{t('colMonth', language)}</th>
                <th className="py-2.5 px-4 text-right">{t('colMonthlyPayment', language)}</th>
                <th className="py-2.5 px-4 text-right">{t('colCumPrincipal', language)}</th>
                <th className="py-2.5 px-4 text-right">{t('colCumInterest', language)}</th>
                <th className="py-2.5 px-4 text-right">
                  {t('colStrategyBalance', language, { strategy: strategyLabel })}
                </th>
                <th className="py-2.5 pl-4 text-right">{t('colBaselineBalance', language)}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/70 text-xs font-mono tabular-nums">
              {sim.schedule.slice(1, visibleScheduleRows + 1).map((row) => (
                <tr
                  key={row.monthIndex}
                  className="hover:bg-neutral-50/70 dark:hover:bg-neutral-800/40"
                >
                  <td className="py-2.5 pr-4 font-sans font-medium text-neutral-900 dark:text-neutral-100">
                    {row.label}{' '}
                    <span className="text-neutral-400 font-normal">
                      {t('chartMonthParen', language, { month: row.monthIndex })}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-right text-neutral-700 dark:text-neutral-300">
                    {formatCurrency(row.monthlyPaymentTotal, currency)}
                  </td>
                  <td className="py-2.5 px-4 text-right text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(row.totalPrincipalPaidStrategy, currency, {
                      maximumFractionDigits: 0,
                    })}
                  </td>
                  <td className="py-2.5 px-4 text-right text-neutral-600 dark:text-neutral-400">
                    {formatCurrency(row.totalInterestPaidStrategy, currency, {
                      maximumFractionDigits: 0,
                    })}
                  </td>
                  <td className="py-2.5 px-4 text-right font-semibold text-neutral-900 dark:text-neutral-100">
                    {formatCurrency(row.totalRemainingStrategy, currency, {
                      maximumFractionDigits: 0,
                    })}
                  </td>
                  <td className="py-2.5 pl-4 text-right text-neutral-400">
                    {formatCurrency(row.totalRemainingBaseline, currency, {
                      maximumFractionDigits: 0,
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {sim.schedule.length - 1 > visibleScheduleRows && (
          <div className="mt-4 pt-3 border-t border-neutral-100 dark:border-neutral-800 flex justify-center">
            <button
              onClick={() => setVisibleScheduleRows((r) => r + 24)}
              className="px-4 py-1.5 text-xs font-medium text-neutral-700 dark:text-neutral-300 hover:underline"
            >
              {t('showNext24Months', language, {
                count: sim.schedule.length - 1 - visibleScheduleRows,
              })}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
