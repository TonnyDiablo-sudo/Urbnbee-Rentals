/** Las métricas se cortan por día en hora del centro de México: "hoy" es hoy para el equipo, no en UTC. */
const fmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Mexico_City",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function analyticsDayKey(d: Date | string | number = new Date()): string {
  return fmt.format(typeof d === "object" ? d : new Date(d));
}

/** Suma (o resta) días a una clave YYYY-MM-DD sin pasar por la zona horaria. */
export function shiftDayKey(day: string, days: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}
