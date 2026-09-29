import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { SCREENING_CONSENT_TEXT, screeningPublicView, screeningQuote } from "@/lib/screening-service";
import { listScreeningsForGuest } from "@/lib/screening-store";
import { getStripe } from "@/lib/stripe-server";
import { verificationRegionFromRequest } from "@/lib/verification-region";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const region = verificationRegionFromRequest(req);
  return NextResponse.json({
    cases: listScreeningsForGuest(user.id).map(screeningPublicView),
    quote: screeningQuote(region),
    consentText: SCREENING_CONSENT_TEXT,
    stripeConfigured: Boolean(getStripe()),
  });
}
