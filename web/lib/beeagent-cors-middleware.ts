import type { NextRequest } from "next/server";

const DEFAULT_ORIGINS = ["https://urbnbeeai.com", "https://www.urbnbeeai.com"];

function allowedOrigins(): string[] {
  const raw = process.env.URBNBEE_PARTNER_ORIGINS?.trim();
  if (!raw) return DEFAULT_ORIGINS;
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Solo para `middleware` (Edge): sin `node:crypto`. Debe coincidir con `beeagent-partner.ts`. */
export function beeagentMiddlewareCorsHeaders(req: NextRequest): Record<string, string> {
  const origin = req.headers.get("origin");
  if (!origin || !allowedOrigins().includes(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type, X-Urbnbee-Signature, X-Request-Id",
    Vary: "Origin",
  };
}

export function beeagentMiddlewarePreflightHeaders(req: NextRequest): Record<string, string> {
  const base = beeagentMiddlewareCorsHeaders(req);
  const reqHeaders = req.headers.get("access-control-request-headers");
  if (reqHeaders) {
    return { ...base, "Access-Control-Allow-Headers": reqHeaders };
  }
  return base;
}
