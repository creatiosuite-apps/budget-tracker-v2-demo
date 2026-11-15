import { AppDataState, Transaction } from '../types/finance';

export interface SyncResponse {
  ok: boolean;
  data?: AppDataState;
  lastUpdated?: string;
  message?: string;
}

export function normalizeDateString(raw: unknown): string {
  const s = String(raw ?? '').trim();
  if (!s) return '2026-11-12';
  // Already YYYY-MM-DD (or ISO prefix)
  const isoMatch = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`;
  }
  // MM/DD/YYYY or M/D/YYYY
  const usMatch = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (usMatch) {
    const first = parseInt(usMatch[1], 10);
    const second = parseInt(usMatch[2], 10);
    // If first > 12, treat as DD/MM/YYYY
    const month = first > 12 ? second : first;
    const day = first > 12 ? first : second;
    return `${usMatch[3]}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return s.slice(0, 10);
}

function toNumber(val: unknown, fallback = 0): number {
  if (typeof val === 'number' && !Number.isNaN(val)) return val;
  const parsed = parseFloat(String(val ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isNaN(parsed) ? fallback : parsed;
}

function normalizePulledState(rawState: AppDataState): AppDataState {
  const rawTx = Array.isArray(rawState.transactions) ? rawState.transactions : [];
  const normalizedTx: Transaction[] = rawTx.map((tx, idx) => ({
    ...tx,
    id: tx.id ? String(tx.id) : `tx-sheet-${idx + 1}`,
    date: normalizeDateString(tx.date),
    description: String(tx.description ?? ''),
    amount: toNumber(tx.amount, 0),
    type: tx.type === 'income' ? 'income' : 'expense',
    category: String(tx.category || 'General'),
    paymentMethod: String(tx.paymentMethod || 'Card'),
    ...(tx.previousDueDate
      ? { previousDueDate: normalizeDateString(tx.previousDueDate) }
      : {}),
  }));

  const normalizedBills = Array.isArray(rawState.bills)
    ? rawState.bills.map((b) => ({
        ...b,
        amount: toNumber(b.amount, 0),
        nextDueDate: normalizeDateString(b.nextDueDate),
        ...(b.lastPaidDate
          ? { lastPaidDate: normalizeDateString(b.lastPaidDate) }
          : {}),
      }))
    : rawState.bills;

  const normalizedGoals = Array.isArray(rawState.savingsGoals)
    ? rawState.savingsGoals.map((g) => ({
        ...g,
        targetAmount: toNumber(g.targetAmount, 0),
        currentAmount: toNumber(g.currentAmount, 0),
        monthlyContributionTarget: toNumber(g.monthlyContributionTarget, 0),
        targetDate: normalizeDateString(g.targetDate),
        history: Array.isArray(g.history)
          ? g.history.map((h) => ({
              ...h,
              date: normalizeDateString(h.date),
              amount: toNumber(h.amount, 0),
              balanceAfter: toNumber(h.balanceAfter, 0),
            }))
          : [],
      }))
    : rawState.savingsGoals;

  const normalizedSplits = Array.isArray(rawState.splitExpenses)
    ? rawState.splitExpenses.map((s) => ({
        ...s,
        date: normalizeDateString(s.date),
        totalAmount: toNumber(s.totalAmount, 0),
      }))
    : rawState.splitExpenses;

  return {
    ...rawState,
    transactions: normalizedTx,
    bills: normalizedBills,
    savingsGoals: normalizedGoals,
    splitExpenses: normalizedSplits,
  };
}

export function isValidGoogleScriptUrl(url: string): boolean {
  if (!url || !url.trim()) return false;
  try {
    const parsed = new URL(url.trim());
    return (
      parsed.protocol === 'https:' &&
      (parsed.hostname.includes('script.google.com') ||
        parsed.hostname.includes('script.googleusercontent.com') ||
        parsed.pathname.includes('/macros/'))
    );
  } catch {
    return false;
  }
}

const SYNC_TIMEOUT_MS = 12000;

function isNavigatorOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

/**
 * Fetches full application state from a Google Apps Script Web App URL.
 * Uses GET with cache-busting query parameter and redirect following.
 */
export async function pullFromGoogleSheets(
  scriptUrl: string
): Promise<SyncResponse> {
  const cleanUrl = scriptUrl.trim();
  if (!cleanUrl) {
    return { ok: false, message: 'No Google Apps Script Web App URL configured.' };
  }
  if (isNavigatorOffline()) {
    return { ok: false, message: 'Device is offline. Using local offline storage.' };
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), SYNC_TIMEOUT_MS);

  try {
    const separator = cleanUrl.includes('?') ? '&' : '?';
    const response = await fetch(
      `${cleanUrl}${separator}action=read&_t=${Date.now()}`,
      {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          Accept: 'application/json, text/plain, */*',
        },
      }
    );

    if (!response.ok) {
      return {
        ok: false,
        message: `HTTP ${response.status}: Failed to read from Google Sheets Web App.`,
      };
    }

    const result = await response.json();
    if (result && result.status === 'success' && result.data) {
      const normalized = normalizePulledState(result.data as AppDataState);
      return {
        ok: true,
        data: normalized,
        lastUpdated: normalized.lastUpdated || new Date().toISOString(),
        message: 'Successfully loaded latest data from Google Sheets.',
      };
    } else if (result && result.status === 'empty') {
      return {
        ok: true,
        data: undefined,
        message: 'Connected to Google Sheets (sheet is empty, ready for initial push).',
      };
    } else if (result && result.transactions) {
      // Direct state payload returned
      const normalized = normalizePulledState(result as AppDataState);
      return {
        ok: true,
        data: normalized,
        lastUpdated: normalized.lastUpdated || new Date().toISOString(),
      };
    }

    return {
      ok: false,
      message: result?.message || 'Unexpected response format from Web App script.',
    };
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { ok: false, message: 'Google Sheets request timed out. Changes remain safely saved locally.' };
    }
    const msg = err instanceof Error ? err.message : 'Network error connecting to Google Sheets.';
    return { ok: false, message: msg };
  } finally {
    window.clearTimeout(timeoutId);
  }
}

