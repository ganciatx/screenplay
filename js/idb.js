const DB_NAME = 'screenplay-editor';
const DB_VERSION = 1;
const SCRIPTS_STORE = 'scripts';
const META_STORE = 'meta';

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(SCRIPTS_STORE)) {
        const store = db.createObjectStore(SCRIPTS_STORE, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt');
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: 'key' });
      }
    };
  });

  return dbPromise;
}

function tx(storeName, mode) {
  return openDB().then((db) => {
    const transaction = db.transaction(storeName, mode);
    return transaction.objectStore(storeName);
  });
}

export async function idbGetScript(id) {
  const store = await tx(SCRIPTS_STORE, 'readonly');
  return new Promise((resolve, reject) => {
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function idbPutScript(script) {
  const store = await tx(SCRIPTS_STORE, 'readwrite');
  return new Promise((resolve, reject) => {
    const req = store.put(script);
    req.onsuccess = () => resolve(script);
    req.onerror = () => reject(req.error);
  });
}

export async function idbDeleteScript(id) {
  const store = await tx(SCRIPTS_STORE, 'readwrite');
  return new Promise((resolve, reject) => {
    const req = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function idbGetAllScripts() {
  const store = await tx(SCRIPTS_STORE, 'readonly');
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function idbGetMeta(key) {
  const store = await tx(META_STORE, 'readonly');
  return new Promise((resolve, reject) => {
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result?.value ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function idbSetMeta(key, value) {
  const store = await tx(META_STORE, 'readwrite');
  return new Promise((resolve, reject) => {
    const req = store.put({ key, value });
    req.onsuccess = () => resolve(value);
    req.onerror = () => reject(req.error);
  });
}

export async function idbGetSyncQueue() {
  return (await idbGetMeta('syncQueue')) || [];
}

export async function idbPushSyncQueue(item) {
  const queue = await idbGetSyncQueue();
  const filtered = queue.filter((q) => q.id !== item.id);
  filtered.push(item);
  await idbSetMeta('syncQueue', filtered);
  return filtered;
}

export async function idbClearSyncQueueItem(id) {
  const queue = await idbGetSyncQueue();
  await idbSetMeta('syncQueue', queue.filter((q) => q.id !== id));
}
