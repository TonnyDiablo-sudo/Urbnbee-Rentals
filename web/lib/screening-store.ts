import "server-only";
import { existsSync, readFileSync, statSync, writeFileSync } from "fs";
import { join } from "path";
import { randomBytes } from "crypto";
import type { ScreeningPrice, ScreeningRecord } from "@/lib/screening-types";
import { scheduleMysql, upsertJsonBlob } from "@/lib/mysql-sync";
import { ensureDir, getDataDir } from "@/lib/runtime-paths";

const CASES_FILE = join(getDataDir(), "screening-cases.json");
const PRICE_FILE = join(getDataDir(), "screening-price.json");

const cases: ScreeningRecord[] = [];
let casesMtime = 0;
function money(n: unknown): number {
  return Math.max(0, Math.round(Number(n) || 0));
}

function normalizePrice(raw: Partial<ScreeningPrice> | undefined): ScreeningPrice {
  const src = raw ?? {};
  const hasMxSplit = src.providerCostMxn !== undefined || src.markupMxn !== undefined;
  const hasUsSplit = src.providerCostUsd !== undefined || src.markupUsd !== undefined;
  const providerCostMxn = money(src.providerCostMxn);
  const markupMxn = hasMxSplit ? money(src.markupMxn) : money(src.amountMxn);
  const providerCostUsd = money(src.providerCostUsd);
  const markupUsd = hasUsSplit ? money(src.markupUsd) : money(src.amountUsd);
  return {
    providerCostMxn,
    markupMxn,
    amountMxn: providerCostMxn + markupMxn,
    providerCostUsd,
    markupUsd,
    amountUsd: providerCostUsd + markupUsd,
    stripeProductId: src.stripeProductId,
    active: Boolean(src.active),
    updatedAt: src.updatedAt ?? nowIso(),
  };
}

let price: ScreeningPrice = normalizePrice({
  providerCostMxn: 0,
  markupMxn: 0,
  providerCostUsd: 0,
  markupUsd: 0,
  active: false,
});
let priceMtime = 0;

function persistCases() {
  try {
    ensureDir(getDataDir());
    writeFileSync(CASES_FILE, JSON.stringify({ version: 1, cases }, null, 2), "utf8");
    if (existsSync(CASES_FILE)) casesMtime = statSync(CASES_FILE).mtimeMs;
    scheduleMysql(() => upsertJsonBlob("screening-cases", { version: 1, cases }));
  } catch (e) {
    console.warn("[screening] persist cases failed:", e);
  }
}

function persistPrice() {
  try {
    ensureDir(getDataDir());
    writeFileSync(PRICE_FILE, JSON.stringify({ version: 1, price }, null, 2), "utf8");
    if (existsSync(PRICE_FILE)) priceMtime = statSync(PRICE_FILE).mtimeMs;
    scheduleMysql(() => upsertJsonBlob("screening-price", { version: 1, price }));
  } catch (e) {
    console.warn("[screening] persist price failed:", e);
  }
}

function reloadCases() {
  try {
    if (!existsSync(CASES_FILE)) return;
    const data = JSON.parse(readFileSync(CASES_FILE, "utf8")) as { cases?: ScreeningRecord[] };
    cases.length = 0;
    for (const c of data.cases ?? []) {
      if (c?.id && c.guestUserId) {
        cases.push({ ...c, payer: c.payer === "host" ? "host" : "guest" });
      }
    }
    casesMtime = statSync(CASES_FILE).mtimeMs;
  } catch (e) {
    console.warn("[screening] load cases failed:", e);
  }
}

function reloadPrice() {
  try {
    if (!existsSync(PRICE_FILE)) return;
    const data = JSON.parse(readFileSync(PRICE_FILE, "utf8")) as { price?: ScreeningPrice };
    if (data.price) price = normalizePrice(data.price);
    priceMtime = statSync(PRICE_FILE).mtimeMs;
  } catch (e) {
    console.warn("[screening] load price failed:", e);
  }
}

