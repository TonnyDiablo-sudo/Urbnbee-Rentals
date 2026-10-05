import { appCore } from "./app-core";
import { appGuest } from "./app-guest";
import { appHost } from "./app-host";
import { appHostTools } from "./app-host-tools";
import { appNotificationsTax } from "./app-notifications-tax";
import { appProfileContracts } from "./app-profile-contracts";
import { appPay } from "./app-pay";
import { appSearchDiscounts } from "./app-search-discounts";
import { common } from "./common";
import { siteAccount } from "./site-account";
import { siteHome } from "./site-home";
import { siteHost } from "./site-host";
import { siteHostListings } from "./site-host-listings";
import { siteListing } from "./site-listing";
import { appToolsStore } from "./app-tools-store";
import { appWishlists } from "./app-wishlists";
import { auditFill } from "./audit-fill";
import { appHelpLegal } from "./app-help-legal";
import { appReports } from "./app-reports";
import { billingAccount } from "./billing-account";
import { listingSetup } from "./listing-setup";
import { trustMedia } from "./trust-media";
import { listingQuick } from "./listing-quick";
import { emails } from "./emails";
import { admin } from "./admin";
import { associates } from "./associates";
import { longStay } from "./long-stay";
import { reviewsPhoneMail } from "./reviews-phone-mail";
import { monthlyCharge } from "./monthly-charge";
import { verificationRecheck } from "./verification-recheck";
import { teamTools } from "./team-tools";
import { contractPayment } from "./contract-payment";
import { addressIncluded } from "./address-included";

/** Clave: el texto exacto en español que aparece en el código. */
export const EN: Record<string, string> = {
  ...auditFill,
  ...common,
  ...appCore,
  ...appGuest,
  ...appHost,
  ...siteHome,
  ...siteListing,
  ...siteAccount,
  ...siteHost,
  ...siteHostListings,
  ...appHostTools,
  ...appProfileContracts,
  ...appNotificationsTax,
  ...appSearchDiscounts,
  ...appPay,
  ...appToolsStore,
  ...appWishlists,
  ...appHelpLegal,
  ...appReports,
  ...billingAccount,
  ...listingSetup,
  ...trustMedia,
  ...listingQuick,
  ...emails,
  ...admin,
  ...associates,
  ...longStay,
  ...reviewsPhoneMail,
  ...monthlyCharge,
  ...verificationRecheck,
  ...teamTools,
  ...contractPayment,
  ...addressIncluded,
};
