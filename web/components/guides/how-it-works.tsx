"use client";

import Link from "next/link";
import { useT } from "@/components/i18n-provider";

const PILLARS = [
  {
    icon: "🆓",
    title: "Gratis para todos",
    text: "Publicar, buscar, ver contactos y chatear no cuesta nada. No cobramos comisión por reserva ni al anfitrión ni al huésped.",
  },
  {
    icon: "🤝",
    title: "Trato directo",
    text: "El anfitrión y el huésped hablan y acuerdan directo, sin intermediarios que se queden con una parte.",
  },
  {
    icon: "🛡️",
    title: "Capas de seguridad",
    text: "Verificación de identidad y de domicilio, contratos firmados y pagos dentro de la plataforma, para quien las quiera.",
  },
  {
    icon: "⚙️",
    title: "Herramientas de operación",
    text: "Reservas en línea, calendario, limpieza y equipo de trabajo para que rentar sea más fácil.",
  },
];

const STEPS_GUEST = [
  "Busca por zona, fechas y filtros (precio, amenidades).",
  "Revisa las etiquetas del anuncio y del anfitrión.",
  "Contacta al anfitrión por chat o reserva en línea si el anuncio lo permite.",
  "Firma el contrato antes de llegar y guarda todo en Cabibee.",
];

const STEPS_HOST = [
  "Crea tu cuenta y publica tu espacio gratis.",
  "Recibe mensajes de huéspedes y responde desde la app.",
  "Si quieres, activa herramientas de la Tienda: verificación, reservas en línea, limpieza o colaboradores.",
  "Prepara tu contrato con nuestras plantillas y ajústalo a tu caso.",
];

const SERVICES = [
  {
    title: "Verificación de identidad",
    text: "Validación de identificación oficial con selfie. Una sola por persona: sirve como anfitrión y como huésped, y da la etiqueta «Miembro verificado».",
  },
  { title: "Ubicación verificada", text: "Comprobamos que la dirección del anuncio existe y que la propiedad es tuya o la administras." },
  { title: "Motor de reservas", text: "El huésped reserva y paga en línea, firma el contrato y todo queda registrado." },
  { title: "Limpieza", text: "Limpiezas automáticas según tus reservas, con asignación y fotos al terminar." },
  { title: "Colaboradores", text: "Da acceso a tu equipo con roles: mensajes, reservas, limpieza o firma de contratos." },
];

export function HowItWorks({ exploreHref, bookHref, storeHref }: { exploreHref: string; bookHref: string; storeHref?: string }) {
  const t = useT();
  return (
    <div className="text-[#222]">
      <p className="text-[13px] font-semibold uppercase tracking-wide text-[#a88a12]">{t("Qué es Cabibee")}</p>
      <h1 className="mt-1 text-[28px] font-bold leading-tight sm:text-4xl">{t("Rentar directo, fácil y seguro. Gratis, para la raza.")}</h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[#555] sm:text-base">
        {t(
          "Cabibee es una plataforma gratuita que conecta a anfitriones con huéspedes. Nuestra intención es que rentar sea accesible para todos: sin comisiones, con el contacto a la vista y con capas de seguridad y operación para quien las necesite."
        )}
      </p>

      <div className="mt-7 grid gap-3 sm:grid-cols-2">
        {PILLARS.map((p) => (
          <div key={p.title} className="rounded-2xl border border-[#ebebeb] p-4">
            <p className="text-2xl" aria-hidden>
              {p.icon}
            </p>
            <p className="mt-2 text-[16px] font-semibold">{t(p.title)}</p>
            <p className="mt-1 text-sm leading-relaxed text-[#555]">{t(p.text)}</p>
          </div>
        ))}
      </div>

      <div className="mt-9 grid gap-8 sm:grid-cols-2">
        {[
          { title: "Si buscas dónde quedarte", steps: STEPS_GUEST },
          { title: "Si rentas tu espacio", steps: STEPS_HOST },
        ].map((col) => (
          <section key={col.title}>
            <h2 className="text-xl font-semibold">{t(col.title)}</h2>
            <ol className="mt-3 space-y-2.5">
              {col.steps.map((s, i) => (
                <li key={s} className="flex gap-3 text-[15px] leading-relaxed text-[#444]">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#dcb81e] text-xs font-bold text-black">
                    {i + 1}
                  </span>
                  <span>{t(s)}</span>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">{t("Servicios opcionales de la Tienda")}</h2>
        <p className="mt-1.5 text-[15px] leading-relaxed text-[#555]">
          {t(
            "Lo básico siempre es gratis. Si quieres más seguridad o ahorrar tiempo, puedes contratar herramientas por anuncio, por 1, 6 o 12 meses. Así se sostiene la plataforma sin cobrar comisión."
          )}
        </p>
        <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
          {SERVICES.map((s) => (
            <li key={s.title} className="rounded-xl bg-[#f7f7f7] px-4 py-3">
              <p className="text-[15px] font-semibold">{t(s.title)}</p>
              <p className="mt-0.5 text-sm leading-relaxed text-[#555]">{t(s.text)}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10 rounded-2xl bg-[#111] p-5 text-white">
        <h2 className="text-lg font-semibold">{t("Lo que Cabibee es y no es")}</h2>
        <p className="mt-2 text-sm leading-relaxed text-white/80">
          {t(
            "Cabibee es una herramienta: te ayudamos a que el trato sea más claro y seguro, pero no somos arrendador, agente ni parte de las rentas. Los contratos, pagos, chats y acuerdos son entre anfitrión y huésped."
          )}
        </p>
        <Link href="/terminos" className="mt-3 inline-block text-sm font-semibold text-[#dcb81e] underline">
          {t("Términos y condiciones")}
        </Link>
      </section>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link href={exploreHref} className="rounded-xl bg-[#dcb81e] px-5 py-3 text-[15px] font-semibold text-black">
          {t("Explorar alojamientos")}
        </Link>
        <Link href={bookHref} className="rounded-xl border border-[#222] px-5 py-3 text-[15px] font-semibold text-[#222]">
          {t("Cómo reservar")}
        </Link>
        {storeHref && (
          <Link href={storeHref} className="rounded-xl border border-[#ddd] px-5 py-3 text-[15px] font-semibold text-[#222]">
            {t("Ver la Tienda")}
          </Link>
        )}
      </div>
    </div>
  );
}
