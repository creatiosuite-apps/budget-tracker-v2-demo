import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import {
  AnimatedCashflowChart,
  MiniGradientSparkline,
} from '../components/Charts';
import { useFinance } from '../context/FinanceContext';
import { DEMO_LIMITS } from '../utils/demoLimits';
import {
  formatCurrency,
  getCategoryLimitForMonth,
  getMonthlyExpenseBudget,
} from '../utils/formatters';
import {
  formatMonthYearLabel,
  getLocalizedGroupLabel,
  t,
} from '../utils/i18n';

type KpiTimeframe = '1M' | '3M' | '6M' | '12M' | 'ALL';
type CashflowPeriod = '5d' | 'weekly' | '10d' | '15d' | 'monthly';

const CASHFLOW_PERIOD_KEYS: {
  id: CashflowPeriod;
  labelKey:
    | 'period5dLabel'
    | 'periodWeeklyLabel'
    | 'period10dLabel'
    | 'period15dLabel'
    | 'periodMonthlyLabel';
  subKey:
    | 'period5dSub'
    | 'periodWeeklySub'
    | 'period10dSub'
    | 'period15dSub'
    | 'periodMonthlySub';
}[] = [
  { id: '5d', labelKey: 'period5dLabel', subKey: 'period5dSub' },
  { id: 'weekly', labelKey: 'periodWeeklyLabel', subKey: 'periodWeeklySub' },
  { id: '10d', labelKey: 'period10dLabel', subKey: 'period10dSub' },
  { id: '15d', labelKey: 'period15dLabel', subKey: 'period15dSub' },
  { id: 'monthly', labelKey: 'periodMonthlyLabel', subKey: 'periodMonthlySub' },
];

const TIMEFRAME_OPTIONS: {
  id: KpiTimeframe;
  labelKey:
    | 'timeframe1M'
    | 'timeframe3M'
    | 'timeframe6M'
    | 'timeframe12M'
    | 'timeframeAll';
  months: number | null;
}[] = [
  { id: '1M', labelKey: 'timeframe1M', months: 1 },
  { id: '3M', labelKey: 'timeframe3M', months: 3 },
  { id: '6M', labelKey: 'timeframe6M', months: 6 },
  { id: '12M', labelKey: 'timeframe12M', months: 12 },
  { id: 'ALL', labelKey: 'timeframeAll', months: null },
];

