const DB_NAME = "preorderTrackerDB";
const DB_VERSION = 1;
const STORE = "items";

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      const store = db.createObjectStore(STORE, { keyPath: "id" });
      store.createIndex("type", "type", { unique: false });
      store.createIndex("status", "status", { unique: false });
      store.createIndex("createdAt", "createdAt", { unique: false });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function run(mode, worker) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    const req = worker(store);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const ItemDB = {
  getAll: () => run("readonly", (s) => s.getAll()),
  getById: (id) => run("readonly", (s) => s.get(id)),
  put: (item) => run("readwrite", (s) => s.put(item)),
  delete: (id) => run("readwrite", (s) => s.delete(id)),
};
