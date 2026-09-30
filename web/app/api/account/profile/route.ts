import { NextRequest, NextResponse } from "next/server";
import { findUserById, getHostProfile, updateUser, upsertHostProfile } from "@/lib/marketplace-store";
import type { HostProfileRecord } from "@/lib/marketplace-types";
import { PROFILE_INTERESTS, PROFILE_LANGUAGES, PROFILE_MAX_CHIPS } from "@/lib/profile-options";
import { getSessionUser } from "@/lib/session";

/** Perfil público de cualquier cuenta (huésped o anfitrión): foto, bio, trabajo, idiomas e intereses. */
function payload(userId: string, email: string) {
  const u = findUserById(userId);
  const p = getHostProfile(userId);
  return {
    user: {
      fullName: u?.fullName ?? "",
      email,
      phone: u?.phone ?? "",
      addressLine: u?.addressLine ?? "",
      role: u?.role,
    },
    profile: {
      bio: p?.bio ?? "",
      avatarUrl: p?.avatarUrl ?? "",
      work: p?.work ?? "",
      livesIn: p?.livesIn ?? "",
      languages: p?.languages ?? [],
      interests: p?.interests ?? [],
    },
  };
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  return NextResponse.json(payload(user.id, user.email));
}

function text(v: unknown, max: number): string | undefined {
  if (v === undefined) return undefined;
  return String(v ?? "").replace(/[<>]/g, "").trim().slice(0, max);
}

function chips(v: unknown, allowed: string[]): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const set = new Set(allowed);
  return [...new Set(v.map(String).filter((x) => set.has(x)))].slice(0, PROFILE_MAX_CHIPS);
}

export async function PATCH(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const fullName = text(body.fullName, 120);
  if (fullName !== undefined && fullName.length < 2) {
    return NextResponse.json({ error: "Escribe tu nombre." }, { status: 400 });
  }
  const account: Parameters<typeof updateUser>[1] = {};
  if (fullName !== undefined) account.fullName = fullName;
  const phone = text(body.phone, 30);
  if (phone !== undefined) account.phone = phone.replace(/[^\d+\s-]/g, "");
  const addressLine = text(body.addressLine, 240);
  if (addressLine !== undefined) account.addressLine = addressLine;
  if (Object.keys(account).length) updateUser(user.id, account);

  const profile: Partial<Omit<HostProfileRecord, "userId">> = {};
  const bio = text(body.bio, 1000);
  if (bio !== undefined) profile.bio = bio;
  const work = text(body.work, 80);
  if (work !== undefined) profile.work = work;
  const livesIn = text(body.livesIn, 80);
  if (livesIn !== undefined) profile.livesIn = livesIn;
  const languages = chips(body.languages, PROFILE_LANGUAGES);
  if (languages) profile.languages = languages;
  const interests = chips(body.interests, PROFILE_INTERESTS);
  if (interests) profile.interests = interests;
  if (Object.keys(profile).length) upsertHostProfile(user.id, profile);

  return NextResponse.json({ ok: true, ...payload(user.id, user.email) });
}
