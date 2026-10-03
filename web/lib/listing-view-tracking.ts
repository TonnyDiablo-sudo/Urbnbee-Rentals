import "server-only";
import { headers } from "next/headers";
import { recordListingView, viewerKeyFrom } from "@/lib/listing-stats-store";
import type { HostListingRecord, UserRecord } from "@/lib/marketplace-types";

/** Cuenta la vista de un anuncio de anfitrión real (no los de muestra), sin contar al dueño. */
export async function trackListingView(record: HostListingRecord | undefined, viewer: UserRecord | null) {
  if (!record?.published || viewer?.id === record.hostId) return;
  const h = await headers();
  const ip = (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip");
  recordListingView(record.id, viewerKeyFrom({ userId: viewer?.id, ip, ua: h.get("user-agent") }));
}
