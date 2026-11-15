import React, { useMemo, useState } from 'react';
import {
  Bell,
  CheckCircle2,
  Edit3,
  ExternalLink,
  PauseCircle,
  PlayCircle,
  Plus,
  RotateCcw,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { BillSubscription, Transaction } from '../types/finance';
import { formatCurrency, t } from '../utils/formatters';

function shiftDueByCycle(
  dateStr: string,
  cycle: BillSubscription['billingCycle'],
  direction: 1 | -1
): string {
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return dateStr;
  const [y, m, d] = parts;
  if (cycle === 'weekly') {
    return new Date(Date.UTC(y, m - 1, d + 7 * direction))
      .toISOString()
      .slice(0, 10);
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
  return new Date(
    Date.UTC(
      targetFirst.getUTCFullYear(),
      targetFirst.getUTCMonth(),
      Math.min(d, lastDay)
    )
  )
    .toISOString()
    .slice(0, 10);
}

export const BillsSubscriptionsPage: React.FC = () => {
  const {
    data,
    addBill,
    updateBill,
    deleteBill,
    markBillPaid,
    revertBillPayment,
    updateBillPayment,
    changeBillStatus,
  } = useFinance();

  const { currency, language } = data.settings;

  const getCycleLabel = (cycle: BillSubscription['billingCycle']) => {
    switch (cycle) {
      case 'monthly':
        return t('cycleMonthly', language);
      case 'yearly':
        return t('cycleYearly', language);
      case 'quarterly':
        return t('cycleQuarterly', language);
      case 'weekly':
        return t('cycleWeekly', language);
    }
  };

  const getStatusLabel = (status: BillSubscription['status']) => {
    switch (status) {
      case 'active':
        return t('statusActive', language);
      case 'paused':
        return t('statusPaused', language);
      case 'cancelled':
        return t('statusCancelled', language);
    }
  };

  const [statusFilter, setStatusFilter] = useState<
    'all' | 'active' | 'paused' | 'cancelled'
  >('all');

  // New Bill / Subscription Drawer
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [billingCycle, setBillingCycle] = useState<
    'monthly' | 'yearly' | 'quarterly' | 'weekly'
  >('monthly');
  const [nextDueDate, setNextDueDate] = useState('2026-11-20');
  const [category, setCategory] = useState('Subscriptions & Media');
  const [autoPay, setAutoPay] = useState(true);
  const [reminderDays, setReminderDays] = useState('3');
  const [providerUrl, setProviderUrl] = useState('');

  // Edit Bill State
  const [editingBillId, setEditingBillId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    name: string;
    amount: string;
    billingCycle: 'monthly' | 'yearly' | 'quarterly' | 'weekly';
    nextDueDate: string;
    category: string;
    autoPay: boolean;
    reminderDaysBefore: string;
    status: 'active' | 'paused' | 'cancelled';
    providerUrl: string;
    notes: string;
  }>({
    name: '',
    amount: '',
    billingCycle: 'monthly',
    nextDueDate: '',
    category: 'Subscriptions & Media',
    autoPay: true,
    reminderDaysBefore: '3',
    status: 'active',
    providerUrl: '',
    notes: '',
  });
  const [syncLatestTxOnEdit, setSyncLatestTxOnEdit] = useState(false);

  // Revert Bill Transaction + Adjust Bill State
  const [revertingTxState, setRevertingTxState] = useState<{
    tx: Transaction;
    bill: BillSubscription;
    adjustedAmount: string;
    adjustedDueDate: string;
  } | null>(null);

  // Adjust Logged Bill Payment State
  const [editingPaymentTxId, setEditingPaymentTxId] = useState<string | null>(
    null
  );
  const [editPaymentForm, setEditPaymentForm] = useState<{
    txAmount: string;
    txDate: string;
    billAmount: string;
    billNextDueDate: string;
    syncBill: boolean;
  }>({
    txAmount: '',
    txDate: '',
    billAmount: '',
    billNextDueDate: '',
    syncBill: true,
  });

  // Normalize any cycle to monthly equivalent for accurate comparison
  const toMonthlyEquivalent = (bill: BillSubscription) => {
    if (bill.billingCycle === 'monthly') return bill.amount;
    if (bill.billingCycle === 'yearly') return bill.amount / 12;
    if (bill.billingCycle === 'quarterly') return bill.amount / 3;
    if (bill.billingCycle === 'weekly') return (bill.amount * 52) / 12;
    return bill.amount;
  };

  const metrics = useMemo(() => {
    const active = data.bills.filter((b) => b.status === 'active');
    const pausedOrCancelled = data.bills.filter((b) => b.status !== 'active');

    const monthlyRunRate = active.reduce(
      (sum, b) => sum + toMonthlyEquivalent(b),
      0
    );
    const annualProjection = monthlyRunRate * 12;
    const annualSavedFromCancelled = pausedOrCancelled.reduce(
      (sum, b) => sum + toMonthlyEquivalent(b) * 12,
      0
    );

    return {
      activeCount: active.length,
      monthlyRunRate,
      annualProjection,
      annualSavedFromCancelled,
    };
  }, [data.bills]);

  const filteredBills = useMemo(() => {
    return data.bills
      .filter((b) => (statusFilter === 'all' ? true : b.status === statusFilter))
      .sort((a, b) => a.nextDueDate.localeCompare(b.nextDueDate));
  }, [data.bills, statusFilter]);

  const billTransactions = useMemo(() => {
    return data.transactions
      .filter((t) => Boolean(t.linkedBillId))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [data.transactions]);

  const linkedTxsByBill = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    billTransactions.forEach((tx) => {
      if (!tx.linkedBillId) return;
      const list = map.get(tx.linkedBillId) || [];
      list.push(tx);
      map.set(tx.linkedBillId, list);
    });
    return map;
  }, [billTransactions]);

  const billById = useMemo(() => {
    const map = new Map<string, BillSubscription>();
    data.bills.forEach((b) => map.set(b.id, b));
    return map;
  }, [data.bills]);

  const handleAddBill = (e: React.FormEvent) => {
    e.preventDefault();
    const numAmt = parseFloat(amount);
    if (!name.trim() || isNaN(numAmt) || numAmt <= 0) return;

    addBill({
      name: name.trim(),
      amount: numAmt,
      billingCycle,
      nextDueDate,
      category,
      autoPay,
      reminderDaysBefore: parseInt(reminderDays, 10) || 3,
      status: 'active',
      providerUrl: providerUrl.trim() || undefined,
    });

    setName('');
    setAmount('');
    setProviderUrl('');
    setShowAddForm(false);
  };

  const cycleReminderDays = (bill: BillSubscription) => {
    const options = [1, 2, 3, 5, 7];
    const nextIdx = (options.indexOf(bill.reminderDaysBefore) + 1) % options.length;
    updateBill({ ...bill, reminderDaysBefore: options[nextIdx] });
  };

  const startEditBill = (bill: BillSubscription) => {
    setRevertingTxState(null);
    setEditingPaymentTxId(null);
    setEditingBillId(bill.id);
    setSyncLatestTxOnEdit(false);
    setEditForm({
      name: bill.name,
      amount: String(bill.amount),
      billingCycle: bill.billingCycle,
      nextDueDate: bill.nextDueDate,
      category: bill.category,
      autoPay: bill.autoPay,
      reminderDaysBefore: String(bill.reminderDaysBefore),
      status: bill.status,
      providerUrl: bill.providerUrl || '',
      notes: bill.notes || '',
    });
  };

  const handleSaveEditBill = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBillId) return;
    const targetBill = billById.get(editingBillId);
    if (!targetBill) return;

    const parsedAmount = parseFloat(editForm.amount);
    if (!editForm.name.trim() || isNaN(parsedAmount) || parsedAmount <= 0) {
      return;
    }

    updateBill({
      ...targetBill,
      name: editForm.name.trim(),
      amount: parsedAmount,
      billingCycle: editForm.billingCycle,
      nextDueDate: editForm.nextDueDate || targetBill.nextDueDate,
      category: editForm.category,
      autoPay: editForm.status === 'active' ? editForm.autoPay : false,
      reminderDaysBefore: parseInt(editForm.reminderDaysBefore, 10) || 3,
      status: editForm.status,
      providerUrl: editForm.providerUrl.trim() || undefined,
      notes: editForm.notes.trim() || undefined,
    });

    if (syncLatestTxOnEdit) {
      const latestTx = linkedTxsByBill.get(targetBill.id)?.[0];
      if (latestTx) {
        updateBillPayment(latestTx.id, {
          txAmount: parsedAmount,
          txDate: latestTx.date,
        });
      }
    }

    setEditingBillId(null);
    setSyncLatestTxOnEdit(false);
  };

  const openRevertTxPanel = (tx: Transaction) => {
    const bill = tx.linkedBillId ? billById.get(tx.linkedBillId) : undefined;
    if (!bill) {
      revertBillPayment(tx.id);
      return;
    }
    setEditingBillId(null);
    setEditingPaymentTxId(null);

    let suggestedDue = bill.nextDueDate;
    if (tx.previousDueDate) {
      suggestedDue = tx.previousDueDate;
    } else if (bill.nextDueDate > tx.date) {
      suggestedDue = shiftDueByCycle(bill.nextDueDate, bill.billingCycle, -1);
    }

    setRevertingTxState({
      tx,
      bill,
      adjustedAmount: String(bill.amount),
      adjustedDueDate: suggestedDue,
    });
  };

  const handleConfirmRevert = (e: React.FormEvent) => {
    e.preventDefault();
    if (!revertingTxState) return;
    const parsedAmount = parseFloat(revertingTxState.adjustedAmount);
    revertBillPayment(revertingTxState.tx.id, {
      amount:
        !isNaN(parsedAmount) && parsedAmount > 0 ? parsedAmount : undefined,
      nextDueDate: revertingTxState.adjustedDueDate || undefined,
    });
    setRevertingTxState(null);
  };

  const startEditPaymentTx = (tx: Transaction) => {
    const bill = tx.linkedBillId ? billById.get(tx.linkedBillId) : undefined;
    setEditingBillId(null);
    setRevertingTxState(null);
    setEditingPaymentTxId(tx.id);
    setEditPaymentForm({
      txAmount: String(tx.amount),
      txDate: tx.date,
      billAmount: String(bill ? bill.amount : tx.amount),
      billNextDueDate: bill ? bill.nextDueDate : tx.date,
      syncBill: Boolean(bill),
    });
  };

  const handleSavePaymentTx = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPaymentTxId) return;
    const txAmt = parseFloat(editPaymentForm.txAmount);
    if (isNaN(txAmt) || txAmt <= 0 || !editPaymentForm.txDate) return;

    const billAmt = parseFloat(editPaymentForm.billAmount);
    updateBillPayment(editingPaymentTxId, {
      txAmount: txAmt,
      txDate: editPaymentForm.txDate,
      billAmount:
        editPaymentForm.syncBill && !isNaN(billAmt) && billAmt > 0
          ? billAmt
          : undefined,
      billNextDueDate:
        editPaymentForm.syncBill && editPaymentForm.billNextDueDate
          ? editPaymentForm.billNextDueDate
          : undefined,
    });

    setEditingPaymentTxId(null);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
            {t('billsTitle', language)}
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
            {t('billsSub', language)}
          </p>
        </div>

        <button
          onClick={() => setShowAddForm((p) => !p)}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{t('addRecurringBill', language)}</span>
        </button>
      </div>

      {/* Add Bill Form */}
      {showAddForm && (
        <form
          onSubmit={handleAddBill}
          className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 space-y-4"
        >
          <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            {t('addRecurringBillTitle', language)}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs text-neutral-500 mb-1">
                {t('serviceUtilityName', language)}
              </label>
              <input
                type="text"
                required
                placeholder={t('servicePlaceholder', language)}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
              />
            </div>

            <div>
              <label className="block text-xs text-neutral-500 mb-1">
                {t('amountLabel', language, { currency })}
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                placeholder="19.99"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3 py-2 text-xs tabular-nums rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
              />
            </div>

            <div>
              <label className="block text-xs text-neutral-500 mb-1">
                {t('billingCycle', language)}
              </label>
              <select
                value={billingCycle}
                onChange={(e) =>
                  setBillingCycle(
                    e.target.value as
                      | 'monthly'
                      | 'yearly'
                      | 'quarterly'
                      | 'weekly'
                  )
                }
                className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
              >
                <option value="monthly">{t('cycleMonthly', language)}</option>
                <option value="yearly">{t('cycleYearly', language)}</option>
                <option value="quarterly">{t('cycleQuarterly', language)}</option>
                <option value="weekly">{t('cycleWeekly', language)}</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-neutral-500 mb-1">
                {t('nextDueDate', language)}
              </label>
              <input
                type="date"
                required
                value={nextDueDate}
                onChange={(e) => setNextDueDate(e.target.value)}
                className="w-full px-3 py-2 text-xs tabular-nums rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
              />
            </div>

            <div>
              <label className="block text-xs text-neutral-500 mb-1">
                {t('reminderLeadTime', language)}
              </label>
              <select
                value={reminderDays}
                onChange={(e) => setReminderDays(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
              >
                <option value="1">{t('dayBefore1', language)}</option>
                <option value="2">{t('daysBeforeN', language, { count: 2 })}</option>
                <option value="3">{t('daysBeforeN', language, { count: 3 })}</option>
                <option value="5">{t('daysBeforeN', language, { count: 5 })}</option>
                <option value="7">{t('daysBeforeN', language, { count: 7 })}</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-4">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="px-3 py-1.5 text-xs rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
              >
                {data.categories
                  .filter((c) => c.type === 'expense')
                  .map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
              </select>

              <input
                type="url"
                placeholder={t('cancelUrlOptional', language)}
                value={providerUrl}
                onChange={(e) => setProviderUrl(e.target.value)}
                className="px-3 py-1.5 text-xs rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
              />

              <label className="inline-flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoPay}
                  onChange={(e) => setAutoPay(e.target.checked)}
                />
                <span>{t('autoPayEnabled', language)}</span>
              </label>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-3 py-1.5 text-xs text-neutral-500"
              >
                {t('cancel', language)}
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-medium rounded-lg bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900"
              >
                {t('saveRecurringBill', language)}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* KPI Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
          <div className="text-xs text-neutral-500 dark:text-neutral-400">
            {t('activeMonthlyRunRate', language)}
          </div>
          <div className="mt-2 text-2xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
            {formatCurrency(metrics.monthlyRunRate, currency)}
          </div>
          <div className="mt-2 text-xs text-neutral-500 dark:text-neutral-400 tabular-nums">
            {t('acrossActiveServices', language, { count: metrics.activeCount })}
          </div>
        </div>

        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
          <div className="text-xs text-neutral-500 dark:text-neutral-400">
            {t('annualizedRecurringCost', language)}
          </div>
          <div className="mt-2 text-2xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
            {formatCurrency(metrics.annualProjection, currency, {
              maximumFractionDigits: 0,
            })}
          </div>
          <div className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
            {t('twelveMonthCommitment', language)}
          </div>
        </div>

        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
          <div className="text-xs text-neutral-500 dark:text-neutral-400">
            {t('annualSavingsCancelledPaused', language)}
          </div>
          <div className="mt-2 text-2xl font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
            {formatCurrency(metrics.annualSavedFromCancelled, currency, {
              maximumFractionDigits: 0,
            })}
          </div>
          <div className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
            {t('reclaimedCashflowYear', language)}
          </div>
        </div>

        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
          <div className="text-xs text-neutral-500 dark:text-neutral-400">
            {t('autoPayCoverage', language)}
          </div>
          <div className="mt-2 text-2xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
            {
              data.bills.filter((b) => b.status === 'active' && b.autoPay)
                .length
            }{' '}
            / {metrics.activeCount}
          </div>
          <div className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
            {t('automatedPaymentProtection', language)}
          </div>
        </div>
      </div>

      {/* Bills & Subscriptions Table with Cancellation & Reminder Controls */}
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div>
            <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
              {t('recurringServicesDirectory', language)}
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              {t('cycleReminderHint', language)}
            </p>
          </div>

          <div className="flex items-center gap-1 p-1 bg-neutral-100 dark:bg-neutral-800 rounded-lg">
            {(['all', 'active', 'paused', 'cancelled'] as const).map((st) => {
              const stLabel =
                st === 'all'
                  ? t('statusAll', language)
                  : st === 'active'
                  ? t('statusActive', language)
                  : st === 'paused'
                  ? t('statusPaused', language)
                  : t('statusCancelled', language);
              return (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    statusFilter === st
                      ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-2xs'
                      : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
                  }`}
                >
                  {stLabel}
                </button>
              );
            })}
          </div>
        </div>

        {/* Popup Modal: Edit Recurring Bill */}
        {editingBillId && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
            onClick={() => setEditingBillId(null)}
          >
            <div
              className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between pb-4 border-b border-neutral-200 dark:border-neutral-800">
                <div>
                  <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                    {t('editRecurringBill', language)}
                  </h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                    {t('editRecurringBillSub', language)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingBillId(null)}
                  className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                  aria-label={t('close', language)}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveEditBill} className="mt-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                      {t('serviceUtilityName', language)}
                    </label>
                    <input
                      type="text"
                      required
                      value={editForm.name}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          name: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                      {t('amountLabel', language, { currency })}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      value={editForm.amount}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          amount: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 text-xs tabular-nums rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                      {t('billingCycle', language)}
                    </label>
                    <select
                      value={editForm.billingCycle}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          billingCycle: e.target.value as
                            | 'monthly'
                            | 'yearly'
                            | 'quarterly'
                            | 'weekly',
                        }))
                      }
                      className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
                    >
                      <option value="monthly">{t('cycleMonthly', language)}</option>
                      <option value="yearly">{t('cycleYearly', language)}</option>
                      <option value="quarterly">{t('cycleQuarterly', language)}</option>
                      <option value="weekly">{t('cycleWeekly', language)}</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                      {t('nextDueDate', language)}
                    </label>
                    <input
                      type="date"
                      required
                      value={editForm.nextDueDate}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          nextDueDate: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 text-xs tabular-nums rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                      {t('statusLabel', language)}
                    </label>
                    <select
                      value={editForm.status}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          status: e.target.value as
                            | 'active'
                            | 'paused'
                            | 'cancelled',
                        }))
                      }
                      className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
                    >
                      <option value="active">{t('statusActive', language)}</option>
                      <option value="paused">{t('statusPaused', language)}</option>
                      <option value="cancelled">{t('statusCancelled', language)}</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                      {t('categoryLabel', language)}
                    </label>
                    <select
                      value={editForm.category}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          category: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
                    >
                      {data.categories
                        .filter((c) => c.type === 'expense')
                        .map((c) => (
                          <option key={c.id} value={c.name}>
                            {c.name}
                          </option>
                        ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                      {t('reminderLeadTime', language)}
                    </label>
                    <select
                      value={editForm.reminderDaysBefore}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          reminderDaysBefore: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
                    >
                      <option value="1">{t('dayBefore1', language)}</option>
                      <option value="2">{t('daysBeforeN', language, { count: 2 })}</option>
                      <option value="3">{t('daysBeforeN', language, { count: 3 })}</option>
                      <option value="5">{t('daysBeforeN', language, { count: 5 })}</option>
                      <option value="7">{t('daysBeforeN', language, { count: 7 })}</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                      {t('managementCancelUrl', language)}
                    </label>
                    <input
                      type="url"
                      placeholder="https://..."
                      value={editForm.providerUrl}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          providerUrl: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                      {t('notes', language)}
                    </label>
                    <input
                      type="text"
                      placeholder={t('notesPlanPlaceholder', language)}
                      value={editForm.notes}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          notes: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 pt-1">
                  <label className="inline-flex items-center gap-1.5 text-xs text-neutral-700 dark:text-neutral-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editForm.autoPay}
                      disabled={editForm.status !== 'active'}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          autoPay: e.target.checked,
                        }))
                      }
                    />
                    <span>{t('autoPayEnabled', language)}</span>
                  </label>

                  {(linkedTxsByBill.get(editingBillId)?.length || 0) > 0 && (
                    <label className="inline-flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={syncLatestTxOnEdit}
                        onChange={(e) =>
                          setSyncLatestTxOnEdit(e.target.checked)
                        }
                      />
                      <span>
                        {t('alsoUpdateLatestTx', language)}
                      </span>
                    </label>
                  )}
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-200 dark:border-neutral-800">
                  <button
                    type="button"
                    onClick={() => setEditingBillId(null)}
                    className="px-3.5 py-2 text-xs font-medium rounded-lg border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                  >
                    {t('cancel', language)}
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-medium rounded-lg bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors"
                  >
                    {t('saveBillChanges', language)}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Popup Modal: Revert Bill Transaction & Adjust Schedule */}
        {revertingTxState && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
            onClick={() => setRevertingTxState(null)}
          >
            <div
              className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3 pb-4 border-b border-neutral-200 dark:border-neutral-800">
                <div>
                  <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                    {t('revertBillTxTitle', language)}
                  </h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 tabular-nums">
                    {t('revertBillTxBody', language, {
                      desc: revertingTxState.tx.description,
                      date: revertingTxState.tx.date,
                      amount: formatCurrency(revertingTxState.tx.amount, currency),
                      bill: revertingTxState.bill.name,
                    })}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setRevertingTxState(null)}
                  className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors shrink-0"
                  aria-label={t('close', language)}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleConfirmRevert} className="mt-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                      {t('adjustedBillAmount', language, { currency })}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      required
                      value={revertingTxState.adjustedAmount}
                      onChange={(e) =>
                        setRevertingTxState((prev) =>
                          prev
                            ? { ...prev, adjustedAmount: e.target.value }
                            : null
                        )
                      }
                      className="w-full px-3 py-2 text-xs tabular-nums rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                      {t('adjustedNextDueDate', language)}
                    </label>
                    <input
                      type="date"
                      required
                      value={revertingTxState.adjustedDueDate}
                      onChange={(e) =>
                        setRevertingTxState((prev) =>
                          prev
                            ? { ...prev, adjustedDueDate: e.target.value }
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
                    onClick={() => setRevertingTxState(null)}
                    className="px-3.5 py-2 text-xs font-medium rounded-lg border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                  >
                    {t('keepPayment', language)}
                  </button>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors whitespace-nowrap"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>{t('confirmRevertUpdateBill', language)}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-800 text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                <th className="py-2.5 pr-4">{t('colServiceCategory', language)}</th>
                <th className="py-2.5 px-4">{t('colNextDueCycle', language)}</th>
                <th className="py-2.5 px-4">{t('colReminderAutoPay', language)}</th>
                <th className="py-2.5 px-4 text-right">{t('colAmount', language)}</th>
                <th className="py-2.5 px-4 text-right">{t('colAnnualImpact', language)}</th>
                <th className="py-2.5 pl-4 text-right">{t('colActions', language)}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/70 text-xs">
              {filteredBills.map((bill) => {
                const annualCost = toMonthlyEquivalent(bill) * 12;
                const linkedTxs = linkedTxsByBill.get(bill.id) || [];
                const latestTx = linkedTxs[0];
                return (
                  <tr
                    key={bill.id}
                    className={`transition-colors ${
                      bill.status === 'cancelled'
                        ? 'opacity-55 bg-neutral-50/40 dark:bg-neutral-950/30'
                        : 'hover:bg-neutral-50/70 dark:hover:bg-neutral-800/40'
                    }`}
                  >
                    <td className="py-3.5 pr-4">
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-medium ${
                            bill.status === 'cancelled'
                              ? 'line-through text-neutral-500'
                              : 'text-neutral-900 dark:text-neutral-100'
                          }`}
                        >
                          {bill.name}
                        </span>
                        {bill.providerUrl && (
                          <a
                            href={bill.providerUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                            title={t('openServiceUrlTooltip', language)}
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                      <div className="text-neutral-500 dark:text-neutral-400 mt-0.5">
                        <span>{bill.category}</span>
                        <span className="mx-1.5" aria-hidden="true">
                          ·
                        </span>
                        <span className="font-medium">
                          {getStatusLabel(bill.status)}
                        </span>
                        {bill.lastPaidDate && (
                          <>
                            <span className="mx-1.5" aria-hidden="true">
                              ·
                            </span>
                            <span className="tabular-nums">
                              {t('paidDateLabel', language, { date: bill.lastPaidDate })}
                            </span>
                          </>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 tabular-nums text-neutral-700 dark:text-neutral-300 whitespace-nowrap">
                      <div>{bill.nextDueDate}</div>
                      <div className="text-neutral-400 mt-0.5">
                        {getCycleLabel(bill.billingCycle)}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => cycleReminderDays(bill)}
                          className="inline-flex items-center gap-1 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100"
                          title={t('clickReminderTooltip', language)}
                        >
                          <Bell className="w-3.5 h-3.5" />
                          <span className="tabular-nums">
                            {t('reminderDaysShort', language, { days: bill.reminderDaysBefore })}
                          </span>
                        </button>
                        <span className="text-neutral-300 dark:text-neutral-700">
                          ·
                        </span>
                        <button
                          onClick={() =>
                            updateBill({ ...bill, autoPay: !bill.autoPay })
                          }
                          className={`text-xs font-medium ${
                            bill.autoPay
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-neutral-500'
                          }`}
                        >
                          {bill.autoPay ? t('autoPayOn', language) : t('manualPay', language)}
                        </button>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono tabular-nums font-semibold text-neutral-900 dark:text-neutral-100 whitespace-nowrap">
                      {formatCurrency(bill.amount, currency)}
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono tabular-nums text-neutral-500 dark:text-neutral-400 whitespace-nowrap">
                      {formatCurrency(annualCost, currency, {
                        maximumFractionDigits: 0,
                      })}
                      {t('perYearShort', language)}
                    </td>

                    <td className="py-3.5 pl-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => startEditBill(bill)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                          title={t('editBillTooltip', language)}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>{t('edit', language)}</span>
                        </button>

                        {latestTx && (
                          <button
                            onClick={() => openRevertTxPanel(latestTx)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-amber-200 dark:border-amber-900/60 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors"
                            title={t('revertPaymentTooltip', language, { date: latestTx.date })}
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>{t('revert', language)}</span>
                          </button>
                        )}

                        {bill.status === 'active' && (
                          <>
                            <button
                              onClick={() => markBillPaid(bill.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-neutral-200 dark:border-neutral-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 transition-colors"
                              title={t('payBillTooltip', language)}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>{t('payBtn', language)}</span>
                            </button>
                            <button
                              onClick={() => changeBillStatus(bill.id, 'paused')}
                              className="p-1.5 rounded-md text-neutral-500 hover:text-amber-600 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                              title={t('pauseSubTooltip', language)}
                            >
                              <PauseCircle className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() =>
                                changeBillStatus(bill.id, 'cancelled')
                              }
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                              title={t('cancelSubTooltip', language)}
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>{t('cancel', language)}</span>
                            </button>
                          </>
                        )}

                        {bill.status !== 'active' && (
                          <button
                            onClick={() => changeBillStatus(bill.id, 'active')}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                          >
                            <PlayCircle className="w-3.5 h-3.5" />
                            <span>{t('reactivateBtn', language)}</span>
                          </button>
                        )}

                        <button
                          onClick={() => deleteBill(bill.id)}
                          className="p-1.5 text-neutral-400 hover:text-rose-600"
                          title={t('deletePermanentlyTooltip', language)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Logged Bill Payment Transactions — Adjust or Revert */}
        <div className="mt-6 pt-5 border-t border-neutral-200 dark:border-neutral-800">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <div>
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                {t('loggedBillPayments', language)}
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {t('loggedBillPaymentsSub', language)}
              </p>
            </div>
            <span className="text-xs text-neutral-500 dark:text-neutral-400 tabular-nums">
              {t('loggedCountBadge', language, { count: billTransactions.length })}
            </span>
          </div>

          {billTransactions.length === 0 ? (
            <div className="rounded-lg border border-dashed border-neutral-200 dark:border-neutral-800 px-4 py-4 text-xs text-neutral-500 dark:text-neutral-400">
              {t('noLoggedBillPayments', language)}
            </div>
          ) : (
            <div className="divide-y divide-neutral-100 dark:divide-neutral-800/70">
              {billTransactions.map((tx) => {
                const linkedBill = tx.linkedBillId
                  ? billById.get(tx.linkedBillId)
                  : undefined;
                const isEditingThis = editingPaymentTxId === tx.id;

                return (
                  <div key={tx.id} className="py-3 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <div className="min-w-0">
                        <div className="font-medium text-neutral-900 dark:text-neutral-100 truncate">
                          {tx.description}
                        </div>
                        <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5 tabular-nums">
                          <span>{t('paidDateLabel', language, { date: tx.date })}</span>
                          <span className="mx-1.5" aria-hidden="true">
                            ·
                          </span>
                          <span>{tx.paymentMethod}</span>
                          {linkedBill && (
                            <>
                              <span className="mx-1.5" aria-hidden="true">
                                ·
                              </span>
                              <span>{t('nextDueInline', language, { date: linkedBill.nextDueDate })}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                        <span className="font-mono tabular-nums font-semibold text-neutral-900 dark:text-neutral-100">
                          -{formatCurrency(tx.amount, currency)}
                        </span>

                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => startEditPaymentTx(tx)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                            title={t('adjustPaymentTooltip', language)}
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>{t('adjust', language)}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => openRevertTxPanel(tx)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-amber-200 dark:border-amber-900/60 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors"
                            title={t('revertTxDueTooltip', language)}
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>{t('revert', language)}</span>
                          </button>
                        </div>
                      </div>
                    </div>

                    {isEditingThis && (
                      <form
                        onSubmit={handleSavePaymentTx}
                        className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50/70 dark:bg-neutral-950/60 p-3 space-y-3"
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                          <div>
                            <label className="block text-[11px] text-neutral-500 mb-1">
                              {t('paymentAmountLabel', language, { currency })}
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              min="0.01"
                              required
                              value={editPaymentForm.txAmount}
                              onChange={(e) =>
                                setEditPaymentForm((prev) => ({
                                  ...prev,
                                  txAmount: e.target.value,
                                  billAmount: prev.syncBill
                                    ? e.target.value
                                    : prev.billAmount,
                                }))
                              }
                              className="w-full px-2.5 py-1.5 text-xs tabular-nums rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
                            />
                          </div>

                          <div>
                            <label className="block text-[11px] text-neutral-500 mb-1">
                              {t('paymentDateLabel', language)}
                            </label>
                            <input
                              type="date"
                              required
                              value={editPaymentForm.txDate}
                              onChange={(e) =>
                                setEditPaymentForm((prev) => ({
                                  ...prev,
                                  txDate: e.target.value,
                                }))
                              }
                              className="w-full px-2.5 py-1.5 text-xs tabular-nums rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
                            />
                          </div>

                          {linkedBill && (
                            <>
                              <div>
                                <label className="block text-[11px] text-neutral-500 mb-1">
                                  {t('billRecurringAmountLabel', language, { currency })}
                                </label>
                                <input
                                  type="number"
                                  step="0.01"
                                  min="0.01"
                                  disabled={!editPaymentForm.syncBill}
                                  value={editPaymentForm.billAmount}
                                  onChange={(e) =>
                                    setEditPaymentForm((prev) => ({
                                      ...prev,
                                      billAmount: e.target.value,
                                    }))
                                  }
                                  className="w-full px-2.5 py-1.5 text-xs tabular-nums rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 disabled:opacity-50"
                                />
                              </div>

                              <div>
                                <label className="block text-[11px] text-neutral-500 mb-1">
                                  {t('billNextDueDateLabel', language)}
                                </label>
                                <input
                                  type="date"
                                  disabled={!editPaymentForm.syncBill}
                                  value={editPaymentForm.billNextDueDate}
                                  onChange={(e) =>
                                    setEditPaymentForm((prev) => ({
                                      ...prev,
                                      billNextDueDate: e.target.value,
                                    }))
                                  }
                                  className="w-full px-2.5 py-1.5 text-xs tabular-nums rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 disabled:opacity-50"
                                />
                              </div>
                            </>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2">
                          {linkedBill ? (
                            <label className="inline-flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-400 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={editPaymentForm.syncBill}
                                onChange={(e) =>
                                  setEditPaymentForm((prev) => ({
                                    ...prev,
                                    syncBill: e.target.checked,
                                  }))
                                }
                              />
                              <span>
                                {t('updateBillAccordingly', language, { name: linkedBill.name })}
                              </span>
                            </label>
                          ) : (
                            <span />
                          )}

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingPaymentTxId(null)}
                              className="px-2.5 py-1 text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
                            >
                              {t('cancel', language)}
                            </button>
                            <button
                              type="submit"
                              className="px-3 py-1 text-xs font-medium rounded-lg bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors"
                            >
                              {t('saveAdjustment', language)}
                            </button>
                          </div>
                        </div>
                      </form>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
