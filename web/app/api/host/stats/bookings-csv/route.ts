import { NextRequest, NextResponse } from "next/server";
import { earningsCsv, earningsRows } from "@/lib/host-earnings-report";
import { getT } from "@/lib/i18n/server";
import { getSessionUser } from "@/lib/session";

/** Reservas del motor y lo cobrado, en CSV (para el contador o el SAT/IRS). */
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || (user.role !== "host" && user.role !== "admin")) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const raw = req.nextUrl.searchParams.get("year") ?? "";
  const year = /^\d{4}$/.test(raw) ? Number(raw) : null;
  const csv = earningsCsv(earningsRows(user.id, year), await getT());
  const name = `cabibee-reservas-${year ?? "todas"}.csv`;
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
