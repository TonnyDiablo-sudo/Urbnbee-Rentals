import "server-only";
import { getBookingById } from "@/lib/bookings-store";
import { activeCreditBureau, bandFromResult, bureauRefHash, type BureauResult } from "@/lib/credit-bureau";
import { findUserById } from "@/lib/marketplace-store";
import { notifyGuestScreeningAuthorize, notifyGuestScreeningDone, notifyHostScreeningReady } from "@/lib/push";
import { getScreeningById, getScreeningByRefHash, listAllScreenings, patchScreening } from "@/lib/screening-store";
import type { ScreeningRecord } from "@/lib/screening-types";
import { openSecret, sealSecret } from "@/lib/secret-box";

const REF_PURPOSE = "credit-bureau-ref";
const FORM_PURPOSE = "credit-bureau-form";
const WAIT_BEFORE_MS = [0, 5_000, 20_000];
const MAX_START_ATTEMPTS = WAIT_BEFORE_MS.length;
const POLL_EVERY_MS = 10 * 60 * 1000;

const APP_ORIGIN = (process.env.APP_PUBLIC_ORIGIN?.trim() || "https://app.cabibee.com").replace(/\/$/, "");

const starting = new Set<string>();
const polling = new Set<string>();

function guestNameFor(row: ScreeningRecord): string {
  return (row.bookingId && getBookingById(row.bookingId)?.guestName) || "El huésped";
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export function bureauConfigured(): boolean {
  return activeCreditBureau() !== null;
}

async function startOnce(row: ScreeningRecord): Promise<boolean> {
  const bureau = activeCreditBureau();
  if (!bureau) return false;
  const guest = findUserById(row.guestUserId);
  if (!guest?.email) return false;
  const started = await bureau.start(
    {
      reference: row.id,
      fullName: guest.fullName?.trim() || guestNameFor(row),
      email: guest.email,
    },
    {
      callbackUrl: `${APP_ORIGIN}/api/webhooks/credit-bureau`,
      returnUrl: `${APP_ORIGIN}/guest/screening?bureau=1`,
    }
  );
  const now = new Date().toISOString();
  patchScreening(row.id, {
    provider: bureau.id,
    status: started.formUrl ? "authorizing" : "processing",
    providerRefSealed: sealSecret(REF_PURPOSE, started.ref),
    providerRefHash: bureauRefHash(started.ref),
    providerFormSealed: started.formUrl ? sealSecret(FORM_PURPOSE, started.formUrl) : undefined,
    providerStartedAt: now,
    providerCheckedAt: now,
    providerNote: started.formUrl
      ? "Falta que el huésped confirme la consulta con su NIP en la página del proveedor."
      : "El proveedor está procesando la consulta.",
  });
  if (started.formUrl) notifyGuestScreeningAuthorize(row.guestUserId);
  return true;
}

async function startWithRetries(id: string): Promise<void> {
  for (let i = 0; i < MAX_START_ATTEMPTS; i++) {
    if (WAIT_BEFORE_MS[i]) await sleep(WAIT_BEFORE_MS[i]);
    const row = getScreeningById(id);
    if (!row || row.status !== "paid" || row.providerRefHash) return;
    patchScreening(id, { providerAttempts: (row.providerAttempts ?? 0) + 1 });
    try {
      if (await startOnce(row)) return;
    } catch (e) {
      console.warn("[screening-bureau] start falló", id, e instanceof Error ? e.message : e);
    }
  }
  patchScreening(id, {
    providerNote: "No pudimos iniciar la consulta con el proveedor. El equipo de Cabibee la revisa.",
  });
}

/** Se dispara después del pago; el que pagó no espera a que responda el proveedor. */
export function queueBureauStart(id: string): void {
  if (starting.has(id)) return;
  starting.add(id);
  void startWithRetries(id).finally(() => starting.delete(id));
}

function applyResult(row: ScreeningRecord, result: BureauResult): ScreeningRecord | undefined {
  const now = new Date().toISOString();
  if (result.state === "pending") {
    return patchScreening(row.id, { providerCheckedAt: now });
  }
  if (result.state === "failed") {
    return patchScreening(row.id, {
      status: "failed",
      providerCheckedAt: now,
      providerCompletedAt: now,
      providerFormSealed: undefined,
      providerNote: "El proveedor no pudo completar la consulta. El equipo de Cabibee revisa el reembolso.",
    });
  }
  const next = patchScreening(row.id, {
    status: "completed",
    band: bandFromResult(result),
    providerCheckedAt: now,
    providerCompletedAt: now,
    providerFormSealed: undefined,
    providerNote: "Resumen del buró. Cabibee no guarda el reporte completo ni el score.",
  });
  if (next?.hostId) notifyHostScreeningReady({ hostId: next.hostId, guestName: guestNameFor(next) });
  notifyGuestScreeningDone(row.guestUserId);
  return next;
}

async function syncResult(id: string): Promise<void> {
  const row = getScreeningById(id);
  if (!row?.providerRefSealed || (row.status !== "authorizing" && row.status !== "processing")) return;
  const bureau = activeCreditBureau();
  const ref = openSecret(REF_PURPOSE, row.providerRefSealed);
  if (!bureau || !ref) return;
  try {
    applyResult(row, await bureau.fetchResult(ref));
  } catch (e) {
    console.warn("[screening-bureau] consulta de resultado falló", id, e instanceof Error ? e.message : e);
  }
}

/** El webhook solo dice "hay novedades"; el resultado siempre se vuelve a pedir al proveedor. */
export async function handleBureauWebhook(raw: string, headers: Headers): Promise<"ok" | "invalid" | "unknown"> {
  const bureau = activeCreditBureau();
  if (!bureau) return "invalid";
  const hit = bureau.verifyWebhook(raw, headers);
  if (!hit) return "invalid";
  const row = getScreeningByRefHash(bureauRefHash(hit.ref));
  if (!row) return "unknown";
  await syncResult(row.id);
  return "ok";
}

/** Retoma casos atorados: pagos sin arrancar y consultas sin respuesta del webhook. */
export function resumeBureauScreenings(): void {
  if (!bureauConfigured()) return;
  const now = Date.now();
  for (const row of listAllScreenings()) {
    if (row.status === "paid" && !row.providerRefHash && row.provider !== "simulated") {
      if ((row.providerAttempts ?? 0) < MAX_START_ATTEMPTS) queueBureauStart(row.id);
      continue;
    }
    if (row.status !== "authorizing" && row.status !== "processing") continue;
    const last = row.providerCheckedAt ? new Date(row.providerCheckedAt).getTime() : 0;
    if (now - last < POLL_EVERY_MS || polling.has(row.id)) continue;
    polling.add(row.id);
    void syncResult(row.id).finally(() => polling.delete(row.id));
  }
}

export function bureauFormUrlFor(row: ScreeningRecord): string | null {
  if (row.status !== "authorizing" || !row.providerFormSealed) return null;
  const url = openSecret(FORM_PURPOSE, row.providerFormSealed);
  return url?.startsWith("https://") ? url : null;
}
