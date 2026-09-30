import { NextRequest, NextResponse } from "next/server";
import { flushDueOutboundWebhooks } from "@/lib/beeagent-outbound";

export const runtime = "nodejs";

function authorizeCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  return req.nextUrl.searchParams.get("secret") === secret;
}

export async function GET(req: NextRequest) {
  if (!authorizeCron(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const result = await flushDueOutboundWebhooks();
  return NextResponse.json({ ok: true, ...result });
}
