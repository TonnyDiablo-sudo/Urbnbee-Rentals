import type { Metadata, Viewport } from "next";
import { getSessionUser } from "@/lib/session";
import { AppShell, type AppUser } from "./_components/app-shell";

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
  return <AppShell user={user}>{children}</AppShell>;
}
