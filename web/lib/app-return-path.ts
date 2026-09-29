/**
 * Ruta de regreso desde Stripe cuando el cobro se inició en la app (app.cabibee.com).
 * Sólo rutas simples del mismo dominio y sin query: se concatenan al origen de la
 * petición, así que nadie puede usar el regreso de Stripe como redirección abierta.
 */
export function appReturnPath(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  if (!/^\/[a-z0-9_-][a-z0-9/_-]*$/i.test(raw) || raw.includes("//")) return undefined;
  return raw;
}
