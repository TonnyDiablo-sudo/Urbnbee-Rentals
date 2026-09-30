import { Suspense } from "react";
import { getT } from "@/lib/i18n/server";
import { AuthForm } from "../auth-form";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Iniciar sesión") };
}

export default function AppLoginPage() {
  return (
    <Suspense>
      <AuthForm mode="login" />
    </Suspense>
  );
}
