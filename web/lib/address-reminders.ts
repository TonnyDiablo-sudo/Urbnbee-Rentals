import "server-only";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { engineListingsMissingAddress } from "@/lib/address-proof-access";
import { latestProofForListing } from "@/lib/address-proof-store";
import type { HostListingRecord } from "@/lib/marketplace-types";
import { listAllUsers } from "@/lib/marketplace-store";
import { notifyUser } from "@/lib/push";
import { ensureDir, getDataDir } from "@/lib/runtime-paths";

/** Cada cuánto se le vuelve a recordar a un anfitrión que le falta verificar direcciones. */
const EVERY_MS = 3 * 24 * 60 * 60 * 1000;
const DATA_FILE = join(getDataDir(), "address-reminders.json");

function loadSent(): Record<string, string> {
  try {
    if (!existsSync(DATA_FILE)) return {};
    const data = JSON.parse(readFileSync(DATA_FILE, "utf8")) as { sent?: Record<string, string> };
    return data.sent && typeof data.sent === "object" ? data.sent : {};
  } catch {
    return {};
  }
}

function saveSent(sent: Record<string, string>) {
  try {
    ensureDir(getDataDir());
    writeFileSync(DATA_FILE, JSON.stringify({ version: 1, sent }, null, 2), "utf8");
  } catch (e) {
    console.warn("[address reminders] save failed:", e);
  }
}

/** Anuncios publicados con motor que no muestran «Ubicación verificada» y no tienen un comprobante en revisión. */
export function listingsNeedingAddress(hostId: string): HostListingRecord[] {
  return engineListingsMissingAddress(hostId).filter((l) => {
    if (!l.published) return false;
    const s = latestProofForListing(l.id)?.status;
    return s !== "review" && s !== "pending";
  });
}

export function sendAddressReminders(now = Date.now()): number {
  const sent = loadSent();
  let count = 0;
  for (const u of listAllUsers()) {
    if (u.role !== "host") continue;
    const missing = listingsNeedingAddress(u.id);
    if (!missing.length) {
      if (sent[u.id]) delete sent[u.id];
      continue;
    }
    const last = Date.parse(sent[u.id] ?? "");
    if (Number.isFinite(last) && now - last < EVERY_MS) continue;
    notifyUser(u.id, {
      kind: "verification",
      title: "Verifica la dirección de tus anuncios",
      body: "Sube un recibo a tu nombre con la dirección del anuncio para que aparezca el listón «Ubicación verificada»: {titles}.",
      vars: { titles: missing.map((l) => l.title || "Sin título").slice(0, 3).join(", ") },
      url: "/host/verificacion",
      tag: "address-reminder",
    });
    sent[u.id] = new Date(now).toISOString();
    count++;
  }
  saveSent(sent);
  return count;
}

let started = false;
export function startAddressReminderWorker() {
  if (started) return;
  started = true;
  const tick = () => {
    try {
      sendAddressReminders();
    } catch (e) {
      console.warn("[address reminders]", e);
    }
  };
  setTimeout(tick, 90_000);
  setInterval(tick, 6 * 60 * 60 * 1000);
}
