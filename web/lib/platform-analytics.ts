import "server-only";
import { analyticsDayKey, shiftDayKey } from "@/lib/analytics-day";
import { listAllBookings } from "@/lib/bookings-store";
import { parsePlaceKey, placeForListing, placeKey, UNKNOWN, type GeoPlace } from "@/lib/geo-places";
import { listAllHostEntitlements } from "@/lib/host-entitlements-store";
import { listAllMessages } from "@/lib/host-inbox-store";
import { listClaimRequests } from "@/lib/listing-claims-store";
import { getAllListingDailyStats } from "@/lib/listing-stats-store";
import { listAllListings, listAllUsers } from "@/lib/marketplace-store";
import { getSiteVisitDays, getUserPlaces } from "@/lib/site-visits-store";
import { listAllVerifications } from "@/lib/verification-store";

export const RANGES = [
  { id: "hoy", label: "Hoy", days: 1 },
  { id: "7d", label: "7 días", days: 7 },
  { id: "30d", label: "30 días", days: 30 },
  { id: "3m", label: "3 meses", days: 91 },
  { id: "6m", label: "6 meses", days: 182 },
  { id: "12m", label: "12 meses", days: 365 },
  { id: "18m", label: "18 meses", days: 547 },
  { id: "24m", label: "24 meses", days: 730 },
  { id: "3a", label: "3 años", days: 1095 },
] as const;
export type RangeId = (typeof RANGES)[number]["id"];

export const METRICS = [
  { key: "visitors", label: "Visitantes únicos", group: "Tráfico" },
  { key: "pageviews", label: "Páginas vistas", group: "Tráfico" },
  { key: "listingViews", label: "Clics en anuncios", group: "Tráfico" },
  { key: "contactViews", label: "Contactos vistos", group: "Tráfico" },
  { key: "accounts", label: "Cuentas nuevas", group: "Cuentas" },
  { key: "guests", label: "Huéspedes nuevos", group: "Cuentas" },
  { key: "hosts", label: "Anfitriones nuevos", group: "Cuentas" },
  { key: "listings", label: "Anuncios nuevos", group: "Cuentas" },
  { key: "associateListings", label: "Anuncios de asociados", group: "Cuentas" },
  { key: "claims", label: "Reclamos de anuncios", group: "Cuentas" },
  { key: "chats", label: "Chats nuevos", group: "Mensajes" },
  { key: "conversations", label: "Conversaciones activas", group: "Mensajes" },
  { key: "messages", label: "Mensajes", group: "Mensajes" },
  { key: "bookings", label: "Reservas solicitadas", group: "Negocio" },
  { key: "bookingsConfirmed", label: "Reservas confirmadas", group: "Negocio" },
  { key: "subscriptions", label: "Suscripciones nuevas", group: "Negocio" },
  { key: "verifications", label: "Anfitriones verificados", group: "Negocio" },
] as const;
export type MetricKey = (typeof METRICS)[number]["key"];

/** Métricas que cuentan cosas distintas (no se suman día a día). */
const DISTINCT: ReadonlySet<MetricKey> = new Set(["conversations"]);

type Ev = { m: MetricKey; day: string; place: string; n: number; id?: string };

export type GeoFilter = { country?: string; state?: string; city?: string };

function matches(placeK: string, f: GeoFilter): boolean {
  if (!f.country && !f.state && !f.city) return true;
  const p = parsePlaceKey(placeK);
  return (!f.country || p.country === f.country) && (!f.state || p.state === f.state) && (!f.city || p.city === f.city);
}

/** Cuentas de muestra (scripts/seed-*.mjs): sus números son inventados. */
export function isDemoUser(u: { id: string; email?: string }): boolean {
  return /^usr_(seed|demo|show)_/.test(u.id) || Boolean(u.email?.endsWith("@urbnbee.test"));
}

