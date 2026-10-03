import "server-only";
import { getHostProfile, listAllListings } from "@/lib/marketplace-store";
import type { HostListingRecord } from "@/lib/marketplace-types";
import { isHostIdentityVerified } from "@/lib/verification-store";

export type Suggestion = {
  id: string;
  /** high = lo que más mueve las vistas. */
  impact: "high" | "medium";
  text: string;
  href?: string;
};

function median(nums: number[]): number | null {
  if (nums.length < 3) return null;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Precio típico de anuncios publicados parecidos (misma ciudad y tipo). */
export function comparablePrice(listing: HostListingRecord): number | null {
  const city = listing.city.trim().toLowerCase();
  if (!city) return null;
  const prices = listAllListings()
    .filter(
      (l) =>
        l.id !== listing.id &&
        l.published &&
        l.categoryKey === listing.categoryKey &&
        l.city.trim().toLowerCase() === city &&
        l.pricePerNight > 0
    )
    .map((l) => l.pricePerNight);
  return median(prices);
}

/** Rutas de la app (app.cabibee.com) y su equivalente en el sitio. */
const WEB_HREF: Record<string, string> = {
  "/host/motor": "/host/verificacion",
  "/perfil/editar?from=host": "/host/dashboard",
};

/** Reglas simples y gratis: qué le falta al anuncio para que lo vean y lo contacten más. */
export function suggestionsForListing(listing: HostListingRecord, surface: "app" | "web" = "app"): Suggestion[] {
  const out = suggestionsForApp(listing);
  if (surface === "app") return out;
  return out.map((s) => ({
    ...s,
    href: s.href?.startsWith("/host/anuncios/")
      ? `/host/listings/${listing.id}/edit`
      : s.href && (WEB_HREF[s.href] ?? s.href),
  }));
}

function suggestionsForApp(listing: HostListingRecord): Suggestion[] {
  const out: Suggestion[] = [];
  const editHref = `/host/anuncios/${listing.id}`;
  const profile = getHostProfile(listing.hostId);

  if (listing.photos.length === 0) {
    out.push({ id: "photos0", impact: "high", text: "Sube fotos: los anuncios sin fotos casi no reciben visitas.", href: editHref });
  } else if (listing.photos.length < 6) {
    out.push({
      id: "photos",
      impact: "high",
      text: `Tienes ${listing.photos.length} fotos. Con 8 o más (recámaras, baño, cocina, fachada) te contactan mucho más.`,
      href: editHref,
    });
  }
  if (!isHostIdentityVerified(listing.hostId)) {
    out.push({
      id: "verify",
      impact: "high",
      text: "Verifica tu identidad: los anuncios verificados salen con sello y los huéspedes pueden filtrar solo verificados.",
      href: "/host/motor",
    });
  }
  if (listing.description.trim().length < 300) {
    out.push({
      id: "desc",
      impact: "medium",
      text: "Escribe una descripción más completa: qué hay cerca, cómo es el espacio y para quién es ideal.",
      href: editHref,
    });
  }
  if (listing.amenities.length < 8) {
    out.push({
      id: "amen",
      impact: "medium",
      text: "Marca todas tus amenidades (wifi, estacionamiento, cocina, aire…): los huéspedes filtran por ellas.",
      href: editHref,
    });
  }
  if (listing.title.trim().length < 25) {
    out.push({
      id: "title",
      impact: "medium",
      text: "Haz el título más descriptivo: tipo de espacio, zona y lo que lo hace especial.",
      href: editHref,
    });
  }
  const typical = comparablePrice(listing);
  if (typical && listing.pricePerNight > typical * 1.25) {
    out.push({
      id: "price",
      impact: "medium",
      text: `Tu precio ($${listing.pricePerNight.toLocaleString("es-MX")}) está arriba de lo típico en ${listing.city} para este tipo (~$${Math.round(typical).toLocaleString("es-MX")}). Si casi no te contactan, prueba ajustarlo.`,
      href: editHref,
    });
  }
  if (!profile?.avatarUrl) {
    out.push({ id: "avatar", impact: "medium", text: "Pon una foto tuya en tu perfil: genera más confianza.", href: "/perfil/editar?from=host" });
  }
  if (!profile?.bio?.trim()) {
    out.push({ id: "bio", impact: "medium", text: "Escribe una bio corta sobre ti como anfitrión.", href: "/perfil/editar?from=host" });
  }
  if (!listing.published) {
    out.unshift({ id: "pub", impact: "high", text: "Este anuncio está oculto: publícalo para que aparezca en búsquedas.", href: editHref });
  }
  return out;
}
