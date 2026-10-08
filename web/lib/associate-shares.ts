import "server-only";
import { randomBytes } from "crypto";
import sharp from "sharp";
import { deletePrivateFile, getPrivateFile, putPrivateFile } from "@/lib/private-files";

/**
 * Lo que el asociado comparte desde Android (menú Compartir → Cabibee Asociados) se guarda
 * aquí y el panel lo precarga; la IA corre hasta que él le da "Analizar".
 */

const PREFIX = "associate-shares";
const MAX_IMAGES = 10;
const MAX_BYTES = 8 * 1024 * 1024;
const KEEP = new Set(["image/jpeg", "image/png", "image/webp"]);

export type SharedItem = {
  id: string;
  associateId: string;
  title?: string;
  text?: string;
  url?: string;
  images: { key: string; mime: string }[];
  skipped: number;
  at: string;
};

const base = (associateId: string, id: string) => `${PREFIX}/${associateId}/${id}`;
const validId = (id: string) => /^[a-f0-9]{24}$/.test(id);

/** Capturas tal cual (la IA lee mejor la letra chica); HEIC/GIF se pasan a WebP sin achicarlas. */
async function normalize(file: File): Promise<{ mime: string; data: Buffer } | null> {
  if (file.size === 0 || file.size > MAX_BYTES) return null;
  const data = Buffer.from(await file.arrayBuffer());
  const mime = (file.type || "").toLowerCase().replace("image/jpg", "image/jpeg");
  if (KEEP.has(mime)) return { mime, data };
  try {
    return { mime: "image/webp", data: await sharp(data, { failOn: "error" }).rotate().webp({ quality: 90 }).toBuffer() };
  } catch {
    return null;
  }
}

export async function saveShare(
  associateId: string,
  input: { title?: string; text?: string; url?: string; files: File[] }
): Promise<SharedItem> {
  const id = randomBytes(12).toString("hex");
  const images: SharedItem["images"] = [];
  let skipped = 0;
  for (const file of input.files) {
    if (images.length >= MAX_IMAGES) {
      skipped++;
      continue;
    }
    const img = await normalize(file);
    if (!img) {
      skipped++;
      continue;
    }
    const key = `${base(associateId, id)}/${images.length}`;
    await putPrivateFile(key, img.data, img.mime);
    images.push({ key, mime: img.mime });
  }
  const item: SharedItem = {
    id,
    associateId,
    title: input.title?.trim().slice(0, 300) || undefined,
    text: input.text?.trim().slice(0, 30_000) || undefined,
    url: input.url?.trim().slice(0, 2000) || undefined,
    images,
    skipped,
    at: new Date().toISOString(),
  };
  await putPrivateFile(`${base(associateId, id)}/meta.json`, Buffer.from(JSON.stringify(item)), "application/json");
  return item;
}

export async function getShare(associateId: string, id: string): Promise<SharedItem | null> {
  if (!validId(id)) return null;
  const buf = await getPrivateFile(`${base(associateId, id)}/meta.json`).catch(() => null);
  if (!buf) return null;
  try {
    const item = JSON.parse(buf.toString("utf8")) as SharedItem;
    return item.associateId === associateId ? item : null;
  } catch {
    return null;
  }
}

export async function getShareImage(
  associateId: string,
  id: string,
  index: number
): Promise<{ mime: string; data: Buffer } | null> {
  const item = await getShare(associateId, id);
  const img = item?.images[index];
  if (!img) return null;
  const data = await getPrivateFile(img.key).catch(() => null);
  return data ? { mime: img.mime, data } : null;
}

export async function deleteShare(associateId: string, id: string): Promise<void> {
  const item = await getShare(associateId, id);
  if (!item) return;
  for (const img of item.images) await deletePrivateFile(img.key);
  await deletePrivateFile(`${base(associateId, id)}/meta.json`);
}
