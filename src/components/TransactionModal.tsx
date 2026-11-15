import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useFinance } from '../context/FinanceContext';
import { t } from '../utils/i18n';

function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export const TransactionModal: React.FC = () => {
  const {
    data,
    isTxModalOpen,
    txModalDefaultDate,
    editingTransaction,
    closeTxModal,
    addTransaction,
    updateTransaction,
  } = useFinance();
  const { language, currency } = data.settings;

  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(() => getTodayDateString());
  const [category, setCategory] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Sapphire Visa');
  const [notes, setNotes] = useState('');

  const filteredCategories = data.categories.filter((c) => c.type === type);

  useEffect(() => {
    if (!isTxModalOpen) return;

    if (editingTransaction) {
      setType(editingTransaction.type);
      setDescription(editingTransaction.description);
      setAmount(String(editingTransaction.amount));
      setDate(editingTransaction.date);
      setCategory(editingTransaction.category);
      setPaymentMethod(editingTransaction.paymentMethod || 'Card');
      setNotes(editingTransaction.notes || '');
    } else {
      const defaultType: 'expense' | 'income' = 'expense';
      setType(defaultType);
      setDescription('');
      setAmount('');
      setDate(txModalDefaultDate || getTodayDateString());
      const firstCat = data.categories.find((c) => c.type === defaultType);
      setCategory(firstCat ? firstCat.name : 'General');
      setPaymentMethod('Sapphire Visa');
      setNotes('');
    }
  }, [isTxModalOpen, editingTransaction, txModalDefaultDate, data.categories]);

  useEffect(() => {
    if (!isTxModalOpen) return;
    if (
      filteredCategories.length > 0 &&
      !filteredCategories.some((c) => c.name === category)
    ) {
      setCategory(filteredCategories[0].name);
    }
  }, [type, isTxModalOpen, filteredCategories, category]);

  if (!isTxModalOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = parseFloat(amount);
    if (!description.trim() || isNaN(numericAmount) || numericAmount <= 0) {
      return;
    }

    const fallbackCat = type === 'income' ? 'Primary Salary' : 'General';
    const payload = {
      date,
      description: description.trim(),
      amount: numericAmount,
      type,
      category: category || fallbackCat,
      paymentMethod: paymentMethod.trim() || 'Card',
      notes: notes.trim() || undefined,
    };

    if (editingTransaction) {
      updateTransaction({
        ...editingTransaction,
        ...payload,
      });
    } else {
      addTransaction(payload);
    }

    setDescription('');
    setAmount('');
    setNotes('');
    closeTxModal();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
      <div className="w-full max-w-md rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-6 shadow-xl">
        <div className="flex items-center justify-between pb-4 border-b border-neutral-200 dark:border-neutral-800">
          <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
            {editingTransaction
              ? t('editTransaction', language)
              : t('recordTransaction', language)}
          </h2>
          <button
            onClick={closeTxModal}
            className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
            aria-label={t('close', language)}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Type Switcher */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-neutral-100 dark:bg-neutral-800 rounded-lg">
            <button
              type="button"
              onClick={() => setType('expense')}
              className={`py-2 px-4 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                type === 'expense'
                  ? 'bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400'
              }`}
            >
              {t('expenseOutflow', language)}
            </button>
            <button
              type="button"
              onClick={() => setType('income')}
              className={`py-2 px-4 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                type === 'income'
                  ? 'bg-white dark:bg-neutral-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                  : 'text-neutral-600 dark:text-neutral-400'
              }`}
            >
              {t('incomeInflow', language)}
            </button>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              {t('descriptionLabel', language)}
            </label>
            <input
              type="text"
              required
              placeholder={t('descriptionPlaceholder', language)}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-300"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                {t('amountLabel', language, { currency })}
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3 py-2 text-sm tabular-nums rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-300"
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
                className="w-full px-3 py-2 text-sm tabular-nums rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-300"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                {t('categoryLabel', language)}
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-300"
              >
                {filteredCategories.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                {t('paymentAccountLabel', language)}
              </label>
              <input
                type="text"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                placeholder={t('paymentAccountPlaceholder', language)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-300"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              {t('optionalNoteLabel', language)}
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('optionalNotePlaceholder', language)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-neutral-900 dark:focus:ring-neutral-300"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-neutral-200 dark:border-neutral-800">
            <button
              type="button"
              onClick={closeTxModal}
              className="px-4 py-2 text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors"
            >
              {t('cancel', language)}
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium rounded-lg bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors"
            >
              {editingTransaction
                ? t('updateTransaction', language)
                : t('saveTransaction', language)}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
