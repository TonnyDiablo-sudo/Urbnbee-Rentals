import "server-only";
import { randomBytes } from "crypto";
import { existsSync, readFileSync, statSync, writeFileSync } from "fs";
import { join } from "path";
import { scheduleMysql, upsertJsonBlob } from "@/lib/mysql-sync";
import { ensureDir, getDataDir } from "@/lib/runtime-paths";

/**
 * Líneas de Cabibee que el piloto pone en los formularios que piden teléfono para mostrar el WhatsApp
 * del anunciante, y con qué nombre y correo los llena.
 */
export type AutopilotPhone = {
  id: string;
  /** Lada de país sin «+»: 52, 57, 56, 593. */
  country: string;
  /** Número nacional, sólo dígitos. */
  national: string;
  active: boolean;
  addedAt: string;
  addedBy: string;
};

/** Correo de Cabibee con el nombre que se pone junto a él en los formularios. */
export type AutopilotEmail = { id: string; email: string; name: string; active: boolean; addedAt: string; addedBy: string };

export type AutopilotPhoneUse = { phoneId: string; emailId?: string; at: string; site: string; associateId: string; url?: string };

export type AutopilotPhonesDoc = {
  phones: AutopilotPhone[];
  emails: AutopilotEmail[];
  uses: AutopilotPhoneUse[];
  formName: string;
  formEmail: string;
  perPhoneDaily: number;
};

const DATA_FILE = join(getDataDir(), "autopilot-phones.json");
const KEEP_USES_MS = 35 * 86400_000;
let doc: AutopilotPhonesDoc = { phones: [], emails: [], uses: [], formName: "", formEmail: "", perPhoneDaily: 8 };
let cachedMtimeMs = 0;

function reload() {
  try {
    if (!existsSync(DATA_FILE)) return;
    const data = JSON.parse(readFileSync(DATA_FILE, "utf8")) as Partial<AutopilotPhonesDoc>;
    doc = {
      phones: Array.isArray(data.phones) ? data.phones : [],
      emails: Array.isArray(data.emails) ? data.emails : [],
      uses: Array.isArray(data.uses) ? data.uses : [],
      formName: typeof data.formName === "string" ? data.formName : "",
      formEmail: typeof data.formEmail === "string" ? data.formEmail : "",
      perPhoneDaily: Number.isFinite(data.perPhoneDaily) ? Number(data.perPhoneDaily) : 8,
    };
    cachedMtimeMs = statSync(DATA_FILE).mtimeMs;
  } catch (e) {
    console.warn("[autopilot-phones] load failed:", e);
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
  const cutoff = Date.now() - KEEP_USES_MS;
  doc.uses = doc.uses.filter((u) => new Date(u.at).getTime() >= cutoff);
  try {
    ensureDir(getDataDir());
    writeFileSync(DATA_FILE, JSON.stringify(doc, null, 2), "utf8");
    cachedMtimeMs = statSync(DATA_FILE).mtimeMs;
    scheduleMysql(() => upsertJsonBlob("autopilot-phones", doc));
  } catch (e) {
    console.warn("[autopilot-phones] persist failed:", e);
  }
}

reload();

export function getAutopilotPhonesDoc(): AutopilotPhonesDoc {
  syncIfStale();
  return doc;
}

/** Agrega las que no estaban; regresa cuántas entraron. */
export function addAutopilotPhones(list: { country: string; national: string }[], addedBy: string): number {
  syncIfStale();
  const have = new Set(doc.phones.map((p) => p.country + p.national));
  const now = new Date().toISOString();
  let added = 0;
  for (const p of list) {
    if (have.has(p.country + p.national)) continue;
    have.add(p.country + p.national);
    doc.phones.push({ id: "aph_" + randomBytes(6).toString("hex"), country: p.country, national: p.national, active: true, addedAt: now, addedBy });
    added++;
  }
  if (added) persist();
  return added;
}

export function addAutopilotEmails(list: { email: string; name: string }[], addedBy: string): number {
  syncIfStale();
  const have = new Set(doc.emails.map((e) => e.email));
  const now = new Date().toISOString();
  let added = 0;
  for (const e of list) {
    if (have.has(e.email)) continue;
    have.add(e.email);
    doc.emails.push({ id: "aem_" + randomBytes(6).toString("hex"), email: e.email, name: e.name, active: true, addedAt: now, addedBy });
    added++;
  }
  if (added) persist();
  return added;
}

/** Prende o apaga una línea o un correo. */
export function updateAutopilotPhone(id: string, patch: { active?: boolean }): boolean {
  syncIfStale();
  const p = doc.phones.find((x) => x.id === id) ?? doc.emails.find((x) => x.id === id);
  if (!p) return false;
  if (typeof patch.active === "boolean") p.active = patch.active;
  persist();
  return true;
}

/** Quita una línea o un correo. */
export function removeAutopilotPhone(id: string): boolean {
  syncIfStale();
  const before = doc.phones.length + doc.emails.length;
  doc.phones = doc.phones.filter((p) => p.id !== id);
  doc.emails = doc.emails.filter((e) => e.id !== id);
  if (doc.phones.length + doc.emails.length === before) return false;
  persist();
  return true;
}

export function saveAutopilotPhoneSettings(s: { formName?: string; formEmail?: string; perPhoneDaily?: number }): void {
  syncIfStale();
  if (s.formName !== undefined) doc.formName = s.formName;
  if (s.formEmail !== undefined) doc.formEmail = s.formEmail;
  if (s.perPhoneDaily !== undefined) doc.perPhoneDaily = s.perPhoneDaily;
  persist();
}

export function recordAutopilotPhoneUse(use: AutopilotPhoneUse): void {
  syncIfStale();
  doc.uses.push(use);
  persist();
}
