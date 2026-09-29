import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AmenitiesGrid } from "@/components/listing/amenities-grid";
import { ReviewsSection } from "@/components/listing/reviews-section";
import { listingIsBookable } from "@/lib/app-listings";
import { getListingDetail } from "@/lib/get-listing-detail";
import { stripHostContactChannels } from "@/lib/host-contact-policy";
import { getListingById } from "@/lib/marketplace-store";
import { getSessionUser } from "@/lib/session";
import { FloatingBack } from "./floating-back";
import { ListingActionBar } from "./listing-action-bar";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return { title: getListingDetail(slug)?.title ?? "Alojamiento" };
}

export default async function AppListingPage({ params }: Props) {
  const { slug } = await params;
  const listing = getListingDetail(slug);
  if (!listing) notFound();

  const viewer = await getSessionUser();
  const record = getListingById(listing.id);
  const hostListing = Boolean(record?.published);
  const bookable = listingIsBookable(listing.id);
  const isOwn = Boolean(viewer && record && viewer.id === record.hostId);
  const host = viewer ? listing.host : stripHostContactChannels(listing.host);
  const place = [listing.city, listing.zone].filter(Boolean).join(", ");
  const photos = listing.photos.length > 0 ? listing.photos : ["/app-icons/icon-512.png"];

  const rules = [
    { label: "Mascotas", v: listing.rules.pets },
    { label: "Fumar", v: listing.rules.smoking },
    { label: "Fiestas", v: listing.rules.parties },
    { label: "Niños", v: listing.rules.children },
  ].filter((r) => r.v !== null);

  return (
    <div className="pb-[calc(96px+env(safe-area-inset-bottom))]">
      <div className="relative">
        <div className="flex aspect-[4/3] snap-x snap-mandatory overflow-x-auto bg-[#eee] [scrollbar-width:none]">
          {photos.map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={`${src}-${i}`}
              src={src}
              alt={i === 0 ? listing.title : ""}
              className="h-full w-full shrink-0 snap-center object-cover"
              loading={i === 0 ? "eager" : "lazy"}
            />
          ))}
        </div>
        <FloatingBack />
        {photos.length > 1 && (
          <span className="absolute bottom-3 right-3 rounded-md bg-black/60 px-2 py-0.5 text-xs font-medium text-white">
            {photos.length} fotos · desliza
          </span>
        )}
      </div>

      <div className="px-5 pt-5">
        <h1 className="text-[24px] font-bold leading-tight text-[#222]">{listing.title}</h1>
        {place && <p className="mt-1 text-[15px] text-[#484848]">{place}</p>}
        <p className="mt-1 text-sm text-[#717171]">
          {listing.guests} huéspedes · {listing.bedrooms} recámaras · {listing.bathrooms} baños
          {listing.size ? ` · ${listing.size}` : ""}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {listing.verified ? (
            <span className="rounded-full bg-[#fdf6d8] px-3 py-1 text-xs font-semibold text-[#8a6d0f]">
              ✓ Miembro verificado
            </span>
          ) : (
            <span className="rounded-full bg-[#f3f3f3] px-3 py-1 text-xs font-medium text-[#717171]">
              Anfitrión no verificado
            </span>
          )}
          {bookable && (
            <span className="rounded-full bg-[#111] px-3 py-1 text-xs font-semibold text-white">
              Reserva protegida en Cabibee
            </span>
          )}
        </div>

        <Section>
          <div className="flex items-center gap-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={listing.host.avatarUrl}
              alt=""
              className="h-14 w-14 shrink-0 rounded-full object-cover ring-2 ring-[#dcb81e]"
            />
            <div className="min-w-0">
              <p className="text-base font-semibold text-[#222]">Anfitrión: {listing.host.name}</p>
              <p className="line-clamp-2 text-sm text-[#717171]">{listing.host.bio}</p>
            </div>
          </div>
        </Section>

        {!bookable && (
          <Section>
            <p className="rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm leading-relaxed text-[#484848]">
              Este anfitrión todavía no recibe reservas dentro de Cabibee. Puedes{" "}
              {hostListing ? "escribirle por el chat o " : ""}ver sus datos de contacto y acordar directamente.
            </p>
          </Section>
        )}

        <Section title="Acerca de este lugar">
          <p className="whitespace-pre-line text-[15px] leading-relaxed text-[#333]">{listing.description}</p>
        </Section>

        {listing.amenities.length > 0 && (
          <Section title="Lo que ofrece">
            <AmenitiesGrid amenities={listing.amenities} />
          </Section>
        )}

        {rules.length > 0 && (
          <Section title="Reglas de la casa">
            <ul className="grid grid-cols-2 gap-2 text-sm text-[#333]">
              {rules.map((r) => (
                <li key={r.label}>
                  {r.v ? "✓" : "✗"} {r.label} {r.v ? "permitido" : "no permitido"}
                </li>
              ))}
            </ul>
          </Section>
        )}

        <Section title="Precio">
          <dl className="space-y-1.5 text-[15px] text-[#333]">
            <Row label="Por noche" value={`$${listing.pricePerNight.toLocaleString("es-MX")} MXN`} />
            {listing.cleaningFee ? (
              <Row label="Limpieza (una vez)" value={`$${listing.cleaningFee.toLocaleString("es-MX")} MXN`} />
            ) : null}
            {listing.depositMxn ? (
              <Row label="Depósito (entre ustedes)" value={`$${listing.depositMxn.toLocaleString("es-MX")} MXN`} />
            ) : null}
          </dl>
        </Section>

        <Section title="Ubicación aproximada">
          <div className="h-52 overflow-hidden rounded-2xl border border-[#ebebeb]">
            <iframe
              title="Mapa aproximado"
              width="100%"
              height="100%"
              style={{ border: 0 }}
              loading="lazy"
              src={`https://www.openstreetmap.org/export/embed.html?bbox=${listing.lng - 0.02}%2C${listing.lat - 0.015}%2C${listing.lng + 0.02}%2C${listing.lat + 0.015}&layer=mapnik&marker=${listing.lat}%2C${listing.lng}`}
            />
          </div>
          <p className="mt-2 text-xs text-[#999]">La dirección exacta se comparte al confirmar la reserva.</p>
        </Section>

        <Section title="Reseñas">
          <ReviewsSection reviews={listing.reviews} />
        </Section>
      </div>

      <ListingActionBar
        listingId={listing.id}
        slug={slug}
        pricePerNight={listing.pricePerNight}
        cleaningFee={listing.cleaningFee}
        depositMxn={listing.depositMxn}
        blockedDates={listing.blockedDates}
        nightlyPriceOverrides={listing.nightlyPriceOverrides}
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-[#717171]">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
