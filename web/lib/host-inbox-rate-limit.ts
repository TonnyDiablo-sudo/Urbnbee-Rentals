/** Rate limit en memoria (por proceso). Solo mitiga abuso casual; en producción usar Redis/edge. */
const lastAt = new Map<string, number>();

export function allowHostInboxPost(key: string, minIntervalMs: number): boolean {
  const now = Date.now();
  const prev = lastAt.get(key) ?? 0;
  if (now - prev < minIntervalMs) return false;
  lastAt.set(key, now);
  return true;
}
