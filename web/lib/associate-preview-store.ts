import "server-only";
import { randomBytes } from "crypto";
import type { DraftPreview } from "@/lib/associate-provision";

/** Vistas previas en memoria: duran media hora y nunca se guardan en disco. */
const TTL_MS = 30 * 60 * 1000;
const MAX = 300;
type Entry = { associateId: string; preview: DraftPreview; expires: number };
// La ruta API que la guarda y la página que la muestra pueden cargar copias distintas de este módulo.
const g = globalThis as typeof globalThis & { __cabibeeDraftPreviews?: Map<string, Entry> };
const previews = (g.__cabibeeDraftPreviews ??= new Map<string, Entry>());

export function savePreview(associateId: string, preview: DraftPreview): string {
  const now = Date.now();
  for (const [k, v] of previews) if (v.expires < now) previews.delete(k);
  while (previews.size >= MAX) previews.delete(previews.keys().next().value!);
  const token = randomBytes(12).toString("hex");
  previews.set(token, { associateId, preview, expires: now + TTL_MS });
  return token;
}

export function getPreview(token: string, viewer: { id: string; role: string }): DraftPreview | null {
  const p = previews.get(token);
  if (!p || p.expires < Date.now()) return null;
  if (p.associateId !== viewer.id && viewer.role !== "admin") return null;
  return p.preview;
}
