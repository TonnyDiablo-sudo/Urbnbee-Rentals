import { NextResponse } from "next/server";
import { isMysqlConfigured, pingMysql } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const mysqlConfigured = isMysqlConfigured();
  let mysqlStatus: "ok" | "disabled" | "error" = "disabled";
  let mysqlError: string | undefined;
  if (mysqlConfigured) {
    const r = await pingMysql();
    mysqlStatus = r.ok ? "ok" : "error";
    mysqlError = r.error;
  }
  const ok = mysqlStatus !== "error";
  return NextResponse.json(
    {
      ok,
      status: "running",
      mysql: mysqlStatus,
      ...(mysqlError ? { mysqlError } : {}),
    },
    { status: ok ? 200 : 503 }
  );
}
