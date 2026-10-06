import { NextRequest, NextResponse } from "next/server";
import { spendingCsv, spendingRows } from "@/lib/guest-spending-report";
import { getT } from "@/lib/i18n/server";
import { getSessionUser } from "@/lib/session";

/** Lo que el huésped ha pagado en Cabibee, en CSV. */
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const raw = req.nextUrl.searchParams.get("year") ?? "";
  const year = /^\d{4}$/.test(raw) ? Number(raw) : null;
  const csv = spendingCsv(spendingRows(user.id, year), await getT());
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="cabibee-gastos-${year ?? "todos"}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
