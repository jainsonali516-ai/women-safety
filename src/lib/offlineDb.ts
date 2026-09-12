const DB_NAME = "tulip-offline";
const DB_VERSION = 1;
const STORE = "emergency_route";
const KEY = "current_emergency_route";

export interface CachedEmergencyRoute {
  routeId: string;
  steps: string[];
  polyline: [number, number][];
  helpPoints: { name: string; type: string; latitude: number; longitude: number; distanceMeters: number }[];
  lastKnownLocation: { latitude: number; longitude: number; address?: string };
  destination: { latitude: number; longitude: number; address?: string } | null;
  contacts: { name: string; phone: string }[];
  timestamp: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE)) {
        request.result.createObjectStore(STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Overwrites the single cached emergency route — there is only ever one "current" route. */
export async function saveEmergencyRoute(route: CachedEmergencyRoute) {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(route, KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    /* IndexedDB unavailable (private browsing, disabled storage) — offline cache is best-effort */
  }
}

export async function getEmergencyRoute(): Promise<CachedEmergencyRoute | null> {
  try {
    const db = await openDb();
    const result = await new Promise<CachedEmergencyRoute | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(KEY);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return result ?? null;
  } catch {
    return null;
  }
}

export async function clearEmergencyRoute() {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    /* ignore */
  }
}
