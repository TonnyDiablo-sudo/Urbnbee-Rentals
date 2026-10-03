import { numberLocale, type Lang } from "@/lib/i18n";

export const GUEST_STATUS: Record<string, { label: string; tone: "wait" | "ok" | "off" }> = {
  AWAITING_PAYMENT: { label: "Falta pagar", tone: "wait" },
  PENDING: { label: "Pendiente de aprobar", tone: "wait" },
  PENDING_HOST: { label: "Pendiente de aprobar", tone: "wait" },
  AWAITING_DETAILS: { label: "Completa tus datos", tone: "wait" },
  CONFIRMED: { label: "Confirmada", tone: "ok" },
  COMPLETED: { label: "Completada", tone: "off" },
  REJECTED: { label: "Rechazada", tone: "off" },
  CANCELLED: { label: "Cancelada", tone: "off" },
  EXPIRED: { label: "Expirada", tone: "off" },
};

export const HOST_STATUS: Record<string, { label: string; tone: "wait" | "ok" | "off" }> = {
  AWAITING_PAYMENT: { label: "Huésped aún no paga", tone: "off" },
  PENDING: { label: "Pendiente de aprobar", tone: "wait" },
  PENDING_HOST: { label: "Pendiente de aprobar", tone: "wait" },
  AWAITING_DETAILS: { label: "Esperando datos del huésped", tone: "wait" },
  CONFIRMED: { label: "Confirmada", tone: "ok" },
  COMPLETED: { label: "Completada", tone: "off" },
  REJECTED: { label: "Rechazada", tone: "off" },
  CANCELLED: { label: "Cancelada", tone: "off" },
  EXPIRED: { label: "Expirada (sin pago)", tone: "off" },
};

type StatusBooking = {
  status: string;
  paidAt?: string | null;
  payProof?: unknown;
  payConfirmation?: { by?: string } | null;
};

export function guestStatusOf(b: StatusBooking) {
  return GUEST_STATUS[b.status] ?? { label: b.status, tone: "off" as const };
}

export function hostStatusOf(b: StatusBooking) {
  return HOST_STATUS[b.status] ?? { label: b.status, tone: "off" as const };
}

export const TONE_CLS = {
  wait: "bg-[#fdf6d8] text-[#8a6d0f]",
  ok: "bg-[#e6f6ea] text-[#1e7a3a]",
  off: "bg-[#f1f1f1] text-[#717171]",
};

export function fmtDay(iso: string, lang: Lang = "es"): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString(numberLocale(lang), { day: "numeric", month: "short" });
}

export function fmtMxn(n: number): string {
  return `$${Math.round(n).toLocaleString("es-MX")} MXN`;
}
