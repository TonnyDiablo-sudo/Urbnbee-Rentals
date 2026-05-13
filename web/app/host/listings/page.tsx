import Link from "next/link";
import { listListingsForHost } from "@/lib/marketplace-store";
import { getSessionUser } from "@/lib/session";

export default async function HostListingsPage() {
  const user = await getSessionUser();
  if (!user) return null;
  const listings = listListingsForHost(user.id);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[#484848]">Mis alojamientos</h1>
          <p className="mt-1 text-sm text-[#888]">Edita fotos, descripción, ubicación y datos de contacto.</p>
        </div>
        <Link
          href="/host/listings/new"
          className="rounded-full px-5 py-2.5 text-sm font-semibold text-black shadow transition hover:brightness-95"
          style={{ backgroundColor: "#dcb81e" }}
        >
          + Nuevo
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#ebebeb] bg-white shadow-sm">
        {listings.length === 0 ? (
          <p className="p-10 text-center text-sm text-[#888]">
            Aún no tienes alojamientos.{" "}
            <Link href="/host/listings/new" className="font-semibold text-[#dcb81e] underline">
              Crea uno
            </Link>
            .
          </p>
        ) : (
          <ul className="divide-y divide-[#ebebeb]">
            {listings.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
                <div className="min-w-0">
                  <p className="font-medium text-[#484848]">{l.title}</p>
                  <p className="truncate text-xs text-[#aaa]">{l.slug}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                        l.published ? "bg-green-100 text-green-800" : "bg-[#f0f0f0] text-[#666]"
                      }`}
                    >
                      {l.published ? "Publicado" : "Borrador"}
                    </span>
                    <span className="text-xs text-[#888]">${l.pricePerNight} / noche</span>
                  </div>
                </div>
                <Link
                  href={`/host/listings/${l.id}/edit`}
                  className="shrink-0 rounded-full border border-[#ddd] px-4 py-2 text-sm font-semibold text-[#484848] transition hover:border-black hover:bg-black hover:text-white"
                >
                  Editar
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
