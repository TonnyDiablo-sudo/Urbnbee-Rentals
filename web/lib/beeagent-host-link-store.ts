import "server-only";
import { existsSync, readFileSync, statSync, writeFileSync } from "fs";
import { join } from "path";
import { randomBytes } from "crypto";
import { ensureDir, getDataDir } from "@/lib/runtime-paths";

const DATA_FILE = join(getDataDir(), "beeagent-host-links.json");
const LINK_CODE_TTL_MS = 10 * 60 * 1000;

export type BeeagentHostLinkRecord = {
  hostId: string;
  beeagentCustomerId: number;
  email: string;
  linkedAt: string;
};

type PendingCode = {
  code: string;
  hostId: string;
  expiresAt: string;
};

type Snapshot = {
  version: 1;
  links: BeeagentHostLinkRecord[];
  pendingCodes: PendingCode[];
};

let linksByHostId = new Map<string, BeeagentHostLinkRecord>();
let linksByCustomerId = new Map<number, BeeagentHostLinkRecord>();
let pendingByCode = new Map<string, PendingCode>();
let cachedMtimeMs = 0;

function nowIso() {
  return new Date().toISOString();
}

function persist() {
  try {
    ensureDir(getDataDir());
    const snapshot: Snapshot = {
      version: 1,
      links: [...linksByHostId.values()],
      pendingCodes: [...pendingByCode.values()],
    };
    writeFileSync(DATA_FILE, JSON.stringify(snapshot, null, 2), "utf8");
    if (existsSync(DATA_FILE)) cachedMtimeMs = statSync(DATA_FILE).mtimeMs;
  } catch (e) {
    console.warn("[beeagent-host-link] persist failed:", e);
  }
}

function reload() {
  try {
    if (!existsSync(DATA_FILE)) return;
    const raw = readFileSync(DATA_FILE, "utf8");
    const data = JSON.parse(raw) as Snapshot;
    linksByHostId.clear();
    linksByCustomerId.clear();
    pendingByCode.clear();
    for (const l of data.links ?? []) {
      if (!l.hostId || !Number.isFinite(l.beeagentCustomerId)) continue;
      linksByHostId.set(l.hostId, l);
      linksByCustomerId.set(l.beeagentCustomerId, l);
    }
    const now = Date.now();
    for (const p of data.pendingCodes ?? []) {
      if (new Date(p.expiresAt).getTime() <= now) continue;
      pendingByCode.set(normalizeLinkCode(p.code), p);
    }
    cachedMtimeMs = statSync(DATA_FILE).mtimeMs;
  } catch (e) {
    console.warn("[beeagent-host-link] load failed:", e);
  }
}

function syncIfStale() {
  try {
    if (!existsSync(DATA_FILE)) return;
    const m = statSync(DATA_FILE).mtimeMs;
    if (m === cachedMtimeMs) return;
    reload();
  } catch {
    /* ignore */
  }
}

reload();

export function normalizeLinkCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

function formatLinkCode(): string {
  const a = randomBytes(2).toString("hex").toUpperCase().slice(0, 4);
  const b = String(Math.floor(1000 + Math.random() * 9000));
  return `${a}-${b}`;
}

export function getBeeagentLinkForHost(hostId: string): BeeagentHostLinkRecord | undefined {
  syncIfStale();
  return linksByHostId.get(hostId);
}

export function getBeeagentLinkForCustomer(
  beeagentCustomerId: number
): BeeagentHostLinkRecord | undefined {
  syncIfStale();
  return linksByCustomerId.get(beeagentCustomerId);
}

export function upsertBeeagentHostLink(input: {
  hostId: string;
  beeagentCustomerId: number;
  email: string;
}): BeeagentHostLinkRecord {
  syncIfStale();
  const existingCustomer = linksByCustomerId.get(input.beeagentCustomerId);
  if (existingCustomer && existingCustomer.hostId !== input.hostId) {
    throw new Error("BEEAGENT_CUSTOMER_LINKED_TO_OTHER_HOST");
  }

  const prev = linksByHostId.get(input.hostId);
  if (prev && prev.beeagentCustomerId !== input.beeagentCustomerId) {
    linksByCustomerId.delete(prev.beeagentCustomerId);
  }

  const record: BeeagentHostLinkRecord = {
    hostId: input.hostId,
    beeagentCustomerId: input.beeagentCustomerId,
    email: input.email.trim().toLowerCase(),
    linkedAt: nowIso(),
  };
  linksByHostId.set(input.hostId, record);
  linksByCustomerId.set(input.beeagentCustomerId, record);
  persist();
  return record;
}

export function createLinkCodeForHost(hostId: string): { code: string; expiresAt: string } {
  syncIfStale();
  purgeExpiredCodes();
  const code = formatLinkCode();
  const normalized = normalizeLinkCode(code);
  const expiresAt = new Date(Date.now() + LINK_CODE_TTL_MS).toISOString();
  pendingByCode.set(normalized, { code: normalized, hostId, expiresAt });
  persist();
  return { code: normalized, expiresAt };
}

function purgeExpiredCodes() {
  const now = Date.now();
  for (const [k, p] of pendingByCode.entries()) {
    if (new Date(p.expiresAt).getTime() <= now) pendingByCode.delete(k);
  }
}

export function consumeLinkCode(code: string): { hostId: string } | undefined {
  syncIfStale();
  purgeExpiredCodes();
  const key = normalizeLinkCode(code);
  const pending = pendingByCode.get(key);
  if (!pending) return undefined;
  if (new Date(pending.expiresAt).getTime() <= Date.now()) {
    pendingByCode.delete(key);
    persist();
    return undefined;
  }
  pendingByCode.delete(key);
  persist();
  return { hostId: pending.hostId };
}