/**
 * Pushes the complete application state to Google Sheets via Apps Script Web App URL.
 * Uses text/plain;charset=utf-8 to bypass CORS preflight restrictions on script.google.com.
 */
export async function pushToGoogleSheets(
  scriptUrl: string,
  state: AppDataState
): Promise<SyncResponse> {
  const cleanUrl = scriptUrl.trim();
  if (!cleanUrl) {
    return { ok: false, message: 'No Google Apps Script Web App URL configured.' };
  }
  if (isNavigatorOffline()) {
    return { ok: false, message: 'Offline — changes queued locally for Google Sheets.' };
  }

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), SYNC_TIMEOUT_MS);

  try {
    const payload = {
      action: 'syncAll',
      timestamp: new Date().toISOString(),
      data: state,
    };

    const response = await fetch(cleanUrl, {
      method: 'POST',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      return {
        ok: false,
        message: `HTTP ${response.status}: Failed to write to Google Sheets Web App.`,
      };
    }

    const result = await response.json();
    if (result && (result.status === 'success' || result.ok)) {
      return {
        ok: true,
        lastUpdated: state.lastUpdated,
        message: result.message || 'Synchronized with Google Sheets.',
      };
    }

    return {
      ok: false,
      message: result?.message || 'Write failed on Google Apps Script.',
    };
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'AbortError') {
      return { ok: false, message: 'Google Sheets sync timed out. Queued locally and will retry automatically.' };
    }
    const msg = err instanceof Error ? err.message : 'Network error pushing to Google Sheets.';
    return { ok: false, message: msg };
  } finally {
    window.clearTimeout(timeoutId);
  }
}

/**
 * Complete Google Apps Script (Code.gs) template for the user's Google Sheet.
 * Creates and synchronizes human-readable tabs for Transactions, Budgets,
 * SavingsGoals, SavingsHistory, Bills, Debts, SplitParticipants, SplitBills,
 * and chunked _ClarityState for full real-time multi-device sync.
 */
