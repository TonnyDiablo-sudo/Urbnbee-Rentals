import { Suspense } from "react";
import { NewPasswordForm } from "@/components/account/password-reset-forms";
import { TopBar } from "../../../_components/top-bar";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Elige una contraseña nueva") };
}

export default function AppRecuperarNuevaPage() {
  return (
    <>
      <TopBar title="" back="/cuenta/entrar" />
      <div className="px-6 pb-10 pt-2">
        <Suspense>
          <NewPasswordForm app />
        </Suspense>
      </div>
    </>
  );
}
