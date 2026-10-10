/**
 * Detecta si la página corre dentro de la app de Android (TWA de Google Play).
 * Chrome solo pone `android-app://<paquete>` como referrer en la primera carga del TWA,
 * así que se recuerda en sessionStorage, que no se comparte con las pestañas normales de Chrome.
 */
export const ANDROID_APP_PACKAGE = "com.cabibee.app";
export const APP_SHELL_HEADER = "x-cabibee-shell";

const STORAGE_KEY = "cb_shell";

export function isAndroidAppShell(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.sessionStorage.getItem(STORAGE_KEY) === "android") return true;
  } catch {
    /* sessionStorage bloqueado */
  }
  if (document.referrer.startsWith(`android-app://${ANDROID_APP_PACKAGE}`)) {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, "android");
    } catch {
      /* sessionStorage bloqueado */
    }
    return true;
  }
  return false;
}

export function appShellHeaders(): Record<string, string> {
  return isAndroidAppShell() ? { [APP_SHELL_HEADER]: "android" } : {};
}
