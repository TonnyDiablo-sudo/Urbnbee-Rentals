import { redirect } from "next/navigation";
import { AccountSecurityForm } from "@/components/account/account-security-form";
import { accountSecurityProps } from "@/lib/account-security-data";
import { getT } from "@/lib/i18n/server";
import { getSessionUser } from "@/lib/session";
import { TopBar } from "../../_components/top-bar";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Activa tu cuenta") };
}

export default async function AppActivateAccountPage() {
  const user = await getSessionUser();
  if (!user) redirect("/cuenta/entrar?next=/cuenta/activar");
  if (!user.mustChangePassword) redirect("/host");
  return (
    <>
      <TopBar title="" />
      <div className="px-6 pb-10 pt-2">
        <AccountSecurityForm {...accountSecurityProps(user, "activate", "/host/estadisticas")} />
      </div>
    </>
  );
}
