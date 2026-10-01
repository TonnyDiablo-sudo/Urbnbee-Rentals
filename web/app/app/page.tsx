import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LangSwitch } from "@/components/lang-switch";
import { APP_BROWSE_FILTERS, appBrowseListings } from "@/lib/app-listings";
import { getT } from "@/lib/i18n/server";
import { getSessionUser } from "@/lib/session";
import { IconSearch } from "./_components/icons";
import { AppListingCardView } from "./_components/listing-card";
import { InstallBanner } from "./_components/install-banner";
import { NotificationBell } from "./_components/notifications";
import { Brand } from "./_components/top-bar";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Explorar") };
}

type Props = { searchParams: Promise<{ q?: string; tipo?: string; source?: string }> };

export default async function AppExplorePage({ searchParams }: Props) {
  const { q = "", tipo = "", source } = await searchParams;

  // Al abrir el ícono instalado se vuelve al modo en que la persona se quedó.
  if (source === "pwa") {
    const user = await getSessionUser();
    const mode = (await cookies()).get("cabibee_mode")?.value;
    if (mode === "host" && (user?.role === "host" || user?.role === "admin")) redirect("/host");
  }

  const t = await getT();
  const listings = appBrowseListings({ tipo, q });
  const hrefFor = (key: string) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (key) p.set("tipo", key);
    const s = p.toString();
    return s ? `/?${s}` : "/";
  };

  return (
    <>
      <div
        className="sticky top-0 z-30 bg-white px-4 pb-2"
        style={{ paddingTop: "calc(12px + env(safe-area-inset-top))" }}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <Brand />
          <div className="flex items-center gap-1">
            <LangSwitch />
            <NotificationBell />
          </div>
        </div>
        <form action="/" className="relative">
          {tipo && <input type="hidden" name="tipo" value={tipo} />}
          <IconSearch className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#222]" />
          <input
            name="q"
            defaultValue={q}
            placeholder={t("¿A dónde vas? Ciudad, zona o tipo")}
            enterKeyHint="search"
            className="w-full rounded-full border border-[#e5e5e5] bg-white py-3.5 pl-12 pr-4 text-base shadow-[0_3px_12px_rgba(0,0,0,0.08)] outline-none placeholder:text-[#8a8a8a] focus:border-[#222]"
          />
        </form>
        <div className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
          {APP_BROWSE_FILTERS.map((f) => {
            const active = f.key === tipo;
            return (
              <Link
                key={f.key || "all"}
                href={hrefFor(f.key)}
                className={`shrink-0 rounded-full border px-4 py-2 text-[13px] font-medium ${
                  active ? "border-black bg-black text-white" : "border-[#e0e0e0] bg-white text-[#484848]"
                }`}
              >
                {t(f.label)}
              </Link>
            );
          })}
        </div>
      </div>

      <InstallBanner />

      <div className="space-y-7 px-4 pb-6 pt-3">
        {listings.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-base font-semibold text-[#222]">{t("Sin resultados")}</p>
            <p className="mt-1 text-sm text-[#717171]">{t("Prueba otra ciudad o quita el filtro.")}</p>
            <Link href="/" className="mt-4 inline-block text-sm font-semibold underline">
              {t("Ver todo")}
            </Link>
          </div>
        ) : (
          listings.map((l, i) => <AppListingCardView key={l.id} listing={l} t={t} priority={i === 0} />)
        )}
      </div>
    </>
  );
}
