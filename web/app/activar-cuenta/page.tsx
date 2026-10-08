import { redirect } from "next/navigation";
import { AccountSecurityForm } from "@/components/account/account-security-form";
import { SiteHeader } from "@/components/site-header";
import { accountSecurityProps } from "@/lib/account-security-data";
import { getT } from "@/lib/i18n/server";
import { getSessionUser } from "@/lib/session";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Activa tu cuenta") };
}

export default async function ActivateAccountPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/activar-cuenta");
  const home = user.associate ? "/asociados" : "/host/listings";
  if (!user.mustChangePassword) redirect(user.associate ? "/asociados" : "/host/dashboard");
  return (
    <>
      <SiteHeader />
      <div className="mx-auto max-w-md px-4 pb-16" style={{ paddingTop: 104 }}>
        <AccountSecurityForm {...accountSecurityProps(user, "activate", home)} />
      </div>
    </>
  );
}
