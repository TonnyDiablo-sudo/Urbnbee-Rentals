import "server-only";
import { NextResponse } from "next/server";

/** Respuesta de un archivo privado con soporte de Range: Safari no reproduce audios sin 206. */
export function privateFileResponse(req: Request, data: Buffer, mime: string): NextResponse {
  const total = data.byteLength;
  const headers: Record<string, string> = {
    "content-type": mime,
    "cache-control": "private, max-age=604800, immutable",
    "accept-ranges": "bytes",
    "x-content-type-options": "nosniff",
  };
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") ?? "");
  if (range && (range[1] || range[2])) {
    let start: number;
    let end: number;
    if (range[1]) {
      start = Number(range[1]);
      end = range[2] ? Number(range[2]) : total - 1;
    } else {
      start = total - Number(range[2]);
      end = total - 1;
    }
    start = Math.max(0, start);
    end = Math.min(total - 1, end);
    if (start > end || start >= total) {
      return new NextResponse(null, { status: 416, headers: { ...headers, "content-range": `bytes */${total}` } });
    }
    return new NextResponse(new Uint8Array(data.subarray(start, end + 1)), {
      status: 206,
      headers: { ...headers, "content-range": `bytes ${start}-${end}/${total}`, "content-length": String(end - start + 1) },
    });
  }
  return new NextResponse(new Uint8Array(data), { headers: { ...headers, "content-length": String(total) } });
}
