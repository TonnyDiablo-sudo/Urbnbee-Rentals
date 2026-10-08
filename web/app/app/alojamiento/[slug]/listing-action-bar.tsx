"use client";

import Link from "next/link";
import { useState } from "react";
import { VerifyEmailBox } from "@/components/account/purchase-prereqs";
import { useLang, useT } from "@/components/i18n-provider";
import { AvailabilityCalendar } from "@/components/listing/availability-calendar";
import { ContactChannelList, hasContactChannels } from "@/components/listing/contact-channel-list";
import { numberLocale } from "@/lib/i18n";
import type { HostContact } from "@/lib/listing-detail-data";
import type { ListingPricing } from "@/lib/listing-pricing";
import type { HostTaxSettings } from "@/lib/stay-tax";
import { Sheet } from "../../_components/sheet";

type Props = {
  listingId: string;
  slug: string;
  pricePerNight: number;
  maxGuests: number;
  /** Renta mensual: el precio principal es por mes. */
  pricePerMonth?: number;
  cleaningFee?: number;
  depositMxn?: number;
  tax?: HostTaxSettings;
  instantBook: boolean;
  blockedDates: string[];
  nightlyPriceOverrides?: Record<string, number>;
  pricing?: ListingPricing;
  bookable: boolean;
  /** Sólo los anuncios de anfitriones reales tienen chat; los de muestra no. */
  chatAvailable: boolean;
  loggedIn: boolean;
  isOwn: boolean;
  host: HostContact;
  /** Tiene sesión pero falta confirmar el correo: no ve contactos. */
  emailGate?: { email?: string; placeholder?: boolean };
};

export function ListingActionBar(p: Props) {
  const t = useT();
  const lang = useLang();
  const [sheet, setSheet] = useState<"book" | "contact" | null>(null);
  const here = `/alojamiento/${p.slug}`;
  const authQ = `next=${encodeURIComponent(here)}`;
  const chatPath = `/mensajes/${encodeURIComponent(p.listingId)}`;
  const chatHref = p.loggedIn ? chatPath : `/cuenta/registro?next=${encodeURIComponent(chatPath)}`;

  const openContact = () => {
    setSheet("contact");
    if (p.loggedIn && !p.emailGate) {
      void fetch(`/api/listings/${p.listingId}/contact-view`, { method: "POST" }).catch(() => {});
    }
  };

  return (
    <>
      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[#ebebeb] bg-white"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto flex max-w-xl md:max-w-3xl items-center gap-3 px-5 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-[15px] text-[#222]">
              <span className="font-bold">${(p.pricePerMonth ?? p.pricePerNight).toLocaleString(numberLocale(lang))}</span> MXN{" "}
              {p.pricePerMonth ? t("/ mes") : t("noche")}
            </p>
            {p.chatAvailable && !p.isOwn && p.bookable && (
              <Link href={chatHref} prefetch className="text-sm font-semibold text-[#222] underline">
                {t("Enviar mensaje")}
              </Link>
            )}
          </div>
          {p.isOwn ? (
            <span className="rounded-xl bg-[#f3f3f3] px-4 py-3 text-sm font-medium text-[#555]">{t("Es tu anuncio")}</span>
          ) : (
            <>
              <button
                type="button"
                onClick={openContact}
                className={`rounded-xl px-4 py-3 text-[15px] font-semibold ${
                  p.bookable || p.chatAvailable ? "border border-[#222] text-[#222]" : "bg-[#dcb81e] text-black"
                }`}
              >
                {t("Contacto")}
              </button>
              {!p.bookable && p.chatAvailable && (
                <Link
                  href={chatHref}
                  prefetch
                  className="rounded-xl bg-[#dcb81e] px-5 py-3 text-[15px] font-semibold text-black"
                >
                  {t("Mensaje")}
                </Link>
              )}
              {p.bookable && (
                <button
                  type="button"
                  onClick={() => setSheet("book")}
                  className="rounded-xl bg-[#dcb81e] px-5 py-3 text-[15px] font-semibold text-black"
                >
                  {t("Reservar")}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <Sheet open={sheet === "book"} onClose={() => setSheet(null)} title={t("Elige tus fechas")}>
        <AvailabilityCalendar
          listingId={p.listingId}
          listingSlug={p.slug}
          bookable={p.bookable}
          maxGuests={p.maxGuests}
          pricePerNight={p.pricePerNight}
          cleaningFee={p.cleaningFee}
          depositMxn={p.depositMxn}
          tax={p.tax}
          instantBook={p.instantBook}
          blockedDates={p.blockedDates}
          nightlyPriceOverrides={p.nightlyPriceOverrides}
          pricing={p.pricing}
          appRoutes={{
            login: `/cuenta/entrar?${authQ}`,
            register: `/cuenta/registro?${authQ}`,
            membership: "/membresia",
            cancelPath: here,
            successPath: "/viajes",
          }}
        />
        <p className="mt-4 text-xs leading-relaxed text-[#888]">
          {t("Para reservar necesitas cuenta y la membresía de huésped verificado (o un pase por reserva).")}
        </p>
      </Sheet>

      <Sheet open={sheet === "contact"} onClose={() => setSheet(null)} title={t("Contacto de {name}", { name: p.host.name })}>
        {!p.loggedIn ? (
          <div className="space-y-4 text-[15px] leading-relaxed text-[#333]">
            <p>
              {t(
                "Para ver teléfono, WhatsApp y correo del anfitrión crea tu cuenta gratis. Así protegemos a los anfitriones del spam y sabemos quién escribe."
              )}
            </p>
            <Link
              href={`/cuenta/registro?${authQ}`}
              className="block rounded-xl bg-[#dcb81e] py-3.5 text-center font-semibold text-black"
            >
              {t("Crear cuenta gratis")}
            </Link>
            <Link
              href={`/cuenta/entrar?${authQ}`}
              className="block rounded-xl border border-[#222] py-3.5 text-center font-semibold text-[#222]"
            >
              {t("Ya tengo cuenta")}
            </Link>
          </div>
        ) : p.emailGate ? (
          <div className="space-y-3">
            <p className="text-[15px] leading-relaxed text-[#333]">
              {t("Para ver teléfono, WhatsApp y correo del anfitrión confirma tu correo. Así sabemos que la cuenta es tuya.")}
            </p>
            <VerifyEmailBox email={p.emailGate.email} placeholder={p.emailGate.placeholder} purpose="contacts" />
          </div>
        ) : (
          <ContactChannels host={p.host} chatHref={p.chatAvailable ? chatHref : undefined} />
        )}
      </Sheet>
    </>
  );
}

function ContactChannels({ host, chatHref }: { host: HostContact; chatHref?: string }) {
  const t = useT();

  return (
    <div className="space-y-3">
      {chatHref && (
        <Link href={chatHref} className="block rounded-xl bg-[#111] px-4 py-3.5 text-[15px] font-semibold text-white">
          💬 {t("Chatear en Cabibee")}
        </Link>
      )}
      {hasContactChannels(host) ? (
        <ContactChannelList host={host} />
      ) : (
        <p className="text-sm text-[#717171]">
          {t("Este anfitrión todavía no publica teléfono ni redes.")} {chatHref ? t("Escríbele por el chat.") : ""}
        </p>
      )}
      <p className="pt-1 text-xs text-[#999]">{t("Nunca compartas contraseñas ni datos bancarios por chat.")}</p>
    </div>
  );
}
