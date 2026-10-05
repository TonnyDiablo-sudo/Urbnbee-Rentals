"use client";

import { useCallback, useEffect, useState } from "react";
import { useT } from "@/components/i18n-provider";

type Summary = {
  capacity: number;
  used: number;
  listings: { id: string; title: string; city: string; published: boolean; on: boolean }[];
  demand?: { occupancy: number; multiplier: number; soldOut: boolean; slotsLeft: number };
};

/** Elige qué anuncios usan los lugares pagados de «Anuncio destacado». */
export function FeaturedListingsPanel({ storeHref = "/tienda" }: { storeHref?: string }) {
  const t = useT();
  const [data, setData] = useState<Summary | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/host/featured", { cache: "no-store" }).catch(() => null);
    if (res?.ok) setData(await res.json());
  }, []);

  useEffect(() => {
    const id = setTimeout(() => void load(), 0);
    return () => clearTimeout(id);
  }, [load]);

  async function toggle(listingId: string, on: boolean) {
    setBusy(listingId);
    setErr(null);
    const res = await fetch("/api/host/featured", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId, on }),
    }).catch(() => null);
    const j = res ? await res.json().catch(() => ({})) : {};
    setBusy(null);
    if (!res?.ok) return setErr(typeof j.error === "string" ? j.error : "No se pudo guardar.");
    setData(j as Summary);
  }

  if (!data) return null;

  return (
    <section className="rounded-2xl border border-[#e5e5e5] bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-[#222]">{t("Anuncios destacados")}</h2>
      <p className="mt-1 text-sm text-[#717171]">
        {data.capacity === 0
          ? t("Destaca tus anuncios para que aparezcan primero en las búsquedas. Se paga por anuncio.")
          : t("Usas {used} de {cap} lugares pagados.", { used: data.used, cap: data.capacity })}{" "}
        <a href={storeHref} className="font-semibold text-[#222] underline">
          {data.capacity === 0 ? t("Ir a la Tienda") : t("Agregar más en la Tienda")}
        </a>
      </p>
      {data.demand && (
        <p className={`mt-2 rounded-lg px-3 py-2 text-xs ${data.demand.soldOut ? "bg-amber-50 text-amber-900" : "bg-[#f7f7f7] text-[#555]"}`}>
          {data.demand.soldOut
            ? t("Agotado por ahora: todos los lugares de anuncio destacado están ocupados. Si ya tienes, los conservas.")
            : data.demand.multiplier > 1
              ? t("Quedan {n} lugares. Por la demanda, hoy el precio está {pct} % arriba del normal.", {
                  n: data.demand.slotsLeft,
                  pct: Math.round((data.demand.multiplier - 1) * 100),
                })
              : t("Quedan {n} lugares. El precio sube o baja según cuántos anfitriones lo quieren ahorita.", { n: data.demand.slotsLeft })}
        </p>
      )}
      {err && <p className="mt-2 text-sm text-red-700">{t(err)}</p>}
      <ul className="mt-4 divide-y divide-[#f0f0f0]">
        {data.listings.map((l) => (
          <li key={l.id} className="flex items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="truncate text-[15px] text-[#222]">{l.title}</p>
              <p className="text-xs text-[#888]">
                {[l.city, l.published ? t("Publicado") : t("Borrador")].filter(Boolean).join(" · ")}
              </p>
            </div>
            <label className="flex shrink-0 items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-5 w-5 accent-[#dcb81e]"
                checked={l.on}
                disabled={busy !== null || data.capacity === 0 || !l.published}
                onChange={(e) => void toggle(l.id, e.target.checked)}
              />
              {l.on ? t("Destacado") : t("No")}
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}
