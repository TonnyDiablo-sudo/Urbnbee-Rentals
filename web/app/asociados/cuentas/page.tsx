import Link from "next/link";
import { loginNameFor } from "@/lib/associate-provision";
import { mxDay } from "@/lib/associate-stats";
import { getT } from "@/lib/i18n/server";
import { getStatsTotalsForListings } from "@/lib/listing-stats-store";
import { listListingsForHost, listUsersProvisionedBy } from "@/lib/marketplace-store";
import { getSessionUser } from "@/lib/session";

export default async function MyAccountsPage() {
  const user = (await getSessionUser())!;
  const t = await getT();
  const accounts = listUsersProvisionedBy(user.id).map((u) => {
    const listings = listListingsForHost(u.id);
    return { user: u, listings, stats: getStatsTotalsForListings(listings.map((l) => l.id)) };
  });

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-gray-900">
        {t("Mis cuentas")} <span className="text-gray-400">({accounts.length})</span>
      </h1>
      {accounts.length === 0 ? (
        <p className="text-sm text-gray-500">{t("Todavía no creas cuentas.")}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs text-gray-500">
                <th className="px-4 py-2 font-medium">{t("Creada")}</th>
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
                  <td className="whitespace-nowrap px-4 py-2 text-xs text-gray-500">{mxDay(u.createdAt)}</td>
                  <td className="px-4 py-2">
                    <Link href={`/asociados/cuentas/${u.id}`} className="font-medium text-gray-900 underline">
                      {u.fullName}
                    </Link>
                  </td>
                  <td className="px-4 py-2 font-mono text-xs text-gray-500">{loginNameFor(u.email)}</td>
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
    </div>
  );
}
