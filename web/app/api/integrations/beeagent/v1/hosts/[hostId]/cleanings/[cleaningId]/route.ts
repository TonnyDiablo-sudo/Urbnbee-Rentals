import type { NextRequest } from "next/server";
import { cleaningPartnerView } from "@/lib/beeagent-cleanings";
import { partnerJson } from "@/lib/beeagent-partner";
import { requirePartnerLinkedHost } from "@/lib/beeagent-require-link";
import { partnerIdempotentJson } from "@/lib/beeagent-route-helpers";
import { assignCleaningTask, rescheduleCleaning, updateCleaningByActor } from "@/lib/cleaning-service";
import { getCleaningTask } from "@/lib/cleaning-store";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ hostId: string; cleaningId: string }> };

/**
 * Organizar una limpieza: {status?: "done"|"pending"|"cancelled", note?, assignee_id?: "host"|id|null,
 * date?: "YYYY-MM-DD", time?: "HH:MM"|null}.
 * Permiso `cleanings_manage`.
 */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { hostId, cleaningId } = await ctx.params;
  const gate = requirePartnerLinkedHost(req, hostId, "cleanings_manage");
  if (!gate.ok) return gate.response;
  const task = getCleaningTask(cleaningId);
  if (!task || task.hostId !== hostId) return partnerJson({ error: "Limpieza no encontrada." }, req, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  return partnerIdempotentJson(req, () => {
    if (body.assignee_id === null || typeof body.assignee_id === "string") {
      if (task.status !== "pending") {
        return { status: 409, body: { error: "La limpieza ya está cerrada.", code: "closed" } };
      }
      const r = assignCleaningTask(hostId, cleaningId, body.assignee_id || null);
      if (!r.ok) return { status: r.status, body: { error: r.error } };
    }
    if (body.date !== undefined || body.time !== undefined) {
      const r = rescheduleCleaning(hostId, cleaningId, { date: body.date, time: body.time });
      if (!r.ok) return { status: r.status, body: { error: r.error } };
    }
    const status = typeof body.status === "string" ? body.status : "";
    if (status && status !== "done" && status !== "pending" && status !== "cancelled") {
      return { status: 400, body: { error: "status debe ser done, pending o cancelled." } };
    }
    if (status || typeof body.note === "string") {
      const r = updateCleaningByActor(hostId, cleaningId, {
        done: status === "done" ? true : status === "pending" ? false : undefined,
        cancel: status === "cancelled",
        note: body.note,
      });
      if (!r.ok) return { status: r.status, body: { error: r.error } };
    }
    const fresh = getCleaningTask(cleaningId);
    return { status: 200, body: { ok: true, cleaning: fresh ? cleaningPartnerView(fresh) : null } };
  });
}
