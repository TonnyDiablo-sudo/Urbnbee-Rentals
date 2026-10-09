import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { StaffDesk } from "./staff-desk";

export const dynamic = "force-dynamic";

export default async function AdminStaffPage() {
  const t = await getT();
  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="mb-1 text-xl font-semibold text-gray-900">{t("Equipo")}</h1>
      <p className="mb-2 text-sm text-gray-500">{t("Administradores de segundo nivel. Solo entran a lo que marques aquí.")}</p>
      <p className="mb-5 text-sm">
        <Link href="/centro" className="text-amber-700 underline">
          {t("Centro de administración")}
        </Link>
      </p>
      <StaffDesk />
    </div>
  );
}
