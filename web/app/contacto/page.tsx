import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return {
    title: t("Contacto"),
    description: t("Escríbenos para dudas, soporte o para modificar o eliminar un anuncio."),
  };
}

export default async function ContactoPage() {
  const t = await getT();
  const help: [string, string][] = [
    ["/como-funciona", "Qué es Cabibee y cómo funciona"],
    ["/como-reservar", "Cómo reservar"],
    ["/terminos", "Términos y condiciones"],
    ["/privacidad", "Aviso de privacidad"],
  ];
  return (
    <>
      <SiteHeader />
      <main className="flex-1 bg-white" style={{ paddingTop: "72px" }}>
        <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
          <h1 className="text-3xl font-semibold text-[#222]">{t("Contacto")}</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-[#555]">
            {t("Escríbenos para quejas, sugerencias, confirmar tu correo o recuperar tu contraseña.")}
          </p>
          <a
            href="mailto:support@cabibee.com"
            className="mt-6 block rounded-2xl bg-[#f7f7f7] px-5 py-4 transition hover:bg-[#f0f0f0]"
          >
            <p className="text-sm text-[#717171]">{t("Correo")}</p>
            <p className="mt-0.5 text-lg font-semibold" style={{ color: "#c9a71a" }}>
              support@cabibee.com
            </p>
          </a>
          <p className="mt-4 text-sm leading-relaxed text-[#555]">
            {t("Si ya tienes cuenta, también puedes escribirle al anfitrión desde el chat de cada anuncio.")}
          </p>
          <h2 className="mt-10 text-lg font-semibold text-[#222]">{t("Ayuda")}</h2>
          <ul className="mt-2 space-y-1">
            {help.map(([href, label]) => (
              <li key={href}>
                <Link href={href} className="text-sm transition hover:text-[#c9a71a]" style={{ color: "#dcb81e" }}>
                  {t(label)}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
