import "server-only";
import { readFile } from "fs/promises";
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

function safeId(bookingId: string): string | null {
  return /^[A-Za-z0-9_-]{6,80}$/.test(bookingId) ? bookingId : null;
}

function payProofFile(bookingId: string, mime: PayProof["mime"]): string | null {
  const id = safeId(bookingId);
  if (!id) return null;
  return path.join(getUploadsDir(), "pay-proofs", id, `receipt.${MIME_EXT[mime]}`);
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
