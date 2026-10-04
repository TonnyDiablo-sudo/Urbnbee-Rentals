"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { AuthNav, AuthNavMobile } from "@/components/auth-nav";
import { useT } from "@/components/i18n-provider";
import { LangSwitch } from "@/components/lang-switch";

const nav = [
  { href: "/", label: "Inicio" },
  { href: "/alojamientos", label: "Alojamientos" },
  { href: "/membresia", label: "Membresía" },
  { href: "/nosotros", label: "Nosotros" },
  { href: "/como-funciona#servicios", label: "Servicios" },
  { href: "/blog", label: "Blog" },
  { href: "/contacto", label: "Contacto" },
];

type Props = {
  /** Ref to the sentinel div at the bottom of the hero. When it leaves the
   *  viewport, the header switches from transparent to solid black. */
  heroSentinelRef?: React.RefObject<HTMLDivElement | null>;
};

export function SiteHeader({ heroSentinelRef }: Props) {
  const t = useT();
  // When no sentinel is provided (e.g. inner pages), default to solid black.
  const [heroVisible, setHeroVisible] = useState(!!heroSentinelRef);
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const sentinel = heroSentinelRef?.current;
    if (!sentinel) {
      // No sentinel → always solid black (non-hero pages)
      setHeroVisible(false);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        // Hero sentinel is visible → header is transparent.
        // Sentinel leaves → header turns black.
        setHeroVisible(entry.isIntersecting);
      },
      { threshold: 0, rootMargin: "0px 0px 0px 0px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [heroSentinelRef]);

  const transparent = heroVisible;

  return (
    <>
      <header
        className="fixed left-0 right-0 top-0 z-50 transition-colors duration-300"
        style={{ backgroundColor: transparent ? "transparent" : "#000000" }}
      >
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          {/* Mobile hamburger */}
          <button
            type="button"
            className="flex items-center justify-center text-white lg:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label={t("Abrir menú")}
          >
            <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          {/* Logo: CABI white + BEE gold + tagline */}
          <Link href="/" className="flex shrink-0 flex-col leading-none">
            <span className="text-xl font-bold tracking-wider">
              <span className="text-white">CABI</span>
              <span style={{ color: "#dcb81e" }}>BEE</span>
            </span>
            <span className="text-[10px] font-light tracking-widest text-white/70">
              Your Booking Bee
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-0.5 lg:flex" aria-label={t("Principal")}>
            {nav.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="px-4 py-2 text-sm font-medium transition-colors"
                  style={{ color: isActive ? "#dcb81e" : "#ffffff" }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "#dcb81e"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = isActive ? "#dcb81e" : "#ffffff"; }}
                >
                  {t(item.label)}
                </Link>
              );
            })}
          </nav>

          {/* Auth */}
          <div className="flex items-center gap-4 shrink-0">
            <div className="hidden sm:flex">
              <LangSwitch dark />
            </div>
            {/* En celular la cuenta y «Enviar propiedad» viven en el menú: en la barra no caben. */}
            <div className="hidden items-center gap-4 sm:flex">
              <AuthNav />
            </div>
            <Link
              href="/register?intent=host"
              className="hidden rounded px-4 py-2 text-sm font-semibold text-black transition hover:brightness-90 sm:inline-block"
              style={{ backgroundColor: "#dcb81e" }}
            >
              {t("Enviar propiedad")}
            </Link>
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[100] flex">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <nav className="relative z-10 flex w-72 flex-col gap-1 bg-black p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <LangSwitch dark />
              <button
                type="button"
                className="text-white"
                onClick={() => setMobileOpen(false)}
                aria-label={t("Cerrar menú")}
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded px-3 py-3 text-sm font-medium text-white transition hover:text-[#dcb81e]"
                onClick={() => setMobileOpen(false)}
              >
                {t(item.label)}
              </Link>
            ))}
            <a
              href="/app"
              className="mt-3 flex items-center justify-between rounded-lg px-3 py-3 text-sm font-semibold text-black"
              style={{ backgroundColor: "#dcb81e" }}
            >
              {t("Usar la app de Cabibee")}
              <span aria-hidden>→</span>
            </a>
            <Link
              href="/register?intent=host"
              className="mt-2 block rounded-lg border border-[#dcb81e] px-3 py-3 text-sm font-semibold text-[#dcb81e]"
              onClick={() => setMobileOpen(false)}
            >
              {t("Enviar propiedad")}
            </Link>
            <hr className="my-3 border-white/10" />
            <AuthNavMobile onNavigate={() => setMobileOpen(false)} />
          </nav>
        </div>
      )}
    </>
  );
}
