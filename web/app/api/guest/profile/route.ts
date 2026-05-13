import { NextRequest, NextResponse } from "next/server";
import { findUserById, getHostProfile, upsertHostProfile } from "@/lib/marketplace-store";
import { getSessionUser } from "@/lib/session";

/** Perfil huésped: foto/bio en el mismo store que anfitriones (tabla JSON `hostProfiles`). */
export async function GET() {
  const user = await getSessionUser();
  if (!user || user.role !== "guest") {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const profile = getHostProfile(user.id);
  const u = findUserById(user.id);
  return NextResponse.json({
    profile: profile ?? { userId: user.id, bio: "" },
    user: {
      fullName: u?.fullName ?? user.fullName,
      email: user.email,
      phone: u?.phone,
    },
  });
}

export async function PATCH(req: NextRequest) {
  const user = await getSessionUser();
  if (!user || user.role !== "guest") {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const body = await req.json().catch(() => ({}));

  upsertHostProfile(user.id, {
    bio: body.bio !== undefined ? String(body.bio) : undefined,
    whatsapp: body.whatsapp !== undefined ? String(body.whatsapp).trim() : undefined,
    phone: body.phone !== undefined ? String(body.phone).trim() : undefined,
    email: body.contactEmail !== undefined ? String(body.contactEmail).trim() : undefined,
    instagram: body.instagram !== undefined ? String(body.instagram).trim() : undefined,
    website: body.website !== undefined ? String(body.website).trim() : undefined,
  });

  const profile = getHostProfile(user.id)!;
  const u = findUserById(user.id)!;
  return NextResponse.json({
    profile,
    user: { fullName: u.fullName, email: u.email, phone: u.phone },
  });
}
