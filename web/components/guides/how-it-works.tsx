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
  {
    title: "Motor de reservas",
    text: "El huésped reserva y paga en línea, firma el contrato y todo queda registrado. Para usarlo, el anfitrión contrata también su verificación de identidad y la de dirección.",
  },
  { title: "Limpieza", text: "Limpiezas automáticas según tus reservas, con asignación y fotos al terminar." },
  { title: "Colaboradores", text: "Da acceso a tu equipo con roles: mensajes, reservas, limpieza o firma de contratos." },
];

const TAGS = [
  {
    icon: "🪪",
    title: "Identidad verificada («Miembro verificado»)",
    text: "La persona subió una identificación oficial (INE, pasaporte, licencia o State ID) y una selfie, y se compararon contra una base de datos oficial. Así sabes que es quien dice ser. Aplica igual para anfitriones y huéspedes.",
  },
  {
    icon: "📍",
    title: "Dirección verificada («Ubicación verificada»)",
    text: "El anfitrión subió un comprobante de domicilio del alojamiento y lo revisamos. Te dice que el lugar existe, que está donde dice el anuncio y que quien lo renta tiene relación con él. Es tu mejor defensa contra anuncios falsos.",
  },
];

const ENGINE_WHY = [
  "Los dos lados están verificados: el huésped con identificación y selfie, y el anfitrión con su identidad y la dirección del anuncio. Sin esas dos verificaciones, un anuncio no puede usar el motor.",
  "El pago se hace con tarjeta a la cuenta de Stripe del anfitrión y queda registrado; nada de depósitos a cuentas desconocidas.",
  "El contrato se firma en línea antes de llegar y queda guardado para los dos.",
  "La dirección exacta, el código de entrada y el wifi se comparten sólo con la reserva confirmada.",
  "Al terminar, se califican el uno al otro; nuestro equipo revisa las reseñas antes de publicarlas.",
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

      <section id="etiquetas" className="mt-10 scroll-mt-24">
        <h2 className="text-xl font-semibold">{t("Qué significan las etiquetas")}</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {TAGS.map((tag) => (
            <li key={tag.title} className="rounded-2xl border border-[#ebebeb] p-4">
              <p className="text-2xl" aria-hidden>
                {tag.icon}
              </p>
              <p className="mt-2 text-[16px] font-semibold">{t(tag.title)}</p>
              <p className="mt-1 text-sm leading-relaxed text-[#555]">{t(tag.text)}</p>
            </li>
          ))}
        </ul>
        <div className="mt-3 rounded-2xl bg-[#fdf6d8] px-4 py-3 text-sm leading-relaxed text-[#5c4a0a]">
          <p className="font-semibold">{t("Se revisan cada mes")}</p>
          <p className="mt-1">
            {t(
              "Mientras la verificación esté pagada, cada mes nuestros sistemas vuelven a revisar todas las identidades y direcciones verificadas contra datos oficiales. Si se deja de pagar, se deja de verificar y la etiqueta se quita. Si la revisión marca que hay que confirmar de nuevo, le pedimos a la persona que vuelva a subir sus datos. Es por la seguridad de todos."
            )}
          </p>
        </div>
      </section>

      <section id="motor" className="mt-10 scroll-mt-24">
        <h2 className="text-xl font-semibold">{t("Por qué es más seguro reservar con el motor de Cabibee")}</h2>
        <ul className="mt-3 space-y-2">
          {ENGINE_WHY.map((s) => (
            <li key={s} className="flex gap-2 text-[15px] leading-relaxed text-[#444]">
              <span className="text-[#1e7a3a]" aria-hidden>
                ✓
              </span>
              <span>{t(s)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section id="servicios" className="mt-10 scroll-mt-24">
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
