import type { NextRequest } from "next/server";

export function publicOriginFromRequest(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-host");
  const host = forwarded ?? req.headers.get("host") ?? "localhost:3005";
  let proto = req.headers.get("x-forwarded-proto") ?? "http";
  if (host.includes("localhost")) proto = "http";
  return `${proto}://${host}`;
}
