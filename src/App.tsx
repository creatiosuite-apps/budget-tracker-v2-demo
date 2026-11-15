/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import {
  Calendar,
  CreditCard,
  HardDrive,
  LayoutDashboard,
  Menu,
  Moon,
  PieChart,
  Plus,
  Receipt,
  Settings,
  Sun,
  Target,
  TrendingDown,
  WifiOff,
  X,
} from 'lucide-react';
import { OfflineSyncBanner } from './components/OfflineSyncBanner';
import { PWAInstallButton } from './components/PWAInstallButton';
import { TransactionModal } from './components/TransactionModal';
import { FinanceProvider, useFinance } from './context/FinanceContext';
import { BillsSubscriptionsPage } from './pages/BillsSubscriptionsPage';
import { DashboardPage } from './pages/DashboardPage';
import { DebtPayoffPage } from './pages/DebtPayoffPage';
import { MonthlyBudgetPage } from './pages/MonthlyBudgetPage';
import { MonthlyCalendarPage } from './pages/MonthlyCalendarPage';
import { SavingGoalsPage } from './pages/SavingGoalsPage';
import { SettingsPage } from './pages/SettingsPage';
import { SplitBillsPage } from './pages/SplitBillsPage';
import { PageId } from './types/finance';
import {
  getFormattedTodayDateText,
  getTimeGreetingText,
  t,
} from './utils/i18n';

const NAV_ITEMS: {
  id: PageId;
  labelKey:
    | 'dashboard'
    | 'budget'
    | 'calendar'
    | 'savings'
    | 'bills'
    | 'debt'
    | 'split'
    | 'settings';
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'dashboard', labelKey: 'dashboard', icon: LayoutDashboard },
  { id: 'budget', labelKey: 'budget', icon: PieChart },
  { id: 'calendar', labelKey: 'calendar', icon: Calendar },
  { id: 'savings', labelKey: 'savings', icon: Target },
  { id: 'bills', labelKey: 'bills', icon: CreditCard },
  { id: 'debt', labelKey: 'debt', icon: TrendingDown },
  { id: 'split', labelKey: 'split', icon: Receipt },
  { id: 'settings', labelKey: 'settings', icon: Settings },
];

