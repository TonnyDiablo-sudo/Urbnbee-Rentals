import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Membresía de huésped",
};

export default function MembresiaPublicPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 pb-16 pt-24 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-semibold text-[#222]">Membresía de verificación de huésped</h1>
        <p className="mt-4 text-sm leading-relaxed text-[#484848]">
          Urbnbee conecta viajeros con anfitriones verificados. Para solicitar reservas dentro de la plataforma necesitas
          una membresía activa y completar la verificación de identidad cuando el sitio lo tenga activado (documento
          oficial + selfie vía Stripe Identity).
        </p>

        <ul className="mt-8 list-inside list-disc space-y-2 text-sm text-[#484848]">
          <li>Planes mensual y/o anual (según lo que configure el equipo en Stripe).</li>
          <li>Gestión de pago y cancelación en el portal de facturación de Stripe.</li>
          <li>La identidad no se guarda en nuestros servidores: la revisa Stripe según su política y regulación.</li>
        </ul>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/register?next=/guest/membresia"
            className="inline-flex items-center justify-center rounded-lg bg-black px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#222]"
          >
            Crear cuenta
          </Link>
          <Link
            href="/login?next=/guest/membresia"
            className="inline-flex items-center justify-center rounded-lg border border-[#ddd] bg-white px-6 py-3 text-sm font-semibold text-[#222] transition hover:bg-[#fafafa]"
          >
            Ya tengo cuenta — ir a membresía
          </Link>
        </div>

        <p className="mt-10 text-xs text-[#aaa]">
          ¿Anfitrión? Publica desde «Enviar propiedad». La membresía de esta página es para huéspedes que reservan en
          Urbnbee.
        </p>
      </main>
    </>
  );
}
