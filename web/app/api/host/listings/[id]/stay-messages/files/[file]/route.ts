import { NextRequest, NextResponse } from "next/server";
import { getListingById } from "@/lib/marketplace-store";
import { getSessionUser } from "@/lib/session";
import { readStayMessageFile } from "@/lib/stay-messages";

export const runtime = "nodejs";

/** Vista previa de una foto o audio de la plantilla, sólo para el anfitrión. */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string; file: string }> }) {
  const user = await getSessionUser();
  const { id, file } = await ctx.params;
  const listing = getListingById(id);
  if (!user || !listing || (listing.hostId !== user.id && user.role !== "admin")) {
    return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  }
  const found = await readStayMessageFile(listing.id, file);
  if (!found) return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  return new NextResponse(new Uint8Array(found.data), {
    headers: {
      "content-type": found.mime,
      "content-length": String(found.data.byteLength),
      "cache-control": "private, max-age=86400",
      "x-content-type-options": "nosniff",
    },
  });
}
