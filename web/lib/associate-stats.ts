import "server-only";
import { listAllDrafts, type AssociateDraft } from "@/lib/associate-drafts-store";
import { listAllUsers } from "@/lib/marketplace-store";
import type { UserRecord } from "@/lib/marketplace-types";

/** Los asociados trabajan en México: el "hoy" de la meta es el de la Ciudad de México. */
const TZ = "America/Mexico_City";
const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });

export function mxDay(d: Date | string): string {
  return dayFmt.format(typeof d === "string" ? new Date(d) : d);
}

/** Últimos `n` días (YYYY-MM-DD en CDMX), del más viejo a hoy. */
export function lastMxDays(n: number, now = new Date()): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(mxDay(new Date(now.getTime() - i * 86_400_000)));
  return [...new Set(out)];
}

export type AssociateDayCount = { day: string; accounts: number; listings: number };

export type AssociateStats = {
  associateId: string;
  goal: number;
  today: number;
  todayListings: number;
  yesterday: number;
  last7: number;
  last30: number;
  month: number;
  total: number;
  totalListings: number;
  claimed: number;
  pendingDrafts: number;
  discardedDrafts: number;
  /** Días de los últimos 30 en que llegó a la meta. */
  goalDays30: number;
  lastCreatedAt?: string;
  days: AssociateDayCount[];
};

function draftDay(d: AssociateDraft): string {
  return mxDay(d.publishedAt ?? d.updatedAt);
}

function build(associate: UserRecord, accounts: UserRecord[], drafts: AssociateDraft[], days: number): AssociateStats {
  const now = new Date();
  const today = mxDay(now);
  const yesterday = mxDay(new Date(now.getTime() - 86_400_000));
  const window30 = new Set(lastMxDays(30, now));
  const window7 = new Set(lastMxDays(7, now));
  const month = today.slice(0, 7);

  const accountsByDay = new Map<string, number>();
  for (const u of accounts) {
    const d = mxDay(u.createdAt);
    accountsByDay.set(d, (accountsByDay.get(d) ?? 0) + 1);
  }
  const published = drafts.filter((d) => d.status === "published");
  const listingsByDay = new Map<string, number>();
  for (const d of published) {
    const k = draftDay(d);
    listingsByDay.set(k, (listingsByDay.get(k) ?? 0) + 1);
  }
  const sumDays = (set: Set<string>) => [...set].reduce((n, d) => n + (accountsByDay.get(d) ?? 0), 0);
  const goal = Math.max(0, associate.associateDailyGoal ?? 0);

  return {
    associateId: associate.id,
    goal,
    today: accountsByDay.get(today) ?? 0,
    todayListings: listingsByDay.get(today) ?? 0,
    yesterday: accountsByDay.get(yesterday) ?? 0,
    last7: sumDays(window7),
    last30: sumDays(window30),
    month: [...accountsByDay].filter(([d]) => d.startsWith(month)).reduce((n, [, c]) => n + c, 0),
    total: accounts.length,
    totalListings: published.length,
    claimed: accounts.filter((u) => u.claimedAt).length,
    pendingDrafts: drafts.filter((d) => d.status === "pending").length,
    discardedDrafts: drafts.filter((d) => d.status === "discarded").length,
    goalDays30: goal ? [...window30].filter((d) => (accountsByDay.get(d) ?? 0) >= goal).length : 0,
    lastCreatedAt: accounts.reduce<string | undefined>((max, u) => (!max || u.createdAt > max ? u.createdAt : max), undefined),
    days: lastMxDays(days, now).map((day) => ({
      day,
      accounts: accountsByDay.get(day) ?? 0,
      listings: listingsByDay.get(day) ?? 0,
    })),
  };
}

export function getAssociateStats(associate: UserRecord, days = 14): AssociateStats {
  const users = listAllUsers();
  return build(
    associate,
    users.filter((u) => u.provisionedBy === associate.id),
    listAllDrafts().filter((d) => d.associateId === associate.id),
    days
  );
}

/** Para el panel del admin: todos los que tienen acceso de asociado o ya crearon cuentas. */
export function getAllAssociateStats(days = 14): { associate: UserRecord; stats: AssociateStats }[] {
  const users = listAllUsers();
  const drafts = listAllDrafts();
  const creators = new Set(users.map((u) => u.provisionedBy).filter(Boolean));
  return users
    .filter((u) => u.associate || creators.has(u.id))
    .map((associate) => ({
      associate,
      stats: build(
        associate,
        users.filter((u) => u.provisionedBy === associate.id),
        drafts.filter((d) => d.associateId === associate.id),
        days
      ),
    }))
    .sort((a, b) => b.stats.today - a.stats.today || b.stats.total - a.stats.total);
}
