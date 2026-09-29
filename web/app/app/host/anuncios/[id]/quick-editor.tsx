"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { IconExternal, IconPlus } from "../../../_components/icons";
import { WebLink } from "../../../_components/site-origin";
import { TopBar } from "../../../_components/top-bar";
import { CATEGORY_OPTIONS, SPACE_OPTIONS } from "../listing-options";

type Listing = {
  id: string;
  slug: string;
  title: string;
  description: string;
  categoryKey: string;
  spaceType: string;
  city: string;
  zone: string;
  guests: number;
  bedrooms: number;
  bathrooms: number;
  pricePerNight: number;
  cleaningFee: number;
  photos: string[];
  published: boolean;
};

type Draft = Omit<Listing, "id" | "slug" | "photos" | "published">;

const inputCls = "mt-1 w-full rounded-xl border border-[#ccc] px-3.5 py-3 text-[15px] outline-none focus:border-[#222]";

function toDraft(l: Listing): Draft {
  return {
    title: l.title,
    description: l.description,
    categoryKey: l.categoryKey,
    spaceType: l.spaceType,
    city: l.city,
    zone: l.zone,
    guests: l.guests,
    bedrooms: l.bedrooms,
    bathrooms: l.bathrooms,
    pricePerNight: l.pricePerNight,
    cleaningFee: l.cleaningFee,
  };
}

