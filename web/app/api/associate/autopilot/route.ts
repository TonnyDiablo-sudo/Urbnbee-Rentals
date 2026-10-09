import { NextRequest, NextResponse } from "next/server";
import { getAssociateFromRequest } from "@/lib/associate-auth";
import {
  autopilotLimitFor,
  autopilotSettings,
  autopilotSiteOf,
  autopilotUsageBySite,
  canUseAutopilot,
  knownListingUrls,
} from "@/lib/associate-autopilot";
import { canonicalListingUrl } from "@/lib/associate-link-utils";

export const runtime = "nodejs";

const UNAUTHORIZED = { error: "Token inválido. Genera uno nuevo en Cabibee → Asociados → Extensión." };

/**
 * La extensión pregunta si la cuenta es Plus y cuánto le queda hoy en cada página.
 * Con `?url=` (la búsqueda donde va a arrancar) regresa además el tope de esa página.
 */
export async function GET(req: NextRequest) {
  const associate = await getAssociateFromRequest(req);
  if (!associate) return NextResponse.json(UNAUTHORIZED, { status: 401 });
  const allowed = canUseAutopilot(associate);
  const { minDelaySec, limits } = autopilotSettings();
  const usedBySite = allowed ? autopilotUsageBySite(associate.id) : {};
  const url = req.nextUrl.searchParams.get("url");
  const site = url ? autopilotSiteOf(url) : null;
  const dailyLimit = site ? autopilotLimitFor(site) : null;
  const usedToday = site ? (usedBySite[site] ?? 0) : null;
  return NextResponse.json({
    allowed,
    minDelaySec,
    limits,
    usedBySite,
    site,
    dailyLimit,
    usedToday,
    remaining: dailyLimit !== null && usedToday !== null ? Math.max(0, dailyLimit - usedToday) : null,
  });
}

/** Recibe los links de una página de resultados y regresa sólo los que todavía no están en Cabibee. */
export async function POST(req: NextRequest) {
  const associate = await getAssociateFromRequest(req);
  if (!associate) return NextResponse.json(UNAUTHORIZED, { status: 401 });
  if (!canUseAutopilot(associate)) {
    return NextResponse.json({ code: "not_plus", error: "El piloto automático es sólo para cuentas Asociado Plus." }, { status: 403 });
  }
  const body = (await req.json().catch(() => null)) as { urls?: unknown } | null;
  const urls = Array.isArray(body?.urls) ? body.urls.filter((u): u is string => typeof u === "string").slice(0, 300) : [];
  const known = knownListingUrls();
  const seen = new Set<string>();
  const fresh: string[] = [];
  for (const url of urls) {
    const c = canonicalListingUrl(url);
    if (!c || known.has(c) || seen.has(c)) continue;
    seen.add(c);
    fresh.push(url);
  }
  return NextResponse.json({ fresh, known: urls.length - fresh.length });
}
