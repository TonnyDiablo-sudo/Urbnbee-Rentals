import "server-only";
import { contractPlainLines, ensureBookingContract, sha256Text } from "@/lib/booking-contract";
import type { BookingContractRecord } from "@/lib/booking-contract-types";
import { listAllBookings, patchBookingRecord } from "@/lib/bookings-store";
import { findUserById } from "@/lib/marketplace-store";

const DEAD = new Set(["EXPIRED", "REJECTED"]);

/**
 * Las reservas de las cuentas demo (@urbnbee.test) se sembraron sin contrato, así que en
 * «Detalles de la reserva» no salía la tarjeta del contrato. Aquí se les genera uno con la plantilla
 * del anuncio y se firma según el estado de la reserva, sin disparar avisos ni webhooks.
 */
export function ensureDemoContracts(): number {
  let n = 0;
  for (const b of listAllBookings()) {
    if (b.contract || DEAD.has(b.status)) continue;
    const host = findUserById(b.hostId);
    if (!host?.email?.endsWith("@urbnbee.test")) continue;
    try {
      const withContract = ensureBookingContract(b.id, { role: "system" });
      const c = withContract?.contract;
      if (!c) continue;
      const at = b.paidAt ?? b.createdAt;
      const hostSigns = b.status !== "PENDING_HOST";
      const guestSigns = Boolean(b.paidAt) || ["CONFIRMED", "COMPLETED", "PENDING_HOST", "CANCELLED"].includes(b.status);
      const hostName = host.fullName?.trim() || c.snapshot.hostLegalName;
      // Fechas coherentes con la reserva (no «hoy»): el contrato se generó al crearla.
      let contract: BookingContractRecord = {
        ...c,
        generatedAt: at,
        hostAcceptedAt: undefined,
        hostAcceptedName: undefined,
        events: c.events.filter((e) => e.action !== "signed").map((e) => ({ ...e, at })),
      };
      if (hostSigns) {
        contract = {
          ...contract,
          hostAcceptedAt: at,
          hostAcceptedByUserId: host.id,
          hostAcceptedName: hostName,
          events: [...contract.events, { at, actor: "host", action: "signed", detail: `El anfitrión firmó como «${hostName}».` }],
        };
      }
      if (guestSigns && b.guestName.trim().length >= 3) {
        const plain = contractPlainLines(contract).join("\n");
        contract = {
          ...contract,
          guestAcceptedAt: at,
          guestAcceptedName: b.guestName.trim(),
          acceptedPlainText: plain,
          acceptedSha256: sha256Text(plain),
          events: [...contract.events, { at, actor: "guest", action: "signed", detail: `El huésped firmó como «${b.guestName.trim()}».` }],
        };
      }
      patchBookingRecord(b.id, {
        contract,
        contractStatus: contract.hostAcceptedAt && contract.guestAcceptedAt ? "signed" : "pending",
      });
      n++;
    } catch (e) {
      console.warn("[demo contracts]", b.id, e);
    }
  }
  return n;
}
