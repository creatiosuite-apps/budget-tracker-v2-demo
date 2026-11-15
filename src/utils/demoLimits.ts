import { BudgetCategory } from '../types/finance';

export const DEMO_LIMITS = {
  MAX_TRANSACTIONS: 15,
  MAX_BILLS: 5,
  MAX_SAVINGS_GOALS: 2,
  MAX_DEBTS: 2,
  MAX_CUSTOM_CATEGORIES: 5,
  ALLOW_GOOGLE_SHEETS: false,
} as const;

export const DEFAULT_CATEGORY_IDS = new Set<string>([
  'cat-inc-1',
  'cat-inc-2',
  'cat-exp-1',
  'cat-exp-2',
  'cat-exp-3',
  'cat-exp-4',
  'cat-exp-5',
  'cat-exp-6',
  'cat-exp-7',
  'cat-exp-8',
  'cat-exp-9',
  'cat-exp-10',
]);

export function isCustomCategory(cat: BudgetCategory): boolean {
  return Boolean(cat.isCustom) || !DEFAULT_CATEGORY_IDS.has(cat.id);
}

export function getCustomCategoryCount(categories: BudgetCategory[]): number {
  return categories.filter(isCustomCategory).length;
}
