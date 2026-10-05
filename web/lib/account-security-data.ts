import "server-only";
import type { AccountSecurityProps } from "@/components/account/account-security-form";
import { getStatsTotalsForListings } from "@/lib/listing-stats-store";
import { getHostProfile, listListingsForHost } from "@/lib/marketplace-store";
import type { UserRecord } from "@/lib/marketplace-types";

export function accountSecurityProps(
  user: UserRecord,
  mode: AccountSecurityProps["mode"],
  doneHref: string
): AccountSecurityProps {
  const listings = listListingsForHost(user.id);
  const totals = getStatsTotalsForListings(listings.map((l) => l.id));
  return {
    mode,
    email: user.placeholderEmail ? "" : user.email,
    emailVerified: Boolean(user.emailVerifiedAt),
    phone: user.phone || getHostProfile(user.id)?.phone || "",
    stats: { listings: listings.length, views: totals.views, contacts: totals.contacts },
    doneHref,
  };
}
