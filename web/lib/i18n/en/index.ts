import { appCore } from "./app-core";
import { appGuest } from "./app-guest";
import { appHost } from "./app-host";
import { appHostTools } from "./app-host-tools";
import { appNotificationsTax } from "./app-notifications-tax";
import { appProfileContracts } from "./app-profile-contracts";
import { common } from "./common";
import { siteAccount } from "./site-account";
import { siteHome } from "./site-home";
import { siteHost } from "./site-host";
import { siteHostListings } from "./site-host-listings";
import { siteListing } from "./site-listing";

/** Clave: el texto exacto en español que aparece en el código. */
export const EN: Record<string, string> = {
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
};
