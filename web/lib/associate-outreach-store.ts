import "server-only";
import { randomBytes } from "crypto";
import { existsSync, readFileSync, statSync, writeFileSync } from "fs";
import { join } from "path";
import { scheduleMysql, upsertJsonBlob } from "@/lib/mysql-sync";
import { ensureDir, getDataDir } from "@/lib/runtime-paths";
import { openSecret, sealSecret } from "@/lib/secret-box";

/** «Por avisar»: a qué dueños de cuentas creadas por asociados ya se les avisó, por dónde y qué contestaron. */
export type OutreachChannel = "whatsapp" | "whatsapp_api" | "messenger" | "email";
export type OutreachManualStatus = "pendiente" | "enviado" | "respondio" | "no_quiere";

export type OutreachSend = { channel: OutreachChannel; at: string; by: string; ok: boolean; error?: string };

export type OutreachRecord = {
  hostId: string;
  associateId: string;
  status: OutreachManualStatus;
  sends: OutreachSend[];
  /** Contraseña temporal cifrada que va en el mensaje; se reutiliza mientras el dueño no la cambie. */
  passwordEnc?: string;
  optOutToken: string;
  optedOutAt?: string;
  updatedAt: string;
};

type OutreachDoc = { records: Record<string, OutreachRecord> };

const DATA_FILE = join(getDataDir(), "associate-outreach.json");
let doc: OutreachDoc = { records: {} };
let cachedMtimeMs = 0;

function reload() {
  try {
    if (!existsSync(DATA_FILE)) return;
    const data = JSON.parse(readFileSync(DATA_FILE, "utf8")) as Partial<OutreachDoc>;
    doc = { records: data.records && typeof data.records === "object" ? data.records : {} };
    cachedMtimeMs = statSync(DATA_FILE).mtimeMs;
  } catch (e) {
    console.warn("[associate-outreach] load failed:", e);
  }
}

function syncIfStale() {
  try {
    if (existsSync(DATA_FILE) && statSync(DATA_FILE).mtimeMs !== cachedMtimeMs) reload();
  } catch {
    /* ignore */
  }
}

function persist() {
  try {
    ensureDir(getDataDir());
    writeFileSync(DATA_FILE, JSON.stringify(doc, null, 2), "utf8");
    cachedMtimeMs = statSync(DATA_FILE).mtimeMs;
    scheduleMysql(() => upsertJsonBlob("associate-outreach", doc));
  } catch (e) {
    console.warn("[associate-outreach] persist failed:", e);
  }
}

reload();

export function getOutreach(hostId: string): OutreachRecord | undefined {
  syncIfStale();
  return doc.records[hostId];
}

export function listOutreach(): OutreachRecord[] {
  syncIfStale();
  return Object.values(doc.records);
}

export function findOutreachByToken(token: string): OutreachRecord | undefined {
  syncIfStale();
  if (!token) return undefined;
  return Object.values(doc.records).find((r) => r.optOutToken === token);
}

export function ensureOutreach(hostId: string, associateId: string): OutreachRecord {
  syncIfStale();
  const prev = doc.records[hostId];
  if (prev) return prev;
  const rec: OutreachRecord = {
    hostId,
    associateId,
    status: "pendiente",
    sends: [],
    optOutToken: randomBytes(18).toString("base64url"),
    updatedAt: new Date().toISOString(),
  };
  doc.records[hostId] = rec;
  persist();
  return rec;
}

export function updateOutreach(hostId: string, patch: Partial<Omit<OutreachRecord, "hostId">>): OutreachRecord | undefined {
  syncIfStale();
  const prev = doc.records[hostId];
  if (!prev) return undefined;
  const next = { ...prev, ...patch, updatedAt: new Date().toISOString() };
  doc.records[hostId] = next;
  persist();
  return next;
}

const PASSWORD_PURPOSE = "cabibee-outreach-passwords";

/** Cada contraseña temporal nueva de la cuenta se guarda para que el aviso lleve la vigente. */
export function rememberOutreachPassword(hostId: string, associateId: string, plain: string): void {
  ensureOutreach(hostId, associateId);
  updateOutreach(hostId, { passwordEnc: sealSecret(PASSWORD_PURPOSE, plain) });
}

export function outreachPassword(rec: OutreachRecord): string | null {
  return rec.passwordEnc ? openSecret(PASSWORD_PURPOSE, rec.passwordEnc) : null;
}

export function addOutreachSend(hostId: string, send: OutreachSend): OutreachRecord | undefined {
  syncIfStale();
  const prev = doc.records[hostId];
  if (!prev) return undefined;
  return updateOutreach(hostId, {
    sends: [...prev.sends, send],
    status: send.ok && prev.status === "pendiente" ? "enviado" : prev.status,
  });
}
