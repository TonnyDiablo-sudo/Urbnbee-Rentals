import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { getAdminLogs } from "@/lib/admin-data";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { searchParams } = new URL(request.url);
  const limit = Math.min(500, parseInt(searchParams.get("limit") ?? "200", 10));
  return NextResponse.json(getAdminLogs(limit));
}
