import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AmenitiesGrid } from "@/components/listing/amenities-grid";
import { ReviewsSection } from "@/components/listing/reviews-section";
import { listingIsBookable } from "@/lib/app-listings";
import { discountRows } from "@/lib/listing-pricing";
import { getListingDetail } from "@/lib/get-listing-detail";
import { stripHostContactChannels } from "@/lib/host-contact-policy";
import { getT } from "@/lib/i18n/server";
import { getListingById } from "@/lib/marketplace-store";
import { getSessionUser } from "@/lib/session";
import { IconChat } from "../../_components/icons";
import { FloatingBack } from "./floating-back";
import { ListingActionBar } from "./listing-action-bar";
import { ListingMap } from "./listing-map";
import { PhotoGallery } from "./photo-gallery";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const t = await getT();
  return { title: getListingDetail(slug)?.title ?? t("Alojamiento") };
}

export default async function AppListingPage({ params }: Props) {
  const { slug } = await params;
  const listing = getListingDetail(slug);
  if (!listing) notFound();

  const t = await getT();
  const viewer = await getSessionUser();
  const record = getListingById(listing.id);
  const hostListing = Boolean(record?.published);
  const bookable = listingIsBookable(listing.id);
  const isOwn = Boolean(viewer && record && viewer.id === record.hostId);
  const host = viewer ? listing.host : stripHostContactChannels(listing.host);
  const place = [listing.city, listing.zone].filter(Boolean).join(", ");
  const mxn = (n: number) => `$${n.toLocaleString("es-MX")} MXN`;
  const pricing = listing.pricing;
  const chatPath = `/mensajes/${encodeURIComponent(listing.id)}`;
  const chatHref = viewer ? chatPath : `/cuenta/registro?next=${encodeURIComponent(chatPath)}`;

  const rules = [
    { label: "Mascotas", v: listing.rules.pets },
    { label: "Fumar", v: listing.rules.smoking },
    { label: "Fiestas", v: listing.rules.parties },
    { label: "Niños", v: listing.rules.children },
  ].filter((r) => r.v !== null);

  return (
    <div className="pb-[calc(96px+env(safe-area-inset-bottom))]">
      <div className="relative">
        <PhotoGallery photos={listing.photos} title={listing.title} />
        <FloatingBack />
      </div>

      <div className="px-5 pt-5">
        <h1 className="text-[24px] font-bold leading-tight text-[#222]">{listing.title}</h1>
        {place && <p className="mt-1 text-[15px] text-[#484848]">{place}</p>}
        <p className="mt-1 text-sm text-[#717171]">
          {t(listing.guests === 1 ? "{n} huésped" : "{n} huéspedes", { n: listing.guests })} ·{" "}
          {t(listing.bedrooms === 1 ? "{n} recámara" : "{n} recámaras", { n: listing.bedrooms })} ·{" "}
          {t(listing.bathrooms === 1 ? "{n} baño" : "{n} baños", { n: listing.bathrooms })}
          {listing.size ? ` · ${listing.size}` : ""}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {listing.identityVerified && (
            <span className="rounded-full bg-[#e7f5ec] px-3 py-1 text-xs font-semibold text-[#1e7a3a]">
              {t("✓ Identidad verificada")}
            </span>
          )}
          {listing.verified && (
            <span className="rounded-full bg-[#fdf6d8] px-3 py-1 text-xs font-semibold text-[#8a6d0f]">
              {t("✓ Miembro verificado")}
            </span>
          )}
          {!listing.verified && !listing.identityVerified && (
            <span className="rounded-full bg-[#f3f3f3] px-3 py-1 text-xs font-medium text-[#717171]">
              {t("Anfitrión no verificado")}
            </span>
          )}
          {bookable && (
            <span className="rounded-full bg-[#111] px-3 py-1 text-xs font-semibold text-white">
              {t("Reserva protegida en Cabibee")}
            </span>
          )}
        </div>

        <Section>
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={listing.host.avatarUrl}
                alt=""
                className="h-14 w-14 rounded-full object-cover ring-2 ring-[#dcb81e]"
                loading="lazy"
              />
              {listing.identityVerified && (
                <span
                  className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-[#1e7a3a] text-xs font-bold text-white"
                  aria-label={t("Identidad verificada")}
                >
                  ✓
                </span>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-base font-semibold text-[#222]">
                {t("Anfitrión: {name}", { name: listing.host.name })}
              </p>
              <p className="line-clamp-2 text-sm text-[#717171]">{listing.host.bio}</p>
            </div>
          </div>
          {listing.identityVerified ? (
            <p className="mt-3 rounded-xl bg-[#e7f5ec] px-3 py-2 text-sm leading-relaxed text-[#1e5a32]">
              🛡️ {t("Perfil verificado: Cabibee comprobó la identidad de este anfitrión con su identificación oficial.")}
            </p>
          ) : hostListing ? (
            <p className="mt-3 rounded-xl bg-[#f7f7f7] px-3 py-2 text-sm leading-relaxed text-[#717171]">
              {t("Este anfitrión todavía no verifica su identidad en Cabibee.")}
            </p>
          ) : null}
          {(listing.host.work || listing.host.livesIn || listing.host.languages?.length) && (
            <ul className="mt-3 space-y-1 text-sm text-[#333]">
              {listing.host.work && <li>💼 {t("Trabaja como: {work}", { work: listing.host.work })}</li>}
              {listing.host.livesIn && <li>📍 {t("Vive en {place}", { place: listing.host.livesIn })}</li>}
              {listing.host.languages?.length ? (
                <li>🗣️ {t("Habla {list}", { list: listing.host.languages.map((l) => t(l)).join(", ") })}</li>
              ) : null}
            </ul>
          )}
          {hostListing && !isOwn && (
            <Link
              href={chatHref}
              prefetch
              className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-[#222] py-3 text-[15px] font-semibold text-[#222] active:bg-[#f7f7f7]"
            >
              <IconChat className="h-5 w-5" />
              {t("Enviar mensaje a {name}", { name: listing.host.name.split(" ")[0] })}
            </Link>
          )}
        </Section>

        {!bookable && (
          <Section>
            <p className="rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm leading-relaxed text-[#484848]">
              {hostListing
                ? t(
                    "Este anfitrión todavía no recibe reservas dentro de Cabibee. Puedes escribirle por el chat o ver sus datos de contacto y acordar directamente."
                  )
                : t(
                    "Este anfitrión todavía no recibe reservas dentro de Cabibee. Puedes ver sus datos de contacto y acordar directamente."
                  )}
            </p>
          </Section>
        )}

        <Section title={t("Acerca de este lugar")}>
          <p className="whitespace-pre-line text-[15px] leading-relaxed text-[#333]">{listing.description}</p>
        </Section>

        {listing.amenities.length > 0 && (
          <Section title={t("Lo que ofrece")}>
            <AmenitiesGrid amenities={listing.amenities} />
          </Section>
        )}

        {(rules.length > 0 || listing.checkInTime || listing.checkOutTime) && (
          <Section title={t("Reglas de la casa")}>
            {(listing.checkInTime || listing.checkOutTime) && (
              <p className="mb-3 text-sm text-[#333]">
                {listing.checkInTime ? t("Llegada desde las {time}", { time: listing.checkInTime }) : ""}
                {listing.checkInTime && listing.checkOutTime ? " · " : ""}
                {listing.checkOutTime ? t("Salida antes de las {time}", { time: listing.checkOutTime }) : ""}
              </p>
            )}
            <ul className="grid grid-cols-2 gap-2 text-sm text-[#333]">
              {rules.map((r) => (
                <li key={r.label}>
                  {r.v ? "✓" : "✗"} {t(r.label)} {r.v ? t("permitido") : t("no permitido")}
                </li>
              ))}
            </ul>
          </Section>
        )}

        <Section title={t("Precio")}>
          <dl className="space-y-1.5 text-[15px] text-[#333]">
            <Row label={t("Por noche")} value={mxn(listing.pricePerNight)} />
            {pricing?.weekendPrice ? <Row label={t("Viernes y sábado")} value={mxn(pricing.weekendPrice)} /> : null}
            {discountRows(pricing).map((r) => (
              <Row key={r.key + JSON.stringify(r.vars ?? {})} label={t(r.key, r.vars)} value={`−${r.pct}%`} accent />
            ))}
            {pricing?.minNights ? <Row label={t("Estancia mínima")} value={t("{n} noches", { n: pricing.minNights })} /> : null}
            {listing.cleaningFee ? <Row label={t("Limpieza (una vez)")} value={mxn(listing.cleaningFee)} /> : null}
            {listing.depositMxn ? <Row label={t("Depósito (entre ustedes)")} value={mxn(listing.depositMxn)} /> : null}
            {bookable && (
              <Row
                label={t("Impuestos")}
                value={
                  listing.tax
                    ? listing.tax.lines.map((l) => `${l.name} ${l.ratePct}%`).join(" + ") +
                      (listing.tax.mode === "included" ? ` (${t("incluidos")})` : "")
                    : t("No cobra")
                }
              />
            )}
          </dl>
          {bookable && listing.instantBook === false && (
            <p className="mt-3 text-xs leading-relaxed text-[#888]">
              {t("El anfitrión aprueba cada solicitud y confirma el total final (fechas e impuestos) antes de que se te cobre cualquier diferencia.")}
            </p>
          )}
        </Section>

        <Section title={t("Ubicación aproximada")}>
          <ListingMap lat={listing.lat} lng={listing.lng} />
          <p className="mt-2 text-xs text-[#999]">{t("La dirección exacta se comparte al confirmar la reserva.")}</p>
        </Section>

        <Section title={t("Reseñas")}>
          <ReviewsSection reviews={listing.reviews} />
        </Section>
      </div>

      <ListingActionBar
        listingId={listing.id}
        slug={slug}
        pricePerNight={listing.pricePerNight}
        cleaningFee={listing.cleaningFee}
        depositMxn={listing.depositMxn}
        tax={listing.tax}
        instantBook={listing.instantBook !== false}
        blockedDates={listing.blockedDates}
        nightlyPriceOverrides={listing.nightlyPriceOverrides}
        pricing={listing.pricing}
        bookable={bookable}
        chatAvailable={hostListing}
        loggedIn={Boolean(viewer)}
        isOwn={isOwn}
        host={host}
      />
    </div>
  );
}

function Section({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-[#ebebeb] py-6 first-of-type:mt-5">
      {title && <h2 className="mb-3 text-lg font-semibold text-[#222]">{title}</h2>}
      {children}
    </section>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-[#717171]">{label}</dt>
      <dd className={`shrink-0 font-medium ${accent ? "text-[#1e7a3a]" : ""}`}>{value}</dd>
    </div>
  );
}