function collectEvents(includeDemo: boolean): Ev[] {
  const ev: Ev[] = [];
  const allUsers = listAllUsers();
  const demoUsers = new Set(includeDemo ? [] : allUsers.filter(isDemoUser).map((u) => u.id));
  const allListings = listAllListings();
  const demoListings = new Set(allListings.filter((l) => demoUsers.has(l.hostId)).map((l) => l.id));
  const listings = allListings.filter((l) => !demoListings.has(l.id));
  const listingPlace = new Map(listings.map((l) => [l.id, placeKey(placeForListing(l))]));
  const hostPlace = new Map<string, string>();
  for (const l of listings) if (!hostPlace.has(l.hostId)) hostPlace.set(l.hostId, listingPlace.get(l.id)!);
  const userPlaces = getUserPlaces();
  const unknown = placeKey({ country: UNKNOWN, state: UNKNOWN, city: UNKNOWN });
  const placeOfUser = (id: string) => userPlaces[id] ?? hostPlace.get(id) ?? unknown;
  const placeOfListing = (id: string) => listingPlace.get(id) ?? unknown;
  const day = (iso: string | undefined) => (iso ? analyticsDayKey(iso) : null);

  for (const [d, places] of Object.entries(getSiteVisitDays())) {
    for (const [p, [pv, uv]] of Object.entries(places)) {
      ev.push({ m: "pageviews", day: d, place: p, n: pv }, { m: "visitors", day: d, place: p, n: uv });
    }
  }

  for (const [listingId, days] of Object.entries(getAllListingDailyStats())) {
    if (demoListings.has(listingId)) continue;
    const p = placeOfListing(listingId);
    for (const [d, c] of Object.entries(days)) {
      if (c.v) ev.push({ m: "listingViews", day: d, place: p, n: c.v });
      if (c.c) ev.push({ m: "contactViews", day: d, place: p, n: c.c });
    }
  }

  for (const u of allUsers) {
    const d = day(u.createdAt);
    if (!d || u.role === "admin" || demoUsers.has(u.id)) continue;
    const p = placeOfUser(u.id);
    ev.push({ m: "accounts", day: d, place: p, n: 1 });
    ev.push({ m: u.role === "host" ? "hosts" : "guests", day: d, place: p, n: 1 });
  }

  for (const l of listings) {
    const d = day(l.createdAt);
    if (!d) continue;
    ev.push({ m: "listings", day: d, place: placeOfListing(l.id), n: 1 });
    if (l.source) ev.push({ m: "associateListings", day: d, place: placeOfListing(l.id), n: 1 });
  }

  for (const c of listClaimRequests()) {
    const d = day(c.createdAt);
    if (d && !demoListings.has(c.listingId)) ev.push({ m: "claims", day: d, place: placeOfListing(c.listingId), n: 1 });
  }

  const threadStarted = new Set<string>();
  const msgs = [...listAllMessages()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  for (const msg of msgs) {
    const d = day(msg.createdAt);
    if (!d || demoListings.has(msg.listingId)) continue;
    const p = placeOfListing(msg.listingId);
    const thread = `${msg.listingId}|${msg.guestSessionId}`;
    ev.push({ m: "messages", day: d, place: p, n: 1 });
    ev.push({ m: "conversations", day: d, place: p, n: 1, id: thread });
    if (!threadStarted.has(thread)) {
      threadStarted.add(thread);
      ev.push({ m: "chats", day: d, place: p, n: 1 });
    }
  }

  for (const b of listAllBookings()) {
    const d = day(b.createdAt);
    if (!d || demoListings.has(b.listingId)) continue;
    const p = placeOfListing(b.listingId);
    ev.push({ m: "bookings", day: d, place: p, n: 1 });
    if (b.status === "CONFIRMED" || b.status === "COMPLETED") ev.push({ m: "bookingsConfirmed", day: d, place: p, n: 1 });
  }

  // Sin `startedAt` (registros anteriores a que se guardara), se toma la última actualización de una suscripción viva.
  for (const e of listAllHostEntitlements()) {
    if (demoUsers.has(e.hostId)) continue;
    const d = day(e.startedAt ?? (e.status === "active" ? e.updatedAt : undefined));
    if (d) ev.push({ m: "subscriptions", day: d, place: placeOfUser(e.hostId), n: 1 });
  }
  const live = (s?: string) => s === "active" || s === "trialing";
  for (const v of listAllVerifications()) {
    if (demoUsers.has(v.userId)) continue;
    const g = day(v.subscriptionStartedAt ?? (live(v.subscriptionStatus) ? v.updatedAt : undefined));
    if (g) ev.push({ m: "subscriptions", day: g, place: placeOfUser(v.userId), n: 1 });
    const h = day(v.hostSubscriptionStartedAt ?? (live(v.hostSubscriptionStatus) ? v.updatedAt : undefined));
    if (h) ev.push({ m: "subscriptions", day: h, place: placeOfUser(v.userId), n: 1 });
    const vd = day(v.hostVerifiedAt);
    if (vd) ev.push({ m: "verifications", day: vd, place: placeOfUser(v.userId), n: 1 });
  }

  return ev;
}

function dayIndex(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function dayLabel(day: string): string {
  const [, m, d] = day.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}

export type MetricResult = {
  key: MetricKey;
  label: string;
  group: string;
  total: number;
  prev: number;
  series: number[];
};

export type BreakdownRow = { place: string; values: Partial<Record<MetricKey, number>> };

export type PlatformDashboard = {
  range: (typeof RANGES)[number];
  from: string;
  to: string;
  bucketLabels: string[];
  bucketUnit: "día" | "semana" | "mes";
  metrics: MetricResult[];
  options: { countries: string[]; states: string[]; cities: string[] };
  breakdown: { level: "estado" | "ciudad"; rows: BreakdownRow[] };
};

export const BREAKDOWN_METRICS: MetricKey[] = [
  "visitors",
  "accounts",
  "listingViews",
  "contactViews",
  "chats",
  "bookings",
  "subscriptions",
];

export function getPlatformDashboard(rangeId: string, filter: GeoFilter, includeDemo = false): PlatformDashboard {
  const range = RANGES.find((r) => r.id === rangeId) ?? RANGES[2];
  const to = analyticsDayKey();
  const from = shiftDayKey(to, -(range.days - 1));
  const prevFrom = shiftDayKey(from, -range.days);
  const fromIdx = dayIndex(from);

  const unit: PlatformDashboard["bucketUnit"] = range.days <= 31 ? "día" : range.days <= 182 ? "semana" : "mes";
  const bucketLabels: string[] = [];
  const bucketOf = (day: string): number => {
    if (unit === "día") return dayIndex(day) - fromIdx;
    if (unit === "semana") return Math.floor((dayIndex(day) - fromIdx) / 7);
    const [fy, fm] = from.split("-").map(Number);
    const [y, m] = day.split("-").map(Number);
    return (y - fy) * 12 + (m - fm);
  };
  if (unit === "día") for (let i = 0; i < range.days; i++) bucketLabels.push(dayLabel(shiftDayKey(from, i)));
  else if (unit === "semana") for (let i = 0; i * 7 < range.days; i++) bucketLabels.push(dayLabel(shiftDayKey(from, i * 7)));
  else {
    const [fy, fm] = from.split("-").map(Number);
    for (let i = 0; i <= bucketOf(to); i++) {
      const mm = (fm - 1 + i) % 12;
      const yy = fy + Math.floor((fm - 1 + i) / 12);
      bucketLabels.push(`${MONTHS[mm]} ${String(yy).slice(2)}`);
    }
  }

  const events = collectEvents(includeDemo);

  const allPlaces = new Set(events.map((e) => e.place));
  const parsed = [...allPlaces].map(parsePlaceKey);
  const sorted = (xs: string[]) => [...new Set(xs)].filter((x) => x !== UNKNOWN).sort((a, b) => a.localeCompare(b, "es"));
  const options = {
    countries: sorted(parsed.map((p) => p.country)),
    states: sorted(parsed.filter((p) => !filter.country || p.country === filter.country).map((p) => p.state)),
    cities: sorted(
      parsed
        .filter((p) => (!filter.country || p.country === filter.country) && (!filter.state || p.state === filter.state))
        .map((p) => p.city)
    ),
  };

  const level: PlatformDashboard["breakdown"]["level"] = filter.state ? "ciudad" : "estado";
  const levelOf = (p: GeoPlace) =>
    level === "ciudad" ? p.city : p.country === "México" || p.country === UNKNOWN ? p.state : `${p.state} (${p.country})`;

  const acc = new Map<MetricKey, { total: number; prev: number; series: number[]; ids: Set<string>; prevIds: Set<string>; bucketIds: Set<string>[] }>();
  for (const m of METRICS) {
    acc.set(m.key, {
      total: 0,
      prev: 0,
      series: bucketLabels.map(() => 0),
      ids: new Set(),
      prevIds: new Set(),
      bucketIds: bucketLabels.map(() => new Set<string>()),
    });
  }
  const breakdown = new Map<string, Partial<Record<MetricKey, number>>>();
  const breakdownIds = new Map<string, Set<string>>();

  for (const e of events) {
    if (e.day < prevFrom || e.day > to || !matches(e.place, filter)) continue;
    const a = acc.get(e.m)!;
    const distinct = DISTINCT.has(e.m) && e.id;
    if (e.day < from) {
      if (distinct) a.prevIds.add(e.id!);
      else a.prev += e.n;
      continue;
    }
    const b = bucketOf(e.day);
    if (distinct) {
      a.ids.add(e.id!);
      if (a.bucketIds[b]) a.bucketIds[b].add(e.id!);
    } else {
      a.total += e.n;
      if (b >= 0 && b < a.series.length) a.series[b] += e.n;
    }
    if (BREAKDOWN_METRICS.includes(e.m)) {
      const k = levelOf(parsePlaceKey(e.place));
      const row = breakdown.get(k) ?? {};
      if (distinct) {
        const s = breakdownIds.get(`${k}|${e.m}`) ?? new Set<string>();
        s.add(e.id!);
        breakdownIds.set(`${k}|${e.m}`, s);
        row[e.m] = s.size;
      } else row[e.m] = (row[e.m] ?? 0) + e.n;
      breakdown.set(k, row);
    }
  }

  const metrics: MetricResult[] = METRICS.map((m) => {
    const a = acc.get(m.key)!;
    if (DISTINCT.has(m.key)) {
      return { ...m, total: a.ids.size, prev: a.prevIds.size, series: a.bucketIds.map((s) => s.size) };
    }
    return { ...m, total: a.total, prev: a.prev, series: a.series };
  });

  const rows = [...breakdown.entries()]
    .map(([place, values]) => ({ place, values }))
    .sort((x, y) => (y.values.visitors ?? 0) + (y.values.listingViews ?? 0) - ((x.values.visitors ?? 0) + (x.values.listingViews ?? 0)));

  return { range, from, to, bucketLabels, bucketUnit: unit, metrics, options, breakdown: { level, rows } };
}
