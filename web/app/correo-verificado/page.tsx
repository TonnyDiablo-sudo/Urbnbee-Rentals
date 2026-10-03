import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { getT } from "@/lib/i18n/server";

export default async function EmailVerifiedPage({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const { ok } = await searchParams;
  const t = await getT();
  const success = ok === "1";
  return (
    <>
      <SiteHeader />
      <div className="mx-auto max-w-md px-4 text-center" style={{ paddingTop: 140 }}>
        <p className="text-4xl">{success ? "✅" : "⚠️"}</p>
        <h1 className="mt-4 text-2xl font-semibold text-[#484848]">
          {success ? t("Correo confirmado") : t("El enlace no es válido o ya venció")}
        </h1>
        <p className="mt-2 text-sm text-[#717171]">
          {success
            ? t("Tu cuenta de Cabibee ya está asegurada con tu correo.")
            : t("Inicia sesión y pide otro correo de confirmación desde tu cuenta.")}
        </p>
        <Link href="/" className="mt-6 inline-block rounded-full bg-[#dcb81e] px-6 py-2.5 text-sm font-semibold text-black">
          {t("Ir a Cabibee")}
        </Link>
      </div>
    </>
  );
}
