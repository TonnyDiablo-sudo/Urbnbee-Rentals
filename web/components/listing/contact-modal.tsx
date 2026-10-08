"use client";
import { useState } from "react";
import Link from "next/link";
import type { HostContact } from "@/lib/listing-detail-data";
import { VerifyEmailBox } from "@/components/account/purchase-prereqs";
import { useT } from "@/components/i18n-provider";
import { ContactChannelList, hasContactChannels } from "@/components/listing/contact-channel-list";

type Props = {
  host: HostContact;
  listingId: string;
  listingSlug: string;
  /** Solo usuarios registrados ven teléfono, WhatsApp, correo, etc. */
  canViewContacts: boolean;
  /** Tiene sesión pero falta confirmar el correo. */
  emailGate?: { email?: string; placeholder?: boolean };
};

export function ContactModal({ host, listingId, listingSlug, canViewContacts, emailGate }: Props) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [views, setViews] = useState(0);

  const nextParam = `/listings/${listingSlug}`;

  const handleOpen = async () => {
    setOpen(true);
    if (!canViewContacts) return;
    try {
      const res = await fetch(`/api/listings/${listingId}/contact-view`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (data.views) setViews(data.views);
    } catch {
      // ignore in dev
    }
  };

  const hasChannels = hasContactChannels(host);

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="w-full rounded py-3 text-center text-sm font-semibold text-black transition hover:brightness-90"
        style={{ backgroundColor: "#dcb81e" }}
      >
        {canViewContacts || emailGate ? t("Ver datos de contacto del anfitrión") : t("Ver datos de contacto — regístrate gratis")}
      </button>
      {views > 0 && canViewContacts && (
        <p className="mt-1 text-center text-xs text-[#aaa]">{t("{n} personas consultaron este perfil", { n: views })}</p>
      )}

      {open && (
        <div
          className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="relative max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-4 top-4 text-[#aaa] transition hover:text-[#484848]"
              aria-label={t("Cerrar")}
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="flex items-center gap-4 pb-5" style={{ borderBottom: "1px solid #ebebeb" }}>
              <img
                src={host.avatarUrl}
                alt={host.name}
                className="h-16 w-16 rounded-full object-cover"
                style={{ border: "2px solid #dcb81e" }}
              />
              <div>
                <h3 className="text-lg font-semibold text-[#484848]">{host.name}</h3>
                <p className="text-sm text-[#aaa]">{t("Anfitrión en Cabibee")}</p>
              </div>
            </div>

            {emailGate ? (
              <div className="mt-5 space-y-3">
                <p className="text-sm text-[#3a3a3a]">
                  {t("Para ver teléfono, WhatsApp y correo del anfitrión confirma tu correo. Así sabemos que la cuenta es tuya.")}
                </p>
                <VerifyEmailBox email={emailGate.email} placeholder={emailGate.placeholder} purpose="contacts" />
              </div>
            ) : !canViewContacts ? (
              <div className="mt-5 space-y-4 text-sm leading-relaxed text-[#3a3a3a]">
                <p className="font-medium text-[#484848]">{t("Registro gratuito para ver teléfono, WhatsApp y más")}</p>
                <p>
                  {t("Ocultamos los datos de contacto directos a quien solo navega para proteger a los anfitriones del spam y las estafas, y para que quien escribe sea una persona identificable en la plataforma:")}{" "}
                  <strong>{t("es por el bien de todos")}</strong>.
                </p>
                <p>
                  {t("Crear cuenta no cuesta nada. Cuando quieras")} <strong>{t("reservar")}</strong>
                  {t(", ahí aplicará la verificación de huésped (suscripción) y el pago según las reglas del sitio.")}
                </p>
                <div className="flex flex-col gap-2 pt-2 sm:flex-row">
                  <Link
                    href={`/register?next=${encodeURIComponent(nextParam)}`}
                    className="rounded-lg bg-black px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-[#222]"
                  >
                    {t("Registrarse gratis")}
                  </Link>
                  <Link
                    href={`/login?next=${encodeURIComponent(nextParam)}`}
                    className="rounded-lg border border-[#ddd] px-4 py-3 text-center text-sm font-semibold text-[#484848] transition hover:bg-[#fafafa]"
                  >
                    {t("Ya tengo cuenta")}
                  </Link>
                </div>
              </div>
            ) : !hasChannels ? (
              <p className="mt-5 text-sm text-[#666]">
                {t("Este anfitrión aún no ha publicado teléfono, WhatsApp u otros enlaces en Cabibee. Puedes escribirle por el chat de la página una vez iniciada sesión.")}
              </p>
            ) : (
              <div className="mt-5">
                <ContactChannelList host={host} />
              </div>
            )}

            <p className="mt-4 text-center text-xs text-[#aaa]">
              {t("Cabibee conecta viajeros con anfitriones verificados")}
            </p>
          </div>
        </div>
      )}
    </>
  );
}

