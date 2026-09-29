import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { cookies, headers } from "next/headers";
import type { SessionPayload, UserRecord, UserRole } from "@/lib/marketplace-types";
import { findUserById } from "@/lib/marketplace-store";

const COOKIE_NAME = "cb_session";
/**
 * Cookie anterior, sólo del host exacto. Se sigue leyendo para no cerrar sesiones
 * abiertas; tiene otro nombre porque una respuesta no puede fijar y borrar dos
 * cookies con el mismo nombre.
 */
const LEGACY_COOKIE_NAME = "urb_session";
const MAX_AGE_SEC = 60 * 60 * 24 * 30;

function signingSecret() {
  return process.env.SESSION_SECRET || "urbnbee-dev-secret-change-in-production";
}

export async function createSession(user: { id: string; email: string; role: UserRole }) {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_SEC;
  const payload = Buffer.from(
    JSON.stringify({ sub: user.id, email: user.email, role: user.role, exp })
  ).toString("base64url");
  const sig = createHmac("sha256", signingSecret()).update(payload).digest("base64url");
  const token = `${payload}.${sig}`;
  const jar = await cookies();
  const domain = await sessionCookieDomain();
  jar.delete(LEGACY_COOKIE_NAME);
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SEC,
    domain,
  });
}

/**
 * El sitio (cabibee.com) y la app (app.cabibee.com) comparten sesión: la cookie se
 * emite para el dominio padre. En local cada host lleva la suya.
 */
async function sessionCookieDomain(): Promise<string | undefined> {
  const fromEnv = process.env.SESSION_COOKIE_DOMAIN?.trim();
  if (fromEnv) return fromEnv;
  const h = await headers();
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "").split(":")[0].toLowerCase();
  return host === "cabibee.com" || host.endsWith(".cabibee.com") ? ".cabibee.com" : undefined;
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(LEGACY_COOKIE_NAME);
  jar.delete({ name: COOKIE_NAME, domain: await sessionCookieDomain(), path: "/" });
}

export async function readSessionPayload(): Promise<SessionPayload | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value ?? jar.get(LEGACY_COOKIE_NAME)?.value;
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expected = createHmac("sha256", signingSecret()).update(payload).digest("base64url");
  try {
    if (sig.length !== expected.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      return null;
    }
  } catch {
    return null;
  }
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SessionPayload;
    if (!data.sub || !data.exp || data.exp < Math.floor(Date.now() / 1000)) return null;
    return data;
  } catch {
    return null;
  }
}

export async function getSessionUser(): Promise<UserRecord | null> {
  const s = await readSessionPayload();
  if (!s) return null;
  return findUserById(s.sub) ?? null;
}

export async function requireHostUser(): Promise<UserRecord> {
  const user = await getSessionUser();
  if (!user || (user.role !== "host" && user.role !== "admin")) {
    throw new Error("UNAUTHORIZED_HOST");
  }
  return user;
}
