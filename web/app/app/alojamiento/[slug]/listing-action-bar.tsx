"use client";

import Link from "next/link";
import { useState } from "react";
import { AvailabilityCalendar } from "@/components/listing/availability-calendar";
import type { HostContact } from "@/lib/listing-detail-data";
import { Sheet } from "../../_components/sheet";

type Props = {
  listingId: string;
  slug: string;
  pricePerNight: number;
  cleaningFee?: number;
  depositMxn?: number;
  blockedDates: string[];
  nightlyPriceOverrides?: Record<string, number>;
  bookable: boolean;
  /** Sólo los anuncios de anfitriones reales tienen chat; los de muestra no. */
  chatAvailable: boolean;
  loggedIn: boolean;
  isOwn: boolean;
  host: HostContact;
};

export function ListingActionBar(p: Props) {
  const [sheet, setSheet] = useState<"book" | "contact" | null>(null);
  const here = `/alojamiento/${p.slug}`;
  const authQ = `next=${encodeURIComponent(here)}`;
  const chatHref = p.loggedIn
    ? `/mensajes/${p.listingId}`
    : `/cuenta/registro?next=${encodeURIComponent(`/mensajes/${p.listingId}`)}`;

  const openContact = () => {
    setSheet("contact");
    if (p.loggedIn) {
      void fetch(`/api/listings/${p.listingId}/contact-view`, { method: "POST" }).catch(() => {});
    }
  };

  return (
    <>
      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[#ebebeb] bg-white"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto flex max-w-xl items-center gap-3 px-5 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-[15px] text-[#222]">
              <span className="font-bold">${p.pricePerNight.toLocaleString("es-MX")}</span> MXN noche
            </p>
            {p.chatAvailable && !p.isOwn && (
              <Link href={chatHref} className="text-sm font-semibold text-[#222] underline">
                Enviar mensaje
              </Link>
            )}
          </div>
          {p.isOwn ? (
            <span className="rounded-xl bg-[#f3f3f3] px-4 py-3 text-sm font-medium text-[#555]">Es tu anuncio</span>
          ) : (
            <>
              <button
                type="button"
                onClick={openContact}
                className={`rounded-xl px-4 py-3 text-[15px] font-semibold ${
                  p.bookable ? "border border-[#222] text-[#222]" : "bg-[#dcb81e] text-black"
                }`}
              >
                Contacto
              </button>
              {p.bookable && (
                <button
                  type="button"
                  onClick={() => setSheet("book")}
                  className="rounded-xl bg-[#dcb81e] px-5 py-3 text-[15px] font-semibold text-black"
                >
                  Reservar
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <Sheet open={sheet === "book"} onClose={() => setSheet(null)} title="Elige tus fechas">
        <AvailabilityCalendar
          listingId={p.listingId}
          listingSlug={p.slug}
          bookable={p.bookable}
          pricePerNight={p.pricePerNight}
          cleaningFee={p.cleaningFee}
          depositMxn={p.depositMxn}
          blockedDates={p.blockedDates}
          nightlyPriceOverrides={p.nightlyPriceOverrides}
          appRoutes={{
            login: `/cuenta/entrar?${authQ}`,
            register: `/cuenta/registro?${authQ}`,
            membership: "/membresia",
            cancelPath: here,
            successPath: "/viajes",
          }}
        />
        <p className="mt-4 text-xs leading-relaxed text-[#888]">
          Para reservar necesitas cuenta y la membresía de huésped verificado (o un pase por reserva).
        </p>
      </Sheet>

      <Sheet open={sheet === "contact"} onClose={() => setSheet(null)} title={`Contacto de ${p.host.name}`}>
        {!p.loggedIn ? (
          <div className="space-y-4 text-[15px] leading-relaxed text-[#333]">
            <p>
              Para ver teléfono, WhatsApp y correo del anfitrión crea tu cuenta gratis. Así protegemos a los anfitriones
              del spam y sabemos quién escribe.
            </p>
            <Link
              href={`/cuenta/registro?${authQ}`}
              className="block rounded-xl bg-[#dcb81e] py-3.5 text-center font-semibold text-black"
            >
              Crear cuenta gratis
            </Link>
            <Link
              href={`/cuenta/entrar?${authQ}`}
              className="block rounded-xl border border-[#222] py-3.5 text-center font-semibold text-[#222]"
            >
              Ya tengo cuenta
            </Link>
          </div>
        ) : (
          <ContactChannels host={p.host} chatHref={p.chatAvailable ? chatHref : undefined} />
        )}
      </Sheet>
    </>
  );
}

function ContactChannels({ host, chatHref }: { host: HostContact; chatHref?: string }) {
  const items = [
    host.whatsapp && { href: `https://wa.me/${host.whatsapp}`, label: `WhatsApp +${host.whatsapp}`, external: true },
    host.phone && { href: `tel:${host.phone}`, label: `Llamar ${host.phone}`, external: false },
    host.email && { href: `mailto:${host.email}`, label: host.email, external: false },
    host.instagram && { href: `https://instagram.com/${host.instagram}`, label: `@${host.instagram}`, external: true },
    host.website && { href: host.website, label: "Sitio web", external: true },
    host.airbnbUrl && { href: host.airbnbUrl, label: "Otro perfil", external: true },
  ].filter(Boolean) as { href: string; label: string; external: boolean }[];

  return (
    <div className="space-y-3">
      {chatHref && (
        <Link href={chatHref} className="block rounded-xl bg-[#111] px-4 py-3.5 text-[15px] font-semibold text-white">
          💬 Chatear en Cabibee
        </Link>
      )}
      {items.length === 0 ? (
        <p className="text-sm text-[#717171]">
          Este anfitrión todavía no publica teléfono ni redes. {chatHref ? "Escríbele por el chat." : ""}
        </p>
      ) : (
        items.map((i) => (
          <a
            key={i.href}
            href={i.href}
            target={i.external ? "_blank" : undefined}
            rel={i.external ? "noopener noreferrer" : undefined}
            className="block rounded-xl border border-[#e5e5e5] px-4 py-3.5 text-[15px] font-medium text-[#222]"
          >
            {i.label}
          </a>
        ))
      )}
      <p className="pt-1 text-xs text-[#999]">Nunca compartas contraseñas ni datos bancarios por chat.</p>
    </div>
  );
}
