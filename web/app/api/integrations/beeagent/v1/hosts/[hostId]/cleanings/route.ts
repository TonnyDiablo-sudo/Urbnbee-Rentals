import type { NextRequest } from "next/server";
import { isIsoDate } from "@/lib/beeagent-iso-date";
import { partnerJson } from "@/lib/beeagent-partner";
import { requirePartnerLinkedHost } from "@/lib/beeagent-require-link";
import { partnerIdempotentJson } from "@/lib/beeagent-route-helpers";
import { cleanersPartnerView, cleaningPartnerView } from "@/lib/beeagent-cleanings";
import { addManualCleaning } from "@/lib/cleaning-service";
import { listCleaningTasksForHost } from "@/lib/cleaning-store";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ hostId: string }> };

/** Limpiezas del anfitrión: ?from=&to= (YYYY-MM-DD), ?listingId=, ?status=pending|done|cancelled. */
export async function GET(req: NextRequest, ctx: Ctx) {
  const { hostId } = await ctx.params;
  const gate = requirePartnerLinkedHost(req, hostId, "cleanings_view");
  if (!gate.ok) return gate.response;

  const q = req.nextUrl.searchParams;
  const from = q.get("from")?.trim() ?? "";
  const to = q.get("to")?.trim() ?? "";
  const listingId = q.get("listingId")?.trim() ?? "";
  const status = q.get("status")?.trim() ?? "";

  const rows = listCleaningTasksForHost(hostId)
    .filter((t) => !isIsoDate(from) || t.date >= from)
    .filter((t) => !isIsoDate(to) || t.date <= to)
    .filter((t) => !listingId || t.listingId === listingId)
    .filter((t) => !status || t.status === status)
    .sort((a, b) => a.date.localeCompare(b.date));

  return partnerJson(
    {
      host_id: hostId,
      count: rows.length,
      cleanings: rows.map(cleaningPartnerView),
      cleaners: cleanersPartnerView(hostId),
    },
    req
  );
}

/** Limpieza extra que no viene de una reserva: {listing_id, date, note?, assignee_id?}. Permiso `cleanings_manage`. */
export async function POST(req: NextRequest, ctx: Ctx) {
  const { hostId } = await ctx.params;
  const gate = requirePartnerLinkedHost(req, hostId, "cleanings_manage");
  if (!gate.ok) return gate.response;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  return partnerIdempotentJson(req, () => {
    const before = new Set(listCleaningTasksForHost(hostId).map((t) => t.id));
    const r = addManualCleaning(hostId, {
      listingId: body.listing_id,
      date: body.date,
      note: body.note,
      assignee: body.assignee_id,
    });
    if (!r.ok) return { status: r.status, body: { error: r.error } };
    const created = listCleaningTasksForHost(hostId).find((t) => !before.has(t.id));
    return { status: 201, body: { ok: true, cleaning: created ? cleaningPartnerView(created) : null } };
  });
}
