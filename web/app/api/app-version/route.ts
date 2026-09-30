import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    { build: process.env.NEXT_PUBLIC_BUILD_ID ?? "" },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
