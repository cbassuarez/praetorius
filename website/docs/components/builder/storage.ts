const DB_NAME = 'praetorius-folio-builder';
const STORE_NAME = 'kv';
const KEY = 'active-project';
const FALLBACK_KEY = 'praetorius-folio-builder.active-project';

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore<T>(mode: IDBTransactionMode, handler: (store: IDBObjectStore) => Promise<T> | T): Promise<T> {
  const db = await openDatabase();
  try {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    const result = await handler(store);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    return result;
  } finally {
    db.close();
  }
}

export async function loadStoredProjectState<T = unknown>(): Promise<T | null> {
  if (typeof window === 'undefined') return null;
  try {
    const result = await withStore<T | null>('readonly', (store) => {
      return new Promise<T | null>((resolve, reject) => {
        const req = store.get(KEY);
        req.onsuccess = () => resolve((req.result as T) || null);
        req.onerror = () => reject(req.error);
      });
    });
    return result;
  } catch (_err) {
    try {
      const raw = window.localStorage.getItem(FALLBACK_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }
}

export async function saveStoredProjectState<T = unknown>(state: T): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    await withStore('readwrite', (store) => {
      store.put(state as any, KEY);
    });
  } catch (_err) {
    try {
      window.localStorage.setItem(FALLBACK_KEY, JSON.stringify(state));
    } catch {
      // no-op fallback
    }
  }
}

export async function clearStoredProjectState(): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    await withStore('readwrite', (store) => {
      store.delete(KEY);
    });
  } catch (_err) {
    try {
      window.localStorage.removeItem(FALLBACK_KEY);
    } catch {
      // noop
    }
  }
}
