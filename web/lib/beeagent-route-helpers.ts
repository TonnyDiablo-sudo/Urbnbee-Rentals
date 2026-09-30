import "server-only";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  rememberPartnerIdempotency,
  replayPartnerIdempotency,
} from "@/lib/beeagent-idempotency";
import { partnerJson } from "@/lib/beeagent-partner";

export function partnerIdempotentJson(
  req: NextRequest,
  build: () => { status: number; body: unknown }
): NextResponse {
  const path = req.nextUrl.pathname;
  const header = req.headers.get("idempotency-key");
  const replay = replayPartnerIdempotency(req.method, path, header);
  if (replay) return partnerJson(replay.body, req, { status: replay.status });
  const result = build();
  rememberPartnerIdempotency(req.method, path, header, result.status, result.body);
  return partnerJson(result.body, req, { status: result.status });
}

export async function partnerIdempotentJsonAsync(
  req: NextRequest,
  build: () => Promise<{ status: number; body: unknown }>
): Promise<NextResponse> {
  const path = req.nextUrl.pathname;
  const header = req.headers.get("idempotency-key");
  const replay = replayPartnerIdempotency(req.method, path, header);
  if (replay) return partnerJson(replay.body, req, { status: replay.status });
  const result = await build();
  rememberPartnerIdempotency(req.method, path, header, result.status, result.body);
  return partnerJson(result.body, req, { status: result.status });
}
