import React, { useState } from 'react';
import {
  AlertTriangle,
  HardDrive,
  Lock,
  Moon,
  Plus,
  RotateCcw,
  Sun,
  Trash2,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import { PWAInstallButton } from '../components/PWAInstallButton';
import { useFinance } from '../context/FinanceContext';
import { CurrencyCode, LanguageCode } from '../types/finance';
import {
  DEMO_LIMITS,
  getCustomCategoryCount,
  isCustomCategory,
} from '../utils/demoLimits';
import { CURRENCY_CONFIG, getLocalizedGroupLabel, t } from '../utils/formatters';

export const SettingsPage: React.FC = () => {
  const {
    data,
    updateSettings,
    toggleTheme,
    addCategory,
    deleteCategory,
    isOnline,
    storageEngine,
    clearAllTransactions,
    resetToDemoData,
  } = useFinance();

  const { settings } = data;
  const { language } = settings;

  const [showClearModal, setShowClearModal] = useState(false);
  const [clearConfirmInput, setClearConfirmInput] = useState('');
  const [clearedToast, setClearedToast] = useState(false);

  // Custom Category state
  const [catName, setCatName] = useState('');
  const [catGroup, setCatGroup] = useState<
    'Needs' | 'Wants' | 'Savings' | 'Income'
  >('Wants');
  const [catLimit, setCatLimit] = useState('300');
  const [catColor, setCatColor] = useState('#2563EB');

  const customCategoryCount = getCustomCategoryCount(data.categories);
  const customCatLimitReached =
    customCategoryCount >= DEMO_LIMITS.MAX_CUSTOM_CATEGORIES;

  const handleAddCustomCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (customCatLimitReached) return;
    const limitNum = parseFloat(catLimit) || 250;
    if (!catName.trim()) return;
    addCategory({
      name: catName.trim(),
      group: catGroup,
      type: catGroup === 'Income' ? 'income' : 'expense',
      monthlyLimit: limitNum,
      color: catColor,
    });
    setCatName('');
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
            {t('settingsTitle', language)}
          </h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
            {t('settingsSub', language)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start">
          <PWAInstallButton compact />
          {clearedToast && (
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 px-2">
              {t('transactionsClearedToast', language)}
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              setClearConfirmInput('');
              setShowClearModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{t('clearAllDataBtn', language)}</span>
          </button>
          <button
            onClick={resetToDemoData}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium rounded-lg border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{t('resetDemoLedgerBtn', language)}</span>
          </button>
        </div>
      </div>

      {/* Section 1: Demo Mode Notice (Google Sheets Apps Script Disabled) */}
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-neutral-200 dark:border-neutral-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 shrink-0">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                {t('sheetsIntegrationTitle', language)}
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                Unavailable in demo mode · Local browser storage only
              </p>
            </div>
          </div>

          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border border-amber-200 dark:border-amber-800/70 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 self-start sm:self-auto">
            <Lock className="w-3 h-3" />
            <span>Demo Restricted</span>
          </span>
        </div>

        <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
          Google Sheets Apps Script synchronization is disabled in this demo
          edition. All ledger entries, budgets, recurring bills, savings goals,
          and debt plans are saved locally in your browser.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-1 text-xs">
          <div className="rounded-lg border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-950/40 px-3 py-2">
            <div className="text-[11px] text-neutral-500">Transactions</div>
            <div className="font-semibold tabular-nums text-neutral-900 dark:text-neutral-100 mt-0.5">
              {data.transactions.length} / {DEMO_LIMITS.MAX_TRANSACTIONS}
            </div>
          </div>
          <div className="rounded-lg border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-950/40 px-3 py-2">
            <div className="text-[11px] text-neutral-500">Recurring Bills</div>
            <div className="font-semibold tabular-nums text-neutral-900 dark:text-neutral-100 mt-0.5">
              {data.bills.length} / {DEMO_LIMITS.MAX_BILLS}
            </div>
          </div>
          <div className="rounded-lg border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-950/40 px-3 py-2">
            <div className="text-[11px] text-neutral-500">Savings Goals</div>
            <div className="font-semibold tabular-nums text-neutral-900 dark:text-neutral-100 mt-0.5">
              {data.savingsGoals.length} / {DEMO_LIMITS.MAX_SAVINGS_GOALS}
            </div>
          </div>
          <div className="rounded-lg border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-950/40 px-3 py-2">
            <div className="text-[11px] text-neutral-500">Debt Accounts</div>
            <div className="font-semibold tabular-nums text-neutral-900 dark:text-neutral-100 mt-0.5">
              {data.debts.length} / {DEMO_LIMITS.MAX_DEBTS}
            </div>
          </div>
          <div className="rounded-lg border border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-950/40 px-3 py-2">
            <div className="text-[11px] text-neutral-500">Custom Categories</div>
            <div className="font-semibold tabular-nums text-neutral-900 dark:text-neutral-100 mt-0.5">
              {customCategoryCount} / {DEMO_LIMITS.MAX_CUSTOM_CATEGORIES}
            </div>
          </div>
        </div>

        <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800 flex flex-wrap items-center gap-3 text-xs text-neutral-600 dark:text-neutral-400">
          <span className="inline-flex items-center gap-1.5 font-medium text-neutral-800 dark:text-neutral-200">
            {isOnline ? (
              <Wifi className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <WifiOff className="w-3.5 h-3.5 text-amber-500" />
            )}
            {isOnline ? t('onlineStatus', language) : t('offlineModeStatus', language)}
          </span>
          <span className="text-neutral-300 dark:text-neutral-700">|</span>
          <span className="inline-flex items-center gap-1.5">
            <HardDrive className="w-3.5 h-3.5 text-neutral-500" />
            {t('storageLabel', language)}{' '}
            <strong className="font-medium text-neutral-800 dark:text-neutral-200">
              {storageEngine}
            </strong>
          </span>
        </div>
      </div>

      {/* Section 2: Personal Profile, Currency, Language & Appearance */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                {t('profileLocalizationTitle', language)}
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                {t('profileLocalizationSub', language)}
              </p>
            </div>
          </div>

          <div className="space-y-3.5">
            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                {t('yourNameLabel', language)}
              </label>
              <input
                type="text"
                value={settings.userName}
                onChange={(e) => updateSettings({ userName: e.target.value })}
                className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                {t('householdLedgerLabel', language)}
              </label>
              <input
                type="text"
                value={settings.householdName}
                onChange={(e) =>
                  updateSettings({ householdName: e.target.value })
                }
                className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  {t('currencyPreferenceLabel', language)}
                </label>
                <select
                  value={settings.currency}
                  onChange={(e) =>
                    updateSettings({
                      currency: e.target.value as CurrencyCode,
                    })
                  }
                  className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
                >
                  {(Object.keys(CURRENCY_CONFIG) as CurrencyCode[]).map(
                    (code) => (
                      <option key={code} value={code}>
                        {code} — {CURRENCY_CONFIG[code].name}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                  {t('interfaceLanguageLabel', language)}
                </label>
                <select
                  value={settings.language}
                  onChange={(e) =>
                    updateSettings({
                      language: e.target.value as LanguageCode,
                    })
                  }
                  className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100"
                >
                  <option value="en">English (US)</option>
                  <option value="es">Español</option>
                  <option value="fr">Français</option>
                  <option value="de">Deutsch</option>
                  <option value="it">Italiano</option>
                  <option value="nl">Nederlands</option>
                  <option value="ja">日本語 (Japanese)</option>
                  <option value="hi">हिन्दी (Hindi)</option>
                </select>
              </div>
            </div>

            {/* Light / Dark Mode Appearance Switch */}
            <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800 flex items-center justify-between">
              <div>
                <div className="text-xs font-medium text-neutral-900 dark:text-neutral-100">
                  {t('colorThemeMode', language)}
                </div>
                <div className="text-[11px] text-neutral-500">
                  {t('colorThemeSub', language)}
                </div>
              </div>

              <button
                type="button"
                onClick={toggleTheme}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100"
              >
                {settings.theme === 'dark' ? (
                  <>
                    <Sun className="w-3.5 h-3.5 text-amber-400" />
                    <span>{t('switchToLightMode', language)}</span>
                  </>
                ) : (
                  <>
                    <Moon className="w-3.5 h-3.5 text-neutral-600" />
                    <span>{t('switchToDarkMode', language)}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right 6 Cols: Custom Categories Manager */}
        <div className="lg:col-span-6 rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 space-y-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                {t('customCategoriesTitle', language)}
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                {t('customCategoriesSub', language)}
              </p>
            </div>
            <span
              className={`px-2 py-0.5 text-[11px] font-medium tabular-nums rounded-md border shrink-0 ${
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
                custom category below to add a new one.
              </span>
            </div>
          )}

          <form
            onSubmit={handleAddCustomCategory}
            className="grid grid-cols-1 sm:grid-cols-12 gap-2"
          >
            <input
              type="text"
              required
              disabled={customCatLimitReached}
              placeholder={t('newCatNamePlaceholder', language)}
              value={catName}
              onChange={(e) => setCatName(e.target.value)}
              className="sm:col-span-5 px-3 py-2 text-xs rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 disabled:opacity-50"
            />
            <select
              value={catGroup}
              disabled={customCatLimitReached}
              onChange={(e) =>
                setCatGroup(
                  e.target.value as 'Needs' | 'Wants' | 'Savings' | 'Income'
                )
              }
              className="sm:col-span-3 px-2.5 py-2 text-xs rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 disabled:opacity-50"
            >
              <option value="Needs">{t('groupNeeds', language)}</option>
              <option value="Wants">{t('groupWants', language)}</option>
              <option value="Savings">{t('groupSavings', language)}</option>
              <option value="Income">{t('groupIncome', language)}</option>
            </select>
            <input
              type="number"
              min="1"
              disabled={customCatLimitReached}
              placeholder={t('limitPlaceholder', language)}
              value={catLimit}
              onChange={(e) => setCatLimit(e.target.value)}
              className="sm:col-span-2 px-2.5 py-2 text-xs tabular-nums rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={customCatLimitReached}
              className="sm:col-span-2 inline-flex items-center justify-center gap-1 px-3 py-2 text-xs font-medium rounded-lg bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 disabled:opacity-45 disabled:cursor-not-allowed"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t('addBtn', language)}</span>
            </button>
          </form>

          {/* Swatch selector */}
          <div className="flex items-center gap-2 text-xs text-neutral-500">
            <span>{t('colorSwatchLabel', language)}</span>
            {[
              '#2563EB',
              '#059669',
              '#D97706',
              '#7C3AED',
              '#DB2777',
              '#0D9488',
              '#E11D48',
            ].map((c) => (
              <button
                key={c}
                type="button"
                disabled={customCatLimitReached}
                onClick={() => setCatColor(c)}
                className={`w-4 h-4 rounded-full disabled:opacity-50 ${
                  catColor === c
                    ? 'ring-2 ring-offset-1 ring-neutral-900 dark:ring-white'
                    : ''
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>

          <div className="max-h-60 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800 border-t border-neutral-100 dark:border-neutral-800 pt-2">
            {data.categories.map((cat) => (
              <div
                key={cat.id}
                className="py-2 flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-xs shrink-0"
                    style={{ backgroundColor: cat.color }}
                  />
                  <span className="font-medium text-neutral-900 dark:text-neutral-100">
                    {cat.name}
                  </span>
                  <span className="text-neutral-400">
                    · {getLocalizedGroupLabel(cat.group, language)} (
                    {cat.type === 'income'
                      ? t('incomeTypeLabel', language)
                      : t('expenseTypeLabel', language)}
                    )
                  </span>
                  {isCustomCategory(cat) && (
                    <span className="px-1.5 py-0.5 text-[10px] font-medium rounded bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">
                      Custom
                    </span>
                  )}
                </div>
                <button
                  onClick={() => deleteCategory(cat.id)}
                  className="p-1 text-neutral-400 hover:text-rose-600"
                  title={t('deleteCategoryTooltip', language)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Clear All Transaction Records Confirmation Popup */}
      {showClearModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-6 shadow-xl space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                    {t('clearModalTitle', language)}
                  </h3>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                    {t('clearModalSubtitle', language)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowClearModal(false);
                  setClearConfirmInput('');
                }}
                aria-label={t('close', language)}
                className="p-1 rounded-lg text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-neutral-600 dark:text-neutral-300 leading-relaxed">
              {t('clearModalBodyBase', language, {
                count: data.transactions.length,
                recordWord:
                  data.transactions.length === 1
                    ? t('clearModalRecordSingular', language)
                    : t('clearModalRecordPlural', language),
                sheetsClause: '',
              })}
            </p>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (clearConfirmInput.trim().toLowerCase() !== 'clear all') {
                  return;
                }
                clearAllTransactions();
                setShowClearModal(false);
                setClearConfirmInput('');
                setClearedToast(true);
                window.setTimeout(() => setClearedToast(false), 3000);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">
                  {t('typeWordPrefix', language)}{' '}
                  <code className="px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-neutral-800 font-mono text-rose-600 dark:text-rose-400">
                    clear all
                  </code>{' '}
                  {t('toConfirmSuffix', language)}
                </label>
                <input
                  type="text"
                  autoFocus
                  value={clearConfirmInput}
                  onChange={(e) => setClearConfirmInput(e.target.value)}
                  placeholder="clear all"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-950 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-200 dark:border-neutral-800">
                <button
                  type="button"
                  onClick={() => {
                    setShowClearModal(false);
                    setClearConfirmInput('');
                  }}
                  className="px-4 py-2 text-xs font-medium rounded-lg border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                >
                  {t('cancel', language)}
                </button>
                <button
                  type="submit"
                  disabled={
                    clearConfirmInput.trim().toLowerCase() !== 'clear all'
                  }
                  className="px-4 py-2 text-xs font-medium rounded-lg bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-45 disabled:cursor-not-allowed transition-colors"
                >
                  {t('clearAllTransactionsBtn', language)}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
