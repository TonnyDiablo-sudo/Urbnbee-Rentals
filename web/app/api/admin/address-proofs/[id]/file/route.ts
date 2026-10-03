import { NextResponse } from "next/server";
import { getAddressProof, readAddressProofFile } from "@/lib/address-proof-store";
import { getSessionUser } from "@/lib/session";

/** El comprobante sólo lo ve el equipo: nunca se sirve como archivo público. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (user?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await ctx.params;
  const proof = getAddressProof(id);
  const buf = proof ? readAddressProofFile(proof) : null;
  if (!proof || !buf) return NextResponse.json({ error: "No encontrado." }, { status: 404 });
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": proof.mime,
      "Cache-Control": "private, no-store",
      "Content-Disposition": `inline; filename="${proof.fileName}"`,
    },
  });
}
