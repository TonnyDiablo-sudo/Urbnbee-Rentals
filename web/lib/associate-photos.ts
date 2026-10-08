import "server-only";
import { mkdir, readdir, readFile, rm, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import sharp from "sharp";
import type { LocatedPhoto } from "@/lib/gemini-photo-locator";
import { getUploadsDir } from "@/lib/runtime-paths";

const MAX_SIDE = 1920;
const MIN_CROP_W = 220;
const MIN_CROP_H = 160;

function draftDir(draftId: string) {
  return path.join(getUploadsDir(), "associate-drafts", draftId);
}

async function writeJpeg(draftId: string, img: sharp.Sharp): Promise<string> {
  const dir = draftDir(draftId);
  await mkdir(dir, { recursive: true });
  const name = `${randomUUID()}.jpg`;
  const buf = await img
    .rotate()
    .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 86, mozjpeg: true })
    .toBuffer();
  await writeFile(path.join(dir, name), buf);
  return `/uploads/associate-drafts/${draftId}/${name}`;
}

/** Fotos originales que mandó la extensión: se normalizan a JPEG y se guardan tal cual. */
export async function saveDraftImage(draftId: string, data: Buffer): Promise<string | null> {
  try {
    const meta = await sharp(data).metadata();
    if (!meta.width || !meta.height || meta.width < MIN_CROP_W || meta.height < MIN_CROP_H) return null;
    return await writeJpeg(draftId, sharp(data));
  } catch {
    return null;
  }
}

/** Miniatura chica para que el modelo de texto elija cuáles son fotos del inmueble. */
export async function thumbnailBase64(data: Buffer): Promise<string | null> {
  try {
    const buf = await sharp(data).rotate().resize({ width: 512, height: 512, fit: "inside" }).jpeg({ quality: 70 }).toBuffer();
    return buf.toString("base64");
  } catch {
    return null;
  }
}

/** Miniaturas de las fotos que ya tiene el borrador, en el mismo orden. */
export async function draftPhotoThumbnails(draftId: string, urls: string[]): Promise<string[]> {
  const prefix = `/uploads/associate-drafts/${draftId}/`;
  const out: string[] = [];
  for (const u of urls) {
    if (!u.startsWith(prefix)) continue;
    const name = u.slice(prefix.length);
    if (!/^[\w-]+\.jpg$/.test(name)) continue;
    const buf = await readFile(path.join(draftDir(draftId), name)).catch(() => null);
    const thumb = buf ? await thumbnailBase64(buf) : null;
    if (thumb) out.push(thumb);
  }
  return out;
}

function overlap(a: LocatedPhoto, b: LocatedPhoto): number {
  if (a.image !== b.image) return 0;
  const [ay0, ax0, ay1, ax1] = a.box;
  const [by0, bx0, by1, bx1] = b.box;
  const ix = Math.max(0, Math.min(ax1, bx1) - Math.max(ax0, bx0));
  const iy = Math.max(0, Math.min(ay1, by1) - Math.max(ay0, by0));
  const inter = ix * iy;
  const area = (ay1 - ay0) * (ax1 - ax0);
  return area ? inter / area : 0;
}

/** Recorta de las capturas las regiones que Gemini marcó como fotos del inmueble. */
export async function cropLocatedPhotos(
  draftId: string,
  screenshots: Buffer[],
  located: LocatedPhoto[]
): Promise<string[]> {
  const kept: LocatedPhoto[] = [];
  for (const p of located) {
    if (!kept.some((k) => overlap(p, k) > 0.6 || overlap(k, p) > 0.6)) kept.push(p);
  }
  const urls: string[] = [];
  for (const p of kept) {
    const src = screenshots[p.image];
    if (!src) continue;
    try {
      const oriented = await sharp(src).rotate().toBuffer();
      const meta = await sharp(oriented).metadata();
      const w = meta.width ?? 0;
      const h = meta.height ?? 0;
      if (!w || !h) continue;
      const [ymin, xmin, ymax, xmax] = p.box;
      const left = Math.round((xmin / 1000) * w);
      const top = Math.round((ymin / 1000) * h);
      const width = Math.min(w - left, Math.round(((xmax - xmin) / 1000) * w));
      const height = Math.min(h - top, Math.round(((ymax - ymin) / 1000) * h));
      if (width < MIN_CROP_W || height < MIN_CROP_H) continue;
      const cropped = await sharp(oriented).extract({ left, top, width, height }).toBuffer();
      urls.push(await writeJpeg(draftId, sharp(cropped)));
    } catch (e) {
      console.warn("[associate-photos] crop failed:", e);
    }
  }
  return urls;
}

export async function removeDraftPhotos(draftId: string, keep: string[]): Promise<void> {
  const prefix = `/uploads/associate-drafts/${draftId}/`;
  const keepNames = new Set(keep.filter((u) => u.startsWith(prefix)).map((u) => u.slice(prefix.length)));
  if (keepNames.size === 0) {
    await rm(draftDir(draftId), { recursive: true, force: true }).catch(() => {});
    return;
  }
  const files = await readdir(draftDir(draftId)).catch(() => [] as string[]);
  await Promise.all(
    files.filter((f) => !keepNames.has(f)).map((f) => rm(path.join(draftDir(draftId), f), { force: true }).catch(() => {}))
  );
}
