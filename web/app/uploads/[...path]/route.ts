import { NextResponse } from "next/server";
import { stat, readFile } from "fs/promises";
import { extname, join, normalize, resolve, sep } from "path";
import { getUploadsDir } from "@/lib/runtime-paths";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".avif": "image/avif",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".pdf": "application/pdf",
};

/**
 * Sirve archivos desde `getUploadsDir()` para `/uploads/<...>`.
 *
 * - En dev sin env vars, `UPLOADS_DIR=<cwd>/public/uploads` y los `<img src="/uploads/...">`
 *   siguen funcionando: esta ruta intercepta y los streamea desde disco.
 * - En Railway con un Volume montado fuera de `public/` (p.ej. `URBNBEE_UPLOADS_DIR=/data/uploads`),
 *   los mismos URLs `/uploads/...` siguen funcionando porque leemos desde `getUploadsDir()`.
 *
 * Bloquea path traversal verificando que la ruta resuelta siga dentro de la base.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ path?: string[] }> }
) {
  const { path: parts } = await ctx.params;
  if (!parts || parts.length === 0) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const base = resolve(getUploadsDir());
  const requested = resolve(base, normalize(join(...parts)));
  if (requested !== base && !requested.startsWith(base + sep)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  let info;
  try {
    info = await stat(requested);
  } catch {
    return new NextResponse("Not Found", { status: 404 });
  }
  if (!info.isFile()) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const ext = extname(requested).toLowerCase();
  const contentType = MIME[ext] ?? "application/octet-stream";

  const buf = await readFile(requested);
  return new NextResponse(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(info.size),
      "Cache-Control": "public, max-age=3600, s-maxage=86400, immutable",
    },
  });
}
