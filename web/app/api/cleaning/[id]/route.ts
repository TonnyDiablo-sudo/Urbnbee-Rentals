import { NextRequest, NextResponse } from "next/server";
import { assignCleaningTask, updateCleaningByActor } from "@/lib/cleaning-service";
import { getSessionUser } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

/** El anfitrión asigna; el anfitrión o quien limpia marca como hecha o deja nota. */
export async function PATCH(req: NextRequest, ctx: Ctx) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as {
    assignee?: string | null;
    done?: boolean;
    note?: string;
    cancel?: boolean;
  };
  if (body.assignee !== undefined) {
    const r = assignCleaningTask(user.id, id, body.assignee);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  }
  if (body.done !== undefined || body.note !== undefined || body.cancel) {
    const r = updateCleaningByActor(user.id, id, {
      done: typeof body.done === "boolean" ? body.done : undefined,
      note: body.note,
      cancel: Boolean(body.cancel),
    });
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
  }
  return NextResponse.json({ ok: true });
}
