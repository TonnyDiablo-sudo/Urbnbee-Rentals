import { redirect } from "next/navigation";
import { AccountSecurityForm } from "@/components/account/account-security-form";
import { accountSecurityProps } from "@/lib/account-security-data";
import { getT } from "@/lib/i18n/server";
import { getSessionUser } from "@/lib/session";
import { TopBar } from "../../_components/top-bar";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Correo y contraseña") };
}

export default async function AppAccountSecurityPage() {
  const user = await getSessionUser();
  if (!user) redirect("/cuenta/entrar?next=/cuenta/seguridad");
  if (user.mustChangePassword) redirect("/cuenta/activar");
  const t = await getT();
  return (
    <>
      <TopBar title={t("Correo y contraseña")} back="/perfil" />
      <div className="px-6 pb-10 pt-4">
        <AccountSecurityForm {...accountSecurityProps(user, "security", "/perfil")} />
      </div>
    </>
  );
}
