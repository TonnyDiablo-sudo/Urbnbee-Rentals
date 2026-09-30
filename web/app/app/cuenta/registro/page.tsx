import { Suspense } from "react";
import { getT } from "@/lib/i18n/server";
import { AuthForm } from "../auth-form";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Crear cuenta") };
}

export default function AppRegisterPage() {
  return (
    <Suspense>
      <AuthForm mode="register" />
    </Suspense>
  );
}
