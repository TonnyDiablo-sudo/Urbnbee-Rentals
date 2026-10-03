import Link from "next/link";
import { notFound } from "next/navigation";
import { getListingStats } from "@/lib/listing-stats-store";
import { findUserById, getHostProfile, listListingsForHost } from "@/lib/marketplace-store";
import { getSessionUser } from "@/lib/session";
import { ResetPasswordButton } from "./reset-password-button";

export default async function AssociateAccountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = (await getSessionUser())!;
  const host = findUserById(id);
  if (!host?.provisionedBy || (host.provisionedBy !== viewer.id && viewer.role !== "admin")) notFound();
  const profile = getHostProfile(host.id);
  const listings = listListingsForHost(host.id).map((l) => ({ listing: l, stats: getListingStats(l.id) }));

  return (
    <div className="space-y-6">
      <Link href="/asociados" className="text-sm text-amber-600 underline">
        ← Inicio
      </Link>
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{host.fullName}</h1>
            <p className="mt-1 font-mono text-sm text-gray-500">Usuario: {host.email}</p>
            <p className="text-sm text-gray-500">
              {[profile?.phone && `Tel. ${profile.phone}`, profile?.whatsapp && `WhatsApp ${profile.whatsapp}`].filter(Boolean).join(" · ")}
            </p>
            <p className="mt-2 text-xs text-gray-400">Creada {new Date(host.createdAt).toLocaleString("es-MX")}</p>
          </div>
          {host.claimedAt ? (
            <span className="rounded bg-green-100 px-3 py-1 text-sm text-green-700">
              Reclamada el {new Date(host.claimedAt).toLocaleDateString("es-MX")}
            </span>
          ) : (
            <ResetPasswordButton hostId={host.id} />
          )}
        </div>
        {host.claimedAt && (
          <p className="mt-3 text-xs text-gray-500">El dueño ya administra esta cuenta; ya no puedes cambiar su acceso ni agregarle anuncios.</p>
        )}
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Anuncios</h2>
        {!host.claimedAt && (
          <Link href={`/asociados/capturar?host=${host.id}`} className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white">
            + Agregar anuncio con capturas
          </Link>
        )}
      </div>
      {!host.claimedAt && (
        <p className="-mt-3 text-xs text-gray-500">
          Con la extensión, abre el otro anuncio y elige esta cuenta en la pantalla de revisión.
        </p>
      )}
      <ul className="grid gap-3 sm:grid-cols-2">
        {listings.map(({ listing: l, stats }) => (
          <li key={l.id} className="flex gap-3 rounded-xl border border-gray-200 bg-white p-3">
            {l.photos[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={l.photos[0]} alt="" className="h-20 w-28 shrink-0 rounded-lg object-cover" />
            ) : (
              <div className="h-20 w-28 shrink-0 rounded-lg bg-gray-100" />
            )}
            <div className="min-w-0">
              <a href={`/listings/${l.slug}`} target="_blank" rel="noreferrer" className="block truncate text-sm font-semibold text-gray-900 underline">
                {l.title}
              </a>
              <p className="text-xs text-gray-500">
                {l.city} · ${l.pricePerNight.toLocaleString("es-MX")} / noche · {l.published ? "Publicado" : "Oculto"}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {stats.viewsTotal} vistas · {stats.contactsTotal} contactos vistos
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
