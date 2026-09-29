/**
 * Ruta de regreso desde Stripe cuando el cobro se inició en la app instalada.
 * Sólo se aceptan rutas bajo /app/ sin query: el resto usa la del panel web, para
 * que nadie pueda usar el regreso de Stripe como redirección abierta.
 */
export function appReturnPath(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  if (!/^\/app\/[a-z0-9/_-]+$/i.test(raw) || raw.includes("//")) return undefined;
  return raw;
}
