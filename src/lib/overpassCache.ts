import { CACHE_TTL_MS } from "./cacheConfig";

// Module-level TTL cache for the live external calls (Overpass, OSRM) the safety-scoring and
// routing pipeline depends on. Without this, the same trip requested twice within a minute could
// get a different result purely because a shared public API mirror happened to time out on one
// of the two calls — this makes identical requests within the TTL window return identical
// results. This is per-server-process state, not a cross-instance/shared cache — fine for the
// determinism this fixes (same user, same process, a few minutes apart), same caveat as the
// UTC/IST note in istTime.ts.
interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();

export function getCached<T>(key: string): T | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return undefined;
  }
  return entry.value as T;
}

export function setCached<T>(key: string, value: T): void {
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}
