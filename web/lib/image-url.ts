/**
 * Pide las fotos de Unsplash al ancho en que se muestran y en WebP/AVIF (auto=format).
 * Las fotos subidas por anfitriones (/uploads/...) se devuelven tal cual.
 */
export function sizedImage(src: string, width: number, quality = 70): string {
  if (!src.startsWith("https://images.unsplash.com/")) return src;
  try {
    const u = new URL(src);
    u.searchParams.set("w", String(width));
    u.searchParams.set("q", String(quality));
    u.searchParams.set("auto", "format");
    u.searchParams.set("fit", "crop");
    return u.toString();
  } catch {
    return src;
  }
}