function syncCases() {
  try {
    if (!existsSync(CASES_FILE)) return;
    const m = statSync(CASES_FILE).mtimeMs;
    if (m !== casesMtime) reloadCases();
  } catch {
    /* ignore */
  }
}

function syncPrice() {
  try {
    if (!existsSync(PRICE_FILE)) return;
    const m = statSync(PRICE_FILE).mtimeMs;
    if (m !== priceMtime) reloadPrice();
  } catch {
    /* ignore */
  }
}

reloadCases();
reloadPrice();

function nowIso() {
  return new Date().toISOString();
}

export function getScreeningPrice(): ScreeningPrice {
  syncPrice();
  return { ...price };
}

export function updateScreeningPrice(
  patch: Partial<
    Pick<
      ScreeningPrice,
      | "providerCostMxn"
      | "markupMxn"
      | "providerCostUsd"
      | "markupUsd"
      | "amountMxn"
      | "amountUsd"
      | "active"
      | "stripeProductId"
    >
  >
): ScreeningPrice {
  syncPrice();
  price = normalizePrice({
    ...price,
    ...patch,
    updatedAt: nowIso(),
  });
  persistPrice();
  return { ...price };
}

export function screeningOffered(region: "mx" | "us"): boolean {
  const p = getScreeningPrice();
  if (!p.active) return false;
  return region === "us" ? p.amountUsd > 0 : p.amountMxn > 0;
}

export function screeningAmount(region: "mx" | "us"): number {
  const p = getScreeningPrice();
  return region === "us" ? p.amountUsd : p.amountMxn;
}

export function listAllScreenings(): ScreeningRecord[] {
  syncCases();
  return [...cases];
}

export function listScreeningsForGuest(guestUserId: string): ScreeningRecord[] {
  syncCases();
  return cases
    .filter((c) => c.guestUserId === guestUserId)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export function listScreeningsForHost(hostId: string): ScreeningRecord[] {
  syncCases();
  return cases
    .filter((c) => c.hostId === hostId)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export function getScreeningById(id: string): ScreeningRecord | undefined {
  syncCases();
  return cases.find((c) => c.id === id);
}

export function getScreeningByBooking(bookingId: string): ScreeningRecord | undefined {
  syncCases();
  return cases.find((c) => c.bookingId === bookingId);
}

export function getScreeningBySession(sessionId: string): ScreeningRecord | undefined {
  syncCases();
  return cases.find((c) => c.stripeCheckoutSessionId === sessionId);
}

export function getScreeningByRefHash(refHash: string): ScreeningRecord | undefined {
  syncCases();
  return cases.find((c) => c.providerRefHash === refHash);
}

export function findReusableGuestScreening(guestUserId: string, withinDays = 90): ScreeningRecord | undefined {
  const cutoff = Date.now() - withinDays * 24 * 60 * 60 * 1000;
  return listScreeningsForGuest(guestUserId).find(
    (c) => c.status === "completed" && new Date(c.updatedAt).getTime() >= cutoff
  );
}

export function insertScreening(
  input: Omit<ScreeningRecord, "id" | "createdAt" | "updatedAt">
): ScreeningRecord {
  syncCases();
  const row: ScreeningRecord = {
    ...input,
    id: `scr_${randomBytes(8).toString("hex")}`,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  cases.push(row);
  persistCases();
  return row;
}

export function patchScreening(id: string, patch: Partial<ScreeningRecord>): ScreeningRecord | undefined {
  syncCases();
  const idx = cases.findIndex((c) => c.id === id);
  if (idx === -1) return undefined;
  const next = { ...cases[idx], ...patch, id, guestUserId: cases[idx].guestUserId, updatedAt: nowIso() };
  cases[idx] = next;
  persistCases();
  return next;
}

export function markScreeningPaidBySession(sessionId: string): ScreeningRecord | undefined {
  syncCases();
  const row = cases.find((c) => c.stripeCheckoutSessionId === sessionId);
  if (!row) return undefined;
  if (row.paidAt) return row;
  return patchScreening(row.id, { status: "paid", paidAt: nowIso() });
}
