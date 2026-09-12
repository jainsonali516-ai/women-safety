const STORAGE_KEY = "tulip_offline_location_queue";

export interface QueuedPing {
  alertId: string;
  latitude: number;
  longitude: number;
  timestamp: number;
}

export function enqueuePing(ping: QueuedPing) {
  try {
    const queue = readQueue();
    queue.push(ping);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch {
    /* localStorage unavailable — ping is simply dropped rather than crashing the tracker */
  }
}

export function readQueue(): QueuedPing[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as QueuedPing[]) : [];
  } catch {
    return [];
  }
}

export function clearQueue() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export async function flushQueue() {
  const queue = readQueue();
  if (queue.length === 0) return { synced: 0, failed: 0 };

  let synced = 0;
  const remaining: QueuedPing[] = [];

  for (const ping of queue) {
    try {
      const res = await fetch(`/api/sos/${ping.alertId}/location`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latitude: ping.latitude, longitude: ping.longitude }),
      });
      if (res.ok) synced += 1;
      else remaining.push(ping);
    } catch {
      remaining.push(ping);
    }
  }

  if (remaining.length > 0) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(remaining));
  } else {
    clearQueue();
  }

  return { synced, failed: remaining.length };
}
