/**
 * Historial crediticio (screening): se prende con NEXT_PUBLIC_CREDIT_CHECK_ENABLED=1 al compilar.
 * Aunque esté prendido, la app de Android (TWA) no lo muestra: solo web y PWA. Ver lib/app-shell.ts.
 */
export const CREDIT_CHECK_ENABLED = process.env.NEXT_PUBLIC_CREDIT_CHECK_ENABLED === "1";

/**
 * Compartir ubicación del dispositivo en la verificación de domicilio.
 * Preparado, pero apagado hasta que App Store y Google Play aprueben la app.
 */
export const ADDRESS_PROOF_GEOLOCATION_ENABLED = false;
