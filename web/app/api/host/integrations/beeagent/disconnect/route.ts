import { NextResponse } from "next/server";
import { deleteBeeagentHostLink, getBeeagentLinkForHost } from "@/lib/beeagent-host-link-store";
import { enqueueHostUnlinked } from "@/lib/beeagent-outbound";
import { getSessionUser } from "@/lib/session";

export async function POST() {
  const user = await getSessionUser();
  if (!user || (user.role !== "host" && user.role !== "admin")) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }
  const prev = getBeeagentLinkForHost(user.id);
  if (prev) {
    enqueueHostUnlinked(prev.hostId, prev.beeagentCustomerId);
    deleteBeeagentHostLink(user.id);
  }
  return NextResponse.json({ ok: true, unlinked: Boolean(prev) });
}
