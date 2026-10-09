"use client";

import Link from "next/link";
import { useT } from "@/components/i18n-provider";

const TAGS = [
  {
    label: "✓ Identidad verificada",
    cls: "bg-[#e7f5ec] text-[#1e7a3a]",
    text: "El anfitrión validó su identificación oficial con una selfie. Sabes que es una persona real y quién es.",
  },
  {
    label: "✓ Miembro verificado",
    cls: "bg-[#fdf6d8] text-[#8a6d0f]",
    text: "El anfitrión comprobó su identidad y mantiene vigente su verificación con Cabibee. Es la etiqueta más completa sobre la persona.",
  },
  {
    label: "📍 Ubicación verificada",
    cls: "bg-[#e8f0fb] text-[#1d4f91]",
    text: "Comprobamos con documentos que la dirección existe y que el anfitrión es dueño o administra la propiedad.",
  },
  {
    label: "Reserva protegida por contrato",
    cls: "bg-[#111] text-white",
    text: "El anuncio usa el motor de reservas: pagas en línea, firmas el contrato y todo queda registrado.",
  },
  {
    label: "Destacado",
    cls: "bg-[#222] text-white",
    text: "El anfitrión pagó para que su anuncio aparezca primero. Es publicidad, no una verificación: revisa también las otras etiquetas.",
  },
  {
    label: "Anfitrión no verificado",
    cls: "bg-[#f3f3f3] text-[#717171]",
    text: "El anfitrión todavía no completa ninguna verificación. No siempre es malo, pero toma más precauciones.",
  },
];

const ENGINE = [
  { title: "Pago dentro de Cabibee", text: "Con tarjeta, sin transferencias a cuentas desconocidas ni depósitos en efectivo." },
  { title: "Contrato firmado por ambos", text: "Fechas, precio, depósito, reglas y cancelación quedan por escrito antes de llegar." },
  { title: "Registro de la estancia", text: "Mensajes, pagos y contrato quedan guardados en tu cuenta por si hay un desacuerdo." },
  { title: "Disponibilidad real", text: "El calendario se actualiza con cada reserva, así evitas que te cancelen por doble reserva." },
];

const STEPS = [
  "Busca por zona y fechas. Usa los filtros para precio y amenidades.",
  "Abre el anuncio y revisa fotos, reglas, precio total y etiquetas.",
  "Escríbele al anfitrión si tienes dudas. Desconfía de quien te pida salir de la plataforma para pagar.",
  "Si tiene «Reserva protegida por contrato», reserva y paga en línea. Si no, acuerda directo con el anfitrión y pide un contrato.",
  "Lee el contrato completo antes de firmar: fechas, depósito, cancelación y reglas.",
  "Al llegar, toma fotos del lugar. Te ayudan si hay un desacuerdo con el depósito.",
];

export function HowToBook({ exploreHref, membershipHref }: { exploreHref: string; membershipHref: string }) {
  const t = useT();
  return (
    <div className="text-[#222]">
      <p className="text-[13px] font-semibold uppercase tracking-wide text-[#a88a12]">{t("Guía para huéspedes")}</p>
      <h1 className="mt-1 text-[28px] font-bold leading-tight sm:text-4xl">{t("Cómo reservar en Cabibee")}</h1>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-[#555] sm:text-base">
        {t("En Cabibee tratas directo con el anfitrión. Estos pasos y etiquetas te ayudan a elegir bien y a reservar seguro.")}
      </p>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">{t("Paso a paso")}</h2>
        <ol className="mt-3 space-y-2.5">
          {STEPS.map((s, i) => (
            <li key={s} className="flex gap-3 text-[15px] leading-relaxed text-[#444]">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#dcb81e] text-xs font-bold text-black">
                {i + 1}
              </span>
              <span>{t(s)}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">{t("Qué significa cada etiqueta")}</h2>
        <ul className="mt-4 space-y-3">
          {TAGS.map((tag) => (
            <li key={tag.label} className="rounded-2xl border border-[#ebebeb] p-4">
              <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${tag.cls}`}>{t(tag.label)}</span>
              <p className="mt-2 text-sm leading-relaxed text-[#444]">{t(tag.text)}</p>
            </li>
          ))}
        </ul>
        <div className="mt-4 rounded-2xl bg-[#fffaf0] p-4 text-sm leading-relaxed text-[#5c4a0e]">
          <p className="font-semibold">{t("¿Por qué revisar las etiquetas?")}</p>
          <p className="mt-1">
            {t(
              "Cada etiqueta es una comprobación que el anfitrión pasó. Entre más tenga, más sabes de con quién tratas. Las estafas más comunes en rentas son anuncios de personas que no existen o de lugares que no son suyos: identidad y ubicación verificadas cierran esa puerta."
            )}
          </p>
          <p className="mt-2">{t("Las etiquetas ayudan, pero no son garantía. Usa tu criterio y lee siempre el contrato.")}</p>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">{t("Por qué es mejor reservar con motor de reservas de Cabibee")}</h2>
        <p className="mt-1.5 text-[15px] leading-relaxed text-[#555]">
          {t("Los anuncios con «Reserva protegida por contrato» te dan más respaldo que un trato sólo por mensajes:")}
        </p>
        <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
          {ENGINE.map((e) => (
            <li key={e.title} className="rounded-xl bg-[#f7f7f7] px-4 py-3">
              <p className="text-[15px] font-semibold">{t(e.title)}</p>
              <p className="mt-0.5 text-sm leading-relaxed text-[#555]">{t(e.text)}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10 rounded-2xl border border-[#ebebeb] p-5">
        <h2 className="text-lg font-semibold">{t("Verifícate tú también")}</h2>
        <p className="mt-1.5 text-sm leading-relaxed text-[#555]">
          {t("Los anfitriones confían más en huéspedes con identidad verificada, y algunos sólo aceptan reservas así.")}
        </p>
        <Link href={membershipHref} className="mt-3 inline-block text-sm font-semibold text-[#222] underline">
          {t("Membresía de huésped")}
        </Link>
      </section>

      <p className="mt-6 text-xs leading-relaxed text-[#888]">
        {t("Cabibee no es parte de los acuerdos entre anfitrión y huésped. Consulta los")}{" "}
        <Link href="/terminos" className="underline">
          {t("Términos y condiciones")}
        </Link>{" "}
        {t("y el")}{" "}
        <Link href="/privacidad" className="underline">
          {t("Aviso de privacidad")}
        </Link>
        .
      </p>

      <Link href={exploreHref} className="mt-6 inline-block rounded-xl bg-[#dcb81e] px-5 py-3 text-[15px] font-semibold text-black">
        {t("Explorar alojamientos")}
      </Link>
    </div>
  );
}
