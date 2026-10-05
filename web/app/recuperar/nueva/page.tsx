import { Suspense } from "react";
import { SiteHeader } from "@/components/site-header";
import { NewPasswordForm } from "@/components/account/password-reset-forms";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Elige una contraseña nueva") };
}

export default function RecuperarNuevaPage() {
  return (
    <>
      <SiteHeader />
      <div className="mx-auto max-w-md px-4" style={{ paddingTop: 120 }}>
        <Suspense>
          <NewPasswordForm />
        </Suspense>
      </div>
    </>
  );
}
