const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_HOUR = 5;

const buckets = new Map<string, { count: number; resetAt: number }>();

export function checkListingImportRateLimit(hostId: string): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  let b = buckets.get(hostId);
  if (!b || now >= b.resetAt) {
    b = { count: 0, resetAt: now + WINDOW_MS };
    buckets.set(hostId, b);
  }
  if (b.count >= MAX_PER_HOUR) {
    return { ok: false, retryAfterSec: Math.ceil((b.resetAt - now) / 1000) };
  }
  b.count += 1;
  return { ok: true };
}
