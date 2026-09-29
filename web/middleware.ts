import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { beeagentMiddlewarePreflightHeaders } from "@/lib/beeagent-cors-middleware";
import { appHostFromSiteHost, isAppHost, requestProto } from "@/lib/app-host";

/** Rutas que el subdominio de la app sirve tal cual (API, estáticos, archivos subidos). */
const PASSTHROUGH = /^\/(api|_next|uploads)(\/|$)/;
const HAS_EXTENSION = /\.[a-z0-9]+$/i;

function isAppPrefixed(pathname: string): boolean {
  return pathname === "/app" || pathname.startsWith("/app/");
}

function stripAppPrefix(pathname: string): string {
  return pathname.slice(4) || "/";
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "";
  const proto = requestProto(req.headers.get("x-forwarded-proto"), host);

  if (isAppHost(host)) {
    if (isAppPrefixed(pathname)) {
      return NextResponse.redirect(`${proto}://${host}${stripAppPrefix(pathname)}${search}`, 308);
    }
    if (PASSTHROUGH.test(pathname) || HAS_EXTENSION.test(pathname)) {
      return NextResponse.next();
    }
    const url = req.nextUrl.clone();
    url.pathname = pathname === "/" ? "/app" : `/app${pathname}`;
    return NextResponse.rewrite(url);
  }

  if (isAppPrefixed(pathname)) {
    return NextResponse.redirect(`${proto}://${appHostFromSiteHost(host)}${stripAppPrefix(pathname)}${search}`, 308);
  }

  if (pathname.startsWith("/api/integrations/beeagent") && req.method === "OPTIONS") {
    return new NextResponse(null, { status: 204, headers: beeagentMiddlewarePreflightHeaders(req) });
  }
  return NextResponse.next();
}

export const config = {
  matcher: "/((?!_next/static|_next/image).*)",
};
