import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const DEFAULT_ORIGINS = ["https://urbnbeeai.com", "https://www.urbnbeeai.com"];

function parseOrigins(): string[] {
  const raw = process.env.URBNBEE_PARTNER_ORIGINS?.trim();
  if (!raw) return DEFAULT_ORIGINS;
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Orígenes permitidos para CORS (widget o admin en URBNBEEAI). */
export function partnerAllowedOrigins(): string[] {
  return parseOrigins();
}

export function getPartnerApiSecret(): string | undefined {
  const s = process.env.URBNBEE_PARTNER_API_SECRET?.trim();
  return s || undefined;
}

export function getPartnerWebhookSecret(): string | undefined {
  const s = process.env.URBNBEE_PARTNER_WEBHOOK_SECRET?.trim();
  if (s) return s;
  return getPartnerApiSecret();
}

function safeEqualString(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a, "utf8");
    const bb = Buffer.from(b, "utf8");
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

/** Bearer igual a `URBNBEE_PARTNER_API_SECRET`. */
export function verifyPartnerBearer(req: NextRequest): boolean {
  const secret = getPartnerApiSecret();
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  return token.length > 0 && safeEqualString(token, secret);
}

export function partnerAuthErrorResponse(req: NextRequest): NextResponse {
  return partnerJson({ error: "No autorizado" }, req, { status: 401 });
}

export function partnerNotConfiguredResponse(req: NextRequest): NextResponse {
  return partnerJson(
    { error: "URBNBEE_PARTNER_API_SECRET no está configurada en este servidor." },
    req,
    { status: 503 }
  );
}

/** Headers CORS solo si el `Origin` del request está en la lista (llamadas desde navegador en urbnbeeai.com). */
export function partnerCorsHeaders(req: NextRequest): Record<string, string> {
  const origin = req.headers.get("origin");
  if (!origin) return {};
  if (!partnerAllowedOrigins().includes(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers":
      "Authorization, Content-Type, X-Urbnbee-Signature, X-Request-Id, X-Beeagent-Customer-Id",
    Vary: "Origin",
  };
}

export function partnerPreflightHeaders(req: NextRequest): Record<string, string> {
  const base = partnerCorsHeaders(req);
  const reqHeaders = req.headers.get("access-control-request-headers");
  if (reqHeaders) {
    return {
      ...base,
      "Access-Control-Allow-Headers": reqHeaders,
    };
  }
  return base;
}

export function withPartnerCors<T extends NextResponse>(res: T, req: NextRequest): T {
  for (const [k, v] of Object.entries(partnerCorsHeaders(req))) {
    res.headers.set(k, v);
  }
  return res;
}

export function partnerJson(data: unknown, req: NextRequest, init?: ResponseInit): NextResponse {
  return withPartnerCors(NextResponse.json(data, init), req);
}

export function parseBeeagentCustomerId(req: NextRequest): number | null {
  const raw = req.headers.get("x-beeagent-customer-id")?.trim() ?? "";
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0 || !Number.isInteger(n)) return null;
  return n;
}

export function connectReturnOrigins(): string[] {
  const raw = process.env.URBNBEEAI_CONNECT_RETURN_ORIGINS?.trim();
  if (!raw) return ["https://www.urbnbeeai.com", "https://urbnbeeai.com"];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function parseAllowedConnectReturnUrl(raw: string): URL | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.protocol === "http:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    return null;
  }
  if (!connectReturnOrigins().includes(url.origin)) return null;
  return url;
}

export function beeagentConnectStartUrl(): string {
  return (
    process.env.URBNBEEAI_CONNECT_START_URL?.trim() ||
    "https://www.urbnbeeai.com/integrations/cabibee/start"
  );
}

/** `X-Urbnbee-Signature: sha256=<hex>` con HMAC-SHA256 del cuerpo en bruto. */
export function verifyPartnerWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = getPartnerWebhookSecret();
  if (!secret || !signatureHeader) return false;
  const m = /^sha256=([a-f0-9]+)$/i.exec(signatureHeader.trim());
  if (!m) return false;
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex");
  return safeEqualString(expected, m[1]);
}
