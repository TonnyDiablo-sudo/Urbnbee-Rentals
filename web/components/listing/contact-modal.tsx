"use client";
import { useState } from "react";
import Link from "next/link";
import type { HostContact } from "@/lib/listing-detail-data";

type Props = {
  host: HostContact;
  listingId: string;
  listingSlug: string;
  /** Solo usuarios registrados ven teléfono, WhatsApp, correo, etc. */
  canViewContacts: boolean;
};

export function ContactModal({ host, listingId, listingSlug, canViewContacts }: Props) {
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

  const hasChannels = Boolean(
    host.whatsapp ||
      host.phone ||
      host.email ||
      host.instagram ||
      host.airbnbUrl ||
      host.website
  );

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="w-full rounded py-3 text-center text-sm font-semibold text-black transition hover:brightness-90"
        style={{ backgroundColor: "#dcb81e" }}
      >
        {canViewContacts ? "Ver datos de contacto del anfitrión" : "Ver datos de contacto — regístrate gratis"}
      </button>
      {views > 0 && canViewContacts && (
        <p className="mt-1 text-center text-xs text-[#aaa]">{views} personas consultaron este perfil</p>
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
              aria-label="Cerrar"
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
                <p className="text-sm text-[#aaa]">Anfitrión en Urbnbee</p>
              </div>
            </div>

            {!canViewContacts ? (
              <div className="mt-5 space-y-4 text-sm leading-relaxed text-[#3a3a3a]">
                <p className="font-medium text-[#484848]">Registro gratuito para ver teléfono, WhatsApp y más</p>
                <p>
                  Ocultamos los datos de contacto directos a quien solo navega para proteger a los anfitriones del spam y
                  las estafas, y para que quien escribe sea una persona identificable en la plataforma:{" "}
                  <strong>es por el bien de todos</strong>.
                </p>
                <p>
                  Crear cuenta no cuesta nada. Cuando quieras <strong>reservar</strong>, ahí aplicará la verificación de
                  huésped (suscripción) y el pago según las reglas del sitio.
                </p>
                <div className="flex flex-col gap-2 pt-2 sm:flex-row">
                  <Link
                    href={`/register?next=${encodeURIComponent(nextParam)}`}
                    className="rounded-lg bg-black px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-[#222]"
                  >
                    Registrarse gratis
                  </Link>
                  <Link
                    href={`/login?next=${encodeURIComponent(nextParam)}`}
                    className="rounded-lg border border-[#ddd] px-4 py-3 text-center text-sm font-semibold text-[#484848] transition hover:bg-[#fafafa]"
                  >
                    Ya tengo cuenta
                  </Link>
                </div>
              </div>
            ) : !hasChannels ? (
              <p className="mt-5 text-sm text-[#666]">
                Este anfitrión aún no ha publicado teléfono, WhatsApp u otros enlaces en Urbnbee. Puedes escribirle por el
                chat de la página una vez iniciada sesión.
              </p>
            ) : (
              <div className="mt-5 space-y-3">
                {host.whatsapp && (
                  <a
                    href={`https://wa.me/${host.whatsapp}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-white transition hover:opacity-90"
                    style={{ backgroundColor: "#25D366" }}
                  >
                    <WhatsAppIcon />
                    WhatsApp: +{host.whatsapp}
                  </a>
                )}
                {host.phone && (
                  <a
                    href={`tel:${host.phone}`}
                    className="flex items-center gap-3 rounded-lg border px-4 py-3 text-sm font-medium text-[#484848] transition hover:border-[#dcb81e]"
                    style={{ borderColor: "#ebebeb" }}
                  >
                    <PhoneIcon />
                    {host.phone}
                  </a>
                )}
                {host.email && (
                  <a
                    href={`mailto:${host.email}`}
                    className="flex items-center gap-3 rounded-lg border px-4 py-3 text-sm font-medium text-[#484848] transition hover:border-[#dcb81e]"
                    style={{ borderColor: "#ebebeb" }}
                  >
                    <EmailIcon />
                    {host.email}
                  </a>
                )}
                {host.instagram && (
                  <a
                    href={`https://instagram.com/${host.instagram}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-white transition hover:opacity-90"
                    style={{ background: "linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)" }}
                  >
                    <InstagramIcon />
                    @{host.instagram}
                  </a>
                )}
                {host.airbnbUrl && (
                  <a
                    href={host.airbnbUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-white transition hover:opacity-90"
                    style={{ backgroundColor: "#FF5A5F" }}
                  >
                    <AirbnbIcon />
                    Ver perfil en Airbnb
                  </a>
                )}
                {host.website && (
                  <a
                    href={host.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 rounded-lg border px-4 py-3 text-sm font-medium text-[#484848] transition hover:border-[#dcb81e]"
                    style={{ borderColor: "#ebebeb" }}
                  >
                    <WebIcon />
                    Sitio web
                  </a>
                )}
              </div>
            )}

            <p className="mt-4 text-center text-xs text-[#aaa]">
              Urbnbee conecta viajeros con anfitriones verificados
            </p>
          </div>
        </div>
      )}
    </>
  );
}

function WhatsAppIcon() {
  return (
    <svg className="h-5 w-5 shrink-0" fill="currentColor" viewBox="0 0 24 24">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg className="h-5 w-5 shrink-0" style={{ color: "#dcb81e" }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
    </svg>
  );
}

function EmailIcon() {
  return (
    <svg className="h-5 w-5 shrink-0" style={{ color: "#dcb81e" }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg className="h-5 w-5 shrink-0" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
  );
}

function AirbnbIcon() {
  return (
    <svg className="h-5 w-5 shrink-0" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 0C5.373 0 0 5.372 0 12s5.373 12 12 12 12-5.372 12-12S18.627 0 12 0zm.52 18.615c-.468 0-.896-.268-1.104-.695l-1.04-2.244a5.78 5.78 0 01-.494-2.306c0-.873.2-1.7.56-2.44L12 8.32l1.558 2.61c.36.74.56 1.567.56 2.44 0 .82-.173 1.604-.494 2.306l-1.04 2.244a1.235 1.235 0 01-1.064.695zm4.773-1.21c-.22.487-.72.803-1.258.803-.49 0-.942-.254-1.196-.674l-.978-1.624a7.27 7.27 0 01-1.04-3.54c0-1.3.347-2.53.963-3.586l1.75-2.953c.173-.29.487-.462.82-.462s.647.173.82.462l1.75 2.953c.616 1.057.963 2.286.963 3.587a7.27 7.27 0 01-1.04 3.54l-.554.494z" />
    </svg>
  );
}

function WebIcon() {
  return (
    <svg className="h-5 w-5 shrink-0" style={{ color: "#dcb81e" }} fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
    </svg>
  );
}
