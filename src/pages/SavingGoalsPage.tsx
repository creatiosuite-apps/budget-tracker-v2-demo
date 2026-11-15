import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowUpRight, Edit3, Plus, RotateCcw, Target, Trash2 } from 'lucide-react';
import { GoalGradientSparkline } from '../components/Charts';
import { useFinance } from '../context/FinanceContext';
import { formatCurrency } from '../utils/formatters';
import { t } from '../utils/i18n';

export const SavingGoalsPage: React.FC = () => {
  const {
    data,
    addSavingsGoal,
    updateSavingsGoal,
    deleteSavingsGoal,
    recordGoalContribution,
    revertGoalContribution,
  } = useFinance();

  const { currency, language } = data.settings;

  const [selectedGoalId, setSelectedGoalId] = useState<string>(
    data.savingsGoals[0]?.id || ''
  );

  // Contribution form inside selected goal detail
  const [contribAmount, setContribAmount] = useState('');
  const [contribType, setContribType] = useState<'deposit' | 'withdrawal'>(
    'deposit'
  );
  const [contribNote, setContribNote] = useState('');
  const [contribDate, setContribDate] = useState('2026-11-12');
  const [alsoLogTx, setAlsoLogTx] = useState(true);

  // New Goal Modal / Drawer
  const [showNewGoal, setShowNewGoal] = useState(false);
  const [goalName, setGoalName] = useState('');
  const [goalCategory, setGoalCategory] = useState('Safety Net');
  const [goalTarget, setGoalTarget] = useState('');
  const [goalInitial, setGoalInitial] = useState('');
  const [goalDate, setGoalDate] = useState('2027-12-01');
  const [goalMonthly, setGoalMonthly] = useState('');
  const [goalColor, setGoalColor] = useState('#059669');

  // Edit Selected Goal inline form state
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editTarget, setEditTarget] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editMonthly, setEditMonthly] = useState('');
  const [editColor, setEditColor] = useState('#059669');
  const [editNotes, setEditNotes] = useState('');

  const selectedGoal = useMemo(() => {
    return (
      data.savingsGoals.find((g) => g.id === selectedGoalId) ||
      data.savingsGoals[0] ||
      null
    );
  }, [data.savingsGoals, selectedGoalId]);

  const totals = useMemo(() => {
    const saved = data.savingsGoals.reduce((s, g) => s + g.currentAmount, 0);
    const target = data.savingsGoals.reduce((s, g) => s + g.targetAmount, 0);
    const monthlyCommitment = data.savingsGoals.reduce(
      (s, g) => s + g.monthlyContributionTarget,
      0
    );
    const overallPct = target > 0 ? (saved / target) * 100 : 0;
    return { saved, target, monthlyCommitment, overallPct };
  }, [data.savingsGoals]);

  const handleContributionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGoal) return;
    const amt = parseFloat(contribAmount);
    if (isNaN(amt) || amt <= 0) return;

    recordGoalContribution(
      selectedGoal.id,
      amt,
      contribType,
      contribNote.trim() ||
        (contribType === 'deposit' ? 'Goal deposit' : 'Goal withdrawal'),
      contribDate,
      alsoLogTx
    );

    setContribAmount('');
    setContribNote('');
  };

  const handleCreateGoal = (e: React.FormEvent) => {
    e.preventDefault();
    const tAmt = parseFloat(goalTarget);
    const initAmt = parseFloat(goalInitial) || 0;
    const mAmt = parseFloat(goalMonthly) || 200;
    if (!goalName.trim() || isNaN(tAmt) || tAmt <= 0) return;

    addSavingsGoal({
      name: goalName.trim(),
      category: goalCategory.trim() || 'Savings',
      targetAmount: tAmt,
      currentAmount: initAmt,
      targetDate: goalDate,
      monthlyContributionTarget: mAmt,
      color: goalColor,
    });

    setGoalName('');
    setGoalTarget('');
    setGoalInitial('');
    setGoalMonthly('');
    setShowNewGoal(false);
  };

  const openEditGoal = () => {
    if (!selectedGoal) return;
    setEditName(selectedGoal.name);
    setEditCategory(selectedGoal.category);
    setEditTarget(String(selectedGoal.targetAmount));
    setEditDate(selectedGoal.targetDate);
    setEditMonthly(String(selectedGoal.monthlyContributionTarget));
    setEditColor(selectedGoal.color);
    setEditNotes(selectedGoal.notes || '');
    setIsEditingGoal(true);
  };

  const handleSaveGoalEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGoal) return;
    const targetNum = parseFloat(editTarget);
    const monthlyNum = parseFloat(editMonthly);
    if (!editName.trim() || isNaN(targetNum) || targetNum <= 0) return;

    updateSavingsGoal({
      ...selectedGoal,
      name: editName.trim(),
      category: editCategory.trim() || 'Savings',
      targetAmount: targetNum,
      targetDate: editDate || selectedGoal.targetDate,
      monthlyContributionTarget:
        !isNaN(monthlyNum) && monthlyNum >= 0
          ? monthlyNum
          : selectedGoal.monthlyContributionTarget,
      color: editColor,
      notes: editNotes.trim() || undefined,
    });
    setIsEditingGoal(false);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
            {t('savingGoalsTitle', language)}
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
            {t('savingGoalsSub', language)}
          </p>
        </div>

        <button
          onClick={() => setShowNewGoal((p) => !p)}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-lg bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors whitespace-nowrap shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{t('newSavingGoal', language)}</span>
        </button>
      </div>

      {/* Create Goal Form */}
      {showNewGoal && (
        <form
          onSubmit={handleCreateGoal}
          className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 space-y-4"
        >
          <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            {t('createNewSavingGoal', language)}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs text-neutral-500 mb-1">
                {t('goalNameLabel', language)}
              </label>
              <input
                type="text"
                required
                placeholder={t('goalNamePlaceholder', language)}
                value={goalName}
                onChange={(e) => setGoalName(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
              />
            </div>
            <div>
              <label className="block text-xs text-neutral-500 mb-1">
                {t('categoryLabel', language)}
              </label>
              <input
                type="text"
                value={goalCategory}
                onChange={(e) => setGoalCategory(e.target.value)}
                placeholder={t('categoryExamplesPlaceholder', language)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
              />
            </div>
            <div>
              <label className="block text-xs text-neutral-500 mb-1">
                {t('targetWithCurrency', language, { currency })}
              </label>
              <input
                type="number"
                required
                min="1"
                placeholder="10000"
                value={goalTarget}
                onChange={(e) => setGoalTarget(e.target.value)}
                className="w-full px-3 py-2 text-xs tabular-nums rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
              />
            </div>
            <div>
              <label className="block text-xs text-neutral-500 mb-1">
                {t('startingBalance', language)}
              </label>
              <input
                type="number"
                min="0"
                placeholder="1000"
                value={goalInitial}
                onChange={(e) => setGoalInitial(e.target.value)}
                className="w-full px-3 py-2 text-xs tabular-nums rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
              />
            </div>
            <div>
              <label className="block text-xs text-neutral-500 mb-1">
                {t('targetDateLabel', language)}
              </label>
              <input
                type="date"
                required
                value={goalDate}
                onChange={(e) => setGoalDate(e.target.value)}
                className="w-full px-3 py-2 text-xs tabular-nums rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
              />
            </div>
          </div>
          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-neutral-500">
                {t('colorLabel', language)}
              </span>
              {['#059669', '#2563EB', '#4F46E5', '#D97706', '#DB2777'].map(
                (c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setGoalColor(c)}
                    className={`w-5 h-5 rounded-full ${
                      goalColor === c
                        ? 'ring-2 ring-offset-2 ring-neutral-900 dark:ring-white'
                        : ''
                    }`}
                    style={{ backgroundColor: c }}
                  />
                )
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowNewGoal(false)}
                className="px-3 py-1.5 text-xs text-neutral-500"
              >
                {t('cancel', language)}
              </button>
              <button
                type="submit"
                className="px-4 py-1.5 text-xs font-medium rounded-lg bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900"
              >
                {t('createGoalBtn', language)}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Summary KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
          <div className="text-xs text-neutral-500 dark:text-neutral-400">
            {t('totalAccumulatedReserves', language)}
          </div>
          <div className="mt-2 text-2xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
            {formatCurrency(totals.saved, currency, {
              maximumFractionDigits: 0,
            })}
          </div>
          <div className="mt-2 text-xs text-emerald-600 dark:text-emerald-400 tabular-nums">
            {t('ofCombinedTarget', language, {
              pct: totals.overallPct.toFixed(1),
              amount: formatCurrency(totals.target, currency, {
                maximumFractionDigits: 0,
              }),
            })}
          </div>
        </div>

        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
          <div className="text-xs text-neutral-500 dark:text-neutral-400">
            {t('remainingAllTargets', language)}
          </div>
          <div className="mt-2 text-2xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
            {formatCurrency(Math.max(0, totals.target - totals.saved), currency, {
              maximumFractionDigits: 0,
            })}
          </div>
          <div className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
            {t('acrossActiveBuckets', language, {
              count: data.savingsGoals.length,
            })}
          </div>
        </div>

        <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5">
          <div className="text-xs text-neutral-500 dark:text-neutral-400">
            {t('monthlySavingsCommitment', language)}
          </div>
          <div className="mt-2 text-2xl font-semibold tabular-nums text-neutral-900 dark:text-neutral-100">
            {t('perMonth', language, {
              amount: formatCurrency(totals.monthlyCommitment, currency, {
                maximumFractionDigits: 0,
              }),
            })}
          </div>
          <div className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
            {t('automatedMonthlyAlloc', language)}
          </div>
        </div>
      </div>

      {/* Main Layout: Left Goal Cards Grid + Right Selected Goal Sparkline & History */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 5 Cols: Interactive Goal Cards */}
        <div className="lg:col-span-5 space-y-4">
          {data.savingsGoals.map((goal) => {
            const pct = Math.min(
              100,
              (goal.currentAmount / Math.max(1, goal.targetAmount)) * 100
            );
            const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);
            const monthsToReach =
              goal.monthlyContributionTarget > 0
                ? Math.ceil(remaining / goal.monthlyContributionTarget)
                : 0;
            const isSelected = selectedGoal?.id === goal.id;

            return (
              <div
                key={goal.id}
                onClick={() => {
                  setSelectedGoalId(goal.id);
                  setIsEditingGoal(false);
                }}
                className={`rounded-xl border p-5 cursor-pointer transition-all ${
                  isSelected
                    ? 'border-neutral-900 dark:border-neutral-100 bg-white dark:bg-neutral-900 ring-1 ring-neutral-900 dark:ring-neutral-100'
                    : 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-neutral-400 dark:hover:border-neutral-700'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs text-neutral-500 dark:text-neutral-400">
                      <span>{goal.category}</span>
                      <span className="mx-1.5" aria-hidden="true">
                        ·
                      </span>
                      <span>
                        {t('targetDateMeta', language, { date: goal.targetDate })}
                      </span>
                    </div>
                    <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100 mt-0.5">
                      {goal.name}
                    </h3>
                  </div>

                  <div className="text-right tabular-nums">
                    <span
                      className="text-sm font-semibold"
                      style={{ color: goal.color }}
                    >
                      {pct.toFixed(1)}%
                    </span>
                  </div>
                </div>

                {/* Amount & Target */}
                <div className="mt-4 flex items-baseline justify-between tabular-nums">
                  <div className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
                    {formatCurrency(goal.currentAmount, currency, {
                      maximumFractionDigits: 0,
                    })}
                  </div>
                  <div className="text-xs text-neutral-500 dark:text-neutral-400">
                    {t('ofTargetAmount', language, {
                      amount: formatCurrency(goal.targetAmount, currency, {
                        maximumFractionDigits: 0,
                      }),
                    })}
                  </div>
                </div>

                {/* Visual Progress Bar with Milestone Ticks */}
                <div className="mt-2.5 relative">
                  <div className="h-2.5 w-full bg-neutral-100 dark:bg-neutral-800 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: pct / 100 }}
                      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
                      style={{
                        transformOrigin: 'left',
                        backgroundColor: goal.color,
                      }}
                      className="h-full w-full rounded-full"
                    />
                  </div>
                  {/* 25% / 50% / 75% subtle milestone ticks */}
                  <div className="flex justify-between text-[10px] text-neutral-400 mt-1 tabular-nums">
                    <span>0%</span>
                    <span>25%</span>
                    <span>50%</span>
                    <span>75%</span>
                    <span>100%</span>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-neutral-100 dark:border-neutral-800/80 flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
                  <span className="tabular-nums">
                    {t('pacePerMo', language, {
                      amount: formatCurrency(
                        goal.monthlyContributionTarget,
                        currency,
                        { maximumFractionDigits: 0 }
                      ),
                    })}
                  </span>
                  <span className="inline-flex items-center gap-1 font-medium text-neutral-800 dark:text-neutral-200">
                    <span>
                      {remaining <= 0
                        ? t('targetReached', language)
                        : t('mosToReach', language, { count: monthsToReach })}
                    </span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Right 7 Cols: Selected Goal Sparkline + Contribution Form + Transaction History */}
        {selectedGoal && (
          <div className="lg:col-span-7 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-gradient-to-br from-emerald-50/65 via-white to-teal-50/75 dark:from-neutral-900 dark:via-neutral-900 dark:to-emerald-950/30 p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-neutral-200 dark:border-neutral-800">
              <div>
                <div className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
                  <Target className="w-3.5 h-3.5" style={{ color: selectedGoal.color }} />
                  <span>{selectedGoal.category}</span>
                  <span aria-hidden="true">·</span>
                  <span>
                    {t('targetDateFullMeta', language, {
                      date: selectedGoal.targetDate,
                    })}
                  </span>
                </div>
                <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100 mt-1">
                  {selectedGoal.name}
                </h2>
                {selectedGoal.notes && (
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                    {selectedGoal.notes}
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-3">
                <div className="sm:text-right tabular-nums">
                  <div className="text-xs text-neutral-500">
                    {t('currentSaved', language)}
                  </div>
                  <div className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
                    {formatCurrency(selectedGoal.currentAmount, currency)}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      isEditingGoal ? setIsEditingGoal(false) : openEditGoal()
                    }
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-all whitespace-nowrap shrink-0 ${
                      isEditingGoal
                        ? 'border-neutral-900 dark:border-neutral-100 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900'
                        : 'border-neutral-200/80 dark:border-neutral-700/80 bg-neutral-50/80 dark:bg-neutral-800/60 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 hover:border-neutral-300 dark:hover:border-neutral-600'
                    }`}
                    title={t('editSavingGoalTooltip', language)}
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>
                      {isEditingGoal ? t('close', language) : t('edit', language)}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteSavingsGoal(selectedGoal.id)}
                    className="p-2 rounded-lg text-neutral-400 hover:text-rose-600 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                    title={t('deleteSavingGoalTooltip', language)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Inline Edit Goal Details Form */}
            {isEditingGoal && (
              <form
                onSubmit={handleSaveGoalEdit}
                className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-950/50 space-y-3"
              >
                <div className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                  {t('editGoalDetails', language)}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] text-neutral-500 mb-1">
                      {t('goalNameLabel', language)}
                    </label>
                    <input
                      type="text"
                      required
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-neutral-500 mb-1">
                      {t('categoryLabel', language)}
                    </label>
                    <input
                      type="text"
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-neutral-500 mb-1">
                      {t('targetAmountCurrency', language, { currency })}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      required
                      value={editTarget}
                      onChange={(e) => setEditTarget(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs tabular-nums rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-neutral-500 mb-1">
                      {t('targetDateLabel', language)}
                    </label>
                    <input
                      type="date"
                      required
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs tabular-nums rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-neutral-500 mb-1">
                      {t('monthlyPaceCurrency', language, { currency })}
                    </label>
                    <input
                      type="number"
                      step="1"
                      min="0"
                      value={editMonthly}
                      onChange={(e) => setEditMonthly(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs tabular-nums rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-neutral-500 mb-1">
                      {t('notes', language)}
                    </label>
                    <input
                      type="text"
                      placeholder={t('optionalGoalNotePlaceholder', language)}
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-neutral-500">
                      {t('colorLabel', language)}
                    </span>
                    {[
                      '#059669',
                      '#2563EB',
                      '#4F46E5',
                      '#D97706',
                      '#DB2777',
                      '#0D9488',
                    ].map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setEditColor(c)}
                        className={`w-5 h-5 rounded-full transition-transform ${
                          editColor === c
                            ? 'scale-110 ring-2 ring-offset-2 ring-neutral-900 dark:ring-white'
                            : ''
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsEditingGoal(false)}
                      className="px-3 py-1.5 text-xs text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100"
                    >
                      {t('cancel', language)}
                    </button>
                    <button
                      type="submit"
                      className="px-3.5 py-1.5 text-xs font-medium rounded-lg bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors"
                    >
                      {t('saveChanges', language)}
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* Gradient Sparkline Historical Log */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  {t('historicalBalanceProgression', language)}
                </h3>
                <span className="text-xs text-neutral-500 tabular-nums">
                  {t('loggedMilestones', language, {
                    count: selectedGoal.history.length,
                  })}
                </span>
              </div>

              <GoalGradientSparkline
                history={selectedGoal.history}
                color={selectedGoal.color}
                currency={currency}
                height={185}
                language={language}
              />
            </div>

            {/* Record Contribution or Withdrawal */}
            <form
              onSubmit={handleContributionSubmit}
              className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-950/50 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                  {t('logContributionWithdrawal', language)}
                </span>
                <label className="inline-flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={alsoLogTx}
                    onChange={(e) => setAlsoLogTx(e.target.checked)}
                    className="rounded border-neutral-300"
                  />
                  <span>{t('alsoRecordInLedger', language)}</span>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                <select
                  value={contribType}
                  onChange={(e) =>
                    setContribType(e.target.value as 'deposit' | 'withdrawal')
                  }
                  className="px-3 py-2 text-xs rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
                >
                  <option value="deposit">{t('depositFunds', language)}</option>
                  <option value="withdrawal">{t('withdrawFunds', language)}</option>
                </select>

                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder={t('amountLabel', language, { currency })}
                  value={contribAmount}
                  onChange={(e) => setContribAmount(e.target.value)}
                  className="px-3 py-2 text-xs tabular-nums rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
                />

                <input
                  type="date"
                  required
                  value={contribDate}
                  onChange={(e) => setContribDate(e.target.value)}
                  className="px-3 py-2 text-xs tabular-nums rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
                />

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder={t('noteExamplePlaceholder', language)}
                    value={contribNote}
                    onChange={(e) => setContribNote(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
                  />
                  <button
                    type="submit"
                    className="px-3.5 py-2 text-xs font-medium rounded-lg bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 whitespace-nowrap shrink-0"
                  >
                    {t('recordBtn', language)}
                  </button>
                </div>
              </div>
            </form>

            {/* Goal Transaction History Table */}
            <div>
              <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 mb-3">
                {t('goalTransactionHistory', language)}
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-neutral-200 dark:border-neutral-800 text-[11px] font-medium text-neutral-500 dark:text-neutral-400">
                      <th className="py-2 pr-3">{t('colDate', language)}</th>
                      <th className="py-2 px-3">{t('colNoteMilestone', language)}</th>
                      <th className="py-2 px-3 text-right">{t('colChange', language)}</th>
                      <th className="py-2 px-3 text-right">{t('colBalanceAfter', language)}</th>
                      <th className="py-2 pl-3 text-right">{t('colAction', language)}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800/70 text-xs">
                    {selectedGoal.history.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="py-6 text-center text-neutral-500 dark:text-neutral-400"
                        >
                          {t('noGoalHistory', language)}
                        </td>
                      </tr>
                    ) : (
                      [...selectedGoal.history].reverse().map((entry) => (
                        <tr
                          key={entry.id}
                          className="hover:bg-neutral-50/70 dark:hover:bg-neutral-800/40 transition-colors"
                        >
                          <td className="py-2.5 pr-3 tabular-nums text-neutral-500 whitespace-nowrap">
                            {entry.date}
                          </td>
                          <td className="py-2.5 px-3 font-medium text-neutral-900 dark:text-neutral-100">
                            {entry.note}
                          </td>
                          <td
                            className={`py-2.5 px-3 text-right font-mono tabular-nums font-semibold whitespace-nowrap ${
                              entry.type === 'deposit'
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            {entry.type === 'deposit' ? '+' : '-'}
                            {formatCurrency(entry.amount, currency)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums text-neutral-700 dark:text-neutral-300 whitespace-nowrap">
                            {formatCurrency(entry.balanceAfter, currency)}
                          </td>
                          <td className="py-2.5 pl-3 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() =>
                                revertGoalContribution(selectedGoal.id, entry.id)
                              }
                              title={t('revertGoalTooltip', language)}
                              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded-md border border-neutral-200/80 dark:border-neutral-700/80 bg-neutral-50/80 dark:bg-neutral-800/60 text-neutral-600 dark:text-neutral-300 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-200 dark:hover:border-rose-800/70 hover:bg-rose-50/70 dark:hover:bg-rose-950/30 active:scale-[0.98] transition-all"
                            >
                              <RotateCcw className="w-3 h-3" />
                              <span>{t('revert', language)}</span>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
