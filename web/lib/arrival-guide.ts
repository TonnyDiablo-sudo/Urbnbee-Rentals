/** Lo que el huésped necesita para llegar. Sólo se le muestra con la reserva confirmada. */
export type ArrivalGuide = {
  checkInTime?: string;
  checkOutTime?: string;
  checkInMethod?: string;
  directions?: string;
  wifiName?: string;
  wifiPassword?: string;
  houseManual?: string;
  checkoutInstructions?: string;
};

export const ARRIVAL_TEXT_FIELDS = [
  "checkInMethod",
  "directions",
  "wifiName",
  "wifiPassword",
  "houseManual",
  "checkoutInstructions",
] as const;

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export function sanitizeArrivalGuide(raw: unknown): ArrivalGuide {
  if (!raw || typeof raw !== "object") return {};
  const o = raw as Record<string, unknown>;
  const out: ArrivalGuide = {};
  for (const k of ["checkInTime", "checkOutTime"] as const) {
    const v = typeof o[k] === "string" ? (o[k] as string).trim() : "";
    if (TIME.test(v)) out[k] = v;
  }
  for (const k of ARRIVAL_TEXT_FIELDS) {
    const v = typeof o[k] === "string" ? (o[k] as string).trim().slice(0, 4000) : "";
    if (v) out[k] = v;
  }
  return out;
}

export function arrivalGuideIsEmpty(g: ArrivalGuide | undefined): boolean {
  return !g || Object.values(g).every((v) => !v);
}
