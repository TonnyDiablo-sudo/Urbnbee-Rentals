import { ForgotPasswordForm } from "@/components/account/password-reset-forms";
import { TopBar } from "../../_components/top-bar";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("¿Olvidaste tu contraseña?") };
}

export default function AppRecuperarPage() {
  return (
    <>
      <TopBar title="" back="/cuenta/entrar" />
      <div className="px-6 pb-10 pt-2">
        <ForgotPasswordForm app />
      </div>
    </>
  );
}