function subtractMonthsFromYm(ym: string, offsetMonths: number): string {
  const [yStr, mStr] = ym.split('-');
  const y = parseInt(yStr, 10) || 2026;
  const m = parseInt(mStr, 10) || 11;
  const d = new Date(y, m - 1 - offsetMonths, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export const DashboardPage: React.FC = () => {
  const {
    data,
    selectedMonth,
    setActivePage,
    openTxModal,
    deleteTransaction,
    markBillPaid,
  } = useFinance();

  const { currency, language } = data.settings;
  const txLimitReached =
    data.transactions.length >= DEMO_LIMITS.MAX_TRANSACTIONS;
  const [kpiTimeframe, setKpiTimeframe] = useState<KpiTimeframe>('1M');
  const [cashflowPeriod, setCashflowPeriod] = useState<CashflowPeriod>('5d');
  const [txSearch, setTxSearch] = useState('');
  const [txScope, setTxScope] = useState<'month' | 'all'>('month');
  const [txTypeFilter, setTxTypeFilter] = useState<'all' | 'income' | 'expense'>(
    'all'
  );

  // Filter transactions for the selected month (used by monthly budget breakdown & velocity chart)
  const monthTransactions = useMemo(() => {
    return data.transactions.filter((tx) => tx.date.startsWith(selectedMonth));
  }, [data.transactions, selectedMonth]);

  // Filter transactions for the main KPI card timeframe (1M, 3M, 6M, 12M, All time)
  const kpiRangeMetrics = useMemo(() => {
    const activeOption =
      TIMEFRAME_OPTIONS.find((o) => o.id === kpiTimeframe) ||
      TIMEFRAME_OPTIONS[0];

    let scopedTransactions = data.transactions;
    let periodLabel = t('allRecordedPeriods', language);
    let spanMonths = 1;

    if (activeOption.months !== null) {
      const startYm = subtractMonthsFromYm(
        selectedMonth,
        activeOption.months - 1
      );
      scopedTransactions = data.transactions.filter((tx) => {
        const txYm = tx.date.slice(0, 7);
        return txYm >= startYm && txYm <= selectedMonth;
      });
      spanMonths = activeOption.months;
      periodLabel =
        activeOption.months === 1
          ? formatMonthYearLabel(selectedMonth, language, 'short')
          : `${formatMonthYearLabel(startYm, language, 'short')} – ${formatMonthYearLabel(selectedMonth, language, 'short')}`;
    } else if (data.transactions.length > 0) {
      const sortedDates = [...data.transactions]
        .map((tx) => tx.date.slice(0, 7))
        .sort();
      const firstYm = sortedDates[0];
      const lastYm = sortedDates[sortedDates.length - 1];
      periodLabel =
        firstYm === lastYm
          ? formatMonthYearLabel(firstYm, language, 'short')
          : `${formatMonthYearLabel(firstYm, language, 'short')} – ${formatMonthYearLabel(lastYm, language, 'short')}`;
      const uniqueMonths = new Set(sortedDates);
      spanMonths = Math.max(1, uniqueMonths.size);
    }

    const inflows = scopedTransactions.filter((tx) => tx.type === 'income');
    const outflows = scopedTransactions.filter((tx) => tx.type === 'expense');

    const totalIncome = inflows.reduce((acc, tx) => acc + tx.amount, 0);
    const totalExpenses = outflows.reduce((acc, tx) => acc + tx.amount, 0);
    const netCashflow = totalIncome - totalExpenses;
    const netMarginPct =
      totalIncome > 0 ? Math.max(-100, Math.min(100, (netCashflow / totalIncome) * 100)) : 0;

    return {
      totalIncome,
      totalExpenses,
      netCashflow,
      netMarginPct,
      inflowCount: inflows.length,
      outflowCount: outflows.length,
      totalCount: scopedTransactions.length,
      periodLabel,
      spanMonths,
      expenseRatioPct:
        totalIncome > 0 ? Math.min(100, (totalExpenses / totalIncome) * 100) : 0,
    };
  }, [data.transactions, selectedMonth, kpiTimeframe, language]);

  // Core monthly KPIs for secondary cards & monthly analytics
  const metrics = useMemo(() => {
    const totalIncome = monthTransactions
      .filter((tx) => tx.type === 'income')
      .reduce((acc, tx) => acc + tx.amount, 0);

    const totalExpenses = monthTransactions
      .filter((tx) => tx.type === 'expense')
      .reduce((acc, tx) => acc + tx.amount, 0);

    const netCashflow = totalIncome - totalExpenses;

    const savingsContributions = monthTransactions
      .filter(
        (tx) =>
          tx.category === 'Savings & Investments' || Boolean(tx.linkedGoalId)
      )
      .reduce((acc, tx) => acc + tx.amount, 0);

    const effectiveSavings = Math.max(
      savingsContributions,
      netCashflow > 0 ? netCashflow : 0
    );
    const savingsRate =
      totalIncome > 0 ? Math.min(100, (effectiveSavings / totalIncome) * 100) : 0;

    const totalExpenseBudget = getMonthlyExpenseBudget(
      data.categories,
      selectedMonth
    );

    const budgetUtilization =
      totalExpenseBudget > 0
        ? (totalExpenses / totalExpenseBudget) * 100
        : 0;

    const totalSavingsBalance = data.savingsGoals.reduce(
      (acc, g) => acc + g.currentAmount,
      0
    );
    const totalDebtBalance = data.debts.reduce((acc, d) => acc + d.balance, 0);

    return {
      totalIncome,
      totalExpenses,
      netCashflow,
      savingsRate,
      totalExpenseBudget,
      budgetUtilization,
      totalSavingsBalance,
      totalDebtBalance,
    };
  }, [
    monthTransactions,
    data.categories,
    data.savingsGoals,
    data.debts,
    selectedMonth,
  ]);

  // 6-month Savings Rate trend for Secondary KPI Card 1 sparkline
  const savingsRateSparkline = useMemo(() => {
    const pts: { label: string; value: number }[] = [];
    for (let offset = 5; offset >= 0; offset--) {
      const ym = subtractMonthsFromYm(selectedMonth, offset);
      const txs = data.transactions.filter((tx) => tx.date.startsWith(ym));
      const inc = txs
        .filter((tx) => tx.type === 'income')
        .reduce((s, tx) => s + tx.amount, 0);
      const exp = txs
        .filter((tx) => tx.type === 'expense')
        .reduce((s, tx) => s + tx.amount, 0);
      const savContrib = txs
        .filter(
          (tx) =>
            tx.category === 'Savings & Investments' || Boolean(tx.linkedGoalId)
        )
        .reduce((s, tx) => s + tx.amount, 0);
      const net = inc - exp;
      const effSav = Math.max(savContrib, net > 0 ? net : 0);
      const rate = inc > 0 ? Math.min(100, (effSav / inc) * 100) : 0;
      pts.push({ label: formatMonthYearLabel(ym, language, 'short'), value: rate });
    }
    return pts;
  }, [data.transactions, selectedMonth, language]);

  // 6-month Combined Goal Reserves trajectory for Secondary KPI Card 2 sparkline
  const reservesSparkline = useMemo(() => {
    const pts: { label: string; value: number }[] = [];
    for (let offset = 5; offset >= 0; offset--) {
      const ym = subtractMonthsFromYm(selectedMonth, offset);
      const endOfMonth = `${ym}-31`;
      let totalAtMonth = 0;
      data.savingsGoals.forEach((goal) => {
        const sortedHist = [...goal.history]
          .filter((h) => h.date <= endOfMonth)
          .sort((a, b) => a.date.localeCompare(b.date));
        if (sortedHist.length > 0) {
          totalAtMonth += sortedHist[sortedHist.length - 1].balanceAfter;
        }
      });
      pts.push({
        label: formatMonthYearLabel(ym, language, 'short'),
        value: totalAtMonth,
      });
    }
    return pts;
  }, [data.savingsGoals, selectedMonth, language]);

  // Build dynamic intra-month cashflow chart points for the chosen period
  const cashflowChartPoints = useMemo(() => {
    const [yStr, mStr] = selectedMonth.split('-');
    const year = parseInt(yStr, 10) || 2026;
    const month = parseInt(mStr, 10) || 11;
    const daysInMonth = new Date(year, month, 0).getDate();

    type Bucket = {
      label: string;
      shortLabel: string;
      min: number;
      max: number;
      income: number;
      expense: number;
      net: number;
    };

    let buckets: Bucket[] = [];

    if (cashflowPeriod === '5d') {
      buckets = [
        { label: t('daysBucketLabel', language, { range: '1–5' }), shortLabel: '1–5', min: 1, max: 5, income: 0, expense: 0, net: 0 },
        { label: t('daysBucketLabel', language, { range: '6–10' }), shortLabel: '6–10', min: 6, max: 10, income: 0, expense: 0, net: 0 },
        { label: t('daysBucketLabel', language, { range: '11–15' }), shortLabel: '11–15', min: 11, max: 15, income: 0, expense: 0, net: 0 },
        { label: t('daysBucketLabel', language, { range: '16–20' }), shortLabel: '16–20', min: 16, max: 20, income: 0, expense: 0, net: 0 },
        { label: t('daysBucketLabel', language, { range: '21–25' }), shortLabel: '21–25', min: 21, max: 25, income: 0, expense: 0, net: 0 },
        { label: t('daysBucketLabel', language, { range: `26–${daysInMonth}` }), shortLabel: `26–${daysInMonth}`, min: 26, max: 31, income: 0, expense: 0, net: 0 },
      ];
    } else if (cashflowPeriod === 'weekly') {
      buckets = [
        { label: t('weekBucketLabel', language, { num: 1, range: '1–7' }), shortLabel: t('weekBucketShort', language, { num: 1 }), min: 1, max: 7, income: 0, expense: 0, net: 0 },
        { label: t('weekBucketLabel', language, { num: 2, range: '8–14' }), shortLabel: t('weekBucketShort', language, { num: 2 }), min: 8, max: 14, income: 0, expense: 0, net: 0 },
        { label: t('weekBucketLabel', language, { num: 3, range: '15–21' }), shortLabel: t('weekBucketShort', language, { num: 3 }), min: 15, max: 21, income: 0, expense: 0, net: 0 },
        { label: t('weekBucketLabel', language, { num: 4, range: `22–${daysInMonth}` }), shortLabel: t('weekBucketShort', language, { num: 4 }), min: 22, max: 31, income: 0, expense: 0, net: 0 },
      ];
    } else if (cashflowPeriod === '10d') {
      buckets = [
        { label: t('daysBucketLabel', language, { range: '1–10' }), shortLabel: '1–10', min: 1, max: 10, income: 0, expense: 0, net: 0 },
        { label: t('daysBucketLabel', language, { range: '11–20' }), shortLabel: '11–20', min: 11, max: 20, income: 0, expense: 0, net: 0 },
        { label: t('daysBucketLabel', language, { range: `21–${daysInMonth}` }), shortLabel: `21–${daysInMonth}`, min: 21, max: 31, income: 0, expense: 0, net: 0 },
      ];
    } else if (cashflowPeriod === '15d') {
      buckets = [
        { label: t('daysBucketLabel', language, { range: '1–15' }), shortLabel: '1–15', min: 1, max: 15, income: 0, expense: 0, net: 0 },
        { label: t('daysBucketLabel', language, { range: `16–${daysInMonth}` }), shortLabel: `16–${daysInMonth}`, min: 16, max: 31, income: 0, expense: 0, net: 0 },
      ];
    } else {
      const mLabel = formatMonthYearLabel(selectedMonth, language, 'short');
      buckets = [
        {
          label: `${mLabel} (1–${daysInMonth})`,
          shortLabel: mLabel,
          min: 1,
          max: 31,
          income: 0,
          expense: 0,
          net: 0,
        },
      ];
    }

    monthTransactions.forEach((tx) => {
      const day = parseInt(tx.date.slice(8, 10), 10);
      const b = buckets.find((bucket) => day >= bucket.min && day <= bucket.max);
      if (b) {
        if (tx.type === 'income') b.income += tx.amount;
        else b.expense += tx.amount;
        b.net = b.income - b.expense;
      }
    });

    return buckets;
  }, [monthTransactions, cashflowPeriod, selectedMonth, language]);

  const activeCashflowPeriodMeta =
    CASHFLOW_PERIOD_KEYS.find((opt) => opt.id === cashflowPeriod) ||
    CASHFLOW_PERIOD_KEYS[0];

  // Spending by category breakdown
  const categorySpending = useMemo(() => {
    const map: Record<string, number> = {};
    monthTransactions
      .filter((tx) => tx.type === 'expense')
      .forEach((tx) => {
        map[tx.category] = (map[tx.category] || 0) + tx.amount;
      });

    return data.categories
      .filter((c) => c.type === 'expense')
      .map((cat) => {
        const effectiveLimit = getCategoryLimitForMonth(cat, selectedMonth);
        const spent = map[cat.name] || 0;
        const pctOfBudget =
          effectiveLimit > 0 ? (spent / effectiveLimit) * 100 : 0;
        const pctOfTotal =
          metrics.totalExpenses > 0
            ? (spent / metrics.totalExpenses) * 100
            : 0;
        return {
          ...cat,
          effectiveLimit,
          spent,
          pctOfBudget,
          pctOfTotal,
        };
      })
      .sort((a, b) => b.spent - a.spent);
  }, [monthTransactions, data.categories, metrics.totalExpenses, selectedMonth]);

  // Filtered recent transactions (supports active month or all synced months)
  const filteredTransactions = useMemo(() => {
    const base = txScope === 'all' ? data.transactions : monthTransactions;
    return base
      .filter((tx) => {
        if (txTypeFilter !== 'all' && tx.type !== txTypeFilter) return false;
        if (txSearch.trim()) {
          const q = txSearch.toLowerCase();
          return (
            tx.description.toLowerCase().includes(q) ||
            tx.category.toLowerCase().includes(q) ||
            tx.paymentMethod.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [txScope, data.transactions, monthTransactions, txTypeFilter, txSearch]);

  const activeBills = useMemo(() => {
    return data.bills
      .filter((b) => b.status === 'active')
      .sort((a, b) => a.nextDueDate.localeCompare(b.nextDueDate));
  }, [data.bills]);

  const formattedSelectedMonth = formatMonthYearLabel(
    selectedMonth,
    language,
    'short'
  );

  return (
    <div className="space-y-8">
      {/* Page Title & Action Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
            {t('dashboard', language)}
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
            {t('dashboardSubtitle', language, {
              household: data.settings.householdName,
              month: formattedSelectedMonth,
            })}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setActivePage('budget')}
            className="px-4 py-2 text-xs font-medium rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors whitespace-nowrap shrink-0"
          >
            {t('adjustBudgets', language)}
          </button>
          <button
            onClick={() => openTxModal()}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('addTransaction', language)}</span>
          </button>
        </div>
      </div>

      {/* Primary KPI Grid: Dominant Main Cashflow/Income/Expense Card + 2 Complementary KPI Cards */}
      <div className="grid grid-cols-1 max-md:landscape:grid-cols-2 md:grid-cols-2 lg:grid-cols-12 gap-4 items-stretch">
        {/* Main Hero KPI Card (6 columns) */}
        <div className="max-md:landscape:col-span-2 md:col-span-2 lg:col-span-6 rounded-xl border border-emerald-200/80 dark:border-emerald-500/35 dark:ring-1 dark:ring-emerald-400/20 bg-gradient-to-br from-[#ECFDF5] via-[#E3F9EF] to-[#D1FAE5] dark:from-[#0C201B] dark:via-[#0E2620] dark:to-[#112E26] shadow-[0_10px_30px_-10px_rgba(16,185,129,0.16),0_4px_12px_-4px_rgba(15,23,42,0.05)] dark:shadow-[0_0_28px_-4px_rgba(16,185,129,0.28),0_0_12px_-2px_rgba(52,211,153,0.18),inset_0_1px_0_0_rgba(110,231,183,0.18)] p-6 flex flex-col justify-between">
          <div>
            {/* Card Header + Filter Pill Control */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-xs font-medium text-emerald-900/75 dark:text-emerald-200/80">
                  {t('netCashflow', language)} · {t('totalBalance', language)}
                </span>
                <div className="text-[11px] text-emerald-800/60 dark:text-emerald-300/60 mt-0.5 tabular-nums">
                  {kpiRangeMetrics.periodLabel} ·{' '}
                  {t('entriesCount', language, {
                    count: kpiRangeMetrics.totalCount,
                  })}
                </div>
              </div>

              {/* Timeframe Segmented Filter Pill */}
              <div
                role="group"
                className="inline-flex items-center gap-0.5 p-1 rounded-full bg-white/70 dark:bg-black/30 backdrop-blur-xs self-start sm:self-auto"
              >
                {TIMEFRAME_OPTIONS.map((opt) => {
                  const isActive = kpiTimeframe === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setKpiTimeframe(opt.id)}
                      className={`px-3 py-1 text-xs font-medium rounded-full transition-all whitespace-nowrap shrink-0 ${
                        isActive
                          ? 'bg-white dark:bg-emerald-950 text-emerald-950 dark:text-emerald-50 shadow-xs'
                          : 'text-emerald-900/70 dark:text-emerald-200/70 hover:text-emerald-950 dark:hover:text-emerald-50'
                      }`}
                    >
                      {t(opt.labelKey, language)}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Hero Net Cashflow Figure */}
            <div className="mt-4 flex flex-wrap items-baseline gap-3">
              <div
                className={`text-3xl sm:text-4xl font-semibold tracking-tight tabular-nums ${
                  kpiRangeMetrics.netCashflow >= 0
                    ? 'text-emerald-800 dark:text-emerald-300'
                    : 'text-rose-700 dark:text-rose-400'
                }`}
              >
                {formatCurrency(kpiRangeMetrics.netCashflow, currency, {
                  showSign: true,
                })}
              </div>
              <span className="text-xs tabular-nums font-medium text-emerald-900/70 dark:text-emerald-200/75">
                {t('netMargin', language, {
                  pct: kpiRangeMetrics.netMarginPct.toFixed(1),
                })}
              </span>
            </div>
          </div>

          {/* Unified Income & Expense Sub-Metrics + Expense Ratio Bar */}
          <div className="mt-5 pt-4 border-t border-emerald-200/70 dark:border-emerald-800/60 space-y-4">
            <div className="grid grid-cols-2 gap-6">
              {/* Income */}
              <div>
                <div className="flex items-center gap-1.5 text-xs text-emerald-900/75 dark:text-emerald-200/80">
                  <ArrowUpRight className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                  <span>
                    {kpiTimeframe === '1M'
                      ? t('totalIncome', language)
                      : t('totalIncomeAll', language)}
                  </span>
                </div>
                <div className="mt-1 text-xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-50">
                  {formatCurrency(kpiRangeMetrics.totalIncome, currency)}
                </div>
                <div className="mt-0.5 text-[11px] text-emerald-900/65 dark:text-emerald-200/65 tabular-nums">
                  {t('inflowsCount', language, {
                    count: kpiRangeMetrics.inflowCount,
                  })}
                  {kpiRangeMetrics.spanMonths > 1 && (
                    <>
                      <span className="mx-1.5" aria-hidden="true">
                        ·
                      </span>
                      <span>
                        {t('avgPerMonth', language, {
                          amount: formatCurrency(
                            kpiRangeMetrics.totalIncome /
                              kpiRangeMetrics.spanMonths,
                            currency,
                            { maximumFractionDigits: 0 }
                          ),
                        })}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Expenses */}
              <div>
                <div className="flex items-center gap-1.5 text-xs text-emerald-900/75 dark:text-emerald-200/80">
                  <ArrowDownRight className="w-3.5 h-3.5 text-emerald-800/70 dark:text-emerald-300/70" />
                  <span>
                    {kpiTimeframe === '1M'
                      ? t('totalExpenses', language)
                      : t('totalExpensesAll', language)}
                  </span>
                </div>
                <div className="mt-1 text-xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-50">
                  {formatCurrency(kpiRangeMetrics.totalExpenses, currency)}
                </div>
                <div className="mt-0.5 text-[11px] text-emerald-900/65 dark:text-emerald-200/65 tabular-nums">
                  {t('outflowsCount', language, {
                    count: kpiRangeMetrics.outflowCount,
                  })}
                  {kpiRangeMetrics.spanMonths > 1 && (
                    <>
                      <span className="mx-1.5" aria-hidden="true">
                        ·
                      </span>
                      <span>
                        {t('avgPerMonth', language, {
                          amount: formatCurrency(
                            kpiRangeMetrics.totalExpenses /
                              kpiRangeMetrics.spanMonths,
                            currency,
                            { maximumFractionDigits: 0 }
                          ),
                        })}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Expense-to-Income Ratio Bar */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] text-emerald-900/70 dark:text-emerald-200/75 tabular-nums">
                <span>{t('expenseToIncomeRatio', language)}</span>
                <span>
                  {t('pctSpent', language, {
                    pct: kpiRangeMetrics.expenseRatioPct.toFixed(1),
                  })}
                </span>
              </div>
              <div className="h-1.5 w-full bg-white/70 dark:bg-emerald-200/20 dark:ring-1 dark:ring-emerald-300/15 rounded-full overflow-hidden">
                <motion.div
                  key={`ratio-${kpiTimeframe}`}
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: kpiRangeMetrics.expenseRatioPct / 100 }}
                  transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                  style={{ transformOrigin: 'left' }}
                  className={`h-full w-full rounded-full ${
                    kpiRangeMetrics.expenseRatioPct > 90
                      ? 'bg-rose-600 dark:bg-rose-500'
                      : 'bg-emerald-700 dark:bg-emerald-400'
                  }`}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Secondary KPI Card 1 (3 columns): Monthly Budget & Savings Rate */}
        <div className="max-md:landscape:col-span-1 md:col-span-1 lg:col-span-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
              <span>{t('savingsRate', language)}</span>
              <button
                onClick={() => setActivePage('budget')}
                className="px-2.5 py-1 text-xs font-medium rounded-lg border border-neutral-200/80 dark:border-neutral-700/80 bg-neutral-50/80 dark:bg-neutral-800/60 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-600 hover:text-neutral-900 dark:hover:text-white active:scale-[0.98] transition-all whitespace-nowrap shrink-0"
              >
                {t('budgetShortBtn', language)}
              </button>
            </div>
            <div className="mt-3 text-2xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
              {metrics.savingsRate.toFixed(1)}%
            </div>
            <div className="mt-1.5 text-xs text-neutral-500 dark:text-neutral-400 tabular-nums">
              {t('pctOfMonthlyCap', language, {
                pct: metrics.budgetUtilization.toFixed(1),
                amount: formatCurrency(metrics.totalExpenseBudget, currency, {
                  maximumFractionDigits: 0,
                }),
              })}
            </div>
          </div>

          <MiniGradientSparkline
            points={savingsRateSparkline}
            color="#059669"
            gradientId="kpi-savings-rate-grad"
            caption={t('savingsRate6MCaption', language)}
            formatValue={(v) => `${v.toFixed(1)}%`}
            language={language}
          />

          <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800 space-y-1 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-neutral-500 dark:text-neutral-400">
                {t('remainingCap', language)}
              </span>
              <span className="font-mono tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">
                {formatCurrency(
                  Math.max(0, metrics.totalExpenseBudget - metrics.totalExpenses),
                  currency,
                  { maximumFractionDigits: 0 }
                )}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-neutral-500 dark:text-neutral-400">
                {t('activeMonth', language)}
              </span>
              <span className="tabular-nums text-neutral-800 dark:text-neutral-200 font-medium">
                {formattedSelectedMonth}
              </span>
            </div>
          </div>
        </div>

        {/* Secondary KPI Card 2 (3 columns): Goal Reserves vs Debt */}
        <div className="max-md:landscape:col-span-1 md:col-span-1 lg:col-span-3 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
              <span>{t('goalReservesVsDebt', language)}</span>
              <button
                onClick={() => setActivePage('savings')}
                className="px-2.5 py-1 text-xs font-medium rounded-lg border border-neutral-200/80 dark:border-neutral-700/80 bg-neutral-50/80 dark:bg-neutral-800/60 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-600 hover:text-neutral-900 dark:hover:text-white active:scale-[0.98] transition-all whitespace-nowrap shrink-0"
              >
                {t('viewGoals', language)}
              </button>
            </div>
            <div className="mt-3 text-2xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
              {formatCurrency(metrics.totalSavingsBalance, currency, {
                maximumFractionDigits: 0,
              })}
            </div>
            <div className="mt-1.5 text-xs text-neutral-500 dark:text-neutral-400 tabular-nums">
              {t('acrossActiveGoals', language, {
                count: data.savingsGoals.length,
              })}
            </div>
          </div>

          <MiniGradientSparkline
            points={reservesSparkline}
            color="#2563EB"
            gradientId="kpi-reserves-grad"
            caption={t('reserves6MCaption', language)}
            formatValue={(v) =>
              formatCurrency(v, currency, { maximumFractionDigits: 0 })
            }
            language={language}
          />

          <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800 space-y-1 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-neutral-500 dark:text-neutral-400">
                {t('totalDebt', language)}
              </span>
              <span className="font-mono tabular-nums font-semibold text-neutral-900 dark:text-neutral-100">
                {formatCurrency(metrics.totalDebtBalance, currency, {
                  maximumFractionDigits: 0,
                })}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-neutral-500 dark:text-neutral-400">
                {t('netReserveRatio', language)}
              </span>
              <span className="tabular-nums text-emerald-600 dark:text-emerald-400 font-medium">
                {metrics.totalDebtBalance > 0
                  ? t('pctCovered', language, {
                      pct: (
                        (metrics.totalSavingsBalance / metrics.totalDebtBalance) *
                        100
                      ).toFixed(0),
                    })
                  : t('debtFree', language)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Analytics Row: Cashflow Chart + Category Budget Utilization */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left 7 cols: Intra-Month Cashflow Velocity */}
        <div className="lg:col-span-7 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-start sm:items-center justify-between gap-3 mb-3">
              <div>
                <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                  {t('cashflowVelocity', language, {
                    month: formattedSelectedMonth,
                  })}
                </h2>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                  {t(activeCashflowPeriodMeta.subKey, language)}
                </p>
              </div>
              <button
                onClick={() => setActivePage('calendar')}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border border-neutral-200/80 dark:border-neutral-700/80 bg-neutral-50/80 dark:bg-neutral-800/60 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-600 hover:text-neutral-900 dark:hover:text-white active:scale-[0.98] transition-all whitespace-nowrap shrink-0"
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>{t('openCalendar', language)}</span>
              </button>
            </div>

            {/* Period Interval Selector */}
            <div className="flex items-center justify-between gap-2 mb-4">
              <div
                role="group"
                className="inline-flex flex-wrap items-center gap-1 p-1 rounded-lg bg-neutral-100/90 dark:bg-neutral-800/70 border border-neutral-200/70 dark:border-neutral-700/60"
              >
                {CASHFLOW_PERIOD_KEYS.map((opt) => {
                  const isActive = cashflowPeriod === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setCashflowPeriod(opt.id)}
                      className={`px-2.5 py-1 text-[11px] sm:text-xs font-medium rounded-md transition-all whitespace-nowrap shrink-0 ${
                        isActive
                          ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-2xs border border-neutral-200/70 dark:border-neutral-700/70'
                          : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 border border-transparent'
                      }`}
                    >
                      {t(opt.labelKey, language)}
                    </button>
                  );
                })}
              </div>
            </div>

            <AnimatedCashflowChart
              key={`${selectedMonth}-${cashflowPeriod}-${language}`}
              points={cashflowChartPoints}
              currency={currency}
              language={language}
            />
          </div>

          <div className="mt-8 pt-4 border-t border-neutral-100 dark:border-neutral-800/80 grid grid-cols-3 gap-4 text-xs">
            <div>
              <span className="text-neutral-500 dark:text-neutral-400 block">
                {t('dailyAvgSpend', language)}
              </span>
              <span className="font-semibold tabular-nums text-neutral-900 dark:text-neutral-100 mt-0.5 block">
                {t('perDay', language, {
                  amount: formatCurrency(metrics.totalExpenses / 30, currency),
                })}
              </span>
            </div>
            <div>
              <span className="text-neutral-500 dark:text-neutral-400 block">
                {t('fixedRecurringBills', language)}
              </span>
              <span className="font-semibold tabular-nums text-neutral-900 dark:text-neutral-100 mt-0.5 block">
                {t('perMonth', language, {
                  amount: formatCurrency(
                    activeBills.reduce((s, b) => s + b.amount, 0),
                    currency
                  ),
                })}
              </span>
            </div>
            <div>
              <span className="text-neutral-500 dark:text-neutral-400 block">
                {t('debtPayoffStrategy', language)}
              </span>
              <button
                onClick={() => setActivePage('debt')}
                className="font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5 block hover:underline"
              >
                {data.settings.debtStrategy === 'avalanche'
                  ? t('avalancheName', language)
                  : t('snowballName', language)}{' '}
                (+
                {t('perMonth', language, {
                  amount: formatCurrency(
                    data.settings.extraDebtPayment,
                    currency,
                    { maximumFractionDigits: 0 }
                  ),
                })}
                )
              </button>
            </div>
          </div>
        </div>

        {/* Right 5 cols: Category Spending Breakdown with Animated Bars */}
        <div className="lg:col-span-5 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                  {t('allocationByCategory', language)}
                </h2>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                  {t('actualSpendVsCap', language)}
                </p>
              </div>
              <button
                onClick={() => setActivePage('budget')}
                className="px-2.5 py-1 text-xs font-medium rounded-lg border border-neutral-200/80 dark:border-neutral-700/80 bg-neutral-50/80 dark:bg-neutral-800/60 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-600 hover:text-neutral-900 dark:hover:text-white active:scale-[0.98] transition-all whitespace-nowrap shrink-0"
              >
                {t('manageAll', language)}
              </button>
            </div>

            <div className="space-y-3.5">
              {categorySpending.slice(0, 6).map((cat, idx) => {
                const clampedPct = Math.min(100, cat.pctOfBudget);
                const isOver = cat.spent > cat.effectiveLimit;
                return (
                  <div key={cat.id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-xs shrink-0"
                          style={{ backgroundColor: cat.color }}
                        />
                        <span className="font-medium text-neutral-800 dark:text-neutral-200">
                          {cat.name}
                        </span>
                        <span className="text-neutral-400 dark:text-neutral-500">
                          · {getLocalizedGroupLabel(cat.group, language)}
                        </span>
                      </div>
                      <div className="tabular-nums text-neutral-700 dark:text-neutral-300">
                        <span
                          className={
                            isOver
                              ? 'text-rose-600 dark:text-rose-400 font-semibold'
                              : 'font-medium'
                          }
                        >
                          {formatCurrency(cat.spent, currency, {
                            maximumFractionDigits: 0,
                          })}
                        </span>
                        <span className="text-neutral-400">
                          {' '}
                          /{' '}
                          {formatCurrency(cat.effectiveLimit, currency, {
                            maximumFractionDigits: 0,
                          })}
                        </span>
                      </div>
                    </div>

                    <div className="h-1.5 w-full bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: clampedPct / 100 }}
                        transition={{
                          duration: 0.5,
                          delay: idx * 0.05,
                          ease: [0.16, 1, 0.3, 1],
                        }}
                        style={{
                          transformOrigin: 'left',
                          backgroundColor: isOver ? '#E11D48' : cat.color,
                        }}
                        className="h-full w-full rounded-full"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-neutral-100 dark:border-neutral-800/80 flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
            <span>
              {t('totalTrackedCategories', language, {
                count: categorySpending.length,
              })}
            </span>
            <span className="tabular-nums font-medium text-neutral-900 dark:text-neutral-100">
              {t('pctBudgetUsed', language, {
                pct: metrics.budgetUtilization.toFixed(1),
              })}
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Row: Upcoming Bills & Saving Goals Snapshot + Recent Transactions Ledger */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left 8 cols: Recent Transactions Table */}
        <div className="lg:col-span-8 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                {t('recentTransactions', language)}
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5 tabular-nums">
                Demo ledger · {data.transactions.length} /{' '}
                {DEMO_LIMITS.MAX_TRANSACTIONS} transactions recorded locally
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={txSearch}
                  onChange={(e) => setTxSearch(e.target.value)}
                  placeholder={t('filterDescCatPlaceholder', language)}
                  className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-1 focus:ring-neutral-400"
                />
              </div>

              <div className="flex items-center gap-1 p-1 bg-neutral-100 dark:bg-neutral-800 rounded-lg">
                {(
                  [
                    { id: 'month', label: selectedMonth },
                    { id: 'all', label: t('filterAll', language) },
                  ] as const
                ).map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setTxScope(s.id)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md tabular-nums transition-colors whitespace-nowrap ${
                      txScope === s.id
                        ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-2xs'
                        : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1 p-1 bg-neutral-100 dark:bg-neutral-800 rounded-lg">
                {(
                  [
                    { id: 'all', label: t('filterAll', language) },
                    { id: 'income', label: t('filterIncome', language) },
                    { id: 'expense', label: t('filterExpense', language) },
                  ] as const
                ).map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setTxTypeFilter(f.id)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                      txTypeFilter === f.id
                        ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-2xs'
                        : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-800 text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                  <th className="py-2.5 pr-3">{t('colDate', language)}</th>
                  <th className="py-2.5 px-3">{t('colDescription', language)}</th>
                  <th className="py-2.5 px-3">{t('colCategoryAccount', language)}</th>
                  <th className="py-2.5 pl-3 text-right">{t('colAmount', language)}</th>
                  <th className="py-2.5 pl-2 w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/70 text-xs">
                {filteredTransactions.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-8 text-center text-neutral-500 dark:text-neutral-400"
                    >
                      {t('noMatchingTxIn', language, {
                        scope:
                          txScope === 'all'
                            ? t('anyMonth', language)
                            : selectedMonth,
                      })}{' '}
                      {txScope === 'month' && data.transactions.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setTxScope('all')}
                          className="underline font-medium text-emerald-700 dark:text-emerald-400 ml-1 mr-2"
                        >
                          {t('showAllRecords', language, {
                            count: data.transactions.length,
                          })}
                        </button>
                      )}
                      <button
                        onClick={() => openTxModal()}
                        className="underline font-medium text-neutral-900 dark:text-neutral-100 ml-1"
                      >
                        {t('addFirstEntry', language)}
                      </button>
                    </td>
                  </tr>
                ) : (
                  filteredTransactions
                    .slice(0, txScope === 'all' ? 25 : 10)
                    .map((tx) => (
                    <tr
                      key={tx.id}
                      className="hover:bg-neutral-50/80 dark:hover:bg-neutral-800/40 transition-colors group"
                    >
                      <td className="py-2.5 pr-3 tabular-nums text-neutral-500 dark:text-neutral-400 whitespace-nowrap">
                        {tx.date}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-neutral-900 dark:text-neutral-100">
                        {tx.description}
                      </td>
                      <td className="py-2.5 px-3 text-neutral-500 dark:text-neutral-400 whitespace-nowrap">
                        <span>{tx.category}</span>
                        <span className="mx-1.5" aria-hidden="true">
                          ·
                        </span>
                        <span>{tx.paymentMethod}</span>
                      </td>
                      <td
                        className={`py-2.5 pl-3 text-right font-mono tabular-nums font-semibold whitespace-nowrap ${
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
                      </td>
                      <td className="py-2.5 pl-2 text-right">
                        <button
                          onClick={() => deleteTransaction(tx.id)}
                          title={t('deleteTransaction', language)}
                          className="p-1 text-neutral-400 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right 4 cols: Upcoming Bills & Saving Goals Quick Progress */}
        <div className="lg:col-span-4 space-y-6">
          {/* Upcoming Bills */}
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
            <div className="flex items-center justify-between mb-3.5">
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                {t('upcomingBillsRenewals', language)}
              </h3>
              <button
                onClick={() => setActivePage('bills')}
                className="px-2.5 py-1 text-xs font-medium rounded-lg border border-neutral-200/80 dark:border-neutral-700/80 bg-neutral-50/80 dark:bg-neutral-800/60 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-600 hover:text-neutral-900 dark:hover:text-white active:scale-[0.98] transition-all whitespace-nowrap shrink-0"
              >
                {t('allBills', language)}
              </button>
            </div>

            <div className="divide-y divide-neutral-100 dark:divide-neutral-800/70">
              {activeBills.slice(0, 4).map((bill) => (
                <div
                  key={bill.id}
                  className="py-2.5 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0">
                    <div className="font-medium text-neutral-900 dark:text-neutral-100 truncate">
                      {bill.name}
                    </div>
                    <div className="text-neutral-500 dark:text-neutral-400 tabular-nums mt-0.5">
                      <span>{t('dueDateLabel', language, { date: bill.nextDueDate })}</span>
                      <span className="mx-1.5" aria-hidden="true">
                        ·
                      </span>
                      <span>
                        {bill.autoPay
                          ? t('autoPayLabel', language)
                          : t('manualLabel', language)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono tabular-nums font-semibold text-neutral-900 dark:text-neutral-100">
                      {formatCurrency(bill.amount, currency)}
                    </span>
                    <button
                      onClick={() => markBillPaid(bill.id)}
                      disabled={txLimitReached}
                      title={
                        txLimitReached
                          ? `Demo limit of ${DEMO_LIMITS.MAX_TRANSACTIONS} transactions reached`
                          : t('markBillPaidTooltip', language)
                      }
                      className="p-1 rounded-md text-neutral-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Saving Goals Quick View */}
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
            <div className="flex items-center justify-between mb-3.5">
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                {t('savingTargets', language)}
              </h3>
              <button
                onClick={() => setActivePage('savings')}
                className="px-2.5 py-1 text-xs font-medium rounded-lg border border-neutral-200/80 dark:border-neutral-700/80 bg-neutral-50/80 dark:bg-neutral-800/60 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-600 hover:text-neutral-900 dark:hover:text-white active:scale-[0.98] transition-all whitespace-nowrap shrink-0"
              >
                {t('inspectSparklines', language)}
              </button>
            </div>

            <div className="space-y-3.5">
              {data.savingsGoals.slice(0, 3).map((goal) => {
                const pct = Math.min(
                  100,
                  (goal.currentAmount / Math.max(1, goal.targetAmount)) * 100
                );
                return (
                  <div
                    key={goal.id}
                    onClick={() => setActivePage('savings')}
                    className="cursor-pointer group"
                  >
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium text-neutral-800 dark:text-neutral-200 group-hover:underline truncate">
                        {goal.name}
                      </span>
                      <span className="tabular-nums text-neutral-500 dark:text-neutral-400">
                        {pct.toFixed(0)}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${pct}%`,
                          backgroundColor: goal.color,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
