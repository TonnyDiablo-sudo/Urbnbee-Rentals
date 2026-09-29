import { NextRequest, NextResponse } from "next/server";
import {
  grantHostVerification,
  hostVerificationSummary,
  revokeHostVerification,
  setHostMembershipActive,
} from "@/lib/host-verification";
import { findUserById } from "@/lib/marketplace-store";
import { getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

/**
 * Concede o revoca identidad y/o membresía de anfitrión.
 *
 * El listón público pide las dos. Se pueden mover por separado para poder probar
 * que una sola no basta, y para verificar documentos cuando Stripe Identity no está.
 */
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const actor = await getSessionUser();
  if (!actor || actor.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await ctx.params;
  const target = findUserById(id);
  if (!target) {
    return NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    verified?: unknown;
    membership?: unknown;
  };

  let listingsUpdated = 0;

  if (typeof body.verified === "boolean") {
    const r = body.verified
      ? grantHostVerification(id, "admin")
      : revokeHostVerification(id);
    listingsUpdated = r.listingsUpdated;
  }

  if (typeof body.membership === "boolean") {
    const end = new Date();
    end.setMonth(end.getMonth() + 12);
    const r = setHostMembershipActive(id, body.membership, {
      periodEnd: body.membership ? end.toISOString() : undefined,
      subscriptionId: body.membership ? "admin" : undefined,
    });
    listingsUpdated = r.listingsUpdated;
  }

  if (typeof body.verified !== "boolean" && typeof body.membership !== "boolean") {
    return NextResponse.json(
      { error: "Manda «verified» y/o «membership» (true o false)." },
      { status: 400 }
    );
  }

  console.info("[admin] anfitrión", {
    admin: actor.email,
    host: target.email,
    verified: body.verified,
    membership: body.membership,
    anunciosActualizados: listingsUpdated,
  });

  return NextResponse.json({
    ok: true,
    listingsUpdated,
    verification: hostVerificationSummary(id),
  });
}
