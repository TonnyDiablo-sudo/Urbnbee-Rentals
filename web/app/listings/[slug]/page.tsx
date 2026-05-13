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
import { ListingHostChat } from "@/components/listing/listing-host-chat";
import { getListingDetail } from "@/lib/get-listing-detail";
import { getSessionUser } from "@/lib/session";
import { stripHostContactChannels } from "@/lib/host-contact-policy";

type Props = { params: Promise<{ slug: string }> };

export default async function ListingDetailPage({ params }: Props) {
  const { slug } = await params;
  const listing = getListingDetail(slug);
  if (!listing) notFound();

  const viewer = await getSessionUser();
  const canViewHostContacts = Boolean(viewer);
  const hostForUi = canViewHostContacts ? listing.host : stripHostContactChannels(listing.host);

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
                {listing.verified && (
                  <span
                    className="mt-1 rounded px-3 py-1 text-xs font-semibold text-white shrink-0"
                    style={{ backgroundColor: "#dcb81e" }}
                  >
                    Verificado
                  </span>
                )}
              </div>

              {/* Location */}
              <p className="mt-2 flex items-center gap-1 text-sm text-[#aaa]">
                <svg className="h-4 w-4 shrink-0" style={{ color: "#dcb81e" }} fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                </svg>
                {listing.city}, {listing.zone}
              </p>

              {/* Quick stats */}
              <div className="mt-4 flex flex-wrap gap-4 text-sm text-[#3a3a3a]">
                <span>👥 {listing.guests} invitados</span>
                <span>🛏 {listing.bedrooms} recámaras</span>
                <span>🚿 {listing.bathrooms} baños</span>
                {listing.size && <span>📐 {listing.size}</span>}
              </div>

              <hr className="my-6" style={{ borderColor: "#ebebeb" }} />

              {/* === Descripción === */}
              <section id="section-descripcion">
                <h2 className="mb-1 text-lg font-semibold text-[#484848]">Descripción del anuncio</h2>
                <div className="h-[3px] w-10 mb-4" style={{ backgroundColor: "#dcb81e" }} />
                <p className="whitespace-pre-line text-sm leading-relaxed text-[#3a3a3a]">
                  {listing.description}
                </p>
              </section>

              <hr className="my-6" style={{ borderColor: "#ebebeb" }} />

              {/* === Precio === */}
              <section id="section-precio">
                <h2 className="mb-1 text-lg font-semibold text-[#484848]">Información del Precio</h2>
                <div className="h-[3px] w-10 mb-4" style={{ backgroundColor: "#dcb81e" }} />
                <div className="rounded border p-5 text-sm" style={{ borderColor: "#ebebeb" }}>
                  <div className="grid gap-2">
                    <PriceRow label="Precio por noche" value={`$ ${listing.pricePerNight.toLocaleString("es-MX")}`} />
                    {listing.priceWeekly && <PriceRow label="Precio por noche (7d+)" value={`$ ${listing.priceWeekly}`} />}
                    {listing.priceMonthly && <PriceRow label="Precio por noche (30d+)" value={`$ ${listing.priceMonthly}`} />}
                    {listing.cleaningFee && <PriceRow label="Tarifa de limpieza" value={`$ ${listing.cleaningFee} — Tarifa única`} />}
                  </div>
                </div>
              </section>

              <hr className="my-6" style={{ borderColor: "#ebebeb" }} />

              {/* === Detalles === */}
              <section id="section-detalles">
                <h2 className="mb-1 text-lg font-semibold text-[#484848]">Detalles</h2>
                <div className="h-[3px] w-10 mb-4" style={{ backgroundColor: "#dcb81e" }} />
                <div className="rounded border p-5 text-sm" style={{ borderColor: "#ebebeb" }}>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <DetailRow label="Estado" value={listing.verified ? "Verificado" : "Pendiente"} />
                    <DetailRow label="ID de propiedad" value={String(listing.propertyId)} />
                    {listing.size && <DetailRow label="Tamaño" value={listing.size} />}
                    <DetailRow label="Habitaciones" value={String(listing.bedrooms)} />
                    <DetailRow label="Dormitorios" value={String(listing.bedrooms)} />
                    <DetailRow label="Baños" value={String(listing.bathrooms)} />
                    <DetailRow label="Ciudad" value={listing.city} />
                    <DetailRow label="Zona" value={listing.zone} />
                    <DetailRow label="Condado" value={listing.county} />
                    <DetailRow label="País" value={listing.country} />
                    {listing.extras?.breakfast && <DetailRow label="Desayuno Incluido" value={listing.extras.breakfast} />}
                    {listing.extras?.lateCheckIn && <DetailRow label="Entrada Tardía" value={listing.extras.lateCheckIn} />}
                    {listing.extras?.cancellation && <DetailRow label="Cancelación" value={listing.extras.cancellation} />}
                    {listing.extras?.optionalServices && <DetailRow label="Servicios Opcionales" value={listing.extras.optionalServices} />}
                    {listing.extras?.outdoorFacilities && <DetailRow label="Instalaciones Exteriores" value={listing.extras.outdoorFacilities} />}
                  </div>
                </div>
              </section>

              <hr className="my-6" style={{ borderColor: "#ebebeb" }} />

              {/* === Comodidades === */}
              <section id="section-comodidades">
                <h2 className="mb-1 text-lg font-semibold text-[#484848]">Características</h2>
                <div className="h-[3px] w-10 mb-4" style={{ backgroundColor: "#dcb81e" }} />
                <AmenitiesGrid amenities={listing.amenities} />

                {/* Terms */}
                <div className="mt-6">
                  <h3 className="mb-3 text-sm font-semibold text-[#484848]">Términos y Condiciones</h3>
                  <div className="flex flex-wrap gap-4">
                    {ruleIcons.map((r) => (
                      <div key={r.label} className="flex items-center gap-2 text-sm text-[#3a3a3a]">
                        <span>{r.icon}</span>
                        <span>{r.label}</span>
                        <span style={{ color: r.allowed ? "#22c55e" : r.allowed === false ? "#ef4444" : "#aaa" }}>
                          {r.allowed === true ? "✓ Permitido" : r.allowed === false ? "✗ No permitido" : "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              <hr className="my-6" style={{ borderColor: "#ebebeb" }} />

              {/* === Propietario === */}
              <section id="section-propietario">
                <h2 className="mb-1 text-lg font-semibold text-[#484848]">Propietario</h2>
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
              </section>

              <hr className="my-6" style={{ borderColor: "#ebebeb" }} />

              <ListingHostChat listingId={listing.id} hostName={listing.host.name} />

              <hr className="my-6" style={{ borderColor: "#ebebeb" }} />

              {/* === Mapa === */}
              <section id="section-mapa">
                <h2 className="mb-1 text-lg font-semibold text-[#484848]">Ubicación cercana (No exacta)</h2>
                <div className="h-[3px] w-10 mb-4" style={{ backgroundColor: "#dcb81e" }} />
                <div className="overflow-hidden rounded" style={{ height: "300px", border: "1px solid #ebebeb" }}>
                  <iframe
                    title="Mapa de ubicación aproximada"
                    width="100%"
                    height="100%"
                    style={{ border: 0 }}
                    loading="lazy"
                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${listing.lng - 0.02}%2C${listing.lat - 0.015}%2C${listing.lng + 0.02}%2C${listing.lat + 0.015}&layer=mapnik&marker=${listing.lat}%2C${listing.lng}`}
                  />
                </div>
                <p className="mt-2 text-xs text-[#aaa]">
                  La dirección exacta se proporciona tras confirmar la reserva.
                </p>
              </section>

              <hr className="my-6" style={{ borderColor: "#ebebeb" }} />

              {/* === Reseñas === */}
              <section>
                <h2 className="mb-1 text-lg font-semibold text-[#484848]">Reseñas</h2>
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
                  <span className="text-sm text-[#aaa]">por noche aprox.</span>
                </div>

                <hr className="mb-4 mt-3" style={{ borderColor: "#ebebeb" }} />

                {/* Calendar */}
                <AvailabilityCalendar
                  listingId={listing.id}
                  listingSlug={slug}
                  pricePerNight={listing.pricePerNight}
                  cleaningFee={listing.cleaningFee}
                  blockedDates={listing.blockedDates}
                  nightlyPriceOverrides={listing.nightlyPriceOverrides}
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
                  <button
                    type="button"
                    className="w-full rounded border py-2.5 text-sm font-medium text-[#484848] transition hover:border-[#dcb81e] hover:text-[#dcb81e]"
                    style={{ borderColor: "#ebebeb" }}
                  >
                    ♡ Agregar a los favoritos
                  </button>
                  <button
                    type="button"
                    className="w-full rounded border py-2.5 text-sm font-medium text-[#484848] transition hover:border-[#dcb81e] hover:text-[#dcb81e]"
                    style={{ borderColor: "#ebebeb" }}
                  >
                    ↗ Compartir
                  </button>
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
