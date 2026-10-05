"use client";

import { useCallback, useEffect, useState } from "react";
import { useT } from "@/components/i18n-provider";

type Summary = {
  capacity: number | "all";
  used: number;
  identityReady: boolean;
  listings: { id: string; title: string; city: string; published: boolean; on: boolean; addressReady: boolean }[];
};

/** Elige qué anuncios usan los lugares pagados del motor de reservas. */
export function EngineListingsPanel({ storeHref = "/tienda" }: { storeHref?: string }) {
  const t = useT();
  const [data, setData] = useState<Summary | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/host/booking-engine", { cache: "no-store" }).catch(() => null);
    if (res?.ok) setData(await res.json());
  }, []);

  useEffect(() => {
    const id = setTimeout(() => void load(), 0);
    return () => clearTimeout(id);
  }, [load]);

  async function toggle(listingId: string, on: boolean) {
    setBusy(listingId);
    setErr(null);
    const res = await fetch("/api/host/booking-engine", {
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
  const all = data.capacity === "all";

  return (
    <section className="rounded-2xl border border-[#e5e5e5] bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-[#222]">{t("Anuncios con motor de reservas")}</h2>
      <p className="mt-1 text-sm text-[#717171]">
        {all
          ? t("Tu suscripción cubre todos tus anuncios.")
          : data.capacity === 0
            ? t("Todavía no tienes el motor de reservas. Se paga por anuncio.")
            : t("Usas {used} de {cap} lugares pagados.", { used: data.used, cap: data.capacity })}{" "}
        <a href={storeHref} className="font-semibold text-[#222] underline">
          {data.capacity === 0 ? t("Ir a la Tienda") : t("Agregar más en la Tienda")}
        </a>
      </p>
      {err && <p className="mt-2 text-sm text-red-700">{t(err)}</p>}
      {!data.identityReady && (
        <p className="mt-3 rounded-xl bg-[#fdf6d8] px-4 py-3 text-sm text-[#5c4a0a]">
          {t("El motor de reservas necesita tu verificación de identidad contratada y aprobada. Se compra aparte en la Tienda.")}
        </p>
      )}
      <ul className="mt-4 divide-y divide-[#f0f0f0]">
        {data.listings.map((l) => (
          <li key={l.id} className="flex items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="truncate text-[15px] text-[#222]">{l.title}</p>
              <p className="text-xs text-[#888]">
                {[l.city, l.published ? t("Publicado") : t("Borrador")].filter(Boolean).join(" · ")}
              </p>
              {l.on && !l.addressReady && (
                <p className="text-xs text-[#a15c00]">{t("Falta la dirección verificada: no recibe reservas hasta tenerla.")}</p>
              )}
            </div>
            <label className="flex shrink-0 items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="h-5 w-5 accent-[#dcb81e]"
                checked={l.on}
                disabled={all || busy !== null || data.capacity === 0}
                onChange={(e) => void toggle(l.id, e.target.checked)}
              />
              {l.on ? t("Activo") : t("Apagado")}
            </label>
          </li>
        ))}
      </ul>
    </section>
  );
}
