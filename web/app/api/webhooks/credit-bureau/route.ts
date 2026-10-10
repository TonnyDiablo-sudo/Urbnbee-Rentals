import { NextRequest, NextResponse } from "next/server";
import { handleBureauWebhook } from "@/lib/screening-bureau";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 64 * 1024;

export async function POST(req: NextRequest) {
  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Cuerpo demasiado grande." }, { status: 413 });
  }
  const outcome = await handleBureauWebhook(raw, req.headers);
  if (outcome === "invalid") {
    return NextResponse.json({ error: "Firma inválida." }, { status: 400 });
  }
  return NextResponse.json({ received: true });
}
