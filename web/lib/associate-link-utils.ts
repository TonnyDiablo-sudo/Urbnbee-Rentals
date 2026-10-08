export type ListingSite = {
  name: string;
  domains: string[];
  /** link: el servidor de Cabibee abre el anuncio con el puro link. shots: bloquean a Cabibee; hacen falta capturas, el texto o la extensión. */
  mode: "link" | "shots";
};

/** Probado desde el servidor de Cabibee en Railway (octubre 2026). */
export const LISTING_SITES: ListingSite[] = [
  { name: "Mercado Libre", domains: ["mercadolibre.com.mx"], mode: "link" },
  { name: "Casas y Terrenos", domains: ["casasyterrenos.com"], mode: "link" },
  { name: "Airbnb", domains: ["airbnb.mx", "airbnb.com", "airbnb.com.mx", "airbnb.es", "airbnb.ca"], mode: "link" },
  { name: "Facebook / Marketplace", domains: ["facebook.com", "fb.com", "fb.me", "fb.watch", "m.me", "messenger.com"], mode: "shots" },
  { name: "Instagram", domains: ["instagram.com", "threads.net"], mode: "shots" },
  { name: "Trovit", domains: ["trovit.com.mx", "trovit.com"], mode: "shots" },
  { name: "Inmuebles24", domains: ["inmuebles24.com"], mode: "shots" },
  { name: "Vivanuncios", domains: ["vivanuncios.com.mx"], mode: "shots" },
  { name: "Lamudi", domains: ["lamudi.com.mx"], mode: "shots" },
  { name: "Propiedades.com", domains: ["propiedades.com"], mode: "shots" },
  { name: "Booking", domains: ["booking.com"], mode: "shots" },
  { name: "Vrbo", domains: ["vrbo.com"], mode: "shots" },
];

function hostOf(raw: string): string | null {
  try {
    return new URL(/^https?:\/\//i.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function matches(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

export function siteFor(raw: string): ListingSite | null {
  const host = hostOf(raw);
  if (!host) return null;
  return LISTING_SITES.find((s) => s.domains.some((d) => matches(host, d))) ?? null;
}

/** El sitio bloquea al servidor (o pide iniciar sesión): con el puro link no se puede leer el anuncio. */
export function needsScreenshots(raw: string): boolean {
  return siteFor(raw)?.mode === "shots";
}

const FACEBOOK_DOMAINS = ["facebook.com", "fb.com", "fb.me", "m.me", "messenger.com"];

/** El contacto «perfil» del dueño sólo puede ser Facebook o Messenger. */
export function isFacebookUrl(raw: string | undefined): boolean {
  const host = raw ? hostOf(raw) : null;
  return Boolean(host && FACEBOOK_DOMAINS.some((d) => matches(host, d)));
}

/** Mismo anuncio aunque el link traiga parámetros distintos: sirve para no importarlo dos veces. */
export function canonicalListingUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw.trim());
    const host = u.hostname.toLowerCase().replace(/^(www|m|web)\./, "");
    const fbItem = u.pathname.match(/\/marketplace\/item\/(\d+)/);
    if (fbItem && (host === "facebook.com" || host.endsWith(".facebook.com"))) return `facebook.com/marketplace/item/${fbItem[1]}`;
    const room = u.pathname.match(/\/rooms\/(\d+)/);
    if (room && host.startsWith("airbnb.")) return `airbnb/rooms/${room[1]}`;
    const ml = u.pathname.match(/\/(MLM-?\d+)/i);
    if (ml && host.endsWith("mercadolibre.com.mx")) return `mercadolibre/${ml[1].toUpperCase().replace("-", "")}`;
    return `${host}${u.pathname.replace(/\/+$/, "").toLowerCase()}`;
  } catch {
    return null;
  }
}

export function firstUrlIn(text: string): string | null {
  const m = text.match(/https?:\/\/[^\s<>"']+/i);
  return m ? m[0].replace(/[),.;!?]+$/, "") : null;
}
