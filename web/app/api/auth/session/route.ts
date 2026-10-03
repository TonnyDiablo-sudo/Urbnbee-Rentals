import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { hasAcceptedTerms, TERMS_VERSION } from "@/lib/terms";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ user: null });
  }
  return NextResponse.json({
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
      phone: user.phone,
      termsAccepted: hasAcceptedTerms(user),
      termsVersion: TERMS_VERSION,
    },
  });
}
