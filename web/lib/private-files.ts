import "server-only";
import { AwsClient } from "aws4fetch";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "fs";
import { dirname, resolve } from "path";
import sharp from "sharp";
import { getDataDir } from "@/lib/runtime-paths";

/**
 * Archivos privados (fotos de limpieza y similares): nunca bajo /uploads público, sólo
 * se sirven por una ruta que revisa permisos.
 *
 * Con R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY y R2_BUCKET se guardan en
 * Cloudflare R2; sin ellas, en el Volume de Railway (URBNBEE_DATA_DIR/private-files).
 */

const MAX_INPUT_BYTES = 10 * 1024 * 1024;

type R2 = { client: AwsClient; base: string };
let r2Cache: R2 | null | undefined;

function r2(): R2 | null {
  if (r2Cache !== undefined) return r2Cache;
  const account = process.env.R2_ACCOUNT_ID?.trim();
  const key = process.env.R2_ACCESS_KEY_ID?.trim();
  const secret = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const bucket = process.env.R2_BUCKET?.trim();
  r2Cache =
    account && key && secret && bucket
      ? {
          client: new AwsClient({ accessKeyId: key, secretAccessKey: secret, service: "s3", region: "auto" }),
          base: `https://${account}.r2.cloudflarestorage.com/${bucket}`,
        }
      : null;
  return r2Cache;
}

export function privateStorageKind(): "r2" | "volume" {
  return r2() ? "r2" : "volume";
}

function safeKey(key: string): string {
  if (!/^[a-z0-9][a-z0-9/_.-]{0,200}$/i.test(key) || key.includes("..")) throw new Error("bad key");
  return key;
}

function localPath(key: string): string {
  const root = resolve(getDataDir(), "private-files");
  const p = resolve(root, safeKey(key));
  if (!p.startsWith(root)) throw new Error("bad key");
  return p;
}

export async function putPrivateFile(key: string, body: Buffer, contentType: string): Promise<void> {
  forget(key);
  const s = r2();
  if (s) {
    const res = await s.client.fetch(`${s.base}/${safeKey(key)}`, {
      method: "PUT",
      body: new Uint8Array(body),
      headers: { "content-type": contentType },
    });
    if (!res.ok) throw new Error(`R2 PUT ${res.status}`);
    return;
  }
  const p = localPath(key);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, body);
}

/**
 * Los audios se piden por pedazos (Range) y cada pedazo bajaba el archivo entero de R2.
 * Las llaves llevan un nombre aleatorio y no se reescriben, así que se pueden guardar en memoria.
 */
const CACHE_MAX_BYTES = 64 * 1024 * 1024;
const CACHE_MAX_FILE = 4 * 1024 * 1024;
const cache = new Map<string, Buffer>();
let cacheBytes = 0;

function remember(key: string, data: Buffer) {
  if (data.byteLength > CACHE_MAX_FILE) return;
  forget(key);
  cache.set(key, data);
  cacheBytes += data.byteLength;
  for (const [k, v] of cache) {
    if (cacheBytes <= CACHE_MAX_BYTES) break;
    cache.delete(k);
    cacheBytes -= v.byteLength;
  }
}

function forget(key: string) {
  const old = cache.get(key);
  if (!old) return;
  cache.delete(key);
  cacheBytes -= old.byteLength;
}

export async function getPrivateFile(key: string): Promise<Buffer | null> {
  const hit = cache.get(key);
  if (hit) {
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }
  const s = r2();
  if (s) {
    const res = await s.client.fetch(`${s.base}/${safeKey(key)}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`R2 GET ${res.status}`);
    const data = Buffer.from(await res.arrayBuffer());
    remember(key, data);
    return data;
  }
  const p = localPath(key);
  return existsSync(p) ? readFileSync(p) : null;
}

export async function deletePrivateFile(key: string): Promise<void> {
  forget(key);
  try {
    const s = r2();
    if (s) {
      await s.client.fetch(`${s.base}/${safeKey(key)}`, { method: "DELETE" });
      return;
    }
    unlinkSync(localPath(key));
  } catch {
    /* ya no estaba */
  }
}

/**
 * Las fotos del celular pesan 3-8 MB; guardadas así llenan el Volume en semanas.
 * Se reducen a 1600 px y WebP: quedan en ~150-300 KB y sin datos EXIF (ubicación GPS).
 */
export async function compressPhoto(input: Buffer): Promise<Buffer> {
  if (input.byteLength > MAX_INPUT_BYTES) throw new Error("too_big");
  return sharp(input, { failOn: "error" })
    .rotate()
    .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 72 })
    .toBuffer();
}

export const PRIVATE_PHOTO_MAX_INPUT_BYTES = MAX_INPUT_BYTES;