const AppWorkspace: React.FC = () => {
  const {
    data,
    activePage,
    setActivePage,
    openTxModal,
    toggleTheme,
    isOnline,
  } = useFinance();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { language, theme, userName } = data.settings;

  useEffect(() => {
    if (!sidebarOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSidebarOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [sidebarOpen]);

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard':
        return <DashboardPage />;
      case 'budget':
        return <MonthlyBudgetPage />;
      case 'calendar':
        return <MonthlyCalendarPage />;
      case 'savings':
        return <SavingGoalsPage />;
      case 'bills':
        return <BillsSubscriptionsPage />;
      case 'debt':
        return <DebtPayoffPage />;
      case 'split':
        return <SplitBillsPage />;
      case 'settings':
        return <SettingsPage />;
      default:
        return <DashboardPage />;
    }
  };

  const handleNavClick = (page: PageId) => {
    setActivePage(page);
    setSidebarOpen(false);
  };

  return (
    <div className="min-h-screen flex bg-[#FAFAFA] dark:bg-[#0B0F17] text-neutral-900 dark:text-neutral-100 transition-colors">
      {/* Backdrop Overlay when retractable sidebar is open */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/45 backdrop-blur-[1px] z-40 transition-opacity"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Retractable Left Navigation Sidebar (All Viewports) */}
      <aside
        id="main-sidebar-nav"
        aria-hidden={!sidebarOpen}
        className={`fixed inset-y-0 left-0 w-64 max-w-[85vw] flex flex-col border-r border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 z-50 shadow-xl transition-transform duration-200 ease-out ${
          sidebarOpen
            ? 'translate-x-0 pointer-events-auto'
            : '-translate-x-full pointer-events-none'
        }`}
      >
        {/* Brand Header + Close Button */}
        <div className="h-16 px-5 flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800">
          <button
            onClick={() => handleNavClick('dashboard')}
            className="flex flex-col items-start text-left shrink-0"
          >
            <span className="text-base font-bold tracking-tight text-neutral-900 dark:text-white leading-tight whitespace-nowrap">
              Budget Tracker
            </span>
            <span className="text-[11px] font-normal text-neutral-400 dark:text-neutral-500 leading-tight whitespace-nowrap mt-0.5">
              {t('byCreator', language)}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            aria-label={t('closeNavMenu', language)}
            className="p-1.5 rounded-lg text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Links (All 8 Pages) */}
        <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900'
                    : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100/80 dark:hover:bg-neutral-800/60'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{t(item.labelKey, language)}</span>
              </button>
            );
          })}
        </nav>

        {/* Bottom Workspace Controls: PWA Install + Demo Status + Theme Switch + User */}
        <div className="p-4 border-t border-neutral-200 dark:border-neutral-800 space-y-3">
          <PWAInstallButton />

          <div className="flex items-center justify-between text-xs">
            <div className="inline-flex items-center gap-1.5 text-neutral-600 dark:text-neutral-400">
              {!isOnline ? (
                <WifiOff className="w-3.5 h-3.5 text-amber-500" />
              ) : (
                <HardDrive className="w-3.5 h-3.5 text-neutral-500" />
              )}
              <span>
                {!isOnline
                  ? t('offlineCached', language)
                  : 'Demo · Local Storage'}
              </span>
            </div>

            <button
              onClick={toggleTheme}
              className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors"
              aria-label={t('toggleThemeTooltip', language)}
              title={t('toggleThemeTooltip', language)}
            >
              {theme === 'dark' ? (
                <Sun className="w-3.5 h-3.5 text-amber-400" />
              ) : (
                <Moon className="w-3.5 h-3.5" />
              )}
            </button>
          </div>

          <div className="pt-2 border-t border-neutral-100 dark:border-neutral-800/80 flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
            <span className="truncate font-medium text-neutral-800 dark:text-neutral-200">
              {userName}
            </span>
            <span className="font-mono tabular-nums">
              {data.settings.currency}
            </span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar Contract: 3 Zones separated by gap-8 */}
        <header className="h-16 px-6 border-b border-neutral-200 dark:border-neutral-800 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-xs sticky top-0 z-20 flex items-center justify-between gap-8">
          {/* Zone 1: Retractable Sidebar Toggle + Greeting / Date */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setSidebarOpen((prev) => !prev)}
              aria-expanded={sidebarOpen}
              aria-controls="main-sidebar-nav"
              className="p-1.5 rounded-lg text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
              aria-label={t('toggleNavMenu', language)}
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="flex flex-col leading-tight min-w-0">
              <span className="text-sm font-semibold tracking-tight text-neutral-900 dark:text-neutral-100 whitespace-nowrap truncate max-w-[240px] sm:max-w-xs">
                {getTimeGreetingText(userName, language)}
              </span>
              <span className="text-[11px] font-normal text-neutral-400 dark:text-neutral-500 whitespace-nowrap mt-0.5">
                {getFormattedTodayDateText(language)}
              </span>
            </div>
          </div>

          {/* Zone 2: Desktop-only single-line navigation links */}
          <nav className="hidden lg:flex items-center gap-6 text-xs font-medium text-neutral-600 dark:text-neutral-400">
            {(
              [
                { id: 'dashboard', label: t('dashboard', language) },
                { id: 'budget', label: t('budget', language) },
                { id: 'calendar', label: t('calendar', language) },
                { id: 'savings', label: t('savings', language) },
                { id: 'bills', label: t('billsShort', language) },
                { id: 'debt', label: t('debt', language) },
              ] as const
            ).map((link) => (
              <button
                key={link.id}
                onClick={() => setActivePage(link.id)}
                className={`hover:text-neutral-900 dark:hover:text-neutral-100 transition-colors whitespace-nowrap shrink-0 ${
                  activePage === link.id
                    ? 'text-neutral-900 dark:text-white underline underline-offset-4'
                    : ''
                }`}
              >
                {link.label}
              </button>
            ))}
          </nav>

          {/* Zone 3: Primary Action + Install CTA (Desktop/Tablet) */}
          <div className="hidden md:flex items-center gap-2.5 shrink-0">
            <PWAInstallButton compact />
            <button
              onClick={() => openTxModal()}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white dark:text-neutral-900 bg-neutral-900 dark:bg-neutral-100 rounded-lg hover:bg-neutral-800 dark:hover:bg-neutral-200 transition-colors whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t('addTransaction', language)}</span>
            </button>
          </div>
        </header>

        {/* Page Viewport */}
        <main className="flex-1 w-full bg-gradient-to-br from-[#F8FAFC] via-[#F2F7F5] to-[#EDF3FA] dark:from-[#0B0F17] dark:via-[#0D141B] dark:to-[#0F1722]">
          <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-24 md:pb-8">
            {renderPage()}
          </div>
        </main>
      </div>

      {/* Mobile / Small Display Floating Bottom-Center Add Transaction Button */}
      <button
        type="button"
        onClick={() => openTxModal()}
        aria-label={t('addTransaction', language)}
        title={t('addTransaction', language)}
        className="md:hidden fixed bottom-5 left-1/2 -translate-x-1/2 z-40 w-12 h-12 rounded-full flex items-center justify-center text-white dark:text-neutral-900 bg-neutral-900 dark:bg-neutral-100 shadow-lg hover:bg-neutral-800 dark:hover:bg-neutral-200 active:scale-95 transition-all"
      >
        <Plus className="w-5 h-5" />
      </button>

      {/* Global Quick Add Transaction Modal */}
      <TransactionModal />

      {/* Offline Mode & Queued Sync Status Indicator */}
      <OfflineSyncBanner />
    </div>
  );
};

export default function App() {
  return (
    <FinanceProvider>
      <AppWorkspace />
    </FinanceProvider>
  );
}
