import {
  BudgetCategory,
  CurrencyCode,
  DebtAccount,
  LanguageCode,
} from '../types/finance';
import {
  formatMonthOnlyName,
  formatMonthYearLabel,
  getFormattedTodayDateText,
  getLocaleForLanguage,
  getLocalizedGroupLabel,
  getLocalizedWeekdays,
  getTimeGreetingText,
  t,
  TranslationKey,
} from './i18n';

export {
  formatMonthOnlyName,
  formatMonthYearLabel,
  getFormattedTodayDateText,
  getLocaleForLanguage,
  getLocalizedGroupLabel,
  getLocalizedWeekdays,
  getTimeGreetingText,
  t,
};
export type { TranslationKey };

export function getCategoryLimitForMonth(
  category: BudgetCategory,
  month: string
): number {
  if (
    category.monthlyOverrides &&
    Object.prototype.hasOwnProperty.call(category.monthlyOverrides, month)
  ) {
    return category.monthlyOverrides[month];
  }
  return category.monthlyLimit;
}

export function getMonthlyExpenseBudget(
  categories: BudgetCategory[],
  month: string
): number {
  return categories
    .filter((c) => c.type === 'expense')
    .reduce((sum, c) => sum + getCategoryLimitForMonth(c, month), 0);
}

export function getMonthlyIncomeBudget(
  categories: BudgetCategory[],
  month: string
): number {
  return categories
    .filter((c) => c.type === 'income')
    .reduce((sum, c) => sum + getCategoryLimitForMonth(c, month), 0);
}

export const CURRENCY_CONFIG: Record<
  CurrencyCode,
  { symbol: string; locale: string; name: string }
> = {
  USD: { symbol: '$', locale: 'en-US', name: 'US Dollar ($)' },
  EUR: { symbol: '€', locale: 'de-DE', name: 'Euro (€)' },
  GBP: { symbol: '£', locale: 'en-GB', name: 'British Pound (£)' },
  INR: { symbol: '₹', locale: 'en-IN', name: 'Indian Rupee (₹)' },
  JPY: { symbol: '¥', locale: 'ja-JP', name: 'Japanese Yen (¥)' },
  CAD: { symbol: 'C$', locale: 'en-CA', name: 'Canadian Dollar (C$)' },
  AUD: { symbol: 'A$', locale: 'en-AU', name: 'Australian Dollar (A$)' },
  SGD: { symbol: 'S$', locale: 'en-SG', name: 'Singapore Dollar (S$)' },
};

export function formatCurrency(
  amount: number,
  currency: CurrencyCode = 'USD',
  options?: { maximumFractionDigits?: number; showSign?: boolean }
): string {
  const cfg = CURRENCY_CONFIG[currency] || CURRENCY_CONFIG.USD;
  const maxDecimals =
    options?.maximumFractionDigits !== undefined
      ? options.maximumFractionDigits
      : currency === 'JPY'
      ? 0
      : 2;

  const absVal = Math.abs(amount);
  const formatted = new Intl.NumberFormat(cfg.locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: maxDecimals === 0 ? 0 : 2,
    maximumFractionDigits: maxDecimals,
  }).format(absVal);

  if (options?.showSign) {
    if (amount > 0) return `+${formatted}`;
    if (amount < 0) return `-${formatted}`;
  } else if (amount < 0) {
    return `-${formatted}`;
  }
  return formatted;
}

