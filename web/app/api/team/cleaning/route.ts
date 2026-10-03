import { NextResponse } from "next/server";
import { cleanerTasksView } from "@/lib/cleaning-service";
import { getSessionUser } from "@/lib/session";

/** Limpiezas asignadas a la persona en los equipos donde colabora. */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  return NextResponse.json({ groups: cleanerTasksView(user) });
}
