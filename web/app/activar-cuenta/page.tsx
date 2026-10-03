import { redirect } from "next/navigation";
import { AccountSecurityForm } from "@/components/account/account-security-form";
import { SiteHeader } from "@/components/site-header";
import { accountSecurityProps } from "@/lib/account-security-data";
import { getSessionUser } from "@/lib/session";

export const metadata = { title: "Activa tu cuenta · Cabibee" };

export default async function ActivateAccountPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/activar-cuenta");
  if (!user.mustChangePassword) redirect("/host/dashboard");
  return (
    <>
      <SiteHeader />
      <div className="mx-auto max-w-md px-4 pb-16" style={{ paddingTop: 104 }}>
        <AccountSecurityForm {...accountSecurityProps(user, "activate", "/host/listings")} />
      </div>
    </>
  );
}
