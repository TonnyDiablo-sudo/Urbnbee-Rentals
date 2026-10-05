import Link from "next/link";
import { listDraftsForAssociate } from "@/lib/associate-drafts-store";
import { getT } from "@/lib/i18n/server";
import { getStatsTotalsForListings } from "@/lib/listing-stats-store";
import { listListingsForHost, listUsersProvisionedBy } from "@/lib/marketplace-store";
import { getSessionUser } from "@/lib/session";

export default async function AssociatesHome() {
  const user = (await getSessionUser())!;
  const t = await getT();
  const drafts = listDraftsForAssociate(user.id, "pending");
  const accounts = listUsersProvisionedBy(user.id).map((u) => {
    const listings = listListingsForHost(u.id);
    return { user: u, listings, stats: getStatsTotalsForListings(listings.map((l) => l.id)) };
  });
  const claimed = accounts.filter((a) => a.user.claimedAt).length;

  return (
    <div className="space-y-10">
      <section className="grid gap-4 sm:grid-cols-3">
        <Stat label={t("Cuentas creadas")} value={accounts.length} />
        <Stat label={t("Reclamadas por el dueño")} value={claimed} />
        <Stat label={t("Borradores por revisar")} value={drafts.length} />
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">{t("Por revisar")}</h2>
          <Link href="/asociados/capturar" className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white hover:bg-amber-600">
            {t("+ Subir capturas")}
          </Link>
        </div>
        {drafts.length === 0 ? (
          <p className="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-500">
            {t("Nada pendiente. Importa un anuncio con la extensión de Chrome o sube capturas.")}
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {drafts.map((d) => (
              <li key={d.id}>
                <Link href={`/asociados/borradores/${d.id}`} className="flex gap-3 rounded-xl border border-gray-200 bg-white p-3 hover:border-amber-400">
                  {d.photos[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={d.photos[0]} alt="" className="h-16 w-20 shrink-0 rounded-lg object-cover" />
                  ) : (
                    <div className="h-16 w-20 shrink-0 rounded-lg bg-gray-100" />
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-900">{d.listing.title}</p>
                    <p className="truncate text-xs text-gray-500">
                      {[d.listing.city, d.contact.hostName].filter(Boolean).join(" · ") || t("Sin ciudad")}
                    </p>
                    <p className="mt-1 text-xs text-gray-400">
                      {d.source.site ?? (d.source.kind === "screenshots" ? t("Capturas") : d.source.kind)} ·{" "}
                      {t("{count} fotos", { count: d.photos.length })}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-gray-900">{t("Mis cuentas de anfitrión")}</h2>
        {accounts.length === 0 ? (
          <p className="text-sm text-gray-500">{t("Todavía no creas cuentas.")}</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs text-gray-500">
                  <th className="px-4 py-2 font-medium">{t("Anfitrión")}</th>
                  <th className="px-4 py-2 font-medium">{t("Usuario")}</th>
                  <th className="px-4 py-2 font-medium">{t("Anuncios")}</th>
                  <th className="px-4 py-2 font-medium">{t("Vistas / contactos")}</th>
                  <th className="px-4 py-2 font-medium">{t("Estado")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {accounts.map(({ user: u, listings, stats }) => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2">
                      <Link href={`/asociados/cuentas/${u.id}`} className="font-medium text-gray-900 underline">
                        {u.fullName}
                      </Link>
                    </td>
                    <td className="px-4 py-2 font-mono text-xs text-gray-500">{u.email}</td>
                    <td className="px-4 py-2 text-gray-700">{listings.length}</td>
                    <td className="px-4 py-2 text-gray-700">
                      {stats.views} / {stats.contacts}
                    </td>
                    <td className="px-4 py-2">
                      {u.claimedAt ? (
                        <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">{t("Reclamada")}</span>
                      ) : (
                        <span className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{t("Sin reclamar")}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      <p className="mt-1 text-xs text-gray-500">{label}</p>
    </div>
  );
}
