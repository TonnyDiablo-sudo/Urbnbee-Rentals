import type { NextRequest } from "next/server";
import { cleaningTeamPartnerView } from "@/lib/beeagent-cleanings";
import { requirePartnerLinkedHost } from "@/lib/beeagent-require-link";
import { partnerIdempotentJson } from "@/lib/beeagent-route-helpers";
import { setListingCleaning } from "@/lib/cleaning-service";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ hostId: string; listingId: string }> };

/** Quién limpia ese anuncio por omisión: {default_cleaner_id: "host"|id|null}. Permiso `cleanings_manage`. */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { hostId, listingId } = await ctx.params;
  const gate = requirePartnerLinkedHost(req, hostId, "cleanings_manage");
  if (!gate.ok) return gate.response;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  return partnerIdempotentJson(req, () => {
    const cleaner = body.default_cleaner_id;
    if (cleaner !== null && typeof cleaner !== "string") {
      return { status: 400, body: { error: "default_cleaner_id es obligatorio (\"host\", id o null)." } };
    }
    const r = setListingCleaning(hostId, listingId, { cleaner });
    if (!r.ok) return { status: r.status, body: { error: r.error } };
    return { status: 200, body: { ok: true, ...cleaningTeamPartnerView(hostId) } };
  });
}
