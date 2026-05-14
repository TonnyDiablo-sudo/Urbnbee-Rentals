import type { NextRequest } from "next/server";
import { findUserById, getHostProfile } from "@/lib/marketplace-store";
import {
  getPartnerApiSecret,
  partnerJson,
  partnerNotConfiguredResponse,
  verifyPartnerBearer,
  partnerAuthErrorResponse,
} from "@/lib/beeagent-partner";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ hostId: string }> };

function publicUser(u: NonNullable<ReturnType<typeof findUserById>>) {
  return {
    id: u.id,
    fullName: u.fullName,
    role: u.role,
    createdAt: u.createdAt,
  };
}

export async function GET(req: NextRequest, ctx: Ctx) {
  if (!getPartnerApiSecret()) return partnerNotConfiguredResponse(req);
  if (!verifyPartnerBearer(req)) return partnerAuthErrorResponse(req);

  const { hostId } = await ctx.params;
  const user = findUserById(hostId);
  if (!user || user.role !== "host") {
    return partnerJson({ error: "Anfitrión no encontrado." }, req, { status: 404 });
  }
  const profile = getHostProfile(hostId);
  return partnerJson({ user: publicUser(user), profile: profile ?? null }, req);
}
