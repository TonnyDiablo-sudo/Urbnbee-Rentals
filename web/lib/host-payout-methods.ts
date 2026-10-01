import "server-only";
import { existsSync, readFileSync, statSync, writeFileSync } from "fs";
import { join } from "path";
import type { BookingRecord, ManualPayMethod, PayInstruction } from "@/lib/booking-types";
import { ensureDir, getDataDir } from "@/lib/runtime-paths";

export type ClabePayout = { holder: string; clabe: string; bank?: string };
export type ZellePayout = { name: string; contact: string };
export type CashAppPayout = { name: string; cashtag: string };
export type OxxoPayout = { holder: string; reference: string; note?: string };

export type HostPayoutMethods = {
  hostId: string;
  clabe?: ClabePayout;
  zelle?: ZellePayout;
  cashapp?: CashAppPayout;
  oxxo?: OxxoPayout;
  updatedAt: string;
};

const DATA_FILE = join(getDataDir(), "host-payout-methods.json");
const rows = new Map<string, HostPayoutMethods>();
let cachedMtimeMs = 0;

const METHOD_LABEL: Record<ManualPayMethod | "stripe", string> = {
  stripe: "Stripe",
  clabe: "CLABE",
  zelle: "Zelle",
  cashapp: "Cash App",
  oxxo: "Oxxo",
};

function nowIso() {
  return new Date().toISOString();
}

function persist() {
  try {
    ensureDir(getDataDir());
    writeFileSync(
      DATA_FILE,
      JSON.stringify({ version: 1, methods: [...rows.values()] }, null, 2),
      "utf8"
    );
    if (existsSync(DATA_FILE)) cachedMtimeMs = statSync(DATA_FILE).mtimeMs;
  } catch (e) {
    console.warn("[host-payout-methods] persist failed:", e);
  }
}

function reloadFromDisk() {
  try {
    if (!existsSync(DATA_FILE)) return;
    const data = JSON.parse(readFileSync(DATA_FILE, "utf8")) as { methods?: HostPayoutMethods[] };
    rows.clear();
    for (const m of data.methods ?? []) {
      if (m?.hostId) rows.set(m.hostId, m);
    }
    cachedMtimeMs = statSync(DATA_FILE).mtimeMs;
  } catch (e) {
    console.warn("[host-payout-methods] load failed:", e);
  }
}

function syncIfStale() {
  try {
    if (!existsSync(DATA_FILE)) return;
    const m = statSync(DATA_FILE).mtimeMs;
    if (m === cachedMtimeMs) return;
    reloadFromDisk();
  } catch {
    /* ignore */
  }
}

reloadFromDisk();

export function getHostPayoutMethods(hostId: string): HostPayoutMethods | undefined {
  syncIfStale();
  return rows.get(hostId);
}

export function saveHostPayoutMethods(
  hostId: string,
  patch: {
    clabe?: ClabePayout | null;
    zelle?: ZellePayout | null;
    cashapp?: CashAppPayout | null;
    oxxo?: OxxoPayout | null;
  }
): HostPayoutMethods {
  syncIfStale();
  const prev = rows.get(hostId);
  const next: HostPayoutMethods = {
    hostId,
    clabe: prev?.clabe,
    zelle: prev?.zelle,
    cashapp: prev?.cashapp,
    oxxo: prev?.oxxo,
    updatedAt: nowIso(),
  };
  if ("clabe" in patch) next.clabe = patch.clabe ?? undefined;
  if ("zelle" in patch) next.zelle = patch.zelle ?? undefined;
  if ("cashapp" in patch) next.cashapp = patch.cashapp ?? undefined;
  if ("oxxo" in patch) next.oxxo = patch.oxxo ?? undefined;
  if (!next.clabe && !next.zelle && !next.cashapp && !next.oxxo) {
    rows.delete(hostId);
    persist();
    return { hostId, updatedAt: next.updatedAt };
  }
  rows.set(hostId, next);
  persist();
  return next;
}

/** CLABE de 18 dígitos con dígito verificador. */
export function clabeOk(clabe: string): boolean {
  if (!/^\d{18}$/.test(clabe)) return false;
  const weights = [3, 7, 1];
  let sum = 0;
  for (let i = 0; i < 17; i++) sum += (Number(clabe[i]) * weights[i % 3]) % 10;
  return (10 - (sum % 10)) % 10 === Number(clabe[17]);
}

export function payMethodLabel(method: ManualPayMethod | "stripe"): string {
  return METHOD_LABEL[method];
}

function clip(value: string, max: number): string {
  return value.trim().replace(/\s+/g, " ").slice(0, max);
}

export function parseClabe(body: unknown): ClabePayout | { error: string } {
  const raw = body as { holder?: unknown; clabe?: unknown; bank?: unknown };
  const holder = typeof raw.holder === "string" ? clip(raw.holder, 80) : "";
  const clabe = typeof raw.clabe === "string" ? raw.clabe.replace(/\D/g, "") : "";
  const bank = typeof raw.bank === "string" ? clip(raw.bank, 60) : "";
  if (holder.length < 3) return { error: "Escribe el nombre del titular." };
  if (!clabeOk(clabe)) return { error: "La CLABE debe tener 18 dígitos y dígito verificador válido." };
  return { holder, clabe, ...(bank ? { bank } : {}) };
}

