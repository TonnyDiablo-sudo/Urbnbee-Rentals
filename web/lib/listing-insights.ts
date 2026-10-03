import "server-only";
import { analyticsDayKey, shiftDayKey } from "@/lib/analytics-day";
import { listBookingsForHost } from "@/lib/bookings-store";
import type { BookingRecord } from "@/lib/booking-types";
import { listForHost } from "@/lib/host-inbox-store";
import { getAllListingDailyStats } from "@/lib/listing-stats-store";

export const INSIGHT_RANGES = [7, 30, 90] as const;
export type InsightRange = (typeof INSIGHT_RANGES)[number];

export type InsightDay = {
  day: string;
  /** Vistas únicas. */
  v: number;
  /** Vieron el contacto. */
  c: number;
  /** Conversaciones nuevas. */
  m: number;
  /** Solicitudes de reserva. */
  r: number;
};

type Totals = {
  views: number;
  contacts: number;
  conversations: number;
  requests: number;
  confirmed: number;
  nights: number;
  revenueMxn: number;
};

export type ListingInsights = {
  range: InsightRange;
  daily: InsightDay[];
  totals: Totals;
  previous: Totals;
  allTime: { views: number; contacts: number };
  /** Vistas por día de la semana, lunes primero. */
  weekday: number[];
  /** Mediana de minutos hasta la primera respuesta del anfitrión. */
  responseMinutes: number | null;
  /** Noches ocupadas de los próximos 30 días. */
  upcomingNights: number;
};

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const BOOKED: BookingRecord["status"][] = ["CONFIRMED", "COMPLETED"];
const REQUESTED: BookingRecord["status"][] = [
  "PENDING",
  "PENDING_HOST",
  "AWAITING_DETAILS",
  "AWAITING_PAYMENT",
  "CONFIRMED",
  "COMPLETED",
  "REJECTED",
  "CANCELLED",
  "EXPIRED",
];

function emptyTotals(): Totals {
  return { views: 0, contacts: 0, conversations: 0, requests: 0, confirmed: 0, nights: 0, revenueMxn: 0 };
}

export function parseInsightRange(raw: string | string[] | undefined): InsightRange {
  const n = Number(Array.isArray(raw) ? raw[0] : raw);
  return (INSIGHT_RANGES as readonly number[]).includes(n) ? (n as InsightRange) : 30;
}

export function listingInsights(listingId: string, hostId: string, range: InsightRange): ListingInsights {
  const today = analyticsDayKey();
  const start = shiftDayKey(today, -(range - 1));
  const prevStart = shiftDayKey(start, -range);
  const stats = getAllListingDailyStats()[listingId] ?? {};

  const byDay = new Map<string, InsightDay>();
  const daily: InsightDay[] = [];
  for (let i = 0; i < range; i++) {
    const day = shiftDayKey(start, i);
    const s = stats[day];
    const row = { day, v: s?.v ?? 0, c: s?.c ?? 0, m: 0, r: 0 };
    byDay.set(day, row);
    daily.push(row);
  }

  const totals = emptyTotals();
  const previous = emptyTotals();
  const inPrev = (day: string) => day >= prevStart && day < start;

  for (const [day, s] of Object.entries(stats)) {
    if (inPrev(day)) {
      previous.views += s.v;
      previous.contacts += s.c;
    }
  }
  let allViews = 0;
  let allContacts = 0;
  for (const s of Object.values(stats)) {
    allViews += s.v;
    allContacts += s.c;
  }

  // Conversaciones: el primer mensaje del huésped de cada hilo; y cuánto tardó la respuesta.
  const threads = new Map<string, { first?: string; reply?: string }>();
  for (const msg of [...listForHost(hostId)].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    if (msg.listingId !== listingId) continue;
    const th = threads.get(msg.guestSessionId) ?? {};
    if (msg.sender === "guest" && !th.first) th.first = msg.createdAt;
    else if (msg.sender === "host" && th.first && !th.reply) th.reply = msg.createdAt;
    threads.set(msg.guestSessionId, th);
  }
  const waits: number[] = [];
  for (const th of threads.values()) {
    if (!th.first) continue;
    const day = analyticsDayKey(th.first);
    const row = byDay.get(day);
    if (row) {
      row.m += 1;
      totals.conversations += 1;
      if (th.reply) waits.push((Date.parse(th.reply) - Date.parse(th.first)) / 60_000);
    } else if (inPrev(day)) {
      previous.conversations += 1;
    }
  }
  waits.sort((a, b) => a - b);
  const responseMinutes = waits.length ? Math.round(waits[Math.floor(waits.length / 2)]) : null;

  const bookings = listBookingsForHost(hostId).filter((b) => b.listingId === listingId);
  for (const b of bookings) {
    if (!REQUESTED.includes(b.status)) continue;
    const day = analyticsDayKey(b.createdAt);
    const target = byDay.has(day) ? totals : inPrev(day) ? previous : null;
    if (!target) continue;
    const row = byDay.get(day);
    if (row) row.r += 1;
    target.requests += 1;
    if (BOOKED.includes(b.status)) {
      target.confirmed += 1;
      target.nights += b.nights || 0;
      target.revenueMxn += b.estimatedTotalMxn || 0;
    }
  }
  for (const d of daily) {
    totals.views += d.v;
    totals.contacts += d.c;
  }

  const weekday = [0, 0, 0, 0, 0, 0, 0];
  for (const d of daily) {
    const [y, m, dd] = d.day.split("-").map(Number);
    const js = new Date(Date.UTC(y, m - 1, dd)).getUTCDay();
    weekday[(js + 6) % 7] += d.v;
  }

  // Ocupación: noches de reservas confirmadas que caen en los próximos 30 días.
  const horizon = shiftDayKey(today, 30);
  let upcomingNights = 0;
  for (const b of bookings) {
    if (!BOOKED.includes(b.status) || !DAY.test(b.checkIn) || !DAY.test(b.checkOut)) continue;
    if (b.checkOut < today || b.checkIn >= horizon) continue;
    for (let day = b.checkIn; day < b.checkOut; day = shiftDayKey(day, 1)) {
      if (day >= today && day < horizon) upcomingNights++;
    }
  }

  return {
    range,
    daily,
    totals,
    previous,
    allTime: { views: allViews, contacts: allContacts },
    weekday,
    responseMinutes,
    upcomingNights,
  };
}
