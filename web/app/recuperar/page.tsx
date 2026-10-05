import { SiteHeader } from "@/components/site-header";
import { ForgotPasswordForm } from "@/components/account/password-reset-forms";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("¿Olvidaste tu contraseña?") };
}

export default function RecuperarPage() {
  return (
    <>
      <SiteHeader />
      <div className="mx-auto max-w-md px-4" style={{ paddingTop: 120 }}>
        <ForgotPasswordForm />
      </div>
    </>
  );
}