/** Lo esencial para publicar desde el celular. Calendario, reglas, contrato y ubicación exacta viven en la web. */
export function QuickListingEditor({ listingId }: { listingId: string }) {
  const [listing, setListing] = useState<Listing | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/host/listings/${listingId}`, { cache: "no-store" });
    const j = await res.json().catch(() => ({}));
    if (!res.ok || !j.listing) {
      setMsg({ ok: false, text: "No encontramos este anuncio." });
      return;
    }
    setListing(j.listing);
    setDraft(toDraft(j.listing));
  }, [listingId]);

  useEffect(() => {
    void load();
  }, [load]);

  const patch = async (body: Record<string, unknown>): Promise<boolean> => {
    const res = await fetch(`/api/host/listings/${listingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    const j = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok || !j.listing) {
      setMsg({ ok: false, text: typeof j.error === "string" ? j.error : "No se pudo guardar." });
      return false;
    }
    setListing(j.listing);
    return true;
  };

  const save = async (publish?: boolean) => {
    if (!draft || !listing) return;
    if (publish && (listing.photos.length === 0 || !draft.city.trim() || draft.pricePerNight <= 0)) {
      setMsg({ ok: false, text: "Para publicar necesitas al menos una foto, la ciudad y un precio." });
      return;
    }
    setSaving(true);
    setMsg(null);
    const ok = await patch({ ...draft, ...(publish === undefined ? {} : { published: publish }) });
    setSaving(false);
    if (ok) {
      setMsg({
        ok: true,
        text: publish === true ? "¡Publicado! Ya aparece en Cabibee." : publish === false ? "Anuncio pausado." : "Cambios guardados.",
      });
    }
  };

  const upload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setMsg(null);
    for (const file of Array.from(files)) {
      setUploading((n) => n + 1);
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/host/listings/${listingId}/photos`, { method: "POST", body: fd }).catch(() => null);
      const j = res ? await res.json().catch(() => ({})) : {};
      if (res?.ok && Array.isArray(j.photos)) {
        setListing((l) => (l ? { ...l, photos: j.photos } : l));
      } else {
        setMsg({ ok: false, text: typeof j.error === "string" ? j.error : `No se pudo subir ${file.name}.` });
      }
      setUploading((n) => n - 1);
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const removePhoto = async (url: string) => {
    if (!listing) return;
    await patch({ photos: listing.photos.filter((p) => p !== url) });
  };

  const makeCover = async (url: string) => {
    if (!listing) return;
    await patch({ photos: [url, ...listing.photos.filter((p) => p !== url)] });
  };

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d));

  if (!listing || !draft) {
    return (
      <>
        <TopBar title="Editar anuncio" back="/host/anuncios" />
        <p className="px-5 py-6 text-sm text-[#999]">{msg?.text ?? "Cargando…"}</p>
      </>
    );
  }

  return (
    <div className="pb-[calc(96px+env(safe-area-inset-bottom))]">
      <TopBar
        title={listing.published ? "Anuncio publicado" : "Borrador"}
        back="/host/anuncios"
        right={
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="rounded-full px-3 py-1.5 text-sm font-semibold text-[#222] underline disabled:opacity-50"
          >
            Guardar
          </button>
        }
      />

      <div className="space-y-6 px-5 py-5">
        {msg && (
          <p className={`rounded-2xl px-4 py-3 text-sm ${msg.ok ? "bg-[#e6f6ea] text-[#1e7a3a]" : "bg-red-50 text-red-700"}`}>
            {msg.text}
          </p>
        )}

        <section>
          <h2 className="text-lg font-semibold text-[#222]">Fotos</h2>
          <p className="text-xs text-[#888]">La primera es la portada. Toca una foto para hacerla portada.</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {listing.photos.map((p, i) => (
              <div key={p} className="relative aspect-square overflow-hidden rounded-xl bg-[#eee]">
                <button type="button" onClick={() => void makeCover(p)} className="h-full w-full" aria-label="Usar como portada">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p} alt="" className="h-full w-full object-cover" />
                </button>
                {i === 0 && (
                  <span className="absolute left-1.5 top-1.5 rounded-md bg-white/90 px-1.5 py-0.5 text-[10px] font-semibold">
                    Portada
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => void removePhoto(p)}
                  className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-sm text-white"
                  aria-label="Quitar foto"
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-[#ccc] text-[#555]"
            >
              <IconPlus />
              <span className="text-xs">{uploading > 0 ? "Subiendo…" : "Agregar"}</span>
            </button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={(e) => void upload(e.target.files)}
          />
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-[#222]">Lo básico</h2>
          <label className="block text-sm font-medium text-[#222]">
            Título
            <input value={draft.title} maxLength={90} onChange={(e) => set("title", e.target.value)} className={inputCls} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-medium text-[#222]">
              Tipo
              <select value={draft.categoryKey} onChange={(e) => set("categoryKey", e.target.value)} className={inputCls}>
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium text-[#222]">
              Espacio
              <select value={draft.spaceType} onChange={(e) => set("spaceType", e.target.value)} className={inputCls}>
                {[...new Set([draft.spaceType, ...SPACE_OPTIONS])].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-medium text-[#222]">
              Ciudad
              <input value={draft.city} onChange={(e) => set("city", e.target.value)} className={inputCls} />
            </label>
            <label className="block text-sm font-medium text-[#222]">
              Zona / colonia
              <input value={draft.zone} onChange={(e) => set("zone", e.target.value)} className={inputCls} />
            </label>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-[#222]">Capacidad</h2>
          <Counter label="Huéspedes" value={draft.guests} min={1} onChange={(v) => set("guests", v)} />
          <Counter label="Recámaras" value={draft.bedrooms} min={0} onChange={(v) => set("bedrooms", v)} />
          <Counter label="Baños" value={draft.bathrooms} min={0} onChange={(v) => set("bathrooms", v)} />
        </section>

        <section className="grid grid-cols-2 gap-3">
          <label className="block text-sm font-medium text-[#222]">
            Precio por noche (MXN)
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={draft.pricePerNight}
              onChange={(e) => set("pricePerNight", Number(e.target.value))}
              className={inputCls}
            />
          </label>
          <label className="block text-sm font-medium text-[#222]">
            Limpieza (MXN)
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={draft.cleaningFee}
              onChange={(e) => set("cleaningFee", Number(e.target.value))}
              className={inputCls}
            />
          </label>
        </section>

        <label className="block text-sm font-medium text-[#222]">
          Descripción
          <textarea
            value={draft.description}
            rows={6}
            onChange={(e) => set("description", e.target.value)}
            className={inputCls}
            placeholder="Qué hace especial tu espacio, qué hay cerca, cómo es la llegada…"
          />
        </label>

        <WebLink
          path={`/host/listings/${listing.id}/edit`}
          className="flex items-center justify-between rounded-2xl bg-[#f7f7f7] px-4 py-3.5 text-sm text-[#333]"
        >
          <span>Amenidades, reglas, calendario, contrato y ubicación exacta</span>
          <span className="flex shrink-0 items-center gap-1 text-xs text-[#999]">
            web <IconExternal />
          </span>
        </WebLink>
      </div>

      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[#ebebeb] bg-white"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto flex max-w-xl gap-3 px-5 py-3">
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="flex-1 rounded-xl border border-[#222] py-3 text-[15px] font-semibold text-[#222] disabled:opacity-50"
          >
            Guardar
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void save(!listing.published)}
            className="flex-1 rounded-xl bg-[#dcb81e] py-3 text-[15px] font-semibold text-black disabled:opacity-50"
          >
            {listing.published ? "Pausar" : "Publicar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Counter({ label, value, min, onChange }: { label: string; value: number; min: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[15px] text-[#222]">{label}</span>
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-[#bbb] text-lg text-[#222] disabled:opacity-30"
          aria-label={`Menos ${label.toLowerCase()}`}
        >
          −
        </button>
        <span className="w-6 text-center text-[15px] font-medium">{value}</span>
        <button
          type="button"
          onClick={() => onChange(Math.min(50, value + 1))}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-[#bbb] text-lg text-[#222]"
          aria-label={`Más ${label.toLowerCase()}`}
        >
          +
        </button>
      </div>
    </div>
  );
}
