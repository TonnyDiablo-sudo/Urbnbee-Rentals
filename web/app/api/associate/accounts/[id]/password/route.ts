import { NextRequest, NextResponse } from "next/server";
import { getAssociateFromRequest } from "@/lib/associate-auth";
import { resetTempPassword } from "@/lib/associate-provision";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const associate = await getAssociateFromRequest(req);
  if (!associate) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  const { id } = await ctx.params;
  const result = await resetTempPassword(associate, id);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 403 });
  return NextResponse.json(result);
}
