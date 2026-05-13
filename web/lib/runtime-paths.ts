import "server-only";
import { mkdirSync } from "fs";
import { isAbsolute, join } from "path";

/**
 * Resuelve la carpeta donde el server guarda JSON persistente.
 *
 * - Por defecto: `<cwd>/data` (compatible con dev local y con cómo estuvo siempre).
 * - En Railway con un Volume montado (p.ej. en `/data`), pon `URBNBEE_DATA_DIR=/data/json`
 *   y los archivos sobreviven a redeploys.
 *
 * Si la ruta es relativa se resuelve contra `process.cwd()`.
 */
export function getDataDir(): string {
  const raw = process.env.URBNBEE_DATA_DIR?.trim();
  if (raw) {
    return isAbsolute(raw) ? raw : join(process.cwd(), raw);
  }
  return join(process.cwd(), "data");
}

/**
 * Resuelve la carpeta donde guardamos archivos subidos por usuarios (fotos de listings,
 * avatars, etc.). Se sirven al cliente vía `/uploads/[...path]` (ver `app/uploads/...`).
 *
 * - Por defecto: `<cwd>/public/uploads` (Next sirve estáticos en dev).
 * - En Railway con un Volume montado, pon `URBNBEE_UPLOADS_DIR=/data/uploads` y nuestra
 *   ruta `/uploads/[...]` lo sirve igual sin tocar `public/`.
 */
export function getUploadsDir(): string {
  const raw = process.env.URBNBEE_UPLOADS_DIR?.trim();
  if (raw) {
    return isAbsolute(raw) ? raw : join(process.cwd(), raw);
  }
  return join(process.cwd(), "public", "uploads");
}

/** mkdir -p con captura silenciosa: úsalo justo antes de escribir. */
export function ensureDir(dir: string): void {
  try {
    mkdirSync(dir, { recursive: true });
  } catch (e) {
    console.warn("[runtime-paths] mkdir failed:", dir, e);
  }
}
