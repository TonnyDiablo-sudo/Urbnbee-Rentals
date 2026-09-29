import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ListingCard } from "@/components/listing-card";
import { BROWSE_TITLES, getBrowseListings } from "@/lib/browse-merge";

type Props = { searchParams: Promise<{ tipo?: string }> };

export default async function AlojamientosPage({ searchParams }: Props) {
  const { tipo } = await searchParams;
  const items = getBrowseListings(tipo);
  const title = (tipo && BROWSE_TITLES[tipo.toLowerCase()]) || "Alojamientos";

  return (
    <>
      <SiteHeader />
      <main className="flex-1 bg-white" style={{ paddingTop: "88px" }}>
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <Link href="/" className="text-sm font-medium" style={{ color: "#dcb81e" }}>
            ← Inicio
          </Link>
          <h1 className="mt-3 text-3xl font-semibold text-[#484848]">{title}</h1>
          <div className="mt-2 h-1 w-16" style={{ backgroundColor: "#dcb81e" }} />
          <p className="mt-3 text-sm text-[#3a3a3a]">
            {items.length === 1 ? "1 listado" : `${items.length} listados`}
          </p>

          {items.length === 0 ? (
            <p className="mt-10 text-sm text-[#3a3a3a]">Todavía no hay anuncios en esta categoría.</p>
          ) : (
            <div className="mt-8 grid gap-6 sm:grid-cols-2">
              {items.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