export function formatCompactCurrency(
  amount: number,
  currency: CurrencyCode = 'USD'
): string {
  const cfg = CURRENCY_CONFIG[currency] || CURRENCY_CONFIG.USD;
  if (Math.abs(amount) < 1000) {
    return formatCurrency(amount, currency, { maximumFractionDigits: 0 });
  }
  return new Intl.NumberFormat(cfg.locale, {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(amount);
}

export interface DebtSimulationMonth {
  monthIndex: number;
  label: string;
  totalRemainingStrategy: number;
  totalRemainingBaseline: number;
  totalPrincipalPaidStrategy: number;
  totalInterestPaidStrategy: number;
  monthlyPaymentTotal: number;
  breakdownByDebt: Record<
    string,
    {
      balance: number;
      payment: number;
      interest: number;
      principal: number;
    }
  >;
}

export interface RankedDebtItem extends DebtAccount {
  rank: number;
  payoffMonthsStrategy: number;
  payoffMonthsBaseline: number;
  totalInterestStrategy: number;
  totalInterestBaseline: number;
  interestSaved: number;
}

export interface DebtPayoffSimulationResult {
  rankedDebts: RankedDebtItem[];
  schedule: DebtSimulationMonth[];
  totalBalance: number;
  totalMinimumPayment: number;
  monthsToPayoffStrategy: number;
  monthsToPayoffBaseline: number;
  monthsSaved: number;
  totalInterestStrategy: number;
  totalInterestBaseline: number;
  interestSaved: number;
  debtFreeDateStrategy: string;
  debtFreeDateBaseline: string;
}

export function simulateDebtPayoff(
  debts: DebtAccount[],
  strategy: 'snowball' | 'avalanche',
  extraMonthlyPayment: number,
  lang: LanguageCode = 'en'
): DebtPayoffSimulationResult {
  const activeDebts = debts.filter((d) => d.balance > 0);
  if (activeDebts.length === 0) {
    return {
      rankedDebts: [],
      schedule: [],
      totalBalance: 0,
      totalMinimumPayment: 0,
      monthsToPayoffStrategy: 0,
      monthsToPayoffBaseline: 0,
      monthsSaved: 0,
      totalInterestStrategy: 0,
      totalInterestBaseline: 0,
      interestSaved: 0,
      debtFreeDateStrategy: t('debtFree', lang),
      debtFreeDateBaseline: t('debtFree', lang),
    };
  }

  // Sort debts according to chosen strategy:
  // Snowball: smallest balance first (tie-break by highest APR)
  // Avalanche: highest APR first (tie-break by smallest balance)
  const sorted = [...activeDebts].sort((a, b) => {
    if (strategy === 'snowball') {
      if (a.balance !== b.balance) return a.balance - b.balance;
      return b.apr - a.apr;
    } else {
      if (b.apr !== a.apr) return b.apr - a.apr;
      return a.balance - b.balance;
    }
  });

  const MAX_MONTHS = 360; // 30 years cap

  // Helper to run simulation for a given extra monthly payment and rollover behavior
  const runSim = (extra: number, rolloverPaidOffMinimums: boolean) => {
    const balances: Record<string, number> = {};
    const interestAccum: Record<string, number> = {};
    const payoffMonth: Record<string, number> = {};

    sorted.forEach((d) => {
      balances[d.id] = d.balance;
      interestAccum[d.id] = 0;
      payoffMonth[d.id] = 0;
    });

    const monthlyRecords: {
      totalRemaining: number;
      totalPrincipalPaid: number;
      totalInterestPaid: number;
      monthlyPaymentTotal: number;
      breakdown: Record<
        string,
        { balance: number; payment: number; interest: number; principal: number }
      >;
    }[] = [];

    let cumulativeInterest = 0;
    let cumulativePrincipal = 0;
    let month = 0;

    const baseTotalMinimum = sorted.reduce((acc, d) => acc + d.minimumPayment, 0);

    while (month < MAX_MONTHS) {
      const totalCurrent = Object.values(balances).reduce((s, v) => s + v, 0);
      if (totalCurrent <= 0.01) break;

      month++;
      const breakdown: Record<
        string,
        { balance: number; payment: number; interest: number; principal: number }
      > = {};

      // 1. Accrue monthly interest on each debt
      const monthlyInterests: Record<string, number> = {};
      sorted.forEach((d) => {
        const bal = balances[d.id];
        if (bal > 0) {
          const interest = bal * (d.apr / 100 / 12);
          monthlyInterests[d.id] = interest;
          balances[d.id] = bal + interest;
          interestAccum[d.id] += interest;
          cumulativeInterest += interest;
        } else {
          monthlyInterests[d.id] = 0;
        }
      });

      // 2. Pay minimum payments first
      let availableExtra = extra;
      let totalPaidThisMonth = 0;

      sorted.forEach((d) => {
        const bal = balances[d.id];
        if (bal <= 0) {
          if (rolloverPaidOffMinimums) {
            availableExtra += d.minimumPayment;
          }
          breakdown[d.id] = { balance: 0, payment: 0, interest: 0, principal: 0 };
          return;
        }

        const minPay = Math.min(bal, Math.max(d.minimumPayment, monthlyInterests[d.id] + 1));
        balances[d.id] = Math.max(0, bal - minPay);
        totalPaidThisMonth += minPay;

        if (rolloverPaidOffMinimums && minPay < d.minimumPayment) {
          availableExtra += d.minimumPayment - minPay;
        }

        const interestPart = Math.min(minPay, monthlyInterests[d.id]);
        const principalPart = Math.max(0, minPay - interestPart);
        cumulativePrincipal += principalPart;

        breakdown[d.id] = {
          balance: balances[d.id],
          payment: minPay,
          interest: interestPart,
          principal: principalPart,
        };

        if (balances[d.id] <= 0.01 && payoffMonth[d.id] === 0) {
          balances[d.id] = 0;
          payoffMonth[d.id] = month;
        }
      });

      // 3. Apply availableExtra to highest priority debts in sorted order
      for (const d of sorted) {
        if (availableExtra <= 0.01) break;
        const bal = balances[d.id];
        if (bal <= 0) continue;

        const extraApplied = Math.min(bal, availableExtra);
        balances[d.id] = Math.max(0, bal - extraApplied);
        availableExtra -= extraApplied;
        totalPaidThisMonth += extraApplied;
        cumulativePrincipal += extraApplied;

        breakdown[d.id].balance = balances[d.id];
        breakdown[d.id].payment += extraApplied;
        breakdown[d.id].principal += extraApplied;

        if (balances[d.id] <= 0.01 && payoffMonth[d.id] === 0) {
          balances[d.id] = 0;
          payoffMonth[d.id] = month;
        }
      }

      const rem = Object.values(balances).reduce((s, v) => s + v, 0);
      monthlyRecords.push({
        totalRemaining: rem,
        totalPrincipalPaid: cumulativePrincipal,
        totalInterestPaid: cumulativeInterest,
        monthlyPaymentTotal:
          totalPaidThisMonth > 0 ? totalPaidThisMonth : baseTotalMinimum + extra,
        breakdown,
      });
    }

    sorted.forEach((d) => {
      if (payoffMonth[d.id] === 0) {
        payoffMonth[d.id] = month;
      }
    });

    return {
      months: month,
      totalInterest: cumulativeInterest,
      interestAccum,
      payoffMonth,
      monthlyRecords,
    };
  };

  const strategySim = runSim(extraMonthlyPayment, true);
  const baselineSim = runSim(0, false);

  const maxLen = Math.max(
    strategySim.monthlyRecords.length,
    baselineSim.monthlyRecords.length
  );

  const startDate = new Date(2026, 10, 1); // Nov 2026 base
  const locale = getLocaleForLanguage(lang);
  const formatMonthOffset = (offset: number) => {
    const d = new Date(startDate.getFullYear(), startDate.getMonth() + offset, 1);
    return d.toLocaleDateString(locale, { month: 'short', year: 'numeric' });
  };

  const totalBalance = sorted.reduce((s, d) => s + d.balance, 0);
  const totalMinimumPayment = sorted.reduce((s, d) => s + d.minimumPayment, 0);

  const schedule: DebtSimulationMonth[] = [
    {
      monthIndex: 0,
      label: t('chartNow', lang),
      totalRemainingStrategy: totalBalance,
      totalRemainingBaseline: totalBalance,
      totalPrincipalPaidStrategy: 0,
      totalInterestPaidStrategy: 0,
      monthlyPaymentTotal: totalMinimumPayment + extraMonthlyPayment,
      breakdownByDebt: Object.fromEntries(
        sorted.map((d) => [
          d.id,
          { balance: d.balance, payment: 0, interest: 0, principal: 0 },
        ])
      ),
    },
  ];

  for (let i = 0; i < maxLen; i++) {
    const sRec = strategySim.monthlyRecords[i];
    const bRec = baselineSim.monthlyRecords[i];
    schedule.push({
      monthIndex: i + 1,
      label: formatMonthOffset(i + 1),
      totalRemainingStrategy: sRec ? sRec.totalRemaining : 0,
      totalRemainingBaseline: bRec ? bRec.totalRemaining : 0,
      totalPrincipalPaidStrategy: sRec
        ? sRec.totalPrincipalPaid
        : totalBalance,
      totalInterestPaidStrategy: sRec
        ? sRec.totalInterestPaid
        : strategySim.totalInterest,
      monthlyPaymentTotal: sRec ? sRec.monthlyPaymentTotal : 0,
      breakdownByDebt: sRec
        ? sRec.breakdown
        : Object.fromEntries(
            sorted.map((d) => [
              d.id,
              { balance: 0, payment: 0, interest: 0, principal: 0 },
            ])
          ),
    });
  }

  const rankedDebts: RankedDebtItem[] = sorted.map((d, idx) => {
    const tIntStrat = strategySim.interestAccum[d.id] || 0;
    const tIntBase = baselineSim.interestAccum[d.id] || 0;
    return {
      ...d,
      rank: idx + 1,
      payoffMonthsStrategy: strategySim.payoffMonth[d.id] || strategySim.months,
      payoffMonthsBaseline: baselineSim.payoffMonth[d.id] || baselineSim.months,
      totalInterestStrategy: tIntStrat,
      totalInterestBaseline: tIntBase,
      interestSaved: Math.max(0, tIntBase - tIntStrat),
    };
  });

  const interestSaved = Math.max(
    0,
    baselineSim.totalInterest - strategySim.totalInterest
  );
  const monthsSaved = Math.max(0, baselineSim.months - strategySim.months);

  return {
    rankedDebts,
    schedule,
    totalBalance,
    totalMinimumPayment,
    monthsToPayoffStrategy: strategySim.months,
    monthsToPayoffBaseline: baselineSim.months,
    monthsSaved,
    totalInterestStrategy: strategySim.totalInterest,
    totalInterestBaseline: baselineSim.totalInterest,
    interestSaved,
    debtFreeDateStrategy: formatMonthOffset(strategySim.months),
    debtFreeDateBaseline: formatMonthOffset(baselineSim.months),
  };
}
