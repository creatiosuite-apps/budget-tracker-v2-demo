import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Check, Edit3, Lock, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { MonthSelectionCard } from '../components/MonthSelectionCard';
import { useFinance } from '../context/FinanceContext';
import { BudgetCategory } from '../types/finance';
import {
  DEMO_LIMITS,
  getCustomCategoryCount,
  isCustomCategory,
} from '../utils/demoLimits';
import { formatCurrency, getCategoryLimitForMonth } from '../utils/formatters';
import {
  formatMonthYearLabel,
  getLocalizedGroupLabel,
  t,
} from '../utils/i18n';

export const MonthlyBudgetPage: React.FC = () => {
  const {
    data,
    selectedMonth,
    addCategory,
    updateCategory,
    deleteCategory,
  } = useFinance();

  const { currency, language } = data.settings;
  const formattedMonth = formatMonthYearLabel(selectedMonth, language, 'short');

  const [activeGroupFilter, setActiveGroupFilter] = useState<
    'All' | 'Needs' | 'Wants' | 'Savings' | 'Income'
  >('All');

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLimitValue, setEditLimitValue] = useState<string>('');

  // New Category form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newGroup, setNewGroup] = useState<
    'Needs' | 'Wants' | 'Savings' | 'Income'
  >('Needs');
  const [newLimit, setNewLimit] = useState('');
  const [newColor, setNewColor] = useState('#2563EB');

  const customCategoryCount = getCustomCategoryCount(data.categories);
  const customCatLimitReached =
    customCategoryCount >= DEMO_LIMITS.MAX_CUSTOM_CATEGORIES;

  // Transactions in the selected month
  const monthTransactions = useMemo(
    () => data.transactions.filter((tx) => tx.date.startsWith(selectedMonth)),
    [data.transactions, selectedMonth]
  );

  // Compute category spend/income vs month-specific limit
  const enrichedCategories = useMemo(() => {
    const actualByCat: Record<string, number> = {};
    monthTransactions.forEach((tx) => {
      actualByCat[tx.category] = (actualByCat[tx.category] || 0) + tx.amount;
    });

    return data.categories.map((cat) => {
      const effectiveLimit = getCategoryLimitForMonth(cat, selectedMonth);
      const hasMonthOverride = Boolean(
        cat.monthlyOverrides &&
          Object.prototype.hasOwnProperty.call(
            cat.monthlyOverrides,
            selectedMonth
          )
      );
      const actual = actualByCat[cat.name] || 0;
      const remaining = effectiveLimit - actual;
      const pct = effectiveLimit > 0 ? (actual / effectiveLimit) * 100 : 0;
      return {
        ...cat,
        effectiveLimit,
        hasMonthOverride,
        actual,
        remaining,
        pct,
      };
    });
  }, [data.categories, monthTransactions, selectedMonth]);

  // Summary metrics across groups (50/30/20 benchmark + Zero-based Unallocated) for selectedMonth
  const summary = useMemo(() => {
    const plannedIncome = enrichedCategories
      .filter((c) => c.type === 'income')
      .reduce((s, c) => s + c.effectiveLimit, 0);

    const actualIncome = monthTransactions
      .filter((tx) => tx.type === 'income')
      .reduce((s, tx) => s + tx.amount, 0);

    const expenseCats = enrichedCategories.filter((c) => c.type === 'expense');
    const plannedExpenses = expenseCats.reduce(
      (s, c) => s + c.effectiveLimit,
      0
    );
    const actualExpenses = monthTransactions
      .filter((tx) => tx.type === 'expense')
      .reduce((s, tx) => s + tx.amount, 0);

    const groupStats = (groupName: 'Needs' | 'Wants' | 'Savings') => {
      const subset = expenseCats.filter((c) => c.group === groupName);
      const planned = subset.reduce((s, c) => s + c.effectiveLimit, 0);
      const actual = subset.reduce((s, c) => s + c.actual, 0);
      const shareOfIncome =
        plannedIncome > 0 ? (planned / plannedIncome) * 100 : 0;
      return { planned, actual, shareOfIncome };
    };

    return {
      plannedIncome,
      actualIncome,
      plannedExpenses,
      actualExpenses,
      unallocatedBudget: plannedIncome - plannedExpenses,
      remainingToSpend: plannedExpenses - actualExpenses,
      needs: groupStats('Needs'),
      wants: groupStats('Wants'),
      savings: groupStats('Savings'),
    };
  }, [enrichedCategories, monthTransactions]);

  const visibleCategories = useMemo(() => {
    if (activeGroupFilter === 'All') return enrichedCategories;
    return enrichedCategories.filter((c) => c.group === activeGroupFilter);
  }, [enrichedCategories, activeGroupFilter]);

  const startEditLimit = (cat: BudgetCategory) => {
    setEditingId(cat.id);
    setEditLimitValue(String(getCategoryLimitForMonth(cat, selectedMonth)));
  };

  const commitEditLimit = (cat: BudgetCategory) => {
    const parsed = parseFloat(editLimitValue);
    if (!isNaN(parsed) && parsed >= 0) {
      updateCategory({
        ...cat,
        monthlyOverrides: {
          ...(cat.monthlyOverrides || {}),
          [selectedMonth]: parsed,
        },
      });
    }
    setEditingId(null);
  };

  const resetMonthOverride = (cat: BudgetCategory) => {
    if (!cat.monthlyOverrides) return;
    const nextOverrides = { ...cat.monthlyOverrides };
    delete nextOverrides[selectedMonth];
    updateCategory({
      ...cat,
      monthlyOverrides:
        Object.keys(nextOverrides).length > 0 ? nextOverrides : undefined,
    });
  };

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (customCatLimitReached) return;
    const limitNum = parseFloat(newLimit);
    if (!newName.trim() || isNaN(limitNum) || limitNum <= 0) return;

    addCategory({
      name: newName.trim(),
      group: newGroup,
      type: newGroup === 'Income' ? 'income' : 'expense',
      monthlyLimit: limitNum,
      color: newColor,
    });

    setNewName('');
    setNewLimit('');
    setShowAddForm(false);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
            {t('monthlyBudgetPlannerTitle', language)}
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
            {t('monthlyBudgetPlannerSub', language, { month: formattedMonth })}
          </p>
        </div>

        <button
          onClick={() => setShowAddForm((prev) => !prev)}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{t('newBudgetCategory', language)}</span>
          <span className="ml-1 opacity-75 tabular-nums">
            ({customCategoryCount}/{DEMO_LIMITS.MAX_CUSTOM_CATEGORIES})
          </span>
        </button>
      </div>

      {/* Month Selection Section */}
      <MonthSelectionCard />

      {/* Add Category Drawer */}
      {showAddForm && (
        <form
          onSubmit={handleAddCategory}
          className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 space-y-4"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              {t('createBudgetCategory', language)}
            </div>
            <span
              className={`px-2 py-0.5 text-[11px] font-medium tabular-nums rounded-md border ${
                customCatLimitReached
                  ? 'border-amber-200 dark:border-amber-800/70 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300'
                  : 'border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300'
              }`}
            >
              {customCategoryCount} / {DEMO_LIMITS.MAX_CUSTOM_CATEGORIES} custom
            </span>
          </div>

          {customCatLimitReached && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-200 dark:border-amber-800/70 bg-amber-50/80 dark:bg-amber-950/30 p-3 text-xs text-amber-800 dark:text-amber-200">
              <Lock className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <span>
                Demo limit reached ({DEMO_LIMITS.MAX_CUSTOM_CATEGORIES} /{' '}
                {DEMO_LIMITS.MAX_CUSTOM_CATEGORIES} custom categories). Delete a
                custom category to add a new one.
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs text-neutral-500 mb-1">
                {t('categoryNameLabel', language)}
              </label>
              <input
                type="text"
                required
                disabled={customCatLimitReached}
                placeholder={t('categoryNamePlaceholder', language)}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-xs text-neutral-500 mb-1">
                {t('allocationGroupLabel', language)}
              </label>
              <select
                value={newGroup}
                disabled={customCatLimitReached}
                onChange={(e) =>
                  setNewGroup(
                    e.target.value as 'Needs' | 'Wants' | 'Savings' | 'Income'
                  )
                }
                className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 disabled:opacity-50"
              >
                <option value="Needs">{t('groupNeedsOpt', language)}</option>
                <option value="Wants">{t('groupWantsOpt', language)}</option>
                <option value="Savings">{t('groupSavingsOpt', language)}</option>
                <option value="Income">{t('groupIncomeOpt', language)}</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-neutral-500 mb-1">
                {t('monthlyTargetLimit', language, { currency })}
              </label>
              <input
                type="number"
                step="1"
                min="1"
                required
                disabled={customCatLimitReached}
                placeholder="500"
                value={newLimit}
                onChange={(e) => setNewLimit(e.target.value)}
                className="w-full px-3 py-2 text-xs tabular-nums rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-xs text-neutral-500 mb-1">
                {t('accentSwatch', language)}
              </label>
              <div className="flex items-center gap-2 pt-1">
                {[
                  '#2563EB',
                  '#059669',
                  '#D97706',
                  '#7C3AED',
                  '#DB2777',
                  '#0D9488',
                ].map((c) => (
                  <button
                    key={c}
                    type="button"
                    disabled={customCatLimitReached}
                    onClick={() => setNewColor(c)}
                    className={`w-6 h-6 rounded-full transition-transform disabled:opacity-50 ${
                      newColor === c
                        ? 'scale-110 ring-2 ring-offset-2 ring-neutral-900 dark:ring-white'
                        : ''
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-3 py-1.5 text-xs text-neutral-500 hover:text-neutral-900"
            >
              {t('cancel', language)}
            </button>
            <button
              type="submit"
              disabled={customCatLimitReached}
              className="px-4 py-1.5 text-xs font-medium rounded-lg bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 disabled:opacity-45 disabled:cursor-not-allowed"
            >
              {t('saveCategory', language)}
            </button>
          </div>
        </form>
      )}

      {/* Top 4 KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
          <div className="text-xs text-neutral-500 dark:text-neutral-400">
            {t('plannedMonthlyIncome', language)}
          </div>
          <div className="mt-2 text-2xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
            {formatCurrency(summary.plannedIncome, currency, {
              maximumFractionDigits: 0,
            })}
          </div>
          <div className="mt-2 text-xs text-neutral-500 dark:text-neutral-400 tabular-nums">
            {t('actualReceived', language)}{' '}
            <span className="font-medium text-emerald-600 dark:text-emerald-400">
              {formatCurrency(summary.actualIncome, currency, {
                maximumFractionDigits: 0,
              })}
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
          <div className="text-xs text-neutral-500 dark:text-neutral-400">
            {t('totalBudgetedOutflows', language)}
          </div>
          <div className="mt-2 text-2xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
            {formatCurrency(summary.plannedExpenses, currency, {
              maximumFractionDigits: 0,
            })}
          </div>
          <div className="mt-2 text-xs text-neutral-500 dark:text-neutral-400 tabular-nums">
            {t('actualSpent', language)}{' '}
            <span className="font-medium text-neutral-900 dark:text-neutral-100">
              {formatCurrency(summary.actualExpenses, currency, {
                maximumFractionDigits: 0,
              })}
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
          <div className="text-xs text-neutral-500 dark:text-neutral-400">
            {t('remainingBudgetHeadroom', language)}
          </div>
          <div
            className={`mt-2 text-2xl font-semibold tabular-nums ${
              summary.remainingToSpend >= 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {formatCurrency(summary.remainingToSpend, currency, {
              maximumFractionDigits: 0,
            })}
          </div>
          <div className="mt-2 text-xs text-neutral-500 dark:text-neutral-400 tabular-nums">
            {summary.plannedExpenses > 0
              ? t('pctMonthlyCapUsed', language, {
                  pct: (
                    (summary.actualExpenses / summary.plannedExpenses) *
                    100
                  ).toFixed(1),
                })
              : t('noCapSet', language)}
          </div>
        </div>

        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
          <div className="text-xs text-neutral-500 dark:text-neutral-400">
            {t('unallocatedZeroBased', language)}
          </div>
          <div className="mt-2 text-2xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
            {formatCurrency(summary.unallocatedBudget, currency, {
              maximumFractionDigits: 0,
              showSign: true,
            })}
          </div>
          <div className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
            {summary.unallocatedBudget >= 0
              ? t('surplusReady', language)
              : t('overAllocated', language)}
          </div>
        </div>
      </div>

      {/* 50 / 30 / 20 Rule Architecture Breakdown */}
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-5">
          <div>
            <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
              {t('benchmark503020Title', language)}
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              {t('benchmark503020Sub', language)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              title: t('needsEssentialsTitle', language),
              benchmark: 50,
              stat: summary.needs,
              color: '#2563EB',
            },
            {
              title: t('wantsLifestyleTitle', language),
              benchmark: 30,
              stat: summary.wants,
              color: '#D97706',
            },
            {
              title: t('savingsPaydownTitle', language),
              benchmark: 20,
              stat: summary.savings,
              color: '#059669',
            },
          ].map((bucket) => {
            const utilization =
              bucket.stat.planned > 0
                ? Math.min(100, (bucket.stat.actual / bucket.stat.planned) * 100)
                : 0;
            return (
              <div
                key={bucket.title}
                className="p-4 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/40 dark:bg-neutral-950/40 space-y-2.5"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                    {bucket.title}
                  </span>
                  <span className="tabular-nums text-neutral-500 dark:text-neutral-400">
                    {t('pctOfIncomeTarget', language, {
                      pct: bucket.stat.shareOfIncome.toFixed(1),
                      target: bucket.benchmark,
                    })}
                  </span>
                </div>

                <div className="flex items-baseline justify-between tabular-nums">
                  <span className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                    {formatCurrency(bucket.stat.actual, currency, {
                      maximumFractionDigits: 0,
                    })}
                  </span>
                  <span className="text-xs text-neutral-500">
                    {t('ofPlannedAmount', language, {
                      amount: formatCurrency(bucket.stat.planned, currency, {
                        maximumFractionDigits: 0,
                      }),
                    })}
                  </span>
                </div>

                <div className="h-2 w-full bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: utilization / 100 }}
                    transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                    style={{
                      transformOrigin: 'left',
                      backgroundColor: bucket.color,
                    }}
                    className="h-full w-full rounded-full"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Category Budget Table with Inline Limit Editing */}
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div>
            <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
              {t('categoryBudgetLedger', language)}
            </h2>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              {t('inlineLimitHint', language, { month: formattedMonth })}
            </p>
          </div>

          <div className="flex items-center gap-1 p-1 bg-neutral-100 dark:bg-neutral-800 rounded-lg overflow-x-auto">
            {(['All', 'Needs', 'Wants', 'Savings', 'Income'] as const).map(
              (grp) => (
                <button
                  key={grp}
                  onClick={() => setActiveGroupFilter(grp)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    activeGroupFilter === grp
                      ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-2xs'
                      : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
                  }`}
                >
                  {getLocalizedGroupLabel(grp, language)}
                </button>
              )
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-800 text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                <th className="py-2.5 pr-4">{t('colCategoryGroup', language)}</th>
                <th className="py-2.5 px-4 w-56">{t('colProgress', language)}</th>
                <th className="py-2.5 px-4 text-right">
                  {t('colBudgetMonth', language, { month: formattedMonth })}
                </th>
                <th className="py-2.5 px-4 text-right">
                  {t('colActualMonth', language, { month: formattedMonth })}
                </th>
                <th className="py-2.5 pl-4 text-right">{t('colVariance', language)}</th>
                <th className="py-2.5 pl-2 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/70 text-xs">
              {visibleCategories.map((cat) => {
                const isOver =
                  cat.type === 'expense' && cat.actual > cat.effectiveLimit;
                const clampedPct = Math.min(100, cat.pct);

                return (
                  <tr
                    key={cat.id}
                    className="hover:bg-neutral-50/70 dark:hover:bg-neutral-800/40 transition-colors group"
                  >
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="w-2.5 h-2.5 rounded-xs shrink-0"
                          style={{ backgroundColor: cat.color }}
                        />
                        <span className="font-medium text-neutral-900 dark:text-neutral-100">
                          {cat.name}
                        </span>
                        <span className="text-neutral-400 dark:text-neutral-500">
                          · {getLocalizedGroupLabel(cat.group, language)}
                        </span>
                        {isCustomCategory(cat) && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
                            Custom
                          </span>
                        )}
                        {cat.hasMonthOverride && (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200/70 dark:border-emerald-800/60">
                            {t('customOverrideBadge', language)}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="flex-1 h-1.5 bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                              width: `${clampedPct}%`,
                              backgroundColor: isOver ? '#E11D48' : cat.color,
                            }}
                          />
                        </div>
                        <span className="w-10 text-right tabular-nums text-[11px] text-neutral-500">
                          {cat.pct.toFixed(0)}%
                        </span>
                      </div>
                    </td>

                    <td className="py-3 px-4 text-right font-mono tabular-nums">
                      {editingId === cat.id ? (
                        <div className="inline-flex items-center justify-end gap-1">
                          <input
                            type="number"
                            value={editLimitValue}
                            onChange={(e) => setEditLimitValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') commitEditLimit(cat);
                              if (e.key === 'Escape') setEditingId(null);
                            }}
                            autoFocus
                            className="w-24 px-2 py-1 text-right text-xs rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
                          />
                          <button
                            onClick={() => commitEditLimit(cat)}
                            className="p-1 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded"
                            title={t('saveBudgetLimitFor', language, {
                              month: formattedMonth,
                            })}
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => startEditLimit(cat)}
                            className="inline-flex items-center gap-1.5 text-neutral-900 dark:text-neutral-100 hover:underline font-medium"
                            title={t('clickToEditBudget', language, {
                              month: formattedMonth,
                            })}
                          >
                            <span>
                              {formatCurrency(cat.effectiveLimit, currency, {
                                maximumFractionDigits: 0,
                              })}
                            </span>
                            <Edit3 className="w-3 h-3 text-neutral-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </button>
                          {cat.hasMonthOverride && (
                            <button
                              type="button"
                              onClick={() => resetMonthOverride(cat)}
                              title={t('resetToDefault', language, {
                                month: formattedMonth,
                                amount: formatCurrency(
                                  cat.monthlyLimit,
                                  currency,
                                  { maximumFractionDigits: 0 }
                                ),
                              })}
                              className="p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded transition-colors"
                            >
                              <RotateCcw className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-4 text-right font-mono tabular-nums text-neutral-700 dark:text-neutral-300">
                      {formatCurrency(cat.actual, currency)}
                    </td>

                    <td
                      className={`py-3 pl-4 text-right font-mono tabular-nums font-medium ${
                        cat.type === 'income'
                          ? cat.actual >= cat.effectiveLimit
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-neutral-500'
                          : cat.remaining >= 0
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {cat.type === 'income'
                        ? formatCurrency(
                            cat.actual - cat.effectiveLimit,
                            currency,
                            { showSign: true }
                          )
                        : formatCurrency(cat.remaining, currency, {
                            showSign: true,
                          })}
                    </td>

                    <td className="py-3 pl-2 text-right">
                      <button
                        onClick={() => deleteCategory(cat.id)}
                        title={t('removeCategory', language)}
                        className="p-1 text-neutral-400 hover:text-rose-600 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
