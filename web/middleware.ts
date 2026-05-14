import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { beeagentMiddlewarePreflightHeaders } from "@/lib/beeagent-cors-middleware";

export function middleware(req: NextRequest) {
  if (!req.nextUrl.pathname.startsWith("/api/integrations/beeagent")) {
    return NextResponse.next();
  }
  if (req.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers: beeagentMiddlewarePreflightHeaders(req) });
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/api/integrations/beeagent/:path*",
};
