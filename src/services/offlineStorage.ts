import { AppDataState } from '../types/finance';

export const STATE_STORAGE_KEY = 'clarity_ledger_state_v1';
export const OUTBOX_STORAGE_KEY = 'clarity_ledger_outbox_v1';

const DB_NAME = 'clarity_ledger_db';
const DB_VERSION = 1;
const STORE_NAME = 'ledger';
const STATE_KEY = 'state';
const OUTBOX_KEY = 'outbox';

export interface SyncOutboxMeta {
  syncPending: boolean;
  pendingChangesCount: number;
  lastLocalEditAt: string | null;
  lastSyncedHash: string | null;
  lastSyncedAtIso: string | null;
}

export const DEFAULT_OUTBOX_META: SyncOutboxMeta = {
  syncPending: false,
  pendingChangesCount: 0,
  lastLocalEditAt: null,
  lastSyncedHash: null,
  lastSyncedAtIso: null,
};

export function getSharedLedgerSnapshot(state: AppDataState) {
  return {
    transactions: state.transactions,
    categories: state.categories,
    savingsGoals: state.savingsGoals,
    bills: state.bills,
    debts: state.debts,
    splitParticipants: state.splitParticipants,
    splitExpenses: state.splitExpenses,
    debtStrategy: state.settings?.debtStrategy,
    extraDebtPayment: state.settings?.extraDebtPayment,
  };
}

/**
 * Fast deterministic 53-bit FNV/cyrb hash over the shared ledger payload.
 * Used to detect real ledger changes and avoid redundant Google Sheets writes.
 */
export function computeSharedLedgerHash(state: AppDataState): string {
  const str = JSON.stringify(getSharedLedgerSnapshot(state));
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 =
    Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^
    Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 =
    Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^
    Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return `${(4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36)}-${str.length}`;
}

export function loadOutboxFromLocalStorage(): SyncOutboxMeta {
  try {
    const raw = localStorage.getItem(OUTBOX_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_OUTBOX_META };
    const parsed = JSON.parse(raw) as Partial<SyncOutboxMeta>;
    return {
      syncPending: Boolean(parsed.syncPending),
      pendingChangesCount: Number(parsed.pendingChangesCount) || 0,
      lastLocalEditAt: parsed.lastLocalEditAt ?? null,
      lastSyncedHash: parsed.lastSyncedHash ?? null,
      lastSyncedAtIso: parsed.lastSyncedAtIso ?? null,
    };
  } catch {
    return { ...DEFAULT_OUTBOX_META };
  }
}

export function saveOutboxToLocalStorage(meta: SyncOutboxMeta): void {
  try {
    localStorage.setItem(OUTBOX_STORAGE_KEY, JSON.stringify(meta));
  } catch {
    // ignore storage quota errors
  }
}

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openLedgerDatabase(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') {
    return Promise.resolve(null);
  }
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });

  return dbPromise;
}

async function idbGet<T>(key: string): Promise<T | null> {
  const db = await openLedgerDatabase();
  if (!db) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(key);
      req.onsuccess = () => resolve((req.result as T) ?? null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function idbSet<T>(key: string, value: T): Promise<boolean> {
  const db = await openLedgerDatabase();
  if (!db) return false;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.put(value, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

export async function saveStateToIndexedDB(state: AppDataState): Promise<boolean> {
  return idbSet(STATE_KEY, state);
}

export async function loadStateFromIndexedDB(): Promise<AppDataState | null> {
  return idbGet<AppDataState>(STATE_KEY);
}

export async function saveOutboxToIndexedDB(meta: SyncOutboxMeta): Promise<boolean> {
  return idbSet(OUTBOX_KEY, meta);
}

export async function loadOutboxFromIndexedDB(): Promise<SyncOutboxMeta | null> {
  return idbGet<SyncOutboxMeta>(OUTBOX_KEY);
}
