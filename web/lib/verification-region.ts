import type { NextRequest } from "next/server";
import type { VerificationRegion } from "@/lib/verification-types";

function headerCountry(h: Headers): string | undefined {
  const names = ["cf-ipcountry", "x-vercel-ip-country", "cloudfront-viewer-country"];
  for (const n of names) {
    const v = h.get(n)?.trim();
    if (v) return v.toUpperCase();
  }
  return undefined;
}

/**
 * Heurística para elegir precio MXN vs USD. Cloudflare: CF-IPCountry; Vercel: x-vercel-ip-country.
 * Si no hay cabecera (p. ej. dev local), default `mx`.
 */
export function verificationRegionFromHeaders(h: Headers): VerificationRegion {
  const c = headerCountry(h);
  if (c === "US" || c === "PR" || c === "GU" || c === "VI" || c === "AS" || c === "UM") {
    return "us";
  }
  return "mx";
}

export function verificationRegionFromRequest(req: NextRequest): VerificationRegion {
  return verificationRegionFromHeaders(req.headers);
}
