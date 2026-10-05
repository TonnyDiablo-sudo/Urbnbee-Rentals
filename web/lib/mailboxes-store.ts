import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { existsSync, readFileSync, statSync, writeFileSync } from "fs";
import { join } from "path";
import { NOREPLY_EMAIL, SUPPORT_EMAIL } from "@/lib/support-contact";
import { scheduleMysql, upsertJsonBlob } from "@/lib/mysql-sync";
import { ensureDir, getDataDir } from "@/lib/runtime-paths";

export type MailboxId = "noreply" | "support";

export type MailboxPublic = {
  id: MailboxId;
  email: string;
  connected: boolean;
  /** Cuenta de Google con la que inicia sesión, si el buzón es un alias de otra. */
  loginUser?: string;
  connectedAt?: string;
  lastOkAt?: string;
  lastError?: string;
};

type MailboxSecret = {
  email: string;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  passEnc: string;
  connectedAt: string;
  lastOkAt?: string;
  lastError?: string;
};

type Doc = { version: 1; boxes: Partial<Record<MailboxId, MailboxSecret>> };

const DATA_FILE = join(getDataDir(), "mailboxes.json");
const ALGO = "aes-256-gcm";

export const MAILBOX_META: Record<MailboxId, { email: string; title: string; uses: string }> = {
  noreply: {
    email: NOREPLY_EMAIL,
    title: "Correo del sistema",
    uses: "Confirmación de correo de huéspedes y anfitriones, recuperación de contraseña y avisos de que alguien cambió el correo o la clave. Quien reciba el mensaje no puede responder a este buzón: las respuestas van a support@.",
  },
  support: {
    email: SUPPORT_EMAIL,
    title: "Soporte y quejas",
    uses: "Aquí llegan las denuncias, quejas, reclamos de cuenta y sugerencias, y las respuestas a los avisos de noreply@. También es el correo que la gente ve para escribirte directo. Si noreply@ no está conectado o falla, los avisos salen desde aquí.",
  },
};

let doc: Doc = { version: 1, boxes: {} };
let cachedMtime = -1;

function keyBytes(): Buffer {
  const secret = process.env.SESSION_SECRET?.trim() || "urbnbee-dev-secret-change-in-production";
  return createHash("sha256").update(`cabibee-mailboxes:${secret}`).digest();
}

function encryptPass(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, keyBytes(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return `v1:${iv.toString("base64")}:${cipher.getAuthTag().toString("base64")}:${enc.toString("base64")}`;
}

function decryptPass(packed: string): string {
  const [ver, ivB64, tagB64, dataB64] = packed.split(":");
  if (ver !== "v1" || !ivB64 || !tagB64 || !dataB64) throw new Error("Credencial ilegible.");
  const decipher = createDecipheriv(ALGO, keyBytes(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]).toString("utf8");
}

function load() {
  try {
    if (!existsSync(DATA_FILE)) return;
    const m = statSync(DATA_FILE).mtimeMs;
    if (m === cachedMtime) return;
    const raw = JSON.parse(readFileSync(DATA_FILE, "utf8")) as Doc;
    doc = { version: 1, boxes: raw.boxes ?? {} };
    cachedMtime = m;
  } catch (e) {
    console.warn("[mailboxes] load failed:", e);
  }
}

function persist() {
  try {
    ensureDir(getDataDir());
    writeFileSync(DATA_FILE, JSON.stringify(doc, null, 2), "utf8");
    cachedMtime = existsSync(DATA_FILE) ? statSync(DATA_FILE).mtimeMs : cachedMtime;
    scheduleMysql(() => upsertJsonBlob("mailboxes", doc));
  } catch (e) {
    console.warn("[mailboxes] persist failed:", e);
  }
}

export function mailboxEmail(id: MailboxId): string {
  return MAILBOX_META[id].email;
}

export function listMailboxesPublic(): MailboxPublic[] {
  load();
  return (["noreply", "support"] as const).map((id) => {
    const box = doc.boxes[id];
    let readable = false;
    if (box?.passEnc) {
      try {
        decryptPass(box.passEnc);
        readable = true;
      } catch {
        readable = false;
      }
    }
    return {
      id,
      email: MAILBOX_META[id].email,
      connected: readable,
      loginUser: box && box.user !== box.email ? box.user : undefined,
      connectedAt: box?.connectedAt,
      lastOkAt: box?.lastOkAt,
      lastError: box?.passEnc && !readable ? "La clave guardada ya no se puede leer (cambió SESSION_SECRET). Vuelve a conectar." : box?.lastError,
    };
  });
}

export function getMailboxAuth(id: MailboxId): { email: string; host: string; port: number; secure: boolean; user: string; pass: string } | null {
  load();
  const box = doc.boxes[id];
  if (!box?.passEnc) return null;
  try {
    return {
      email: box.email,
      host: box.host,
      port: box.port,
      secure: box.secure,
      user: box.user,
      pass: decryptPass(box.passEnc),
    };
  } catch {
    return null;
  }
}

export function saveMailbox(
  id: MailboxId,
  input: { host: string; port: number; secure: boolean; user: string; pass: string }
): MailboxPublic {
  load();
  const now = new Date().toISOString();
  doc.boxes[id] = {
    email: MAILBOX_META[id].email,
    host: input.host,
    port: input.port,
    secure: input.secure,
    user: input.user,
    passEnc: encryptPass(input.pass),
    connectedAt: doc.boxes[id]?.connectedAt ?? now,
    lastOkAt: now,
    lastError: undefined,
  };
  persist();
  return listMailboxesPublic().find((b) => b.id === id)!;
}

export function markMailboxError(id: MailboxId, message: string) {
  load();
  const box = doc.boxes[id];
  if (!box) return;
  box.lastError = message.slice(0, 300);
  persist();
}

export function markMailboxOk(id: MailboxId) {
  load();
  const box = doc.boxes[id];
  if (!box) return;
  box.lastOkAt = new Date().toISOString();
  box.lastError = undefined;
  persist();
}

export function disconnectMailbox(id: MailboxId): MailboxPublic {
  load();
  delete doc.boxes[id];
  persist();
  return { id, email: MAILBOX_META[id].email, connected: false };
}
