/**
 * La app vive en su propio subdominio (app.cabibee.com, en local app.localhost:3005)
 * y el sitio en el dominio principal, igual que app.urbnbeeai.com / urbnbeeai.com.
 * Internamente las pantallas de la app siguen en `app/app/*`: el middleware
 * reescribe `app.cabibee.com/x` → `/app/x`.
 */

export function isAppHost(host: string | null | undefined): boolean {
  return Boolean(host && host.toLowerCase().startsWith("app."));
}

/** app.cabibee.com → cabibee.com (conserva el puerto en local). */
export function siteHostFromAppHost(host: string): string {
  return host.replace(/^app\./i, "");
}

/** www.cabibee.com / cabibee.com → app.cabibee.com */
export function appHostFromSiteHost(host: string): string {
  return `app.${host.replace(/^www\./i, "")}`;
}

export function requestProto(forwardedProto: string | null, host: string): string {
  if (/^(app\.)?localhost(:\d+)?$/i.test(host)) return "http";
  return forwardedProto?.split(",")[0]?.trim() || "https";
}