export function parseZelle(body: unknown): ZellePayout | { error: string } {
  const raw = body as { name?: unknown; contact?: unknown };
  const name = typeof raw.name === "string" ? clip(raw.name, 80) : "";
  const contact = typeof raw.contact === "string" ? clip(raw.contact, 80) : "";
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact);
  const phone = contact.replace(/\D/g, "").length >= 10;
  if (name.length < 2 || (!email && !phone)) {
    return { error: "Zelle necesita un nombre y un correo o teléfono." };
  }
  return { name, contact };
}

export function parseCashApp(body: unknown): CashAppPayout | { error: string } {
  const raw = body as { name?: unknown; cashtag?: unknown };
  const name = typeof raw.name === "string" ? clip(raw.name, 80) : "";
  let cashtag = typeof raw.cashtag === "string" ? raw.cashtag.trim().replace(/\s/g, "") : "";
  if (cashtag.startsWith("$")) cashtag = cashtag.slice(1);
  if (name.length < 2 || !/^[A-Za-z][A-Za-z0-9_]{1,19}$/.test(cashtag)) {
    return { error: "Cash App necesita un nombre y un $cashtag." };
  }
  return { name, cashtag: `$${cashtag}` };
}

export function parseOxxo(body: unknown): OxxoPayout | { error: string } {
  const raw = body as { holder?: unknown; reference?: unknown; note?: unknown };
  const holder = typeof raw.holder === "string" ? clip(raw.holder, 80) : "";
  const reference = typeof raw.reference === "string" ? clip(raw.reference, 40) : "";
  const note = typeof raw.note === "string" ? clip(raw.note, 160) : "";
  if (holder.length < 3 || reference.length < 4) {
    return { error: "Oxxo necesita el nombre y una referencia." };
  }
  return { holder, reference, ...(note ? { note } : {}) };
}

export function instructionFor(method: ManualPayMethod, saved: HostPayoutMethods): PayInstruction | { error: string } {
  const sentAt = nowIso();
  if (method === "clabe" && saved.clabe) {
    const { holder, clabe, bank } = saved.clabe;
    const pretty = clabe.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
    return {
      method,
      sentAt,
      clabe: saved.clabe,
      lines: [
        "Transfiere por SPEI a esta CLABE:",
        `Titular: ${holder}`,
        `CLABE: ${pretty}`,
        ...(bank ? [`Banco: ${bank}`] : []),
      ],
    };
  }
  if (method === "zelle" && saved.zelle) {
    return {
      method,
      sentAt,
      zelle: saved.zelle,
      lines: ["Paga con Zelle:", `Nombre: ${saved.zelle.name}`, `Correo o teléfono: ${saved.zelle.contact}`],
    };
  }
  if (method === "cashapp" && saved.cashapp) {
    return {
      method,
      sentAt,
      cashapp: saved.cashapp,
      lines: ["Paga con Cash App:", `Nombre: ${saved.cashapp.name}`, `Cashtag: ${saved.cashapp.cashtag}`],
    };
  }
  if (method === "oxxo" && saved.oxxo) {
    return {
      method,
      sentAt,
      oxxo: saved.oxxo,
      lines: [
        "Paga en Oxxo con estos datos:",
        `A nombre de: ${saved.oxxo.holder}`,
        `Referencia: ${saved.oxxo.reference}`,
        ...(saved.oxxo.note ? [saved.oxxo.note] : []),
      ],
    };
  }
  return { error: "Esa forma de cobro no está guardada." };
}

function fmtWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Mexico_City",
  });
}

/**
 * Anexo que se muestra después del contrato. No entra a `contractPlainLines`,
 * así que no cambia el hash de lo que firmaron.
 */
export function paymentNoteLines(booking: BookingRecord): string[] {
  const c = booking.payConfirmation;
  const head = ["", "Nota de pago (no cambia el texto firmado)"];
  if (c?.by === "stripe" || (booking.paidAt && booking.stripeCheckoutSessionId && c?.by !== "host")) {
    return [...head, `Ya se pagó por Stripe el ${fmtWhen(c?.at ?? booking.paidAt!)}`];
  }
  if (c?.by === "host") {
    return [...head, `El anfitrión confirmó el pago (${payMethodLabel(c.method)}) el ${fmtWhen(c.at)}`];
  }
  if (booking.paidAt) {
    return [...head, `Ya se pagó el ${fmtWhen(booking.paidAt)}`];
  }
  if (booking.payInstruction) {
    const extra = booking.payProof
      ? "El huésped ya envió su comprobante. El anfitrión lo confirma."
      : "El huésped debe subir su comprobante de pago en la reserva. El anfitrión lo revisa y confirma.";
    return [...head, ...booking.payInstruction.lines, extra];
  }
  return [];
}
