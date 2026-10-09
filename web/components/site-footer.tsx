"use client";

import { useT } from "@/components/i18n-provider";
import { LangSwitch } from "@/components/lang-switch";

export function SiteFooter() {
  const t = useT();
  return (
    <footer className="bg-white border-t py-12" style={{ borderColor: "#ebebeb" }}>
      <div className="mx-auto max-w-7xl space-y-6 px-4 sm:px-6 lg:px-8">
        <p className="text-sm leading-relaxed text-[#3a3a3a]">
          {t("La información en este directorio ha sido proporcionada por los anfitriones o recopilada de fuentes públicas con autorización. Si eres el propietario de un alojamiento y deseas modificar o eliminar tu perfil, contáctanos.")}{" "}
          {t("Cabibee se compromete a ofrecer un alto nivel de experiencia, servicio al cliente y atención al detalle en el mercado de reservas de alojamiento.")}
        </p>
        <div className="flex flex-col gap-6 sm:flex-row sm:justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[#484848]">{t("Contacto")}</h3>
            <a
              href="mailto:support@cabibee.com"
              className="mt-1 block text-sm transition hover:text-[#c9a71a]"
              style={{ color: "#dcb81e" }}
            >
              support@cabibee.com
            </a>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#484848]">{t("Ayuda")}</h3>
            {[
              ["/como-funciona", "Qué es Cabibee y cómo funciona"],
              ["/como-reservar", "Cómo reservar"],
              ["/terminos", "Términos y condiciones"],
              ["/privacidad", "Aviso de privacidad"],
            ].map(([href, label]) => (
              <a
                key={href}
                href={href}
                className="mt-1 block text-sm transition hover:text-[#c9a71a]"
                style={{ color: "#dcb81e" }}
              >
                {t(label)}
              </a>
            ))}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#484848]">{t("App Cabibee")}</h3>
            <a
              href="/app"
              className="mt-1 block text-sm transition hover:text-[#c9a71a]"
              style={{ color: "#dcb81e" }}
            >
              {t("Instálala en tu celular")}
            </a>
            <p className="mt-0.5 text-xs text-[#717171]">{t("Busca, chatea y administra tus anuncios desde el teléfono.")}</p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#484848]">{t("Síguenos:")}</h3>
            <p className="mt-1 text-sm text-[#3a3a3a]">{t("Redes sociales próximamente")}</p>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[#484848]">{t("Idioma")}</h3>
            <LangSwitch className="mt-2" />
          </div>
        </div>
        <p className="text-xs text-[#3a3a3a]">
          {t("Todos los derechos reservados: Cabibee® {year}.", { year: new Date().getFullYear() })}
        </p>
      </div>
    </footer>
  );
}
