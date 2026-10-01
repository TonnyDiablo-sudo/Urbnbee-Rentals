import "server-only";
import { mkdir, readFile, rm, writeFile } from "fs/promises";
import path from "path";
import type { PayProof } from "@/lib/booking-types";
import { getUploadsDir } from "@/lib/runtime-paths";

const MIME_EXT: Record<PayProof["mime"], string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/pdf": "pdf",
};

export function sniffPayProof(buf: Buffer): PayProof["mime"] | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
    return "image/webp";
  }
  if (buf.length >= 6 && (buf.toString("ascii", 0, 6) === "GIF87a" || buf.toString("ascii", 0, 6) === "GIF89a")) {
    return "image/gif";
  }
  if (buf.length >= 5 && buf.toString("ascii", 0, 5) === "%PDF-") return "application/pdf";
  return null;
}

function safeId(bookingId: string): string | null {
  return /^[A-Za-z0-9_-]{6,80}$/.test(bookingId) ? bookingId : null;
}

export function payProofFile(bookingId: string, mime: PayProof["mime"]): string | null {
  const id = safeId(bookingId);
  if (!id) return null;
  return path.join(getUploadsDir(), "pay-proofs", id, `receipt.${MIME_EXT[mime]}`);
}

export async function savePayProof(bookingId: string, buf: Buffer, mime: PayProof["mime"]): Promise<void> {
  const file = payProofFile(bookingId, mime);
  const id = safeId(bookingId);
  if (!file || !id) throw new Error("Reserva inválida.");
  const dir = path.join(getUploadsDir(), "pay-proofs", id);
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });
  await writeFile(file, buf);
}

export async function readPayProof(bookingId: string, mime: PayProof["mime"]): Promise<Buffer | null> {
  const file = payProofFile(bookingId, mime);
  if (!file) return null;
  try {
    return await readFile(file);
  } catch {
    return null;
  }
}
