"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconBack } from "./icons";

/** Encabezado de pantalla. Con `back`, muestra la flecha para regresar. */
export function TopBar({
  title,
  back,
  right,
}: {
  title: string;
  back?: string;
  right?: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <header
      className="sticky top-0 z-30 flex items-center gap-2 border-b border-[#f0f0f0] bg-white/95 px-3 backdrop-blur"
      style={{ paddingTop: "env(safe-area-inset-top)", minHeight: "calc(56px + env(safe-area-inset-top))" }}
    >
      {back ? (
        <button
          type="button"
          onClick={() => (window.history.length > 1 ? router.back() : router.push(back))}
          className="flex h-10 w-10 items-center justify-center rounded-full text-[#222] hover:bg-[#f5f5f5]"
          aria-label="Regresar"
        >
          <IconBack />
        </button>
      ) : (
        <span className="w-1" />
      )}
      <h1 className="min-w-0 flex-1 truncate text-base font-semibold text-[#222]">{title}</h1>
      {right}
    </header>
  );
}

/** Título grande de pestaña principal (Explorar, Viajes, Mensajes…). */
export function TabHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <header className="px-5 pb-3" style={{ paddingTop: "calc(20px + env(safe-area-inset-top))" }}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-[28px] font-bold leading-tight text-[#222]">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-[#717171]">{subtitle}</p>}
        </div>
        {right}
      </div>
    </header>
  );
}

export function Brand({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`inline-flex flex-col leading-none ${className}`} aria-label="Cabibee">
      <span className="text-lg font-bold tracking-wider">
        <span className="text-[#111]">CABI</span>
        <span className="text-[#dcb81e]">BEE</span>
      </span>
    </Link>
  );
}
