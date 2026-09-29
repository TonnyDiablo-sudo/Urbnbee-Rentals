import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { requestProto, siteHostFromAppHost } from "@/lib/app-host";
import { getSessionUser } from "@/lib/session";
import { AppShell, type AppUser } from "./_components/app-shell";
import { SiteOriginProvider } from "./_components/site-origin";

export const metadata: Metadata = {
  title: { default: "Cabibee", template: "%s · Cabibee" },
  applicationName: "Cabibee",
  appleWebApp: { capable: true, title: "Cabibee", statusBarStyle: "default" },
  icons: {
    icon: "/app-icons/icon-192.png",
    apple: "/app-icons/apple-touch-icon.png",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const u = await getSessionUser();
  const user: AppUser = u ? { id: u.id, fullName: u.fullName, email: u.email, role: u.role } : null;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3005";
  const siteHost = siteHostFromAppHost(host);
  const siteOrigin = `${requestProto(h.get("x-forwarded-proto"), siteHost)}://${siteHost}`;
  return (
    <SiteOriginProvider origin={siteOrigin}>
      <AppShell user={user}>{children}</AppShell>
    </SiteOriginProvider>
  );
}
