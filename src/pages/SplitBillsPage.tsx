import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Edit3,
  Plus,
  Receipt,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { SplitLineItem, SplitShareEntry } from '../types/finance';
import { formatCurrency, t } from '../utils/formatters';

export const SplitBillsPage: React.FC = () => {
  const {
    data,
    addParticipant,
    updateParticipant,
    removeParticipant,
    addSplitExpense,
    updateSplitExpensePayer,
    toggleSplitSettled,
    settleAllForParticipant,
    deleteSplitExpense,
  } = useFinance();

  const { currency, language } = data.settings;

  const getMethodLabel = (
    method: 'equal' | 'exact' | 'ratio' | 'itemized'
  ) => {
    switch (method) {
      case 'equal':
        return t('methodEqual', language);
      case 'exact':
        return t('methodExact', language);
      case 'ratio':
        return t('methodRatio', language);
      case 'itemized':
        return t('methodItemized', language);
    }
  };

  // Roommate / Friend form & edit modal state
  const [newFriendName, setNewFriendName] = useState('');
  const [newFriendEmail, setNewFriendEmail] = useState('');
  const [editingParticipantId, setEditingParticipantId] = useState<string | null>(
    null
  );
  const [editParticipantForm, setEditParticipantForm] = useState({
    name: '',
    email: '',
    setAsDefaultPayer: false,
  });

  // Split Calculator / Creator state
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('2026-11-12');
  const [category, setCategory] = useState('Dining & Coffee');
  const [paidById, setPaidById] = useState(
    data.splitParticipants[0]?.id || 'part-1'
  );
  const effectivePaidById = data.splitParticipants.some((p) => p.id === paidById)
    ? paidById
    : data.splitParticipants[0]?.id || 'part-1';
  const [splitMethod, setSplitMethod] = useState<
    'equal' | 'exact' | 'ratio' | 'itemized'
  >('equal');

  const [totalAmountInput, setTotalAmountInput] = useState('120');
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<string[]>(
    () => data.splitParticipants.map((p) => p.id)
  );

  // Exact amount overrides per participant
  const [exactAmounts, setExactAmounts] = useState<Record<string, string>>({});

  // Ratio / Share weights per participant (default 1 share or % weight)
  const [ratioWeights, setRatioWeights] = useState<Record<string, string>>({});

  // Itemized receipt items + tax + tip
  const [items, setItems] = useState<SplitLineItem[]>([
    {
      id: 'init-item-1',
      name: 'Shared Appetizer Platter',
      price: 32,
      assignedToIds: data.splitParticipants.map((p) => p.id),
    },
    {
      id: 'init-item-2',
      name: 'Main Entree & Beverage',
      price: 48,
      assignedToIds: [data.splitParticipants[0]?.id || 'part-1'],
    },
  ]);
  const [taxInput, setTaxInput] = useState('8.50');
  const [tipInput, setTipInput] = useState('16.00');
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');

  // Toggle participant inclusion in current split
  const toggleParticipantInSplit = (id: string) => {
    setSelectedParticipantIds((prev) =>
      prev.includes(id)
        ? prev.length > 1
          ? prev.filter((x) => x !== id)
          : prev
        : [...prev, id]
    );
  };

  // Toggle participant assignment on a specific line item
  const toggleParticipantOnItem = (itemId: string, partId: string) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== itemId) return it;
        const exists = it.assignedToIds.includes(partId);
        const nextIds = exists
          ? it.assignedToIds.length > 1
            ? it.assignedToIds.filter((x) => x !== partId)
            : it.assignedToIds
          : [...it.assignedToIds, partId];
        return { ...it, assignedToIds: nextIds };
      })
    );
  };

  const addReceiptItem = () => {
    const p = parseFloat(newItemPrice);
    if (!newItemName.trim() || isNaN(p) || p <= 0) return;
    setItems((prev) => [
      ...prev,
      {
        id: `item-${Date.now()}`,
        name: newItemName.trim(),
        price: p,
        assignedToIds:
          selectedParticipantIds.length > 0
            ? [...selectedParticipantIds]
            : [data.splitParticipants[0]?.id || 'part-1'],
      },
    ]);
    setNewItemName('');
    setNewItemPrice('');
  };

  const removeReceiptItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  // Compute live preview of split shares based on chosen splitMethod
  const computedSplitPreview = useMemo(() => {
    const activeParts = data.splitParticipants.filter((p) =>
      selectedParticipantIds.includes(p.id)
    );

    if (activeParts.length === 0) {
      return { effectiveTotal: 0, shares: [] as SplitShareEntry[], variance: 0 };
    }

    if (splitMethod === 'equal') {
      const total = Math.max(0, parseFloat(totalAmountInput) || 0);
      const rawPerPerson = total / activeParts.length;
      const shares: SplitShareEntry[] = activeParts.map((p, idx) => {
        const rounded = Math.round(rawPerPerson * 100) / 100;
        // Adjust last person by any cent remainder
        const amount =
          idx === activeParts.length - 1
            ? Math.max(
                0,
                Math.round((total - rounded * (activeParts.length - 1)) * 100) /
                  100
              )
            : rounded;
        return {
          participantId: p.id,
          amount,
          settled: p.id === effectivePaidById,
        };
      });
      return { effectiveTotal: total, shares, variance: 0 };
    }

    if (splitMethod === 'exact') {
      const total = Math.max(0, parseFloat(totalAmountInput) || 0);
      const shares: SplitShareEntry[] = activeParts.map((p) => {
        const val = Math.max(0, parseFloat(exactAmounts[p.id] ?? '0') || 0);
        return {
          participantId: p.id,
          amount: Math.round(val * 100) / 100,
          settled: p.id === effectivePaidById,
        };
      });
      const sumShares = shares.reduce((s, x) => s + x.amount, 0);
      return {
        effectiveTotal: total,
        shares,
        variance: Math.round((total - sumShares) * 100) / 100,
      };
    }

    if (splitMethod === 'ratio') {
      const total = Math.max(0, parseFloat(totalAmountInput) || 0);
      const weights = activeParts.map((p) => ({
        id: p.id,
        w: Math.max(0, parseFloat(ratioWeights[p.id] ?? '1') || 0),
      }));
      const totalWeight = Math.max(
        0.0001,
        weights.reduce((s, x) => s + x.w, 0)
      );

      const shares: SplitShareEntry[] = weights.map((wObj) => {
        const amt = (total * wObj.w) / totalWeight;
        return {
          participantId: wObj.id,
          amount: Math.round(amt * 100) / 100,
          ratioOrPercent: Math.round((wObj.w / totalWeight) * 1000) / 10,
          settled: wObj.id === effectivePaidById,
        };
      });
      return { effectiveTotal: total, shares, variance: 0 };
    }

    // 'itemized' method: calculate each person's subtotal from assigned items, then distribute tax & tip proportionally
    const subtotals: Record<string, number> = {};
    data.splitParticipants.forEach((p) => {
      subtotals[p.id] = 0;
    });

    let itemsSubtotal = 0;
    items.forEach((item) => {
      itemsSubtotal += item.price;
      const assignees =
        item.assignedToIds.length > 0
          ? item.assignedToIds
          : [data.splitParticipants[0]?.id || 'part-1'];
      const splitCost = item.price / assignees.length;
      assignees.forEach((pid) => {
        subtotals[pid] = (subtotals[pid] || 0) + splitCost;
      });
    });

    const tax = Math.max(0, parseFloat(taxInput) || 0);
    const tip = Math.max(0, parseFloat(tipInput) || 0);
    const grandTotal = itemsSubtotal + tax + tip;

    const shares: SplitShareEntry[] = data.splitParticipants
      .map((p) => {
        const sub = subtotals[p.id] || 0;
        if (sub <= 0) return null;
        const proportion = itemsSubtotal > 0 ? sub / itemsSubtotal : 0;
        const withTaxAndTip = sub + (tax + tip) * proportion;
        return {
          participantId: p.id,
          amount: Math.round(withTaxAndTip * 100) / 100,
          settled: p.id === effectivePaidById,
        };
      })
      .filter((x): x is SplitShareEntry => x !== null);

    return {
      effectiveTotal: Math.round(grandTotal * 100) / 100,
      shares,
      variance: 0,
    };
  }, [
    data.splitParticipants,
    selectedParticipantIds,
    splitMethod,
    totalAmountInput,
    exactAmounts,
    ratioWeights,
    items,
    taxInput,
    tipInput,
    effectivePaidById,
  ]);

  // Calculate net and pairwise balances across all logged split expenses
  const participantBalances = useMemo(() => {
    const netByPart: Record<string, { owedToThem: number; theyOwe: number }> = {};
    const pairwiseNet: Record<string, Record<string, number>> = {};

    data.splitParticipants.forEach((p) => {
      netByPart[p.id] = { owedToThem: 0, theyOwe: 0 };
      pairwiseNet[p.id] = {};
    });

    data.splitExpenses.forEach((exp) => {
      exp.splits.forEach((s) => {
        if (s.settled || s.participantId === exp.paidById) return;
        if (netByPart[exp.paidById]) {
          netByPart[exp.paidById].owedToThem += s.amount;
        }
        if (netByPart[s.participantId]) {
          netByPart[s.participantId].theyOwe += s.amount;
        }
        if (pairwiseNet[exp.paidById] && pairwiseNet[s.participantId]) {
          pairwiseNet[exp.paidById][s.participantId] =
            (pairwiseNet[exp.paidById][s.participantId] || 0) + s.amount;
          pairwiseNet[s.participantId][exp.paidById] =
            (pairwiseNet[s.participantId][exp.paidById] || 0) - s.amount;
        }
      });
    });

    return data.splitParticipants.map((p) => {
      const stat = netByPart[p.id] || { owedToThem: 0, theyOwe: 0 };
      const pairwiseDetails = data.splitParticipants
        .filter((other) => other.id !== p.id)
        .map((other) => ({
          otherId: other.id,
          otherName: other.name,
          amount: Math.round((pairwiseNet[p.id]?.[other.id] || 0) * 100) / 100,
        }))
        .filter((entry) => Math.abs(entry.amount) >= 0.01)
        .sort((a, b) => b.amount - a.amount);

      return {
        ...p,
        owedToThem: stat.owedToThem,
        theyOwe: stat.theyOwe,
        net: stat.owedToThem - stat.theyOwe,
        pairwiseDetails,
      };
    });
  }, [data.splitParticipants, data.splitExpenses]);

  const handleSaveSplitBill = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || computedSplitPreview.effectiveTotal <= 0) return;
    if (splitMethod === 'exact' && Math.abs(computedSplitPreview.variance) > 0.05) {
      return;
    }

    addSplitExpense({
      title: title.trim(),
      date,
      totalAmount: computedSplitPreview.effectiveTotal,
      paidById: effectivePaidById,
      splitMethod,
      category,
      splits: computedSplitPreview.shares,
      items: splitMethod === 'itemized' ? items : undefined,
      taxAmount:
        splitMethod === 'itemized' ? parseFloat(taxInput) || 0 : undefined,
      tipAmount:
        splitMethod === 'itemized' ? parseFloat(tipInput) || 0 : undefined,
    });

    setTitle('');
  };

  const handleAddFriend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFriendName.trim()) return;
    addParticipant({
      name: newFriendName.trim(),
      email: newFriendEmail.trim(),
    });
    setNewFriendName('');
    setNewFriendEmail('');
  };

  const openEditParticipantModal = (
    participant: (typeof data.splitParticipants)[number]
  ) => {
    setEditingParticipantId(participant.id);
    setEditParticipantForm({
      name: participant.name,
      email: participant.email,
      setAsDefaultPayer: participant.id === effectivePaidById,
    });
  };

  const handleSaveParticipant = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingParticipantId) return;
    const target = data.splitParticipants.find(
      (p) => p.id === editingParticipantId
    );
    if (!target || !editParticipantForm.name.trim()) return;

    updateParticipant({
      ...target,
      name: editParticipantForm.name.trim(),
      email: editParticipantForm.email.trim(),
    });

    if (editParticipantForm.setAsDefaultPayer) {
      setPaidById(target.id);
    }

    setEditingParticipantId(null);
  };

  const getParticipantName = (id: string) =>
    data.splitParticipants.find((p) => p.id === id)?.name ||
    t('participantFallback', language);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
            {t('splitTitle', language)}
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
            {t('splitSub', language)}
          </p>
        </div>
      </div>

      {/* Participant Balances Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {participantBalances.map((p) => {
          const selfShortName = p.isSelf
            ? t('youPronounLower', language)
            : p.name.split(' ')[0];

          return (
            <div
              key={p.id}
              className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 flex flex-col justify-between"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                    {p.name}
                  </div>
                  {p.email && (
                    <div className="text-xs text-neutral-400 truncate mt-0.5">
                      {p.email}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => openEditParticipantModal(p)}
                    className="text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 p-1 rounded transition-colors"
                    title={t('editParticipantTooltip', language)}
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                  </button>
                  {!p.isSelf && (
                    <button
                      type="button"
                      onClick={() => removeParticipant(p.id)}
                      className="text-neutral-400 hover:text-rose-600 p-1 rounded transition-colors"
                      title={t('removeParticipantTooltip', language)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-4">
                <div className="text-xs text-neutral-500">{t('netPosition', language)}</div>
                <div
                  className={`text-xl font-semibold font-mono tabular-nums mt-0.5 ${
                    p.net > 0.01
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : p.net < -0.01
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-neutral-500'
                  }`}
                >
                  {Math.abs(p.net) < 0.01
                    ? t('settledUp', language)
                    : formatCurrency(p.net, currency, { showSign: true })}
                </div>
              </div>

              {/* Pairwise breakdown from all past split transactions */}
              <div className="mt-3 pt-2.5 border-t border-neutral-100 dark:border-neutral-800 space-y-1.5">
                {p.pairwiseDetails.length > 0 ? (
                  p.pairwiseDetails.map((detail) => {
                    const otherFirst = detail.otherName.split(' ')[0];
                    const isOwedToP = detail.amount > 0;
                    return (
                      <div
                        key={detail.otherId}
                        className="flex items-center justify-between gap-2 text-[11px]"
                      >
                        <span className="text-neutral-600 dark:text-neutral-400 truncate">
                          {isOwedToP
                            ? t('personOwesPerson', language, {
                                from: otherFirst,
                                to: selfShortName,
                              })
                            : p.isSelf
                            ? t('youOwePerson', language, { to: otherFirst })
                            : t('personOwesPerson', language, {
                                from: p.name.split(' ')[0],
                                to: otherFirst,
                              })}
                        </span>
                        <span
                          className={`font-mono tabular-nums font-medium shrink-0 ${
                            isOwedToP
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {formatCurrency(Math.abs(detail.amount), currency)}
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-[11px] text-neutral-400">
                    {t('noPendingBalances', language)}
                  </div>
                )}
              </div>

              <div className="mt-3 pt-2.5 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between text-xs text-neutral-500">
                <span className="tabular-nums">
                  {p.net > 0.01
                    ? t('owedTotal', language, {
                        amount: formatCurrency(p.owedToThem, currency),
                      })
                    : p.net < -0.01
                    ? t('owesTotal', language, {
                        amount: formatCurrency(p.theyOwe, currency),
                      })
                    : p.pairwiseDetails.length > 0
                    ? t('balancedAcrossPairs', language)
                    : t('allSplitsSettled', language)}
                </span>
                {(Math.abs(p.net) > 0.01 || p.pairwiseDetails.length > 0) && (
                  <button
                    onClick={() => settleAllForParticipant(p.id)}
                    className="font-medium text-neutral-900 dark:text-neutral-100 hover:underline"
                  >
                    {t('settleAll', language)}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Split: 7-Col Interactive Bill Splitter Engine + 5-Col Shared Ledger & Roommates */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 7 Cols: Interactive Split Bill Workbench */}
        <form
          onSubmit={handleSaveSplitBill}
          className="lg:col-span-7 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 space-y-6"
        >
          <div className="flex items-center justify-between pb-4 border-b border-neutral-200 dark:border-neutral-800">
            <div>
              <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                {t('createNewSharedSplit', language)}
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                {t('createNewSharedSplitSub', language)}
              </p>
            </div>
            <Receipt className="w-5 h-5 text-neutral-400" />
          </div>

          {/* Bill Meta Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                {t('expenseTitleLabel', language)}
              </label>
              <input
                type="text"
                required
                placeholder={t('expenseTitlePlaceholder', language)}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                {t('dateLabel', language)}
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 text-xs tabular-nums rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                {t('paidByLabel', language)}
              </label>
              <select
                value={effectivePaidById}
                onChange={(e) => setPaidById(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
              >
                {data.splitParticipants.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                {t('categoryLabel', language)}
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
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

            {splitMethod !== 'itemized' ? (
              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  {t('totalBillAmountLabel', language, { currency })}
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={totalAmountInput}
                  onChange={(e) => setTotalAmountInput(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono tabular-nums rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
                />
              </div>
            ) : (
              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  {t('computedReceiptTotal', language)}
                </label>
                <div className="px-3 py-2 text-xs font-mono tabular-nums font-semibold rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100">
                  {formatCurrency(computedSplitPreview.effectiveTotal, currency)}
                </div>
              </div>
            )}
          </div>

          {/* 4 Split Modes Segmented Switcher */}
          <div>
            <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              {t('splitCalculationMethod', language)}
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 bg-neutral-100 dark:bg-neutral-800 rounded-lg">
              {(['equal', 'exact', 'ratio', 'itemized'] as const).map((mId) => (
                <button
                  key={mId}
                  type="button"
                  onClick={() => setSplitMethod(mId)}
                  className={`py-2 px-3 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    splitMethod === mId
                      ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-2xs'
                      : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
                  }`}
                >
                  {getMethodLabel(mId)}
                </button>
              ))}
            </div>
          </div>

          {/* Mode-Specific Interactive Allocation Area */}
          {splitMethod !== 'itemized' ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-neutral-500">
                <span>{t('selectIncludedParticipants', language)}</span>
                {splitMethod === 'exact' && (
                  <span
                    className={`font-mono tabular-nums font-medium ${
                      Math.abs(computedSplitPreview.variance) < 0.02
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {Math.abs(computedSplitPreview.variance) < 0.02
                      ? t('exactAmountsMatch', language)
                      : t('unassignedDifference', language, {
                          amount: formatCurrency(
                            computedSplitPreview.variance,
                            currency
                          ),
                        })}
                  </span>
                )}
              </div>

              <div className="divide-y divide-neutral-100 dark:divide-neutral-800 border border-neutral-200 dark:border-neutral-800 rounded-xl overflow-hidden">
                {data.splitParticipants.map((p) => {
                  const isIncluded = selectedParticipantIds.includes(p.id);
                  const previewShare = computedSplitPreview.shares.find(
                    (s) => s.participantId === p.id
                  );

                  return (
                    <div
                      key={p.id}
                      className="p-3.5 flex items-center justify-between gap-4 bg-white dark:bg-neutral-900"
                    >
                      <label className="flex items-center gap-2.5 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isIncluded}
                          onChange={() => toggleParticipantInSplit(p.id)}
                          className="rounded border-neutral-300"
                        />
                        <div>
                          <div className="text-xs font-medium text-neutral-900 dark:text-neutral-100">
                            {p.name}
                          </div>
                          <div className="text-[11px] text-neutral-400">
                            {p.id === effectivePaidById
                              ? t('paidThisBill', language)
                              : t('participantRole', language)}
                          </div>
                        </div>
                      </label>

                      {isIncluded && (
                        <div className="flex items-center gap-3">
                          {splitMethod === 'exact' && (
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0.00"
                              value={exactAmounts[p.id] ?? ''}
                              onChange={(e) =>
                                setExactAmounts((prev) => ({
                                  ...prev,
                                  [p.id]: e.target.value,
                                }))
                              }
                              className="w-24 px-2.5 py-1 text-right text-xs font-mono tabular-nums rounded border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
                            />
                          )}

                          {splitMethod === 'ratio' && (
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                step="0.5"
                                min="0"
                                placeholder="1"
                                value={ratioWeights[p.id] ?? '1'}
                                onChange={(e) =>
                                  setRatioWeights((prev) => ({
                                    ...prev,
                                    [p.id]: e.target.value,
                                  }))
                                }
                                className="w-16 px-2 py-1 text-right text-xs font-mono tabular-nums rounded border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
                              />
                              <span className="text-[11px] text-neutral-400 tabular-nums w-12">
                                ({previewShare?.ratioOrPercent || 0}%)
                              </span>
                            </div>
                          )}

                          <span className="font-mono tabular-nums text-xs font-semibold text-neutral-900 dark:text-neutral-100 min-w-[72px] text-right">
                            {formatCurrency(previewShare?.amount || 0, currency)}
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            /* Itemized Receipt Splitter UI */
            <div className="space-y-4">
              <div className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-950/50 space-y-3">
                <div className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                  {t('receiptLineItemsHint', language)}
                </div>

                {/* Add new line item row */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder={t('itemNamePlaceholder', language)}
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
                  />
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    placeholder={t('pricePlaceholder', language)}
                    value={newItemPrice}
                    onChange={(e) => setNewItemPrice(e.target.value)}
                    className="w-24 px-3 py-1.5 text-xs font-mono tabular-nums rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
                  />
                  <button
                    type="button"
                    onClick={addReceiptItem}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 whitespace-nowrap"
                  >
                    {t('addItemBtn', language)}
                  </button>
                </div>

                {/* Existing line items */}
                <div className="divide-y divide-neutral-200/70 dark:divide-neutral-800">
                  {items.map((item) => (
                    <div
                      key={item.id}
                      className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                    >
                      <div className="flex items-center justify-between sm:justify-start gap-3">
                        <span className="font-medium text-neutral-900 dark:text-neutral-100">
                          {item.name}
                        </span>
                        <span className="font-mono tabular-nums text-neutral-600 dark:text-neutral-400">
                          {formatCurrency(item.price, currency)}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 flex-wrap">
                        {data.splitParticipants.map((p) => {
                          const assigned = item.assignedToIds.includes(p.id);
                          const shortName = p.name.split(' ')[0];
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() =>
                                toggleParticipantOnItem(item.id, p.id)
                              }
                              className={`px-2 py-1 text-[11px] font-medium rounded transition-colors ${
                                assigned
                                  ? 'bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900'
                                  : 'bg-neutral-200/70 dark:bg-neutral-800 text-neutral-500'
                              }`}
                            >
                              {shortName}
                            </button>
                          );
                        })}
                        <button
                          type="button"
                          onClick={() => removeReceiptItem(item.id)}
                          className="p-1 text-neutral-400 hover:text-rose-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Proportional Tax & Tip Inputs */}
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-neutral-200 dark:border-neutral-800">
                  <div>
                    <label className="block text-[11px] text-neutral-500 mb-1">
                      {t('sharedTaxLabel', language, { currency })}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={taxInput}
                      onChange={(e) => setTaxInput(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-neutral-500 mb-1">
                      {t('sharedTipLabel', language, { currency })}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={tipInput}
                      onChange={(e) => setTipInput(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100"
                    />
                  </div>
                </div>
              </div>

              {/* Computed Itemized Summary Per Person */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {computedSplitPreview.shares.map((s) => (
                  <div
                    key={s.participantId}
                    className="p-2.5 rounded-lg border border-neutral-200 dark:border-neutral-800 text-xs"
                  >
                    <div className="text-neutral-500 truncate">
                      {getParticipantName(s.participantId)}
                    </div>
                    <div className="font-mono tabular-nums font-semibold text-neutral-900 dark:text-neutral-100 mt-0.5">
                      {formatCurrency(s.amount, currency)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-3 border-t border-neutral-200 dark:border-neutral-800">
            <div className="text-xs text-neutral-500 tabular-nums">
              {t('totalSharedExpense', language)}{' '}
              <strong className="text-neutral-900 dark:text-neutral-100">
                {formatCurrency(computedSplitPreview.effectiveTotal, currency)}
              </strong>
            </div>

            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-medium rounded-lg bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t('recordSplitBill', language)}</span>
            </button>
          </div>
        </form>

        {/* Right 5 Cols: Add Roommate/Friend + Logged Split Expenses History */}
        <div className="lg:col-span-5 space-y-6">
          {/* Add Roommate / Friend Card */}
          <form
            onSubmit={handleAddFriend}
            className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 space-y-3"
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              <Users className="w-4 h-4 text-neutral-500" />
              <span>{t('addRoommateFriend', language)}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <input
                type="text"
                required
                placeholder={t('fullNamePlaceholder', language)}
                value={newFriendName}
                onChange={(e) => setNewFriendName(e.target.value)}
                className="px-3 py-2 text-xs rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
              />
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder={t('emailOptionalPlaceholder', language)}
                  value={newFriendEmail}
                  onChange={(e) => setNewFriendEmail(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
                />
                <button
                  type="submit"
                  className="px-3 py-2 text-xs font-medium rounded-lg bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 shrink-0"
                  title={t('addFriendTooltip', language)}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </form>

          {/* Logged Split Bills History */}
          <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-5 space-y-4">
            <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              {t('sharedExpenseHistoryCount', language, {
                count: data.splitExpenses.length,
              })}
            </h3>

            <div className="space-y-4">
              {data.splitExpenses.map((exp) => (
                <div
                  key={exp.id}
                  className="p-4 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-neutral-50/40 dark:bg-neutral-950/40 space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                        {exp.title}
                      </div>
                      <div className="text-[11px] text-neutral-500 mt-0.5 tabular-nums flex items-center flex-wrap gap-1">
                        <span>{exp.date}</span>
                        <span aria-hidden="true">·</span>
                        <label className="inline-flex items-center gap-1">
                          <span>{t('paidByInline', language)}</span>
                          <select
                            aria-label={`${t('paidByInline', language)} ${exp.title}`}
                            value={exp.paidById}
                            onChange={(e) =>
                              updateSplitExpensePayer(exp.id, e.target.value)
                            }
                            className="px-1.5 py-0.5 text-[11px] font-medium rounded border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-1 focus:ring-neutral-400"
                          >
                            {data.splitParticipants.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <span aria-hidden="true">·</span>
                        <span>{getMethodLabel(exp.splitMethod)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="font-mono tabular-nums text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                        {formatCurrency(exp.totalAmount, currency)}
                      </span>
                      <button
                        onClick={() => deleteSplitExpense(exp.id)}
                        className="p-1 text-neutral-400 hover:text-rose-600"
                        title={t('deleteSharedBillTooltip', language)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Individual Share Settlement Toggles */}
                  <div className="divide-y divide-neutral-200/60 dark:divide-neutral-800/70 text-xs">
                    {exp.splits.map((s) => (
                      <div
                        key={s.participantId}
                        className="py-1.5 flex items-center justify-between"
                      >
                        <span className="text-neutral-700 dark:text-neutral-300">
                          {getParticipantName(s.participantId)}
                          {s.ratioOrPercent
                            ? ` (${s.ratioOrPercent}%)`
                            : ''}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono tabular-nums font-medium text-neutral-900 dark:text-neutral-100">
                            {formatCurrency(s.amount, currency)}
                          </span>
                          <button
                            onClick={() =>
                              toggleSplitSettled(exp.id, s.participantId)
                            }
                            className={`inline-flex items-center gap-1 text-[11px] font-medium ${
                              s.settled
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-amber-600 dark:text-amber-400 hover:underline'
                            }`}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>
                              {s.settled ? t('settled', language) : t('markPaid', language)}
                            </span>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Popup Modal: Edit Roommate / Friend Detail */}
      {editingParticipantId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4"
          onClick={() => setEditingParticipantId(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 shadow-xl space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-neutral-200 dark:border-neutral-800">
              <div>
                <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                  {t('editRoommateFriend', language)}
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                  {t('editRoommateFriendSub', language)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingParticipantId(null)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                aria-label={t('close', language)}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveParticipant} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  {t('displayNameLabel', language)}
                </label>
                <input
                  type="text"
                  required
                  value={editParticipantForm.name}
                  onChange={(e) =>
                    setEditParticipantForm((prev) => ({
                      ...prev,
                      name: e.target.value,
                    }))
                  }
                  placeholder={t('displayNamePlaceholder', language)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  {t('emailAddressOptional', language)}
                </label>
                <input
                  type="email"
                  value={editParticipantForm.email}
                  onChange={(e) =>
                    setEditParticipantForm((prev) => ({
                      ...prev,
                      email: e.target.value,
                    }))
                  }
                  placeholder={t('emailOptionalPlaceholder', language)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
                />
              </div>

              <label className="flex items-center gap-2.5 p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-950/50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editParticipantForm.setAsDefaultPayer}
                  onChange={(e) =>
                    setEditParticipantForm((prev) => ({
                      ...prev,
                      setAsDefaultPayer: e.target.checked,
                    }))
                  }
                  className="rounded border-neutral-300"
                />
                <div>
                  <div className="text-xs font-medium text-neutral-900 dark:text-neutral-100">
                    {t('setAsDefaultPayer', language)}
                  </div>
                  <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    {t('setAsDefaultPayerSub', language)}
                  </div>
                </div>
              </label>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-200 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => setEditingParticipantId(null)}
                  className="px-3.5 py-2 text-xs font-medium rounded-lg border border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                >
                  {t('cancel', language)}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-medium rounded-lg bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-200"
                >
                  {t('saveChanges', language)}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
