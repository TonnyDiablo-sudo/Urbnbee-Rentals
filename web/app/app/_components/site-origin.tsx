"use client";

import { createContext, useContext } from "react";
import { IconExternal } from "./icons";

const SiteOriginContext = createContext("");

export function SiteOriginProvider({ origin, children }: { origin: string; children: React.ReactNode }) {
  return <SiteOriginContext.Provider value={origin}>{children}</SiteOriginContext.Provider>;
}

/** La app corre en app.cabibee.com: lo que vive en el sitio necesita URL absoluta. */
export function useSiteUrl(): (path: string) => string {
  const origin = useContext(SiteOriginContext);
  return (path) => `${origin}${path}`;
}

type WebLinkProps = Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  path: string;
  /** Muestra el ícono de "se abre fuera". */
  icon?: boolean;
};

export function WebLink({ path, icon, children, ...rest }: WebLinkProps) {
  const siteUrl = useSiteUrl();
  return (
    <a href={siteUrl(path)} target="_blank" rel="noopener" {...rest}>
      {children}
      {icon && <IconExternal />}
    </a>
  );
}
