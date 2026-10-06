import { NextRequest, NextResponse } from "next/server";
import { earningsCsv, earningsMonthlyCsv, earningsRows } from "@/lib/host-earnings-report";
import { getT } from "@/lib/i18n/server";
import { getSessionUser } from "@/lib/session";

/**
 * Reservas del motor y lo cobrado, en CSV (para el contador o el SAT/IRS).
 * `year` (AAAA o «todas»), `month` (1-12, opcional) y `view=months` para el resumen mes por mes.
 */
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || (user.role !== "host" && user.role !== "admin")) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const q = req.nextUrl.searchParams;
  const raw = q.get("year") ?? "";
  const year = /^\d{4}$/.test(raw) ? Number(raw) : null;
  const m = Number(q.get("month"));
  const month = year !== null && Number.isInteger(m) && m >= 1 && m <= 12 ? m : null;
  const monthly = q.get("view") === "months";
  const rows = earningsRows(user.id, year, month);
  const t = await getT();
  const csv = monthly ? earningsMonthlyCsv(rows, t) : earningsCsv(rows, t);
  const period = year === null ? "todas" : month ? `${year}-${String(month).padStart(2, "0")}` : String(year);
  const name = `cabibee-${monthly ? "ingresos-por-mes" : "reservas"}-${period}.csv`;
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
