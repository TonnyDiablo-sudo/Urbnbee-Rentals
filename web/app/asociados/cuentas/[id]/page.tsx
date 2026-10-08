import Link from "next/link";
import { notFound } from "next/navigation";
import { loginNameFor } from "@/lib/associate-provision";
import { numberLocale } from "@/lib/i18n";
import { getLang, getT } from "@/lib/i18n/server";
import { getListingStats } from "@/lib/listing-stats-store";
import { findUserById, getHostProfile, listListingsForHost } from "@/lib/marketplace-store";
import { getSessionUser } from "@/lib/session";
import { ResetPasswordButton } from "./reset-password-button";

export default async function AssociateAccountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = (await getSessionUser())!;
  const host = findUserById(id);
  if (!host?.provisionedBy || (host.provisionedBy !== viewer.id && viewer.role !== "admin")) notFound();
  const t = await getT();
  const locale = numberLocale(await getLang());
  const profile = getHostProfile(host.id);
  const listings = listListingsForHost(host.id).map((l) => ({ listing: l, stats: getListingStats(l.id) }));

  return (
    <div className="space-y-6">
      <Link href="/asociados" className="text-sm text-amber-600 underline">
        {t("← Inicio")}
      </Link>
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{host.fullName}</h1>
            <p className="mt-1 font-mono text-sm text-gray-500">
              {t("Usuario:")} {loginNameFor(host.email)}
            </p>
            <p className="text-sm text-gray-500">
              {[profile?.phone && `${t("Tel.")} ${profile.phone}`, profile?.whatsapp && `WhatsApp ${profile.whatsapp}`].filter(Boolean).join(" · ")}
            </p>
            <p className="mt-2 text-xs text-gray-400">
              {t("Creada {date}", { date: new Date(host.createdAt).toLocaleString(locale) })}
            </p>
          </div>
          {host.claimedAt ? (
            <span className="rounded bg-green-100 px-3 py-1 text-sm text-green-700">
              {t("Reclamada el {date}", { date: new Date(host.claimedAt).toLocaleDateString(locale) })}
            </span>
          ) : (
            <ResetPasswordButton hostId={host.id} />
          )}
        </div>
        {host.claimedAt && (
          <p className="mt-3 text-xs text-gray-500">
            {t("El dueño ya administra esta cuenta; ya no puedes cambiar su acceso ni agregarle anuncios.")}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">{t("Anuncios")}</h2>
        {!host.claimedAt && (
          <Link href={`/asociados/capturar?host=${host.id}`} className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white">
            {t("+ Agregar anuncio con capturas")}
          </Link>
        )}
      </div>
      {!host.claimedAt && (
        <p className="-mt-3 text-xs text-gray-500">
          {t("Con la extensión, abre el otro anuncio y elige esta cuenta en la pantalla de revisión.")}
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
                {l.city} · ${l.pricePerNight.toLocaleString(locale)} {t("/ noche")} · {l.published ? t("Publicado") : t("Oculto")}
              </p>
              <p className="mt-1 text-xs text-gray-500">
                {t("{views} vistas · {contacts} contactos vistos", { views: stats.viewsTotal, contacts: stats.contactsTotal })}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
