import { NextResponse } from "next/server";
import { getBeeagentLinkForHost } from "@/lib/beeagent-host-link-store";
import { getSessionUser } from "@/lib/session";

const DEFAULT_SIGNUP = "https://www.urbnbeeai.com/signup";

export async function GET() {
  const user = await getSessionUser();
  if (!user || (user.role !== "host" && user.role !== "admin")) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const link = getBeeagentLinkForHost(user.id);
  return NextResponse.json({
    linked: Boolean(link),
    hostId: user.id,
    beeagentCustomerId: link?.beeagentCustomerId ?? null,
    linkedAt: link?.linkedAt ?? null,
    signupUrl: process.env.URBNBEEAI_SIGNUP_URL?.trim() || DEFAULT_SIGNUP,
  });
}