export const GOOGLE_APPS_SCRIPT_TEMPLATE = `/**
 * Budget Tracker — Real-Time Google Sheets Web App Backend
 *
 * SETUP INSTRUCTIONS:
 * 1. Open a new or existing Google Sheet (https://sheets.new)
 * 2. Click Extensions > Apps Script
 * 3. Replace any code in Code.gs with this entire script and click Save (Ctrl+S / Cmd+S)
 * 4. Click "Deploy" > "New deployment" (or Manage deployments > Edit > New version)
 * 5. Select type: "Web app"
 * 6. Set "Execute as": "Me"
 * 7. Set "Who has access": "Anyone" (required for browser CORS fetch requests)
 * 8. Click "Deploy", authorize access, and copy the Web App URL (ends in /exec)
 * 9. Paste the Web App URL in Settings -> Google Sheets Connection.
 */

function doGet(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var storeSheet = ss.getSheetByName('_ClarityState');
    if (!storeSheet) {
      return createJsonResponse({ status: 'empty', message: 'No state initialized yet.' });
    }

    var rawJson = readCanonicalJson(storeSheet);
    if (!rawJson) {
      return createJsonResponse({ status: 'empty', message: 'State store is empty.' });
    }

    var state = JSON.parse(rawJson);
    var tz = ss.getSpreadsheetTimeZone();
    var beforeStateJson = JSON.stringify({
      transactions: state.transactions || [],
      bills: state.bills || [],
      savingsGoals: state.savingsGoals || [],
      splitExpenses: state.splitExpenses || []
    });

    // 1. Merge manual edits from Transactions tab (dates, amounts, descriptions, notes, links)
    var txSheet = ss.getSheetByName('Transactions');
    if (txSheet && txSheet.getLastRow() > 1) {
      var colCount = Math.min(12, Math.max(7, txSheet.getLastColumn()));
      var rows = txSheet.getRange(2, 1, txSheet.getLastRow() - 1, colCount).getValues();
      var parsedTx = [];
      for (var i = 0; i < rows.length; i++) {
        var r = rows[i];
        if (r[2] || r[3]) {
          var numericAmt = typeof r[3] === 'number'
            ? r[3]
            : parseFloat(String(r[3] || '0').replace(/[^0-9.-]/g, '')) || 0;
          var tx = {
            id: r[0] ? String(r[0]) : 'tx-sheet-' + (i + 2),
            date: formatDateCell(r[1], tz),
            description: String(r[2] || 'Transaction'),
            amount: numericAmt,
            type: String(r[4]).toLowerCase() === 'income' ? 'income' : 'expense',
            category: String(r[5] || 'General'),
            paymentMethod: String(r[6] || 'Card')
          };
          if (r[7]) tx.notes = String(r[7]);
          if (r[8]) tx.linkedBillId = String(r[8]);
          if (r[9]) tx.previousDueDate = formatDateCell(r[9], tz);
          if (r[10]) tx.linkedGoalId = String(r[10]);
          if (r[11]) tx.linkedDebtId = String(r[11]);
          parsedTx.push(tx);
        }
      }
      if (parsedTx.length > 0) {
        state.transactions = parsedTx;
      }
    }

    // 2. Merge manual edits from Bills tab (Next Due Date, Last Paid Date, Amount, Status, etc.)
    var billsSheet = ss.getSheetByName('Bills');
    if (billsSheet && billsSheet.getLastRow() > 1 && Array.isArray(state.bills)) {
      var bCols = Math.min(12, Math.max(10, billsSheet.getLastColumn()));
      var bRows = billsSheet.getRange(2, 1, billsSheet.getLastRow() - 1, bCols).getValues();
      var billById = {};
      for (var bi = 0; bi < state.bills.length; bi++) {
        billById[String(state.bills[bi].id)] = state.bills[bi];
      }
      var mergedBills = [];
      for (var bj = 0; bj < bRows.length; bj++) {
        var br = bRows[bj];
        if (!br[0] && !br[1]) continue;
        var bId = br[0] ? String(br[0]) : 'bill-sheet-' + (bj + 2);
        var existingBill = billById[bId] || {};
        var bAmt = typeof br[2] === 'number'
          ? br[2]
          : parseFloat(String(br[2] || existingBill.amount || '0').replace(/[^0-9.-]/g, '')) || 0;
        var updatedBill = {
          id: bId,
          name: String(br[1] || existingBill.name || 'Bill'),
          amount: bAmt,
          billingCycle: br[3] ? String(br[3]) : (existingBill.billingCycle || 'monthly'),
          nextDueDate: br[4] ? formatDateCell(br[4], tz) : (existingBill.nextDueDate || ''),
          category: String(br[6] || existingBill.category || 'Utilities'),
          autoPay: br[7] !== '' && br[7] !== undefined ? Boolean(br[7] === true || String(br[7]).toLowerCase() === 'true') : Boolean(existingBill.autoPay),
          reminderDaysBefore: Number(br[8] !== '' ? br[8] : (existingBill.reminderDaysBefore || 3)) || 0,
          status: br[9] ? String(br[9]) : (existingBill.status || 'active')
        };
        if (br[5]) updatedBill.lastPaidDate = formatDateCell(br[5], tz);
        if (br[10]) updatedBill.providerUrl = String(br[10]);
        if (br[11]) updatedBill.notes = String(br[11]);
        mergedBills.push(updatedBill);
      }
      if (mergedBills.length > 0) {
        state.bills = mergedBills;
      }
    }

    // 3. Merge manual date/target edits from SavingsGoals & SavingsHistory tabs
    var goalsSheet = ss.getSheetByName('SavingsGoals');
    if (goalsSheet && goalsSheet.getLastRow() > 1 && Array.isArray(state.savingsGoals)) {
      var gCols = Math.min(9, Math.max(6, goalsSheet.getLastColumn()));
      var gRows = goalsSheet.getRange(2, 1, goalsSheet.getLastRow() - 1, gCols).getValues();
      var goalMap = {};
      for (var gi = 0; gi < state.savingsGoals.length; gi++) {
        goalMap[String(state.savingsGoals[gi].id)] = state.savingsGoals[gi];
      }
      var mergedGoals = [];
      for (var gj = 0; gj < gRows.length; gj++) {
        var gr = gRows[gj];
        if (!gr[0] && !gr[1]) continue;
        var gId = gr[0] ? String(gr[0]) : 'goal-sheet-' + (gj + 2);
        var existingGoal = goalMap[gId] || { history: [] };
        var nextGoal = {
          id: gId,
          name: String(gr[1] || existingGoal.name || 'Goal'),
          category: String(gr[2] || existingGoal.category || 'Savings'),
          currentAmount: typeof gr[3] === 'number' ? gr[3] : (parseFloat(String(gr[3] || existingGoal.currentAmount || '0').replace(/[^0-9.-]/g, '')) || 0),
          targetAmount: typeof gr[4] === 'number' ? gr[4] : (parseFloat(String(gr[4] || existingGoal.targetAmount || '0').replace(/[^0-9.-]/g, '')) || 0),
          targetDate: gr[5] ? formatDateCell(gr[5], tz) : (existingGoal.targetDate || ''),
          monthlyContributionTarget: typeof gr[6] === 'number' ? gr[6] : (parseFloat(String(gr[6] || existingGoal.monthlyContributionTarget || '0').replace(/[^0-9.-]/g, '')) || 0),
          color: String(gr[7] || existingGoal.color || '#059669'),
          history: existingGoal.history || []
        };
        if (gr[8]) nextGoal.notes = String(gr[8]);
        mergedGoals.push(nextGoal);
      }
      if (mergedGoals.length > 0) {
        state.savingsGoals = mergedGoals;
      }
    }

    var ghSheet = ss.getSheetByName('SavingsHistory');
    if (ghSheet && ghSheet.getLastRow() > 1 && Array.isArray(state.savingsGoals)) {
      var ghRows = ghSheet.getRange(2, 1, ghSheet.getLastRow() - 1, Math.min(9, ghSheet.getLastColumn())).getValues();
      var histByGoal = {};
      for (var hi = 0; hi < ghRows.length; hi++) {
        var hr = ghRows[hi];
        if (!hr[1] || (!hr[3] && !hr[5])) continue;
        var hGoalId = String(hr[1]);
        if (!histByGoal[hGoalId]) histByGoal[hGoalId] = [];
        var hEntry = {
          id: hr[0] ? String(hr[0]) : 'gh-sheet-' + (hi + 2),
          date: formatDateCell(hr[3], tz),
          type: String(hr[4]).toLowerCase() === 'withdrawal' ? 'withdrawal' : 'deposit',
          amount: typeof hr[5] === 'number' ? hr[5] : (parseFloat(String(hr[5] || '0').replace(/[^0-9.-]/g, '')) || 0),
          balanceAfter: typeof hr[6] === 'number' ? hr[6] : (parseFloat(String(hr[6] || '0').replace(/[^0-9.-]/g, '')) || 0),
          note: String(hr[7] || '')
        };
        if (hr[8]) hEntry.linkedTxId = String(hr[8]);
        histByGoal[hGoalId].push(hEntry);
      }
      for (var gk = 0; gk < state.savingsGoals.length; gk++) {
        var sg = state.savingsGoals[gk];
        if (histByGoal[sg.id]) {
          sg.history = histByGoal[sg.id];
        }
      }
    }

    // 4. Merge manual date edits from SplitBills tab
    var splitSheet = ss.getSheetByName('SplitBills');
    if (splitSheet && splitSheet.getLastRow() > 1 && Array.isArray(state.splitExpenses)) {
      var sRows = splitSheet.getRange(2, 1, splitSheet.getLastRow() - 1, Math.min(11, splitSheet.getLastColumn())).getValues();
      var splitDateById = {};
      for (var si = 0; si < sRows.length; si++) {
        if (sRows[si][0] && sRows[si][2]) {
          splitDateById[String(sRows[si][0])] = {
            title: sRows[si][1] ? String(sRows[si][1]) : undefined,
            date: formatDateCell(sRows[si][2], tz)
          };
        }
      }
      for (var sj = 0; sj < state.splitExpenses.length; sj++) {
        var se = state.splitExpenses[sj];
        if (splitDateById[se.id]) {
          se.date = splitDateById[se.id].date;
          if (splitDateById[se.id].title) se.title = splitDateById[se.id].title;
        }
      }
    }

    var afterStateJson = JSON.stringify({
      transactions: state.transactions || [],
      bills: state.bills || [],
      savingsGoals: state.savingsGoals || [],
      splitExpenses: state.splitExpenses || []
    });

    if (afterStateJson !== beforeStateJson) {
      state.lastUpdated = new Date().toISOString();
      writeCanonicalJson(storeSheet, state);
    }

    return createJsonResponse({ status: 'success', data: state });
  } catch (err) {
    return createJsonResponse({ status: 'error', message: err.toString() });
  } finally {
    lock.releaseLock();
  }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.tryLock(10000);
  try {
    var payload = JSON.parse(e.postData.contents);
    var state = payload.data;
    if (!state) {
      return createJsonResponse({ status: 'error', message: 'Missing state data payload' });
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // 1. Save full canonical JSON state in _ClarityState (chunked into 40k char rows to stay safely under Sheets' 50k cell limit)
    var storeSheet = getOrCreateSheet(ss, '_ClarityState', ['LastUpdated', 'ChunkCount', 'CanonicalJSONChunk']);
    writeCanonicalJson(storeSheet, state);

    // 2. Populate Transactions sheet (with Notes & Bill/Goal/Debt links)
    var txSheet = getOrCreateSheet(ss, 'Transactions', [
      'ID', 'Date', 'Description', 'Amount', 'Type', 'Category', 'Payment Method',
      'Notes', 'Linked Bill ID', 'Previous Due Date', 'Linked Goal ID', 'Linked Debt ID'
    ]);
    clearDataRows(txSheet);
    if (state.transactions && state.transactions.length > 0) {
      var txRows = state.transactions.map(function(t) {
        return [
          t.id,
          t.date,
          t.description,
          t.amount,
          t.type,
          t.category,
          t.paymentMethod || '',
          t.notes || '',
          t.linkedBillId || '',
          t.previousDueDate || '',
          t.linkedGoalId || '',
          t.linkedDebtId || ''
        ];
      });
      txSheet.getRange(2, 2, txRows.length, 1).setNumberFormat('@');
      txSheet.getRange(2, 10, txRows.length, 1).setNumberFormat('@');
      txSheet.getRange(2, 1, txRows.length, 12).setValues(txRows);
    }

    // 3. Populate Budgets & Custom Categories sheet
    var budgetSheet = getOrCreateSheet(ss, 'Budgets', [
      'ID', 'Category', 'Type', 'Group', 'Monthly Limit', 'Color', 'Monthly Overrides'
    ]);
    clearDataRows(budgetSheet);
    if (state.categories && state.categories.length > 0) {
      var bRows = state.categories.map(function(c) {
        return [
          c.id,
          c.name,
          c.type,
          c.group,
          c.monthlyLimit,
          c.color || '',
          c.monthlyOverrides ? JSON.stringify(c.monthlyOverrides) : ''
        ];
      });
      budgetSheet.getRange(2, 1, bRows.length, 7).setValues(bRows);
    }

    // 4. Populate Savings Goals sheet
    var goalsSheet = getOrCreateSheet(ss, 'SavingsGoals', [
      'ID', 'Goal Name', 'Category', 'Current Saved', 'Target Amount', 'Target Date', 'Monthly Target', 'Color', 'Notes'
    ]);
    clearDataRows(goalsSheet);
    if (state.savingsGoals && state.savingsGoals.length > 0) {
      var gRows = state.savingsGoals.map(function(g) {
        return [
          g.id,
          g.name,
          g.category,
          g.currentAmount,
          g.targetAmount,
          g.targetDate,
          g.monthlyContributionTarget,
          g.color || '',
          g.notes || ''
        ];
      });
      goalsSheet.getRange(2, 1, gRows.length, 9).setValues(gRows);
    }

    // 5. Populate Savings History (individual goal deposit & withdrawal records)
    var goalHistorySheet = getOrCreateSheet(ss, 'SavingsHistory', [
      'Entry ID', 'Goal ID', 'Goal Name', 'Date', 'Type', 'Amount', 'Balance After', 'Note', 'Linked Tx ID'
    ]);
    clearDataRows(goalHistorySheet);
    var ghRows = [];
    if (state.savingsGoals && state.savingsGoals.length > 0) {
      for (var gi = 0; gi < state.savingsGoals.length; gi++) {
        var goal = state.savingsGoals[gi];
        var hist = goal.history || [];
        for (var hi = 0; hi < hist.length; hi++) {
          var h = hist[hi];
          ghRows.push([
            h.id,
            goal.id,
            goal.name,
            h.date,
            h.type,
            h.amount,
            h.balanceAfter,
            h.note || '',
            h.linkedTxId || ''
          ]);
        }
      }
      if (ghRows.length > 0) {
        goalHistorySheet.getRange(2, 1, ghRows.length, 9).setValues(ghRows);
      }
    }

    // 6. Populate Bills & Subscriptions sheet
    var billsSheet = getOrCreateSheet(ss, 'Bills', [
      'ID', 'Service Name', 'Amount', 'Billing Cycle', 'Next Due Date', 'Last Paid Date',
      'Category', 'AutoPay', 'Reminder Days', 'Status', 'Provider URL', 'Notes'
    ]);
    clearDataRows(billsSheet);
    if (state.bills && state.bills.length > 0) {
      var billRows = state.bills.map(function(b) {
        return [
          b.id,
          b.name,
          b.amount,
          b.billingCycle,
          b.nextDueDate,
          b.lastPaidDate || '',
          b.category,
          b.autoPay,
          b.reminderDaysBefore || 0,
          b.status,
          b.providerUrl || '',
          b.notes || ''
        ];
      });
      billsSheet.getRange(2, 1, billRows.length, 12).setValues(billRows);
    }

    // 7. Populate Debts sheet
    var debtsSheet = getOrCreateSheet(ss, 'Debts', [
      'ID', 'Account Name', 'Lender', 'Category', 'Current Balance', 'Original Balance', 'APR (%)', 'Min Payment', 'Due Day'
    ]);
    clearDataRows(debtsSheet);
    if (state.debts && state.debts.length > 0) {
      var dRows = state.debts.map(function(d) {
        return [
          d.id,
          d.name,
          d.lender,
          d.category,
          d.balance,
          d.originalBalance,
          d.apr,
          d.minimumPayment,
          d.dueDateDay || 1
        ];
      });
      debtsSheet.getRange(2, 1, dRows.length, 9).setValues(dRows);
    }

    // 8. Populate Split Participants (Roommates & Friends)
    var partNameById = {};
    var partSheet = getOrCreateSheet(ss, 'SplitParticipants', [
      'ID', 'Name', 'Email', 'Is Self'
    ]);
    clearDataRows(partSheet);
    if (state.splitParticipants && state.splitParticipants.length > 0) {
      var pRows = state.splitParticipants.map(function(p) {
        partNameById[p.id] = p.name;
        return [p.id, p.name, p.email || '', Boolean(p.isSelf)];
      });
      partSheet.getRange(2, 1, pRows.length, 4).setValues(pRows);
    }

    // 9. Populate Split Bills sheet
    var splitSheet = getOrCreateSheet(ss, 'SplitBills', [
      'ID', 'Title', 'Date', 'Total Amount', 'Paid By', 'Method', 'Category', 'Shares Summary', 'Tax', 'Tip', 'Notes'
    ]);
    clearDataRows(splitSheet);
    if (state.splitExpenses && state.splitExpenses.length > 0) {
      var sRows = state.splitExpenses.map(function(s) {
        var payerLabel = partNameById[s.paidById] || s.paidById;
        var sharesSummary = (s.splits || []).map(function(entry) {
          var pName = partNameById[entry.participantId] || entry.participantId;
          return pName + ': ' + entry.amount + (entry.settled ? ' [Settled]' : ' [Pending]');
        }).join('; ');
        return [
          s.id,
          s.title,
          s.date,
          s.totalAmount,
          payerLabel,
          s.splitMethod,
          s.category,
          sharesSummary,
          s.taxAmount || 0,
          s.tipAmount || 0,
          s.notes || ''
        ];
      });
      splitSheet.getRange(2, 1, sRows.length, 11).setValues(sRows);
    }

    return createJsonResponse({
      status: 'success',
      message: 'All financial sheets updated in real time.',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    return createJsonResponse({ status: 'error', message: err.toString() });
  } finally {
    lock.releaseLock();
  }
}

function writeCanonicalJson(storeSheet, state) {
  clearDataRows(storeSheet);
  var jsonStr = JSON.stringify(state);
  var chunkSize = 40000;
  var chunks = [];
  for (var c = 0; c < jsonStr.length; c += chunkSize) {
    chunks.push([jsonStr.slice(c, c + chunkSize)]);
  }
  if (chunks.length === 0) chunks.push(['{}']);
  storeSheet.getRange('A2').setValue(state.lastUpdated || new Date().toISOString());
  storeSheet.getRange('B2').setValue(chunks.length);
  storeSheet.getRange(2, 3, chunks.length, 1).setValues(chunks);
}

function readCanonicalJson(storeSheet) {
  var chunkCount = Number(storeSheet.getRange('B2').getValue());
  if (chunkCount >= 1 && storeSheet.getLastRow() >= 1 + chunkCount) {
    var colValues = storeSheet.getRange(2, 3, chunkCount, 1).getValues();
    var joined = '';
    for (var i = 0; i < colValues.length; i++) {
      joined += String(colValues[i][0] || '');
    }
    if (joined && joined.charAt(0) === '{') {
      return joined;
    }
  }
  // Backwards compatibility with single-cell JSON stored in A2
  var legacy = String(storeSheet.getRange('A2').getValue() || '');
  if (legacy && legacy.charAt(0) === '{') {
    return legacy;
  }
  return '';
}

function getOrCreateSheet(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  if (sheet.getLastRow() === 0 || sheet.getLastColumn() < headers.length) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function clearDataRows(sheet) {
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow > 1 && lastCol > 0) {
    sheet.getRange(2, 1, lastRow - 1, lastCol).clearContent();
  }
}

function formatDateCell(val, tz) {
  var safeTz = tz || Session.getScriptTimeZone();
  if (val instanceof Date) {
    return Utilities.formatDate(val, safeTz, 'yyyy-MM-dd');
  }
  var s = String(val || '').trim();
  if (!s) return '';
  var iso = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (iso) {
    return iso[1] + '-' + ('0' + iso[2]).slice(-2) + '-' + ('0' + iso[3]).slice(-2);
  }
  var us = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (us) {
    var first = parseInt(us[1], 10);
    var second = parseInt(us[2], 10);
    var m = first > 12 ? second : first;
    var d = first > 12 ? first : second;
    return us[3] + '-' + ('0' + m).slice(-2) + '-' + ('0' + d).slice(-2);
  }
  var parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    return Utilities.formatDate(parsed, safeTz, 'yyyy-MM-dd');
  }
  return s.slice(0, 10);
}

function createJsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
`;

