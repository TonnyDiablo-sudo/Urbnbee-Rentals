import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { lockLegalName } from "@/lib/display-name";
import { findUserById, setUserRole, updateUserAuth } from "@/lib/marketplace-store";
import type { UserRole } from "@/lib/marketplace-types";
import {
  getVerification,
  grantComplimentaryBookingPass,
  markGuestIdentityVerified,
} from "@/lib/verification-store";

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

  const body = (await request.json()) as {
    role?: string;
    grantPass?: boolean;
    verifyGuestIdentity?: boolean;
    associate?: boolean;
  };
  if (typeof body.associate === "boolean") {
    const updated = updateUserAuth(id, {
      associate: body.associate || undefined,
      ...(body.associate ? {} : { associateTokenHash: undefined }),
    });
    return NextResponse.json({ ok: true, associate: Boolean(updated?.associate) });
  }
  if (body.verifyGuestIdentity) {
    const v = markGuestIdentityVerified(id);
    lockLegalName(id);
    return NextResponse.json({ ok: true, kycStatus: v.kycStatus });
  }
  if (body.grantPass) {
    grantComplimentaryBookingPass(id, "admin");
    const v = getVerification(id);
    return NextResponse.json({
      ok: true,
      bookingPassesRemaining: v?.bookingPassesRemaining ?? 0,
    });
  }
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
