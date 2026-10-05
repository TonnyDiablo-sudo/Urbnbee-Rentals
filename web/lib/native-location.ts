"use client";

/**
 * Ubicación de un solo momento (marcar entrada o salida). En la app nativa usa el plugin
 * de Capacitor `Geolocation`; en el navegador, `navigator.geolocation`. Nunca rastrea en segundo plano:
 * sólo pide permiso «mientras se usa la app».
 *
 * Para publicar en las tiendas:
 * - iOS (Info.plist): NSLocationWhenInUseUsageDescription = LOCATION_PURPOSE. Sin NSLocationAlways*.
 * - Android (AndroidManifest): ACCESS_FINE_LOCATION y ACCESS_COARSE_LOCATION. Sin ACCESS_BACKGROUND_LOCATION.
 * - Google Play pide un aviso visible antes del permiso del sistema: es `LocationDisclosure`.
 */
export const LOCATION_PURPOSE =
  "Cabibee usa tu ubicación sólo cuando marcas tu entrada o salida de una limpieza, para comprobar que estás en el alojamiento.";

export type Fix = { lat: number; lng: number; accuracy: number; platform: "web" | "ios" | "android" };

type CapGeo = {
  checkPermissions: () => Promise<{ location: string }>;
  requestPermissions: () => Promise<{ location: string }>;
  getCurrentPosition: (o: { enableHighAccuracy: boolean; timeout: number; maximumAge: number }) => Promise<{
    coords: { latitude: number; longitude: number; accuracy: number };
  }>;
};

type CapWindow = Window & {
  Capacitor?: { isNativePlatform?: () => boolean; getPlatform?: () => string; Plugins?: { Geolocation?: CapGeo } };
};

const DISCLOSURE_KEY = "cabibee.locationDisclosure";

export function disclosureAccepted(): boolean {
  try {
    return localStorage.getItem(DISCLOSURE_KEY) === "1";
  } catch {
    return false;
  }
}

export function acceptDisclosure() {
  try {
    localStorage.setItem(DISCLOSURE_KEY, "1");
  } catch {}
}

export async function currentFix(): Promise<Fix | { error: string }> {
  const cap = (window as CapWindow).Capacitor;
  const geo = cap?.isNativePlatform?.() ? cap.Plugins?.Geolocation : undefined;
  if (geo) {
    const platform = cap?.getPlatform?.() === "ios" ? "ios" : "android";
    try {
      let perm = (await geo.checkPermissions()).location;
      if (perm !== "granted") perm = (await geo.requestPermissions()).location;
      if (perm !== "granted") return { error: "Permite la ubicación en los ajustes del teléfono para marcar tu entrada." };
      const p = await geo.getCurrentPosition({ enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 });
      return { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy, platform };
    } catch {
      return { error: "No pudimos leer tu ubicación. Activa el GPS e inténtalo otra vez." };
    }
  }
  if (!("geolocation" in navigator)) return { error: "Tu navegador no puede compartir la ubicación." };
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy, platform: "web" }),
      (e) =>
        resolve({
          error:
            e.code === e.PERMISSION_DENIED
              ? "Permite la ubicación en tu navegador para marcar tu entrada."
              : "No pudimos leer tu ubicación. Activa el GPS e inténtalo otra vez.",
        }),
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 }
    );
  });
}
