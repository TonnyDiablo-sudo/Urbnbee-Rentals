import { notFound } from "next/navigation";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { PhotoGallery } from "@/components/listing/photo-gallery";
import { ListingNav } from "@/components/listing/listing-nav";
import { AmenitiesGrid } from "@/components/listing/amenities-grid";
import { ContactModal } from "@/components/listing/contact-modal";
import { AvailabilityCalendar } from "@/components/listing/availability-calendar";
import { ReviewsSection } from "@/components/listing/reviews-section";
import { AiChatWidget } from "@/components/listing/ai-chat-widget";
import { PlaceMap } from "@/components/maps/place-map";
import { ListingHostChat } from "@/components/listing/listing-host-chat";
import { ShareLinkButton } from "@/components/share-link-button";
import { SaveHeart } from "@/components/wishlist/save-heart";
import { listingIsBookable } from "@/lib/app-listings";
import { discountRows } from "@/lib/listing-pricing";
import { getListingDetail } from "@/lib/get-listing-detail";
import { getSessionUser } from "@/lib/session";
import { stripHostContactChannels } from "@/lib/host-contact-policy";
import { getLang, getT } from "@/lib/i18n/server";
import { localizeListingDetail } from "@/lib/listing-localize";
import { UnclaimedNotice } from "@/components/listing/unclaimed-notice";
import { isListingUnclaimed } from "@/lib/listing-claim-status";
import { trackListingView } from "@/lib/listing-view-tracking";
import { getListingById } from "@/lib/marketplace-store";

type Props = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ checkIn?: string; checkOut?: string; ref?: string }>;
};

