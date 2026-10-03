import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { placeFromIp } from "@/lib/geo-ip";
import { placeKey } from "@/lib/geo-places";
import { isBotUserAgent } from "@/lib/listing-stats-store";
import { getSessionUser } from "@/lib/session";
import { recordSiteVisit } from "@/lib/site-visits-store";

const COOKIE = "cb_vid";

/** Beacon de página vista (components/visit-beacon.tsx). Siempre responde 204: no debe molestar al visitante. */
export async function POST(req: Request) {
  const res = new NextResponse(null, { status: 204 });
  const ua = req.headers.get("user-agent");
  if (isBotUserAgent(ua)) return res;

  const cookie = req.headers.get("cookie") ?? "";
  let visitorId = /(?:^|;\s*)cb_vid=([a-f0-9]{24})/.exec(cookie)?.[1];
  if (!visitorId) {
    visitorId = randomBytes(12).toString("hex");
    res.cookies.set(COOKIE, visitorId, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 730,
    });
  }

  try {
    const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || req.headers.get("x-real-ip");
    const [place, user] = await Promise.all([placeFromIp(ip), getSessionUser()]);
    if (user?.role === "admin") return res;
    recordSiteVisit({ visitorId, placeKey: placeKey(place), userId: user?.id });
  } catch (e) {
    console.warn("[track/visit]", e);
  }
  return res;
}
