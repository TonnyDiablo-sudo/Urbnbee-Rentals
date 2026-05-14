import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getPartnerApiSecret, partnerJson } from "@/lib/beeagent-partner";

export const runtime = "nodejs";

/** Conectividad pública (sin secret). BeeAgent / healthchecks. */
export async function GET(req: NextRequest) {
  const configured = Boolean(getPartnerApiSecret());
  return partnerJson(
    {
      ok: true,
      service: "urbnbee-marketplace",
      partnerApi: configured ? "configured" : "not_configured",
    },
    req
  );
}