export default async function ListingDetailPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const q = await searchParams;
  const found = getListingDetail(slug);
  if (!found) notFound();

  const [t, lang] = await Promise.all([getT(), getLang()]);
  const listing = await localizeListingDetail(found, lang);
  const viewer = await getSessionUser();
  const canViewHostContacts = Boolean(viewer);
  const hostForUi = canViewHostContacts ? listing.host : stripHostContactChannels(listing.host);
  const bookable = listingIsBookable(listing.id);
  const record = getListingById(listing.id);
  const unclaimed = Boolean(record?.published) && isListingUnclaimed(listing.id);
  await trackListingView(record, viewer);

  const ruleIcons = [
    { label: "Fumar", allowed: listing.rules.smoking, icon: "🚬" },
    { label: "Mascotas", allowed: listing.rules.pets, icon: "🐾" },
    { label: "Fiestas", allowed: listing.rules.parties, icon: "🎉" },
    { label: "Niños permitidos", allowed: listing.rules.children, icon: "👶" },
  ];

  return (
    <>
      <SiteHeader />

      {/* Top padding for fixed header */}
      <div style={{ paddingTop: "72px" }}>
        {/* Photo gallery */}
        <PhotoGallery photos={listing.photos} title={listing.title} />

        {/* Sticky nav tabs */}
        <ListingNav />

        {/* Main content */}
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-10 lg:flex-row lg:gap-12">

            {/* ─── LEFT COLUMN ─── */}
            <div className="flex-1 min-w-0">

              {/* Title + verified badge */}
              <div className="flex flex-wrap items-start gap-3">
                <h1 className="text-2xl font-bold text-[#484848] sm:text-3xl leading-tight">
                  {listing.title}
                </h1>
                {listing.identityVerified && (
                  <span className="mt-1 shrink-0 rounded bg-[#1e7a3a] px-3 py-1 text-xs font-semibold text-white">
                    {t("✓ Identidad verificada")}
                  </span>
                )}
                {listing.locationVerified && (
                  <span className="mt-1 shrink-0 rounded bg-[#1d4f91] px-3 py-1 text-xs font-semibold text-white">
                    {t("📍 Ubicación verificada")}
                  </span>
                )}
                {listing.verified && (
                  <span
                    className="mt-1 rounded px-3 py-1 text-xs font-semibold text-white shrink-0"
                    style={{ backgroundColor: "#dcb81e" }}
                  >
                    {t("Miembro verificado")}
                  </span>
                )}
              </div>

              {/* Location */}
              <p className="mt-2 flex items-center gap-1 text-sm text-[#aaa]">
                <svg className="h-4 w-4 shrink-0" style={{ color: "#dcb81e" }} fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                </svg>
                {[listing.zone, listing.city, listing.state, listing.country].filter(Boolean).join(", ")}
              </p>

              {/* Quick stats */}
              <div className="mt-4 flex flex-wrap gap-4 text-sm text-[#3a3a3a]">
                <span>👥 {t("{n} invitados", { n: listing.guests })}</span>
                <span>🛏 {t("{n} recámaras", { n: listing.bedrooms })}</span>
                <span>🚿 {t("{n} baños", { n: listing.bathrooms })}</span>
                {listing.size && <span>📐 {listing.size}</span>}
              </div>

              <hr className="my-6" style={{ borderColor: "#ebebeb" }} />

              {/* === Descripción === */}
              <section id="section-descripcion">
                <h2 className="mb-1 text-lg font-semibold text-[#484848]">{t("Descripción del anuncio")}</h2>
                <div className="h-[3px] w-10 mb-4" style={{ backgroundColor: "#dcb81e" }} />
                <p className="whitespace-pre-line text-sm leading-relaxed text-[#3a3a3a]">
                  {listing.description}
                </p>
              </section>

              <hr className="my-6" style={{ borderColor: "#ebebeb" }} />

              {/* === Precio === */}
              <section id="section-precio">
                <h2 className="mb-1 text-lg font-semibold text-[#484848]">{t("Información del Precio")}</h2>
                <div className="h-[3px] w-10 mb-4" style={{ backgroundColor: "#dcb81e" }} />
                <div className="rounded border p-5 text-sm" style={{ borderColor: "#ebebeb" }}>
                  <div className="grid gap-2">
                    <PriceRow label={t("Precio por noche")} value={`$ ${listing.pricePerNight.toLocaleString("es-MX")}`} />
                    {listing.priceWeekly && <PriceRow label={t("Precio por noche (7d+)")} value={`$ ${listing.priceWeekly}`} />}
                    {listing.priceMonthly && <PriceRow label={t("Precio por noche (30d+)")} value={`$ ${listing.priceMonthly}`} />}
                    {listing.cleaningFee && <PriceRow label={t("Tarifa de limpieza")} value={`$ ${listing.cleaningFee} — ${t("Tarifa única")}`} />}
                    {discountRows(listing.pricing).map((r) => (
                      <PriceRow key={r.key + JSON.stringify(r.vars ?? {})} label={t(r.key, r.vars)} value={`−${r.pct}%`} />
                    ))}
                    {listing.depositMxn ? (
                      <PriceRow
                        label={t("Depósito (fuera de Cabibee)")}
                        value={`$ ${listing.depositMxn.toLocaleString("es-MX")} — ${t("se pacta y entrega entre anfitrión y huésped")}`}
                      />
                    ) : null}
                  </div>
                </div>
              </section>

              <hr className="my-6" style={{ borderColor: "#ebebeb" }} />

              {/* === Detalles === */}
              <section id="section-detalles">
                <h2 className="mb-1 text-lg font-semibold text-[#484848]">{t("Detalles")}</h2>
                <div className="h-[3px] w-10 mb-4" style={{ backgroundColor: "#dcb81e" }} />
                <div className="rounded border p-5 text-sm" style={{ borderColor: "#ebebeb" }}>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <DetailRow
                      label={t("Verificación")}
                      value={
                        listing.verified
                          ? t("Miembro verificado")
                          : listing.identityVerified
                            ? t("Identidad verificada")
                            : t("Pendiente")
                      }
                    />
                    <DetailRow label={t("ID de propiedad")} value={String(listing.propertyId)} />
                    {listing.size && <DetailRow label={t("Tamaño")} value={listing.size} />}
                    <DetailRow label={t("Habitaciones")} value={String(listing.bedrooms)} />
                    <DetailRow label={t("Dormitorios")} value={String(listing.bedrooms)} />
                    <DetailRow label={t("Baños")} value={String(listing.bathrooms)} />
                    <DetailRow label={t("Ciudad")} value={listing.city} />
                    <DetailRow label={t("Zona")} value={listing.zone} />
                    {listing.county && listing.county !== listing.state && (
                      <DetailRow label={t("Municipio")} value={listing.county} />
                    )}
                    {listing.state && <DetailRow label={t("Estado / provincia")} value={listing.state} />}
                    <DetailRow label={t("País")} value={listing.country} />
                    {listing.extras?.breakfast && <DetailRow label={t("Desayuno Incluido")} value={listing.extras.breakfast} />}
                    {listing.extras?.lateCheckIn && <DetailRow label={t("Entrada Tardía")} value={listing.extras.lateCheckIn} />}
                    {listing.extras?.cancellation && <DetailRow label={t("Cancelación")} value={listing.extras.cancellation} />}
                    {listing.extras?.optionalServices && <DetailRow label={t("Servicios Opcionales")} value={listing.extras.optionalServices} />}
                    {listing.extras?.outdoorFacilities && <DetailRow label={t("Instalaciones Exteriores")} value={listing.extras.outdoorFacilities} />}
                  </div>
                </div>
              </section>

              <hr className="my-6" style={{ borderColor: "#ebebeb" }} />

              {/* === Comodidades === */}
              <section id="section-comodidades">
                <h2 className="mb-1 text-lg font-semibold text-[#484848]">{t("Características")}</h2>
                <div className="h-[3px] w-10 mb-4" style={{ backgroundColor: "#dcb81e" }} />
                <AmenitiesGrid amenities={listing.amenities} />

                {/* Terms */}
                <div className="mt-6">
                  <h3 className="mb-3 text-sm font-semibold text-[#484848]">{t("Términos y Condiciones")}</h3>
                  <div className="flex flex-wrap gap-4">
                    {ruleIcons.map((r) => (
                      <div key={r.label} className="flex items-center gap-2 text-sm text-[#3a3a3a]">
                        <span>{r.icon}</span>
                        <span>{t(r.label)}</span>
                        <span style={{ color: r.allowed ? "#22c55e" : r.allowed === false ? "#ef4444" : "#aaa" }}>
                          {r.allowed === true ? t("✓ Permitido") : r.allowed === false ? t("✗ No permitido") : "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                  {(listing.checkInTime || listing.checkOutTime) && (
                    <p className="mt-3 text-sm text-[#3a3a3a]">
                      {listing.checkInTime ? `🕒 ${t("Llegada desde las {time}", { time: listing.checkInTime })}` : ""}
                      {listing.checkInTime && listing.checkOutTime ? " · " : ""}
                      {listing.checkOutTime ? `🧳 ${t("Salida antes de las {time}", { time: listing.checkOutTime })}` : ""}
                    </p>
                  )}
                  <p className="mt-1 text-sm text-[#3a3a3a]">👥 {t("Máximo {n} huéspedes", { n: listing.guests })}</p>
                  {listing.houseRules && (
                    <div className="mt-4 rounded border p-4" style={{ borderColor: "#ebebeb" }}>
                      <p className="text-sm font-semibold text-[#484848]">{t("Otras reglas del anfitrión")}</p>
                      <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-[#3a3a3a]">{listing.houseRules}</p>
                    </div>
                  )}
                </div>
              </section>

              <hr className="my-6" style={{ borderColor: "#ebebeb" }} />

              {/* === Propietario === */}
              <section id="section-propietario">
                <h2 className="mb-1 text-lg font-semibold text-[#484848]">{t("Propietario")}</h2>
                <div className="h-[3px] w-10 mb-4" style={{ backgroundColor: "#dcb81e" }} />
                <div className="flex flex-col gap-4 sm:flex-row">
                  <img
                    src={listing.host.avatarUrl}
                    alt={listing.host.name}
                    className="h-20 w-20 rounded-full object-cover shrink-0"
                    style={{ border: "3px solid #dcb81e" }}
                  />
                  <div className="flex-1">
                    <h3 className="text-base font-semibold text-[#484848]">{listing.host.name}</h3>
                    {listing.identityVerified && (
                      <p className="mt-1 text-sm font-medium text-[#1e7a3a]">
                        🛡️ {t("Perfil verificado: Cabibee comprobó la identidad de este anfitrión con su identificación oficial.")}
                      </p>
                    )}
                    <p className="mt-2 text-sm leading-relaxed text-[#3a3a3a]">{listing.host.bio}</p>
                  </div>
                </div>
                <div className="mt-4">
                  <ContactModal
                    host={hostForUi}
                    listingId={listing.id}
                    listingSlug={slug}
                    canViewContacts={canViewHostContacts}
                  />
                </div>
                {unclaimed && (
                  <div className="mt-3">
                    <UnclaimedNotice listingId={listing.id} t={t} />
                  </div>
                )}
              </section>

              <hr className="my-6" style={{ borderColor: "#ebebeb" }} />

              <ListingHostChat listingId={listing.id} hostName={listing.host.name} />

              <hr className="my-6" style={{ borderColor: "#ebebeb" }} />

              {/* === Mapa === */}
              <section id="section-mapa">
                <h2 className="mb-1 text-lg font-semibold text-[#484848]">
                  {listing.exactLocation ? t("Ubicación") : t("Ubicación cercana (No exacta)")}
                </h2>
                <div className="h-[3px] w-10 mb-4" style={{ backgroundColor: "#dcb81e" }} />
                <div className="overflow-hidden rounded" style={{ height: "300px", border: "1px solid #ebebeb" }}>
                  <PlaceMap lat={listing.lat} lng={listing.lng} zoom={15} exact={listing.exactLocation} />
                </div>
                {listing.exactLocation && listing.addressLine ? (
                  <p className="mt-2 text-sm text-[#484848]">{listing.addressLine}</p>
                ) : (
                  <p className="mt-2 text-xs text-[#aaa]">
                    {t("La dirección exacta se proporciona tras confirmar la reserva.")}
                  </p>
                )}
                {listing.locationVerified && (
                  <p className="mt-1 text-xs text-[#1d4f91]">
                    {t("El anfitrión comprobó con un recibo de servicios que la dirección de este anuncio es real.")}
                  </p>
                )}
              </section>

              <hr className="my-6" style={{ borderColor: "#ebebeb" }} />

              {/* === Reseñas === */}
              <section>
                <h2 className="mb-1 text-lg font-semibold text-[#484848]">{t("Reseñas")}</h2>
                <div className="h-[3px] w-10 mb-4" style={{ backgroundColor: "#dcb81e" }} />
                <ReviewsSection reviews={listing.reviews} />
              </section>
            </div>

            {/* ─── RIGHT SIDEBAR ─── */}
            <aside className="w-full lg:w-80 xl:w-96 shrink-0">
              <div className="sticky top-[130px] rounded border p-5" style={{ borderColor: "#ebebeb" }}>
                {/* Price header */}
                <div className="mb-1 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-[#484848]">
                    $ {listing.pricePerNight.toLocaleString("es-MX")}
                  </span>
                  <span className="text-sm text-[#aaa]">{t("por noche aprox.")}</span>
                </div>

                <hr className="mb-4 mt-3" style={{ borderColor: "#ebebeb" }} />

                {/* Calendar */}
                <AvailabilityCalendar
                  listingId={listing.id}
                  listingSlug={slug}
                  bookable={bookable}
                  initialCheckIn={q.checkIn}
                  initialCheckOut={q.checkOut}
                  bookingRef={q.ref}
                  pricePerNight={listing.pricePerNight}
                  cleaningFee={listing.cleaningFee}
                  depositMxn={listing.depositMxn}
                  tax={listing.tax}
                  instantBook={listing.instantBook !== false}
                  blockedDates={listing.blockedDates}
                  nightlyPriceOverrides={listing.nightlyPriceOverrides}
                  pricing={listing.pricing}
                />

                <hr className="my-4" style={{ borderColor: "#ebebeb" }} />

                {/* Actions */}
                <div className="space-y-3">
                  <ContactModal
                    host={hostForUi}
                    listingId={listing.id}
                    listingSlug={slug}
                    canViewContacts={canViewHostContacts}
                  />
                  <SaveHeart
                    slug={slug}
                    surface="web"
                    variant="plain"
                    className="w-full rounded border border-[#ebebeb] py-2.5 text-sm font-medium text-[#484848] transition hover:border-[#dcb81e] hover:text-[#dcb81e]"
                  />
                  <ShareLinkButton
                    path={`/listings/${slug}`}
                    title={listing.title}
                    label={t("↗ Compartir")}
                    className="w-full rounded border border-[#ebebeb] py-2.5 text-sm font-medium text-[#484848] transition hover:border-[#dcb81e] hover:text-[#dcb81e]"
                  />
                </div>
              </div>
            </aside>
          </div>
        </div>
      </div>

      {/* AI Chat Widget */}
      <AiChatWidget listingId={listing.id} listingTitle={listing.title} />

      <SiteFooter />
    </>
  );
}

function PriceRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-[#aaa]">{label}:</span>
      <span className="font-medium text-[#484848]">{value}</span>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[#aaa] shrink-0">{label}:</span>
      <span className="text-[#484848]">{value}</span>
    </div>
  );
}
