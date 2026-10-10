import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { isAccountSuspended, SUSPENDED_ERROR } from "@/lib/account-standing";
import { APP_SHELL_HEADER } from "@/lib/app-shell";
import { CREDIT_CHECK_ENABLED } from "@/lib/feature-flags";
import type { UserRecord } from "@/lib/marketplace-types";

export function screeningBlocked(req: NextRequest, user?: UserRecord | null): NextResponse | null {
  if (!CREDIT_CHECK_ENABLED) {
    return NextResponse.json(
      { error: "La revisión de historial crediticio todavía no está disponible." },
      { status: 403 }
    );
  }
  if (req.headers.get(APP_SHELL_HEADER) === "android") {
    return NextResponse.json(
      { error: "La revisión de historial crediticio se hace desde la web de Cabibee." },
      { status: 403 }
    );
  }
  if (user && isAccountSuspended(user)) {
    return NextResponse.json({ error: SUSPENDED_ERROR }, { status: 403 });
  }
  return null;
}
