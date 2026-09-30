export const GUEST_STATUS: Record<string, { label: string; tone: "wait" | "ok" | "off" }> = {
  AWAITING_PAYMENT: { label: "Falta pagar", tone: "wait" },
  PENDING: { label: "Esperando al anfitrión", tone: "wait" },
  PENDING_HOST: { label: "Esperando al anfitrión", tone: "wait" },
  AWAITING_DETAILS: { label: "Completa tus datos", tone: "wait" },
  CONFIRMED: { label: "Confirmada", tone: "ok" },
  COMPLETED: { label: "Completada", tone: "off" },
  REJECTED: { label: "Rechazada", tone: "off" },
  CANCELLED: { label: "Cancelada", tone: "off" },
  EXPIRED: { label: "Expirada", tone: "off" },
};

export const HOST_STATUS: Record<string, { label: string; tone: "wait" | "ok" | "off" }> = {
  AWAITING_PAYMENT: { label: "Huésped aún no paga", tone: "off" },
  PENDING: { label: "Por responder", tone: "wait" },
  PENDING_HOST: { label: "Por responder", tone: "wait" },
  AWAITING_DETAILS: { label: "Esperando datos del huésped", tone: "wait" },
  CONFIRMED: { label: "Confirmada", tone: "ok" },
  COMPLETED: { label: "Completada", tone: "off" },
  REJECTED: { label: "Rechazada", tone: "off" },
  CANCELLED: { label: "Cancelada", tone: "off" },
  EXPIRED: { label: "Expirada (sin pago)", tone: "off" },
};

export const TONE_CLS = {
  wait: "bg-[#fdf6d8] text-[#8a6d0f]",
  ok: "bg-[#e6f6ea] text-[#1e7a3a]",
  off: "bg-[#f1f1f1] text-[#717171]",
};

export function fmtDay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString("es-MX", { day: "numeric", month: "short" });
}

export function fmtMxn(n: number): string {
  return `$${Math.round(n).toLocaleString("es-MX")} MXN`;
}
