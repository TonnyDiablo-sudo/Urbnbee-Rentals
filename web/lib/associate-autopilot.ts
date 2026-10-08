import "server-only";
import { canonicalListingUrl } from "@/lib/associate-link-utils";
import { listAllDrafts } from "@/lib/associate-drafts-store";
import { mxDay } from "@/lib/associate-stats";
import { listAllListings } from "@/lib/marketplace-store";
import type { UserRecord } from "@/lib/marketplace-types";

/**
 * Piloto automático de la extensión (Asociado Plus): abre los anuncios de una búsqueda uno por uno
 * en el Chrome del asociado, con su sesión, a ritmo de persona y con tope diario para no quemar su cuenta.
 */
function envInt(name: string, fallback: number, min: number, max: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n >= min && n <= max ? Math.round(n) : fallback;
}

export function autopilotSettings(): { dailyLimit: number; minDelaySec: number } {
  return {
    dailyLimit: envInt("AUTOPILOT_DAILY_LIMIT", 40, 1, 300),
    minDelaySec: envInt("AUTOPILOT_MIN_DELAY_SEC", 90, 20, 1800),
  };
}

export function canUseAutopilot(user: UserRecord | null | undefined): boolean {
  return Boolean(user && (user.role === "admin" || (user.associate && user.associatePlus)));
}

/** Borradores que el piloto automático trajo hoy (día de la Ciudad de México). */
export function autopilotUsedToday(associateId: string): number {
  const today = mxDay(new Date());
  return listAllDrafts().filter((d) => d.associateId === associateId && d.autopilot && mxDay(d.createdAt) === today).length;
}

/** Anuncios que ya están en Cabibee (borrador de cualquier asociado o anuncio publicado). */
export function knownListingUrls(): Set<string> {
  const known = new Set<string>();
  for (const d of listAllDrafts()) {
    const c = canonicalListingUrl(d.source.url);
    if (c) known.add(c);
  }
  for (const l of listAllListings()) {
    const c = canonicalListingUrl(l.source?.url);
    if (c) known.add(c);
  }
  return known;
}

export function isKnownListingUrl(url: string): boolean {
  const c = canonicalListingUrl(url);
  return Boolean(c && knownListingUrls().has(c));
}
