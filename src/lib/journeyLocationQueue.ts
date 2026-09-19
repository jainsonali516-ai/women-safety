// Offline queue for journey location pings — mirrors lib/offlineQueue.ts's exact pattern (used
// by SosTracker) but kept as its own separate queue/storage key, since these are two different
// features and mixing their queued pings would risk sending a journey ping to the SOS endpoint
// or vice versa.
const STORAGE_KEY = "herlane_offline_journey_location_queue";

export interface QueuedJourneyPing {
  journeyId: string;
  latitude: number;
  longitude: number;
  timestamp: number;
}

export function enqueueJourneyPing(ping: QueuedJourneyPing) {
  try {
    const queue = readJourneyQueue();
    queue.push(ping);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch {
    /* localStorage unavailable — ping is simply dropped rather than crashing the timer */
  }
}

export function readJourneyQueue(): QueuedJourneyPing[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as QueuedJourneyPing[]) : [];
  } catch {
    return [];
  }
}

export function clearJourneyQueue() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export async function flushJourneyQueue() {
  const queue = readJourneyQueue();
  if (queue.length === 0) return { synced: 0, failed: 0 };

  let synced = 0;
  const remaining: QueuedJourneyPing[] = [];

  for (const ping of queue) {
    try {
      const res = await fetch(`/api/journey/${ping.journeyId}/location`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latitude: ping.latitude, longitude: ping.longitude, recordedAt: ping.timestamp }),
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
    clearJourneyQueue();
  }

  return { synced, failed: remaining.length };
}
