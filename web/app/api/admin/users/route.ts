import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { getAdminUsers } from "@/lib/admin-data";

export async function GET() {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return NextResponse.json(getAdminUsers());
}
