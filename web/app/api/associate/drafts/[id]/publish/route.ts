import { NextRequest, NextResponse } from "next/server";
import { getAssociateFromRequest } from "@/lib/associate-auth";
import { parseDraftEdits } from "@/lib/associate-draft-edits";
import { publishDraft, type PublishTarget } from "@/lib/associate-provision";

export const runtime = "nodejs";

function str(v: unknown, max: number): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.replace(/[<>]/g, "").trim().slice(0, max);
  return t || undefined;
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const associate = await getAssociateFromRequest(req);
  if (!associate) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });

  const parsed = parseDraftEdits(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { contact } = parsed.edits;

  const t = (body.target ?? {}) as Record<string, unknown>;
  let target: PublishTarget;
  if (t.kind === "existing" && typeof t.hostId === "string") {
    target = { kind: "existing", hostId: t.hostId };
  } else {
    target = {
      kind: "new",
      fullName: str(t.fullName, 120) ?? contact.hostName ?? "",
      email: str(t.email, 160),
      phone: str(t.phone, 40) ?? contact.phone,
      whatsapp: str(t.whatsapp, 40) ?? contact.whatsapp,
    };
  }

  const result = await publishDraft({ associate, draftId: id, edits: parsed.edits, target });
  if (!result.ok) {
    return NextResponse.json({ error: result.error, problems: result.problems }, { status: result.status });
  }
  return NextResponse.json(result);
}
