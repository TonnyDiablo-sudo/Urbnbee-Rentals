import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";

// In-memory store for dev (replace with DB in production)
const viewCounts: Record<string, number> = {};

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Inicia sesión para registrar la consulta.", needsLogin: true }, { status: 401 });
  }

  const { id } = await params;
  viewCounts[id] = (viewCounts[id] ?? 0) + 1;

  // TODO: persist to DB
  // await db.query("INSERT INTO listing_contact_views (listing_id, viewed_at) VALUES (?, NOW())", [id]);

  console.log(`[contact-view] listing ${id} → total views: ${viewCounts[id]}`);

  return NextResponse.json({ ok: true, views: viewCounts[id] });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return NextResponse.json({ views: viewCounts[id] ?? 0 });
}
