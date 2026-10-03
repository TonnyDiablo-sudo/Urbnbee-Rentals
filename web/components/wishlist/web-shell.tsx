import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import type { TFn } from "@/lib/i18n";

export function WishlistWebShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="flex-1 bg-white" style={{ paddingTop: "88px" }}>
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">{children}</div>
      </main>
      <SiteFooter />
    </>
  );
}

/** Para quien todavía no entra: lo manda a crear cuenta o iniciar sesión y regresa a `next`. */
export function WebAuthButtons({ t, next, title, message }: { t: TFn; next: string; title: string; message: string }) {
  const q = `next=${encodeURIComponent(next)}`;
  return (
    <div className="mt-8 max-w-md">
      <h2 className="text-2xl font-semibold text-[#222]">{t(title)}</h2>
      <p className="mt-2 text-[15px] leading-relaxed text-[#555]">{t(message)}</p>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link href={`/register?${q}`} className="rounded px-5 py-3 text-sm font-semibold text-black" style={{ backgroundColor: "#dcb81e" }}>
          {t("Crear cuenta gratis")}
        </Link>
        <Link href={`/login?${q}`} className="rounded border border-[#222] px-5 py-3 text-sm font-semibold text-[#222]">
          {t("Ya tengo cuenta")}
        </Link>
      </div>
    </div>
  );
}
