import Link from "next/link";
import { listListingsForHost } from "@/lib/marketplace-store";
import { getSessionUser } from "@/lib/session";

export default async function HostDashboardPage() {
  const user = await getSessionUser();
  if (!user) return null;
  const listings = listListingsForHost(user.id);
  const published = listings.filter((l) => l.published).length;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-[#484848]">
          Hola, {(user.fullName?.trim() && user.fullName.split(" ")[0]) || "anfitrión"}
        </h1>
        <p className="mt-1 text-sm text-[#888]">
          Gestiona tus propiedades y datos de contacto. Los datos viven en memoria en desarrollo; en producción irán a MySQL.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-[#ebebeb] bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#aaa]">Alojamientos</p>
          <p className="mt-1 text-3xl font-bold text-[#484848]">{listings.length}</p>
        </div>
        <div className="rounded-xl border border-[#ebebeb] bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#aaa]">Publicados</p>
          <p className="mt-1 text-3xl font-bold text-[#484848]">{published}</p>
        </div>
        <div className="rounded-xl border border-[#ebebeb] bg-white p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#aaa]">Cuenta</p>
          <p className="mt-1 truncate text-sm font-medium text-[#484848]">{user.email}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/host/listings/new"
          className="inline-flex rounded-full px-6 py-3 text-sm font-semibold text-black shadow transition hover:brightness-95"
          style={{ backgroundColor: "#dcb81e" }}
        >
          + Crear alojamiento
        </Link>
        <Link
          href="/host/listings"
          className="inline-flex rounded-full border border-[#ddd] bg-white px-6 py-3 text-sm font-semibold text-[#484848] transition hover:bg-[#f8f8f8]"
        >
          Ver todos
        </Link>
        <Link
          href="/host/calendar"
          className="inline-flex rounded-full border border-[#ddd] bg-white px-6 py-3 text-sm font-semibold text-[#484848] transition hover:bg-[#f8f8f8]"
        >
          Calendario
        </Link>
      </div>
    </div>
  );
}
