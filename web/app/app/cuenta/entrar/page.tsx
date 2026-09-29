import { Suspense } from "react";
import { AuthForm } from "../auth-form";

export const metadata = { title: "Iniciar sesión" };

export default function AppLoginPage() {
  return (
    <Suspense>
      <AuthForm mode="login" />
    </Suspense>
  );
}
