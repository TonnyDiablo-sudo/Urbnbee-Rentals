import { Suspense } from "react";
import { AuthForm } from "../auth-form";

export const metadata = { title: "Crear cuenta" };

export default function AppRegisterPage() {
  return (
    <Suspense>
      <AuthForm mode="register" />
    </Suspense>
  );
}
