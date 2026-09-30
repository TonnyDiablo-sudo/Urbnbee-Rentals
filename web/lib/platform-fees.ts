import "server-only";
import { getHostStripe } from "@/lib/host-stripe";

/** Margen mínimo sobre el cobro de estancia (no es % tipo Airbnb sobre todo el negocio — cargo explícito de infra). */
export function platformBookingFeeMxn(stayAndCleaningTotalMxn: number): number {
  const raw = process.env.PLATFORM_BOOKING_FEE_PERCENT?.trim();
  const pct = raw ? Number.parseFloat(raw) : 1;
  if (!Number.isFinite(pct) || pct < 0) return 0;
  const fee = Math.round((stayAndCleaningTotalMxn * pct) / 100);
  const minFee = Number.parseInt(process.env.PLATFORM_BOOKING_FEE_MIN_MXN ?? "0", 10);
  const floor = Number.isFinite(minFee) && minFee > 0 ? Math.max(fee, minFee) : fee;
  return Math.max(0, floor);
}

export function totalBookingChargeMxn(stayAndCleaningTotalMxn: number): number {
  return stayAndCleaningTotalMxn + platformBookingFeeMxn(stayAndCleaningTotalMxn);
}

/** Misma regla que Checkout: si el anfitrión cobra en su Stripe, no se suma el cargo de plataforma (Q1). */
export function stayPlatformFeeMxn(hostId: string, stayAndCleaningTotalMxn: number): number {
  if (getHostStripe(hostId)) return 0;
  return platformBookingFeeMxn(stayAndCleaningTotalMxn);
}
