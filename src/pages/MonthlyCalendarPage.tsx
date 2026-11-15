import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { formatCompactCurrency, formatCurrency } from '../utils/formatters';
import {
  getLocaleForLanguage,
  getLocalizedWeekdays,
  t,
} from '../utils/i18n';

function getLocalTodayStr(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export const MonthlyCalendarPage: React.FC = () => {
  const {
    data,
    selectedMonth,
    setSelectedMonth,
    openTxModal,
    openEditTxModal,
    deleteTransaction,
    markBillPaid,
  } = useFinance();

  const { currency, language } = data.settings;
  const todayStr = getLocalTodayStr();
  const [selectedDayStr, setSelectedDayStr] = useState<string>(() =>
    todayStr.startsWith(selectedMonth) ? todayStr : `${selectedMonth}-01`
  );

  // Parse year and month
  const [yearNum, monthNum] = useMemo(() => {
    const parts = selectedMonth.split('-');
    return [parseInt(parts[0], 10) || 2026, parseInt(parts[1], 10) || 11];
  }, [selectedMonth]);

  const monthLabel = useMemo(() => {
    const d = new Date(yearNum, monthNum - 1, 1);
    return d.toLocaleDateString(getLocaleForLanguage(language), {
      month: 'long',
      year: 'numeric',
    });
  }, [yearNum, monthNum, language]);

  const weekdays = useMemo(() => getLocalizedWeekdays(language), [language]);

  const changeMonth = (delta: number) => {
    const d = new Date(yearNum, monthNum - 1 + delta, 1);
    const nextYm = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
      2,
      '0'
    )}`;
    setSelectedMonth(nextYm);
    setSelectedDayStr(
      todayStr.startsWith(nextYm) ? todayStr : `${nextYm}-01`
    );
  };

  const jumpToToday = () => {
    const today = getLocalTodayStr();
    setSelectedMonth(today.slice(0, 7));
    setSelectedDayStr(today);
  };

  // Build calendar cells for the month
  const calendarDays = useMemo(() => {
    const firstDayOfWeek = new Date(yearNum, monthNum - 1, 1).getDay();
    const daysInMonth = new Date(yearNum, monthNum, 0).getDate();

    const cells: {
      dayNumber: number | null;
      dateStr: string | null;
      income: number;
      expense: number;
      net: number;
      txCount: number;
      billsDue: typeof data.bills;
      debtsDue: typeof data.debts;
    }[] = [];

    for (let i = 0; i < firstDayOfWeek; i++) {
      cells.push({
        dayNumber: null,
        dateStr: null,
        income: 0,
        expense: 0,
        net: 0,
        txCount: 0,
        billsDue: [],
        debtsDue: [],
      });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${selectedMonth}-${String(day).padStart(2, '0')}`;
      const dayTxs = data.transactions.filter((tx) => tx.date === dateStr);
      const income = dayTxs
        .filter((t) => t.type === 'income')
        .reduce((s, t) => s + t.amount, 0);
      const expense = dayTxs
        .filter((t) => t.type === 'expense')
        .reduce((s, t) => s + t.amount, 0);

      const billsDue = data.bills.filter(
        (b) => b.status === 'active' && b.nextDueDate === dateStr
      );
      const debtsDue = data.debts.filter(
        (d) => d.balance > 0 && d.dueDateDay === day
      );

      cells.push({
        dayNumber: day,
        dateStr,
        income,
        expense,
        net: income - expense,
        txCount: dayTxs.length,
        billsDue,
        debtsDue,
      });
    }

    return cells;
  }, [yearNum, monthNum, selectedMonth, data.transactions, data.bills, data.debts]);

  // Selected day details
  const selectedDayDetails = useMemo(() => {
    const dayNum = parseInt(selectedDayStr.slice(8, 10), 10) || 1;
    const txs = data.transactions.filter((tx) => tx.date === selectedDayStr);
    const bills = data.bills.filter(
      (b) => b.status === 'active' && b.nextDueDate === selectedDayStr
    );
    const debts = data.debts.filter(
      (d) => d.balance > 0 && d.dueDateDay === dayNum
    );
    const income = txs
      .filter((t) => t.type === 'income')
      .reduce((s, t) => s + t.amount, 0);
    const expense = txs
      .filter((t) => t.type === 'expense')
      .reduce((s, t) => s + t.amount, 0);

    return {
      txs,
      bills,
      debts,
      income,
      expense,
      net: income - expense,
    };
  }, [selectedDayStr, data.transactions, data.bills, data.debts]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
            {t('calendarTitle', language)}
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
            {t('calendarSub', language)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={jumpToToday}
            disabled={
              selectedDayStr === todayStr &&
              selectedMonth === todayStr.slice(0, 7)
            }
            title={t('jumpToTodayTooltip', language, { date: todayStr })}
            className="px-3 py-2 text-xs font-medium rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-default transition-colors whitespace-nowrap shrink-0"
          >
            {t('todayBtn', language)}
          </button>

          <div className="inline-flex items-center rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-1">
            <button
              onClick={() => changeMonth(-1)}
              className="p-1.5 rounded-md text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              aria-label={t('prevMonth', language)}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 text-xs font-semibold text-neutral-900 dark:text-neutral-100 min-w-[125px] text-center">
              {monthLabel}
            </span>
            <button
              onClick={() => changeMonth(1)}
              className="p-1.5 rounded-md text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              aria-label={t('nextMonth', language)}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => openTxModal(selectedDayStr)}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('logOnDate', language, { date: selectedDayStr.slice(5) })}</span>
          </button>
        </div>
      </div>

      {/* Main Split: 8-Col Calendar Grid + 4-Col Selected Day Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Calendar Grid */}
        <div className="lg:col-span-8 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-3 sm:p-5">
          {/* Legend */}
          <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-4 pb-3 sm:pb-4 mb-3 sm:mb-4 border-b border-neutral-100 dark:border-neutral-800 text-[11px] sm:text-xs text-neutral-500 dark:text-neutral-400">
            <div className="flex flex-wrap items-center gap-2.5 sm:gap-4">
              <span>
                <strong className="text-emerald-600 dark:text-emerald-400">
                  +$
                </strong>{' '}
                {t('inflowNet', language)}
              </span>
              <span aria-hidden="true">·</span>
              <span>
                <strong className="text-neutral-900 dark:text-neutral-200">
                  -$
                </strong>{' '}
                {t('outflowNet', language)}
              </span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block xl:hidden" />
                <span>{t('billDebtDue', language)}</span>
              </span>
            </div>
            <span className="hidden sm:inline">
              {t('clickDateInspect', language)}
            </span>
            <span className="sm:hidden text-[11px] text-neutral-400">
              {t('tapDateInspect', language)}
            </span>
          </div>

          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-1 sm:gap-1.5 mb-1.5 sm:mb-2 text-center text-[10px] sm:text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
            {weekdays.map((day, idx) => (
              <div key={idx} className="py-1">
                <span className="sm:hidden">{day.narrow}</span>
                <span className="hidden sm:inline">{day.short}</span>
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
            {calendarDays.map((cell, idx) => {
              if (!cell.dayNumber || !cell.dateStr) {
                return (
                  <div
                    key={`empty-${idx}`}
                    className="h-14 sm:h-20 xl:h-24 rounded-md sm:rounded-lg bg-neutral-50/40 dark:bg-neutral-950/30 border border-transparent"
                  />
                );
              }

              const isSelected = cell.dateStr === selectedDayStr;
              const isToday = cell.dateStr === todayStr;
              const hasReminders =
                cell.billsDue.length > 0 || cell.debtsDue.length > 0;
              const hasActivity = cell.income > 0 || cell.expense > 0;

              return (
                <button
                  key={cell.dateStr}
                  type="button"
                  onClick={() => setSelectedDayStr(cell.dateStr!)}
                  className={`h-14 sm:h-20 xl:h-24 p-1 sm:p-1.5 xl:p-2 rounded-md sm:rounded-lg border text-left flex flex-col justify-between overflow-hidden transition-all ${
                    isSelected
                      ? 'border-neutral-900 dark:border-neutral-100 bg-neutral-50 dark:bg-neutral-800/80 ring-1 ring-neutral-900 dark:ring-neutral-100'
                      : 'border-neutral-200/80 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600 bg-white dark:bg-neutral-900'
                  }`}
                >
                  {/* Top Row: Day number + compact indicators */}
                  <div className="flex items-center justify-between gap-0.5 w-full">
                    <span
                      className={`text-[11px] sm:text-xs tabular-nums font-semibold leading-none ${
                        isToday
                          ? 'text-emerald-600 dark:text-emerald-400 underline underline-offset-2'
                          : 'text-neutral-800 dark:text-neutral-200'
                      }`}
                    >
                      {cell.dayNumber}
                    </span>

                    <div className="flex items-center gap-1 shrink-0">
                      {hasReminders && (
                        <span
                          title={
                            cell.billsDue.length > 0
                              ? t('billDueTag', language, {
                                  name: cell.billsDue[0].name,
                                })
                              : t('debtDueTag', language, {
                                  name: cell.debtsDue[0].name,
                                })
                          }
                          className="w-1.5 h-1.5 rounded-full bg-amber-500 xl:hidden"
                        />
                      )}
                      {cell.txCount > 0 && (
                        <>
                          <span className="hidden xl:inline text-[10px] tabular-nums text-neutral-400">
                            {t('txCountCompact', language, { count: cell.txCount })}
                          </span>
                          <span className="hidden sm:inline xl:hidden text-[9px] tabular-nums font-medium text-neutral-400">
                            ·{cell.txCount}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Reminders label (only on spacious desktop cells) */}
                  <div className="hidden xl:block space-y-0.5 my-auto w-full overflow-hidden">
                    {hasReminders && (
                      <div className="text-[10px] font-medium text-amber-600 dark:text-amber-400 truncate">
                        {cell.billsDue.length > 0
                          ? t('billDueTag', language, {
                              name: cell.billsDue[0].name,
                            })
                          : t('debtDueTag', language, {
                              name: cell.debtsDue[0].name,
                            })}
                      </div>
                    )}
                  </div>

                  {/* Daily Net Cashflow */}
                  <div className="w-full text-right leading-none">
                    {hasActivity ? (
                      <span
                        className={`text-[10px] sm:text-[11px] sm:font-mono tabular-nums tracking-tight sm:tracking-normal font-semibold block truncate ${
                          cell.net > 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : cell.net < 0
                            ? 'text-neutral-900 dark:text-neutral-200'
                            : 'text-neutral-400'
                        }`}
                      >
                        {cell.net > 0 ? '+' : ''}
                        {formatCompactCurrency(cell.net, currency)}
                      </span>
                    ) : (
                      <span className="text-[10px] text-neutral-300 dark:text-neutral-700">
                        —
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right 4-Col Inspector: Selected Day Record & Reminders */}
        <div className="lg:col-span-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-neutral-200 dark:border-neutral-800">
            <div>
              <div className="text-xs text-neutral-500 dark:text-neutral-400">
                {t('selectedDateRecord', language)}
              </div>
              <h2 className="text-lg font-semibold tabular-nums text-neutral-900 dark:text-neutral-100 mt-0.5">
                {selectedDayStr}
              </h2>
            </div>
            <button
              onClick={() => openTxModal(selectedDayStr)}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200 transition-colors"
            >
              {t('addEntryBtn', language)}
            </button>
          </div>

          {/* Daily Net Summary Strip */}
          <div className="grid grid-cols-3 gap-2 p-3 rounded-lg bg-neutral-50 dark:bg-neutral-950 border border-neutral-200/70 dark:border-neutral-800 text-xs">
            <div>
              <span className="text-neutral-500 block">{t('inflowLabel', language)}</span>
              <span className="font-mono tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">
                {formatCurrency(selectedDayDetails.income, currency)}
              </span>
            </div>
            <div>
              <span className="text-neutral-500 block">{t('outflowLabel', language)}</span>
              <span className="font-mono tabular-nums font-semibold text-neutral-900 dark:text-neutral-100">
                {formatCurrency(selectedDayDetails.expense, currency)}
              </span>
            </div>
            <div>
              <span className="text-neutral-500 block">{t('netFlowLabel', language)}</span>
              <span
                className={`font-mono tabular-nums font-semibold ${
                  selectedDayDetails.net >= 0
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {formatCurrency(selectedDayDetails.net, currency, {
                  showSign: true,
                })}
              </span>
            </div>
          </div>

          {/* Bills & Debt Reminders Due on Selected Day */}
          {(selectedDayDetails.bills.length > 0 ||
            selectedDayDetails.debts.length > 0) && (
            <div className="space-y-2.5">
              <div className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                {t('scheduledRemindersOn', language, {
                  date: selectedDayStr.slice(5),
                })}
              </div>

              {selectedDayDetails.bills.map((bill) => (
                <div
                  key={bill.id}
                  className="p-3 rounded-lg border border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20 flex items-center justify-between gap-2 text-xs"
                >
                  <div>
                    <div className="font-medium text-neutral-900 dark:text-neutral-100">
                      {t('billDuePrefix', language, { name: bill.name })}
                    </div>
                    <div className="text-neutral-500 dark:text-neutral-400 mt-0.5">
                      {bill.category} ·{' '}
                      {bill.autoPay
                        ? t('autoPayLabel', language)
                        : t('manualLabel', language)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono tabular-nums font-semibold text-neutral-900 dark:text-neutral-100">
                      {formatCurrency(bill.amount, currency)}
                    </span>
                    <button
                      onClick={() => markBillPaid(bill.id, selectedDayStr)}
                      title={t('markBillPaidDateTooltip', language)}
                      className="p-1 text-emerald-600 hover:bg-emerald-100/60 rounded"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}

              {selectedDayDetails.debts.map((debt) => (
                <div
                  key={debt.id}
                  className="p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 flex items-center justify-between gap-2 text-xs"
                >
                  <div>
                    <div className="font-medium text-neutral-900 dark:text-neutral-100">
                      {t('debtDuePrefix', language, { name: debt.name })}
                    </div>
                    <div className="text-neutral-500 dark:text-neutral-400 mt-0.5">
                      {debt.lender} · {t('aprPct', language, { apr: debt.apr })}
                    </div>
                  </div>
                  <span className="font-mono tabular-nums font-semibold text-neutral-900 dark:text-neutral-100">
                    {t('minAmount', language, {
                      amount: formatCurrency(debt.minimumPayment, currency),
                    })}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Transactions List for Selected Day */}
          <div className="space-y-2.5">
            <div className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
              {t('transactionsCount', language, {
                count: selectedDayDetails.txs.length,
              })}
            </div>

            {selectedDayDetails.txs.length === 0 ? (
              <div className="py-8 text-center text-xs text-neutral-500 dark:text-neutral-400 border border-dashed border-neutral-200 dark:border-neutral-800 rounded-lg">
                {t('noTxLoggedOn', language, { date: selectedDayStr })}
              </div>
            ) : (
              <div className="divide-y divide-neutral-100 dark:divide-neutral-800 text-xs">
                {selectedDayDetails.txs.map((tx) => (
                  <div
                    key={tx.id}
                    className="py-3 flex items-center justify-between gap-3 group"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-neutral-900 dark:text-neutral-100 truncate">
                        {tx.description}
                      </div>
                      <div className="text-neutral-500 dark:text-neutral-400 mt-0.5">
                        {tx.category} · {tx.paymentMethod}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={`font-mono tabular-nums font-semibold ${
                          tx.type === 'income'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-neutral-900 dark:text-neutral-100'
                        }`}
                      >
                        {formatCurrency(
                          tx.type === 'income' ? tx.amount : -tx.amount,
                          currency,
                          { showSign: true }
                        )}
                      </span>
                      <div className="flex items-center gap-0.5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => openEditTxModal(tx)}
                          className="p-1 text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors"
                          title={t('editTransaction', language)}
                          aria-label={t('editTransaction', language)}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteTransaction(tx.id)}
                          className="p-1 text-neutral-400 hover:text-rose-600 transition-colors"
                          title={t('deleteTransaction', language)}
                          aria-label={t('deleteTransaction', language)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
