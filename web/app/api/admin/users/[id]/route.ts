import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { findUserById, setUserRole } from "@/lib/marketplace-store";
import type { UserRole } from "@/lib/marketplace-types";

const VALID_ROLES: UserRole[] = ["guest", "host", "admin"];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const viewer = await getSessionUser();
  if (!viewer || viewer.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const target = findUserById(id);
  if (!target) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await request.json()) as { role?: string };
  if (body.role) {
    if (!VALID_ROLES.includes(body.role as UserRole)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }
    if (target.id === viewer.id) {
      return NextResponse.json({ error: "Cannot change own role" }, { status: 400 });
    }
    const updated = setUserRole(id, body.role as UserRole);
    return NextResponse.json({ user: updated });
  }

  return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
}
