import type { NextRequest } from "next/server";
import type { VerificationRegion } from "@/lib/verification-types";

function headerCountry(req: NextRequest): string | undefined {
  const names = ["cf-ipcountry", "x-vercel-ip-country", "cloudfront-viewer-country"];
  for (const n of names) {
    const v = req.headers.get(n)?.trim();
    if (v) return v.toUpperCase();
  }
  return undefined;
}

/**
 * Heurística para elegir price MXN vs USD. Cloudflare: CF-IPCountry; Vercel: x-vercel-ip-country.
 * Si no hay cabecera (p. ej. dev local), default `mx`.
 */
export function verificationRegionFromRequest(req: NextRequest): VerificationRegion {
  const c = headerCountry(req);
  if (c === "US" || c === "PR" || c === "GU" || c === "VI" || c === "AS" || c === "UM") {
    return "us";
  }
  return "mx";
}
