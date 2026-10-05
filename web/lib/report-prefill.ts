import "server-only";
import type { ReportPrefill } from "@/components/reports/report-center";
import { getListingById } from "@/lib/marketplace-store";
import { REPORT_KINDS, type UserReportKind } from "@/lib/user-reports-types";

export type ReportSearchParams = { [k: string]: string | string[] | undefined };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/** `?anuncio=<listingId>&tipo=<kind>&cuenta=<userId>` → formulario ya llenado. */
export function reportPrefillFrom(sp: ReportSearchParams, viewerId: string): ReportPrefill {
  const out: ReportPrefill = {};
  const kind = one(sp.tipo);
  if (REPORT_KINDS.some((k) => k.kind === kind)) out.kind = kind as UserReportKind;
  const listing = getListingById(one(sp.anuncio));
  if (listing && listing.hostId !== viewerId) {
    out.listingId = listing.id;
    out.listingTitle = listing.title;
  }
  const account = one(sp.cuenta);
  if (account && account !== viewerId) out.targetUserId = account;
  return out;
}
