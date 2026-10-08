"use client";

import { useEffect, type ReactNode } from "react";
import { useT } from "@/components/i18n-provider";
import type { ListingImportLlmPayload } from "@/lib/listing-import-types";

const GOLD = "#dcb81e";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-[#ebebeb] pt-6">
      <h2 className="mb-1 text-lg font-semibold text-[#484848]">{title}</h2>
      <div className="mb-4 h-[3px] w-10" style={{ backgroundColor: GOLD }} />
      {children}
    </section>
  );
}

/** Cómo se verá el anuncio publicado (mismo diseño que /listings/[slug]), con lo que hay ahora en el formulario. */
export function ListingPreview({
  listing: l,
  photos,
  hostName,
  location,
  exactAddress,
  problems,
  publishLabel,
  publishing,
  onPublish,
  onClose,
}: {
  listing: ListingImportLlmPayload;
  photos: string[];
  hostName: string;
  location: string;
  exactAddress?: string;
  problems: string[];
  publishLabel: string;
  publishing: boolean;
  onPublish: () => void;
  onClose: () => void;
}) {
  const t = useT();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const price = l.pricePerNight ? `$ ${Math.round(l.pricePerNight).toLocaleString("es-MX")}` : "$ —";
  const rules = [
    { label: "Fumar", allowed: l.rules?.smoking, icon: "🚬" },
    { label: "Mascotas", allowed: l.rules?.pets, icon: "🐾" },
    { label: "Fiestas", allowed: l.rules?.parties, icon: "🎉" },
    { label: "Niños permitidos", allowed: l.rules?.children, icon: "👶" },
  ];
  const [cover, ...rest] = photos;
  const name = hostName.trim() || t("Anfitrión");

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/60" role="dialog" aria-modal="true">
      <div className="flex items-center gap-3 bg-gray-900 px-4 py-3 text-white">
        <span className="text-sm font-semibold">👁 {t("Vista previa · así lo verá la gente")}</span>
        <span className="hidden text-xs text-gray-400 sm:inline">{t("Todavía no está publicado.")}</span>
        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-white/30 px-3 py-1.5 text-sm">
            {t("Seguir editando")}
          </button>
          <button
            type="button"
            disabled={publishing || problems.length > 0}
            onClick={onPublish}
            title={problems.length ? problems.map((p) => t(p)).join("\n") : undefined}
            className="rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-semibold disabled:opacity-40"
          >
            {publishing ? t("Publicando…") : publishLabel}
          </button>
        </div>
      </div>
      {problems.length > 0 && (
        <div className="bg-red-50 px-4 py-2 text-xs text-red-800">
          {t("Falta para publicar:")} {problems.map((p) => t(p)).join(" · ")}
        </div>
      )}

      <div className="flex-1 overflow-y-auto bg-white">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">{t("Tarjeta en resultados de búsqueda")}</p>
          <div className="mb-8 w-64 overflow-hidden rounded-lg border border-[#ebebeb]">
            {cover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={cover} alt="" className="aspect-[4/3] w-full object-cover" />
            ) : (
              <div className="flex aspect-[4/3] items-center justify-center bg-gray-100 text-xs text-gray-400">{t("Sin fotos")}</div>
            )}
            <div className="p-3">
              <p className="line-clamp-2 text-sm font-semibold text-[#484848]">{l.title || t("Sin título")}</p>
              <p className="mt-0.5 text-xs text-[#aaa]">{location || "—"}</p>
              <p className="mt-1 text-sm text-[#484848]">
                <strong>{price}</strong> <span className="text-[#aaa]">{t("por noche aprox.")}</span>
              </p>
            </div>
          </div>

          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-400">{t("Página del anuncio")}</p>
          <div className="overflow-hidden rounded-lg border border-[#ebebeb]">
            <div className="grid h-72 grid-cols-4 grid-rows-2 gap-1 sm:h-96">
              {cover ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={cover}
                  alt=""
                  className={`col-span-4 row-span-2 h-full w-full object-cover ${rest.length ? "sm:col-span-2" : ""}`}
                />
              ) : (
                <div className="col-span-4 row-span-2 bg-gray-100" />
              )}
              {rest.slice(0, 4).map((p) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={p} src={p} alt="" className="hidden h-full w-full object-cover sm:block" />
              ))}
            </div>

            <div className="flex flex-col gap-10 p-6 lg:flex-row">
              <div className="min-w-0 flex-1 space-y-6">
                <div>
                  <h1 className="text-2xl font-bold leading-tight text-[#484848] sm:text-3xl">{l.title || t("Sin título")}</h1>
                  <p className="mt-2 text-sm text-[#aaa]">📍 {location || "—"}</p>
                  <div className="mt-4 flex flex-wrap gap-4 text-sm text-[#3a3a3a]">
                    <span>👥 {t("{n} invitados", { n: l.guests ?? "—" })}</span>
                    <span>🛏 {t("{n} recámaras", { n: l.bedrooms ?? "—" })}</span>
                    <span>🚿 {t("{n} baños", { n: l.bathrooms ?? "—" })}</span>
                    {l.spaceType && <span>🏠 {t(l.spaceType)}</span>}
                  </div>
                </div>

                <Section title={t("Descripción del anuncio")}>
                  <p className="whitespace-pre-line text-sm leading-relaxed text-[#3a3a3a]">
                    {l.description?.trim() || t("Sin descripción todavía.")}
                  </p>
                </Section>

                <Section title={t("Información del Precio")}>
                  <div className="grid gap-2 rounded border border-[#ebebeb] p-5 text-sm">
                    <Row label={t("Precio por noche")} value={price} />
                    {l.cleaningFee ? (
                      <Row label={t("Tarifa de limpieza")} value={`$ ${Math.round(l.cleaningFee).toLocaleString("es-MX")} — ${t("Tarifa única")}`} />
                    ) : null}
                  </div>
                </Section>

                <Section title={t("Características")}>
                  {l.amenities?.length ? (
                    <ul className="grid grid-cols-2 gap-2 text-sm text-[#3a3a3a] sm:grid-cols-3">
                      {l.amenities.map((a) => (
                        <li key={a}>✓ {a}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-[#aaa]">{t("Sin características.")}</p>
                  )}
                  <div className="mt-5 flex flex-wrap gap-4">
                    {rules.map((r) => (
                      <div key={r.label} className="flex items-center gap-2 text-sm text-[#3a3a3a]">
                        <span>{r.icon}</span>
                        <span>{t(r.label)}</span>
                        <span style={{ color: r.allowed ? "#22c55e" : "#ef4444" }}>
                          {r.allowed ? t("✓ Permitido") : t("✗ No permitido")}
                        </span>
                      </div>
                    ))}
                  </div>
                </Section>

                <Section title={t("Propietario")}>
                  <div className="flex items-center gap-4">
                    <div
                      className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 text-xl font-semibold text-gray-500"
                      style={{ border: `3px solid ${GOLD}` }}
                    >
                      {name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-[#484848]">{name}</p>
                      <p className="text-sm text-[#3a3a3a]">{t("{name} es anfitrión en Cabibee.", { name })}</p>
                    </div>
                  </div>
                </Section>

                <Section title={exactAddress ? t("Ubicación") : t("Ubicación cercana (No exacta)")}>
                  <p className="text-sm text-[#484848]">{exactAddress || location || "—"}</p>
                  {!exactAddress && <p className="mt-1 text-xs text-[#aaa]">{t("La dirección exacta se proporciona tras confirmar la reserva.")}</p>}
                </Section>
              </div>

              <aside className="w-full shrink-0 lg:w-80">
                <div className="rounded border border-[#ebebeb] p-5">
                  <p className="text-2xl font-bold text-[#484848]">
                    {price} <span className="text-sm font-normal text-[#aaa]">{t("por noche aprox.")}</span>
                  </p>
                  <div
                    className="mt-4 w-full rounded py-3 text-center text-sm font-semibold text-black"
                    style={{ backgroundColor: GOLD }}
                  >
                    {t("Ver datos de contacto del anfitrión")}
                  </div>
                </div>
              </aside>
            </div>
          </div>
          <p className="mt-3 text-xs text-gray-400">
            {t("Las {n} fotos aparecen en la galería del anuncio. El mapa se arma al publicar con la ubicación.", { n: photos.length })}
          </p>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-[#aaa]">{label}:</span>
      <span className="font-medium text-[#484848]">{value}</span>
    </div>
  );
}
