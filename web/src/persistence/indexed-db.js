// Drafts use a stable database identifier across application sessions.
let dbPromise;
function database() {
  if (!dbPromise)
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open("evony-formation", 2);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains("plans"))
          request.result.createObjectStore("plans");
        if (!request.result.objectStoreNames.contains("projects"))
          request.result.createObjectStore("projects");
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  return dbPromise;
}
export async function readSaved(key = "current") {
  const db = await database();
  return new Promise((resolve, reject) => {
    const r = db.transaction("projects").objectStore("projects").get(key);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
export async function writeSaved(plan, key = "current") {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("projects", "readwrite");
    tx.objectStore("projects").put(plan, key);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
