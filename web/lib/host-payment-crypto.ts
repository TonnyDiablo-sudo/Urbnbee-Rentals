import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGO = "aes-256-gcm";

export class HostPaymentKeyMissingError extends Error {
  constructor() {
    super("Falta HOST_PAYMENT_CREDS_KEY (64 hex). El anfitrión no puede guardar su Stripe todavía.");
    this.name = "HostPaymentKeyMissingError";
  }
}

function keyBytes(): Buffer {
  const raw = process.env.HOST_PAYMENT_CREDS_KEY?.trim() ?? "";
  if (!/^[0-9a-fA-F]{64}$/.test(raw)) {
    throw new HostPaymentKeyMissingError();
  }
  return Buffer.from(raw, "hex");
}

export function hostPaymentCryptoReady(): boolean {
  return /^[0-9a-fA-F]{64}$/.test(process.env.HOST_PAYMENT_CREDS_KEY?.trim() ?? "");
}

export function encryptHostPaymentPayload(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, keyBytes(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${enc.toString("base64")}`;
}

export function decryptHostPaymentPayload(packed: string): string {
  const [ver, ivB64, tagB64, dataB64] = packed.split(":");
  if (ver !== "v1" || !ivB64 || !tagB64 || !dataB64) {
    throw new Error("Credencial de pago ilegible.");
  }
  const decipher = createDecipheriv(ALGO, keyBytes(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

export function secretLast4(secret: string): string {
  const s = secret.trim();
  return s.slice(-4);
}
