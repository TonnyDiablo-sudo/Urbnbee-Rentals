import "server-only";
import { canonicalListingUrl, siteFor } from "@/lib/associate-link-utils";
import { listAllDrafts } from "@/lib/associate-drafts-store";
import { mxDay } from "@/lib/associate-stats";
import { getAutopilotSettingsDoc } from "@/lib/autopilot-settings-store";
import { listAllListings } from "@/lib/marketplace-store";
import type { UserRecord } from "@/lib/marketplace-types";

/**
 * Piloto automático de la extensión (Asociado Plus): abre los anuncios de una búsqueda uno por uno
 * en el Chrome del asociado, con su sesión, a ritmo de persona y con tope diario por página.
 */

/** Páginas donde el piloto sabe juntar los anuncios de una búsqueda. */
export const AUTOPILOT_SITES = [
  "Facebook / Marketplace",
  "Inmuebles24",
  "Vivanuncios",
  "Lamudi",
  "Propiedades.com",
  "Casas y Terrenos",
  "Mercado Libre",
  "Airbnb",
] as const;

/** Facebook va con la cuenta personal del asociado: si lo bloquean pierde su cuenta, por eso va más bajo. */
const DEFAULT_LIMITS: Record<string, number> = { "Facebook / Marketplace": 40 };
const DEFAULT_SITE_LIMIT = 50;
export const MAX_SITE_LIMIT = 300;

function envInt(name: string, fallback: number, min: number, max: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n >= min && n <= max ? Math.round(n) : fallback;
}

/** Nombre de la página para los topes: «Inmuebles24», «Facebook / Marketplace» o el dominio si no la conocemos. */
export function autopilotSiteOf(url: string | undefined): string {
  if (!url) return "Otro";
  const known = siteFor(url);
  if (known) return known.name;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Otro";
  }
}

export function autopilotLimitFor(site: string): number {
  const custom = getAutopilotSettingsDoc().siteLimits[site];
  if (Number.isFinite(custom) && custom >= 0) return custom;
  return DEFAULT_LIMITS[site] ?? DEFAULT_SITE_LIMIT;
}

export function autopilotSettings(): { minDelaySec: number; limits: Record<string, number> } {
  return {
    minDelaySec: envInt("AUTOPILOT_MIN_DELAY_SEC", 90, 20, 1800),
    limits: Object.fromEntries(AUTOPILOT_SITES.map((s) => [s, autopilotLimitFor(s)])),
  };
}

export function canUseAutopilot(user: UserRecord | null | undefined): boolean {
  return Boolean(user && (user.role === "admin" || (user.associate && user.associatePlus)));
}

/** Borradores que el piloto trajo hoy (día de la Ciudad de México), por página. */
export function autopilotUsageBySite(associateId: string): Record<string, number> {
  const today = mxDay(new Date());
  const out: Record<string, number> = {};
  for (const d of listAllDrafts()) {
    if (d.associateId !== associateId || !d.autopilot || mxDay(d.createdAt) !== today) continue;
    const site = autopilotSiteOf(d.source.url);
    out[site] = (out[site] ?? 0) + 1;
  }
  return out;
}

export function autopilotUsedToday(associateId: string, site: string): number {
  return autopilotUsageBySite(associateId)[site] ?? 0;
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
