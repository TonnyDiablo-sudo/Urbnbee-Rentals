import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { getSessionUser } from "@/lib/session";
import { hasStaffPermission } from "@/lib/staff";

export const dynamic = "force-dynamic";

export default async function CentroHomePage() {
  const user = await getSessionUser();
  const t = await getT();
  return (
    <div className="space-y-3">
      <h1 className="text-xl font-semibold text-gray-900">{t("Centro de administración")}</h1>
      <p className="text-sm text-gray-500">{t("Solo ves las secciones que te asignaron.")}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {hasStaffPermission(user, "appeals") && (
          <Link href="/centro/resoluciones" className="rounded-xl border border-gray-200 bg-white p-4 text-sm font-semibold text-gray-900">
            {t("Resoluciones de cuentas")}
          </Link>
        )}
        {hasStaffPermission(user, "reports") && (
          <Link href="/centro/reportes" className="rounded-xl border border-gray-200 bg-white p-4 text-sm font-semibold text-gray-900">
            {t("Reportes de cuentas")}
          </Link>
        )}
        {hasStaffPermission(user, "agent") && (
          <Link href="/centro/revisor" className="rounded-xl border border-gray-200 bg-white p-4 text-sm font-semibold text-gray-900">
            {t("Revisor de denuncias")}
          </Link>
        )}
      </div>
    </div>
  );
}
