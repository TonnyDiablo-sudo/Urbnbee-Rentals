import { NextRequest, NextResponse } from "next/server";
import { getAssociateFromRequest } from "@/lib/associate-auth";
import type { DraftContact } from "@/lib/associate-drafts-store";
import { publishDraft, type PublishTarget } from "@/lib/associate-provision";
import { validateListingImportPayload } from "@/lib/listing-import-llm";

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

  let listing;
  try {
    listing = validateListingImportPayload(body.listing);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Datos inválidos." }, { status: 400 });
  }

  const c = (body.contact ?? {}) as Record<string, unknown>;
  const contact: DraftContact = {
    hostName: str(c.hostName, 120),
    phone: str(c.phone, 40),
    whatsapp: str(c.whatsapp, 40),
    email: str(c.email, 160)?.toLowerCase(),
  };

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

  const photos = Array.isArray(body.photos) ? body.photos.filter((p): p is string => typeof p === "string") : [];
  const result = await publishDraft({ associate, draftId: id, listing, contact, photos, target });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result);
}
