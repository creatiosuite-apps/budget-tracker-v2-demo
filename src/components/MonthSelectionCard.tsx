import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
} from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import {
  formatCurrency,
  getMonthlyExpenseBudget,
  getMonthlyIncomeBudget,
} from '../utils/formatters';
import {
  formatMonthOnlyName,
  formatMonthYearLabel,
  t,
} from '../utils/i18n';

const MONTH_NUMBERS = [
  '01',
  '02',
  '03',
  '04',
  '05',
  '06',
  '07',
  '08',
  '09',
  '10',
  '11',
  '12',
];

type GridMetricMode = 'expense' | 'income';

export const MonthSelectionCard: React.FC = () => {
  const { data, selectedMonth, setSelectedMonth } = useFinance();
  const { currency, language } = data.settings;

  const [selectedYearStr, selectedMonthNumStr] = selectedMonth.split('-');
  const selectedYear = parseInt(selectedYearStr, 10) || 2026;

  const [displayYear, setDisplayYear] = useState<number>(selectedYear);
  const [isGridOpen, setIsGridOpen] = useState<boolean>(true);
  const [gridMetric, setGridMetric] = useState<GridMetricMode>('expense');

  // Keep browsed year synced if selectedMonth changes elsewhere (e.g., calendar arrows)
  useEffect(() => {
    const yr = parseInt(selectedMonth.split('-')[0], 10);
    if (!Number.isNaN(yr)) {
      setDisplayYear(yr);
    }
  }, [selectedMonth]);

  // Selected month budgets (matching MonthlyBudgetPage summary cards exact)
  const activeExpenseBudget = useMemo(() => {
    return getMonthlyExpenseBudget(data.categories, selectedMonth);
  }, [data.categories, selectedMonth]);

  const activeIncomeBudget = useMemo(() => {
    return getMonthlyIncomeBudget(data.categories, selectedMonth);
  }, [data.categories, selectedMonth]);

  // Pre-aggregate expense & income totals + entry counts by YYYY-MM
  const monthlyStatsMap = useMemo(() => {
    const map: Record<string, { expense: number; income: number; count: number }> = {};
    data.transactions.forEach((tx) => {
      const ym = tx.date.slice(0, 7);
      if (!map[ym]) {
        map[ym] = { expense: 0, income: 0, count: 0 };
      }
      map[ym].count += 1;
      if (tx.type === 'expense') {
        map[ym].expense += tx.amount;
      } else {
        map[ym].income += tx.amount;
      }
    });
    return map;
  }, [data.transactions]);

  // Years that exist in transactions + selectedYear + displayYear
  const availableYears = useMemo(() => {
    const years = new Set<number>([selectedYear, displayYear]);
    data.transactions.forEach((tx) => {
      const yr = parseInt(tx.date.slice(0, 4), 10);
      if (!Number.isNaN(yr)) years.add(yr);
    });
    return Array.from(years).sort((a, b) => a - b);
  }, [data.transactions, selectedYear, displayYear]);

  // Active month actuals & utilization figures
  const activeStats = monthlyStatsMap[selectedMonth] || {
    expense: 0,
    income: 0,
    count: 0,
  };

  const expenseUtilizationPct =
    activeExpenseBudget > 0
      ? (activeStats.expense / activeExpenseBudget) * 100
      : 0;
  const expenseBarWidthPct = Math.min(100, Math.max(0, expenseUtilizationPct));
  const expenseRemaining = activeExpenseBudget - activeStats.expense;
  const isOverExpenseBudget =
    activeExpenseBudget > 0 && activeStats.expense > activeExpenseBudget;
  const isNearExpenseBudget =
    !isOverExpenseBudget && expenseUtilizationPct >= 85;

  const incomeRealizedPct =
    activeIncomeBudget > 0
      ? (activeStats.income / activeIncomeBudget) * 100
      : 0;
  const incomeBarWidthPct = Math.min(100, Math.max(0, incomeRealizedPct));

  const activeMonthLongLabel = useMemo(
    () => formatMonthYearLabel(selectedMonth, language, 'long'),
    [selectedMonth, language]
  );
  const activeMonthShortLabel = useMemo(
    () => formatMonthYearLabel(selectedMonth, language, 'short'),
    [selectedMonth, language]
  );

  // Build 12 month tiles for displayYear using each month's exact individual budgets
  const yearMonths = useMemo(() => {
    return MONTH_NUMBERS.map((num, idx) => {
      const ym = `${displayYear}-${num}`;
      const stats = monthlyStatsMap[ym] || { expense: 0, income: 0, count: 0 };
      const expenseBudget = getMonthlyExpenseBudget(data.categories, ym);
      const incomeBudget = getMonthlyIncomeBudget(data.categories, ym);
      const hasCustomBudget = data.categories.some(
        (c) =>
          c.monthlyOverrides &&
          Object.prototype.hasOwnProperty.call(c.monthlyOverrides, ym)
      );

      const actualVal = gridMetric === 'expense' ? stats.expense : stats.income;
      const plannedVal = gridMetric === 'expense' ? expenseBudget : incomeBudget;
      const pct = plannedVal > 0 ? (actualVal / plannedVal) * 100 : 0;

      return {
        num,
        short: formatMonthOnlyName(idx, language, 'short'),
        full: formatMonthOnlyName(idx, language, 'long'),
        ym,
        actualVal,
        plannedVal,
        hasCustomBudget,
        pct,
        isSelected: ym === selectedMonth,
      };
    });
  }, [
    displayYear,
    monthlyStatsMap,
    data.categories,
    selectedMonth,
    gridMetric,
    language,
  ]);

  return (
    <section
      aria-label={t('monthSelectorAria', language)}
      className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 sm:p-5 shadow-[0_6px_24px_-12px_rgba(15,23,42,0.06)] dark:shadow-none"
    >
      {/* Top Bar: Active Month Readout + Metric Switch + Year Selector + Grid Toggle */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200/70 dark:border-emerald-800/60 flex items-center justify-center shrink-0 text-emerald-700 dark:text-emerald-400">
            <CalendarDays className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                {activeMonthLongLabel}
              </h2>
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-md bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 tabular-nums">
                {activeStats.count}{' '}
                {t(
                  activeStats.count === 1 ? 'entrySingular' : 'entryPlural',
                  language
                )}
              </span>
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              {t('selectMonthHint', language, { year: displayYear })}
            </p>
          </div>
        </div>

        {/* Metric Switch + Year Switcher + Collapse Toggle */}
        <div className="flex items-center justify-between lg:justify-end gap-2 flex-wrap">
          {/* Grid Metric Toggle (Outflows vs Income) */}
          <div
            role="group"
            className="inline-flex items-center gap-0.5 p-1 rounded-lg bg-neutral-100/90 dark:bg-neutral-800/70 border border-neutral-200/70 dark:border-neutral-700/60"
          >
            {(
              [
                { id: 'expense', label: t('outflows', language) },
                { id: 'income', label: t('incomeLabel', language) },
              ] as const
            ).map((mode) => {
              const active = gridMetric === mode.id;
              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setGridMetric(mode.id)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md transition-all whitespace-nowrap ${
                    active
                      ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-2xs border border-neutral-200/70 dark:border-neutral-700/70'
                      : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 border border-transparent'
                  }`}
                >
                  {mode.label}
                </button>
              );
            })}
          </div>

          <div
            role="group"
            className="inline-flex items-center gap-1 p-1 rounded-lg bg-neutral-100/90 dark:bg-neutral-800/70 border border-neutral-200/70 dark:border-neutral-700/60"
          >
            <button
              type="button"
              onClick={() => setDisplayYear((y) => y - 1)}
              aria-label={t('previousYear', language)}
              className="p-1 rounded-md text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-white dark:hover:bg-neutral-900 transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            {availableYears.map((yr) => {
              const isViewing = yr === displayYear;
              return (
                <button
                  key={yr}
                  type="button"
                  onClick={() => setDisplayYear(yr)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md tabular-nums transition-all ${
                    isViewing
                      ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-2xs border border-neutral-200/70 dark:border-neutral-700/70'
                      : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 border border-transparent'
                  }`}
                >
                  {yr}
                </button>
              );
            })}

            <button
              type="button"
              onClick={() => setDisplayYear((y) => y + 1)}
              aria-label={t('nextYear', language)}
              className="p-1 rounded-md text-neutral-500 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-white dark:hover:bg-neutral-900 transition-colors"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => setIsGridOpen((prev) => !prev)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-neutral-200/80 dark:border-neutral-700/80 bg-neutral-50/80 dark:bg-neutral-800/60 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-600 hover:text-neutral-900 dark:hover:text-white active:scale-[0.98] transition-all whitespace-nowrap shrink-0"
          >
            <span>
              {isGridOpen
                ? t('hideMonths', language)
                : t('allMonths', language)}
            </span>
            {isGridOpen ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Selected Month Dual Progress Strip: Planned Income + Budgeted Outflows (exact parity with KPI cards below) */}
      <div className="mt-4 pt-3.5 border-t border-neutral-100 dark:border-neutral-800/80 grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Planned Income vs Actual Received */}
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs mb-1.5">
            <span className="font-medium text-neutral-700 dark:text-neutral-300">
              {t('plannedIncomeMonth', language, { monthYear: activeMonthShortLabel })}
            </span>
            <div className="tabular-nums text-neutral-600 dark:text-neutral-400">
              <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                {formatCurrency(activeStats.income, currency, {
                  maximumFractionDigits: 0,
                })}
              </span>
              <span>
                {' '}
                /{' '}
                {formatCurrency(activeIncomeBudget, currency, {
                  maximumFractionDigits: 0,
                })}{' '}
                ({incomeRealizedPct.toFixed(1)}%)
              </span>
            </div>
          </div>

          <div className="h-2 w-full rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
            <motion.div
              key={`month-income-bar-${selectedMonth}-${activeIncomeBudget}`}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: incomeBarWidthPct / 100 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              style={{ transformOrigin: 'left' }}
              className="h-full w-full rounded-full bg-emerald-600 dark:bg-emerald-500"
            />
          </div>
        </div>

        {/* Budgeted Outflows vs Actual Spent */}
        <div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs mb-1.5">
            <div className="flex items-center gap-2">
              <span className="font-medium text-neutral-700 dark:text-neutral-300">
                {t('budgetedOutflowsMonth', language, {
                  monthYear: activeMonthShortLabel,
                })}
              </span>
              <span
                className={`font-medium tabular-nums ${
                  isOverExpenseBudget
                    ? 'text-rose-600 dark:text-rose-400'
                    : isNearExpenseBudget
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-emerald-600 dark:text-emerald-400'
                }`}
              >
                {isOverExpenseBudget
                  ? t('overAmount', language, {
                      amount: formatCurrency(
                        Math.abs(expenseRemaining),
                        currency,
                        { maximumFractionDigits: 0 }
                      ),
                    })
                  : t('leftAmount', language, {
                      amount: formatCurrency(
                        Math.max(0, expenseRemaining),
                        currency,
                        { maximumFractionDigits: 0 }
                      ),
                    })}
              </span>
            </div>

            <div className="tabular-nums text-neutral-600 dark:text-neutral-400">
              <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                {formatCurrency(activeStats.expense, currency, {
                  maximumFractionDigits: 0,
                })}
              </span>
              <span>
                {' '}
                /{' '}
                {formatCurrency(activeExpenseBudget, currency, {
                  maximumFractionDigits: 0,
                })}{' '}
                ({expenseUtilizationPct.toFixed(1)}%)
              </span>
            </div>
          </div>

          <div className="h-2 w-full rounded-full bg-neutral-100 dark:bg-neutral-800 overflow-hidden">
            <motion.div
              key={`month-budget-bar-${selectedMonth}-${activeExpenseBudget}`}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: expenseBarWidthPct / 100 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              style={{ transformOrigin: 'left' }}
              className={`h-full w-full rounded-full ${
                isOverExpenseBudget
                  ? 'bg-rose-500 dark:bg-rose-500'
                  : isNearExpenseBudget
                  ? 'bg-amber-500 dark:bg-amber-400'
                  : 'bg-neutral-900 dark:bg-neutral-200'
              }`}
            />
          </div>
        </div>
      </div>

      {/* 12-Month Grid for displayYear with Exact Budget vs Actual Progress Bars */}
      {isGridOpen && (
        <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {yearMonths.map((m) => {
            const tileOver =
              gridMetric === 'expense' &&
              m.plannedVal > 0 &&
              m.actualVal > m.plannedVal;
            const tileNear =
              gridMetric === 'expense' && !tileOver && m.pct >= 85;
            const barPct = Math.min(100, Math.max(0, m.pct));

            return (
              <button
                key={m.ym}
                type="button"
                onClick={() => setSelectedMonth(m.ym)}
                aria-pressed={m.isSelected}
                className={`text-left rounded-lg border px-2.5 py-2 transition-all ${
                  m.isSelected
                    ? 'border-emerald-500/80 dark:border-emerald-500/70 bg-emerald-50/80 dark:bg-emerald-950/35 shadow-2xs'
                    : 'border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/40 hover:bg-neutral-100/80 dark:hover:bg-neutral-800/60 hover:border-neutral-300 dark:hover:border-neutral-700'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span
                    className={`inline-flex items-center gap-1 text-xs font-semibold ${
                      m.isSelected
                        ? 'text-emerald-900 dark:text-emerald-200'
                        : 'text-neutral-800 dark:text-neutral-200'
                    }`}
                  >
                    <span>{m.short}</span>
                    {m.hasCustomBudget && (
                      <span
                        title={t('customBudgetTooltip', language)}
                        className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block"
                      />
                    )}
                  </span>
                  <span
                    className={`text-[10px] tabular-nums font-medium ${
                      tileOver
                        ? 'text-rose-600 dark:text-rose-400'
                        : m.actualVal > 0
                        ? 'text-neutral-500 dark:text-neutral-400'
                        : 'text-neutral-400 dark:text-neutral-600'
                    }`}
                  >
                    {m.actualVal > 0 ? `${m.pct.toFixed(0)}%` : '—'}
                  </span>
                </div>

                <div className="mt-1 text-[11px] tabular-nums truncate">
                  <span
                    className={`font-medium ${
                      m.actualVal > 0
                        ? 'text-neutral-900 dark:text-neutral-100'
                        : 'text-neutral-400 dark:text-neutral-500'
                    }`}
                  >
                    {formatCurrency(m.actualVal, currency, {
                      maximumFractionDigits: 0,
                    })}
                  </span>
                  <span className="text-neutral-400 dark:text-neutral-500">
                    {' '}
                    /{' '}
                    {formatCurrency(m.plannedVal, currency, {
                      maximumFractionDigits: 0,
                    })}
                  </span>
                </div>

                <div className="mt-1.5 h-1 w-full rounded-full bg-neutral-200/80 dark:bg-neutral-800 overflow-hidden">
                  <div
                    style={{ width: `${barPct}%` }}
                    className={`h-full rounded-full transition-all duration-300 ${
                      gridMetric === 'income'
                        ? m.actualVal > 0
                          ? 'bg-emerald-600 dark:bg-emerald-500'
                          : 'bg-transparent'
                        : tileOver
                        ? 'bg-rose-500'
                        : tileNear
                        ? 'bg-amber-500'
                        : m.actualVal > 0
                        ? 'bg-emerald-600 dark:bg-emerald-500'
                        : 'bg-transparent'
                    }`}
                  />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
};
