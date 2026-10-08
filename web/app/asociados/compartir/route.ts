import { NextRequest, NextResponse } from "next/server";
import { canUseAssociatePanel } from "@/lib/associate-auth";
import { firstUrlIn } from "@/lib/associate-link-utils";
import { saveShare } from "@/lib/associate-shares";
import { getSessionUser } from "@/lib/session";

export const runtime = "nodejs";

function to(req: NextRequest, path: string) {
  return NextResponse.redirect(new URL(path, req.url), 303);
}

/** Destino del menú Compartir de Android (share_target del manifest de asociados). */
export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return to(req, "/login?next=/asociados/celular&compartido=sin-sesion");
  if (!canUseAssociatePanel(user)) return to(req, "/");

  const form = await req.formData().catch(() => null);
  if (!form) return to(req, "/asociados/capturar?compartido=error");

  const text = String(form.get("text") ?? "");
  const url = String(form.get("url") ?? "").trim() || firstUrlIn(text) || undefined;
  const files = form.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);
  if (!url && !text.trim() && !files.length) return to(req, "/asociados/capturar?compartido=vacio");

  const share = await saveShare(user.id, {
    title: String(form.get("title") ?? ""),
    text: url ? text.replace(url, "") : text,
    url,
    files,
  });
  return to(req, `/asociados/capturar?compartido=${share.id}`);
}

export function GET(req: NextRequest) {
  return to(req, "/asociados/capturar");
}
