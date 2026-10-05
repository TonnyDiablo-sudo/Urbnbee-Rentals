"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "@/components/i18n-provider";
import { AMENITY_GROUPS, AMENITY_OPTIONS } from "@/lib/amenity-options";
import { ACCESS_CODE_MAX } from "@/lib/arrival-guide";
import { MONTHLY_RENTAL_NIGHTS, type RentalMode } from "@/lib/listing-pricing";
import { IconExternal, IconPlus } from "../../../_components/icons";
import { WebLink } from "../../../_components/site-origin";
import { TopBar } from "../../../_components/top-bar";
import { MX_STATE_LIST } from "@/lib/geo-places";
import type { HostListing } from "../../_shared/host-data";
import { CATEGORY_OPTIONS, SPACE_OPTIONS } from "../listing-options";

type Listing = HostListing;

type Draft = {
  title: string;
  description: string;
  categoryKey: string;
  spaceType: string;
  city: string;
  state: string;
  zone: string;
  guests: number;
  bedrooms: number;
  bathrooms: number;
  bathroomType: "private" | "shared" | null;
  selfCheckIn: boolean | null;
  rentalMode: RentalMode;
  pricePerNight: number;
  pricePerMonth: number;
  cleaningFee: number;
  weeklyDiscountPct: number;
  monthlyDiscountPct: number;
  amenities: string[];
  accessCode: string;
  agentCanShareAccessCode: boolean;
  wifiName: string;
  wifiPassword: string;
};

const inputCls = "mt-1 w-full rounded-xl border border-[#ccc] px-3.5 py-3 text-[15px] outline-none focus:border-[#222]";

function toDraft(l: Listing): Draft {
  const ag = l.arrivalGuide ?? {};
  return {
    title: l.title,
    description: l.description,
    categoryKey: l.categoryKey,
    spaceType: l.spaceType,
    city: l.city,
    state: l.state ?? "",
    zone: l.zone,
    guests: l.guests,
    bedrooms: l.bedrooms,
    bathrooms: l.bathrooms,
    bathroomType: l.bathroomType ?? null,
    selfCheckIn: l.selfCheckIn ?? null,
    rentalMode: l.rentalMode ?? "nightly",
    pricePerNight: l.pricePerNight,
    pricePerMonth: l.pricePerMonth ?? 0,
    cleaningFee: l.cleaningFee,
    weeklyDiscountPct: l.pricing?.weeklyDiscountPct ?? 0,
    monthlyDiscountPct: l.pricing?.monthlyDiscountPct ?? 0,
    amenities: [...l.amenities],
    accessCode: ag.accessCode ?? "",
    agentCanShareAccessCode: l.agentCanShareAccessCode !== false,
    wifiName: ag.wifiName ?? "",
    wifiPassword: ag.wifiPassword ?? "",
  };
}

/** Lo esencial para publicar desde el celular. Calendario, reglas, contrato y ubicación exacta viven en la web. */
export function QuickListingEditor({ listingId }: { listingId: string }) {
  const t = useT();
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
    const monthly = draft.rentalMode === "monthly";
    const hasPrice = monthly ? draft.pricePerMonth > 0 : draft.pricePerNight > 0;
    if (publish && (listing.photos.length === 0 || !draft.city.trim() || !draft.state.trim() || !hasPrice)) {
      setMsg({ ok: false, text: "Para publicar necesitas al menos una foto, la ciudad, el estado y un precio." });
      return;
    }
    if (monthly && draft.pricePerMonth <= 0) {
      setMsg({ ok: false, text: "Escribe la renta mensual." });
      return;
    }
    setSaving(true);
    setMsg(null);
    const where: Record<string, number> = {};
    if (draft.city !== listing.city || draft.state !== (listing.state ?? "") || draft.zone !== listing.zone) {
      const q = [draft.zone, draft.city, draft.state, "México"].map((x) => x.trim()).filter(Boolean).join(", ");
      const geo = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);
      if (geo && typeof geo.lat === "number" && typeof geo.lng === "number") Object.assign(where, { lat: geo.lat, lng: geo.lng });
    }
    const body = {
      title: draft.title,
      description: draft.description,
      categoryKey: draft.categoryKey,
      spaceType: draft.spaceType,
      city: draft.city,
      state: draft.state,
      zone: draft.zone,
      guests: draft.guests,
      bedrooms: draft.bedrooms,
      bathrooms: draft.bathrooms,
      bathroomType: draft.bathrooms > 0 ? draft.bathroomType : null,
      selfCheckIn: draft.selfCheckIn,
      rentalMode: draft.rentalMode,
      ...(monthly ? { pricePerMonth: draft.pricePerMonth } : { pricePerNight: draft.pricePerNight }),
      cleaningFee: draft.cleaningFee,
      // El servidor reemplaza `pricing` completo: se manda lo guardado con los descuentos encima.
      pricing: { ...(listing.pricing ?? {}), weeklyDiscountPct: draft.weeklyDiscountPct, monthlyDiscountPct: draft.monthlyDiscountPct },
      amenities: draft.amenities,
      arrivalGuide: {
        ...(listing.arrivalGuide ?? {}),
        accessCode: draft.accessCode,
        wifiName: draft.wifiName,
        wifiPassword: draft.wifiPassword,
      },
      agentCanShareAccessCode: draft.agentCanShareAccessCode,
      ...where,
      ...(publish === undefined ? {} : { published: publish }),
    };
    const ok = await patch(body);
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
        setMsg({ ok: false, text: typeof j.error === "string" ? j.error : t("No se pudo subir {name}.", { name: file.name }) });
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
        <TopBar title={t("Editar anuncio")} back="/host/anuncios" />
        <p className="px-5 py-6 text-sm text-[#999]">{msg ? t(msg.text) : t("Cargando…")}</p>
      </>
    );
  }

  const toggleAmenity = (a: string) =>
    set("amenities", draft.amenities.includes(a) ? draft.amenities.filter((x) => x !== a) : [...draft.amenities, a]);

  return (
    <div className="pb-[calc(96px+env(safe-area-inset-bottom))]">
      <TopBar
        title={listing.published ? t("Anuncio publicado") : t("Borrador")}
        back={`/host/anuncios/${encodeURIComponent(listingId)}`}
        right={
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="rounded-full px-3 py-1.5 text-sm font-semibold text-[#222] underline disabled:opacity-50"
          >
            {t("Guardar")}
          </button>
        }
      />

      <div className="space-y-6 px-5 py-5">
        {msg && (
          <p className={`rounded-2xl px-4 py-3 text-sm ${msg.ok ? "bg-[#e6f6ea] text-[#1e7a3a]" : "bg-red-50 text-red-700"}`}>
            {t(msg.text)}
          </p>
        )}

        <section>
          <h2 className="text-lg font-semibold text-[#222]">{t("Fotos")}</h2>
          <p className="text-xs text-[#888]">{t("La primera es la portada. Toca una foto para hacerla portada.")}</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {listing.photos.map((p, i) => (
              <div key={p} className="relative aspect-square overflow-hidden rounded-xl bg-[#eee]">
                <button type="button" onClick={() => void makeCover(p)} className="h-full w-full" aria-label={t("Usar como portada")}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p} alt="" className="h-full w-full object-cover" />
                </button>
                {i === 0 && (
                  <span className="absolute left-1.5 top-1.5 rounded-md bg-white/90 px-1.5 py-0.5 text-[10px] font-semibold">
                    {t("Portada")}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => void removePhoto(p)}
                  className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-sm text-white"
                  aria-label={t("Quitar foto")}
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
              <span className="text-xs">{uploading > 0 ? t("Subiendo…") : t("Agregar")}</span>
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
          <h2 className="text-lg font-semibold text-[#222]">{t("Lo básico")}</h2>
          <label className="block text-sm font-medium text-[#222]">
            {t("Título")}
            <input value={draft.title} maxLength={90} onChange={(e) => set("title", e.target.value)} className={inputCls} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-medium text-[#222]">
              {t("Tipo")}
              <select value={draft.categoryKey} onChange={(e) => set("categoryKey", e.target.value)} className={inputCls}>
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c.key} value={c.key}>
                    {t(c.label)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium text-[#222]">
              {t("Espacio")}
              <select value={draft.spaceType} onChange={(e) => set("spaceType", e.target.value)} className={inputCls}>
                {[...new Set([draft.spaceType, ...SPACE_OPTIONS])].map((s) => (
                  <option key={s} value={s}>
                    {t(s)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-medium text-[#222]">
              {t("Ciudad")}
              <input value={draft.city} onChange={(e) => set("city", e.target.value)} className={inputCls} />
            </label>
            <label className="block text-sm font-medium text-[#222]">
              {t("Estado")}
              <input list="cb-mx-states" value={draft.state} onChange={(e) => set("state", e.target.value)} className={inputCls} />
              <datalist id="cb-mx-states">
                {MX_STATE_LIST.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </label>
          </div>
          <label className="block text-sm font-medium text-[#222]">
            {t("Zona / colonia")}
            <input value={draft.zone} onChange={(e) => set("zone", e.target.value)} className={inputCls} />
          </label>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-[#222]">{t("Capacidad")}</h2>
          <Counter label={t("Huéspedes")} value={draft.guests} min={1} onChange={(v) => set("guests", v)} />
          <Counter label={t("Recámaras")} value={draft.bedrooms} min={0} onChange={(v) => set("bedrooms", v)} />
          <Counter label={t("Baños")} value={draft.bathrooms} min={0} onChange={(v) => set("bathrooms", v)} />
          {draft.bathrooms > 0 && (
            <Choice
              label={t("¿Los baños son privados o compartidos?")}
              value={draft.bathroomType}
              options={[
                ["private", t("Privados")],
                ["shared", t("Compartidos")],
              ]}
              onChange={(v) => set("bathroomType", v)}
            />
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-[#222]">{t("Precio")}</h2>
          <Choice
            label={t("¿Cómo cobras?")}
            value={draft.rentalMode}
            options={[
              ["nightly", t("Por noche")],
              ["monthly", t("Renta mensual")],
            ]}
            onChange={(v) => set("rentalMode", v ?? "nightly")}
            required
          />
          <div className="grid grid-cols-2 gap-3">
            {draft.rentalMode === "monthly" ? (
              <label className="block text-sm font-medium text-[#222]">
                {t("Renta mensual (MXN)")}
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={draft.pricePerMonth || ""}
                  onChange={(e) => set("pricePerMonth", Number(e.target.value) || 0)}
                  className={inputCls}
                />
              </label>
            ) : (
              <label className="block text-sm font-medium text-[#222]">
                {t("Precio por noche (MXN)")}
                <input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={draft.pricePerNight}
                  onChange={(e) => set("pricePerNight", Number(e.target.value))}
                  className={inputCls}
                />
              </label>
            )}
            <label className="block text-sm font-medium text-[#222]">
              {t("Limpieza (MXN)")}
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={draft.cleaningFee}
                onChange={(e) => set("cleaningFee", Number(e.target.value))}
                className={inputCls}
              />
            </label>
            <label className="block text-sm font-medium text-[#222]">
              {t("Descuento 7+ noches (%)")}
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={99}
                value={draft.weeklyDiscountPct || ""}
                onChange={(e) => set("weeklyDiscountPct", Math.min(99, Math.max(0, Number(e.target.value) || 0)))}
                className={inputCls}
              />
            </label>
            <label className="block text-sm font-medium text-[#222]">
              {t("Descuento 28+ noches (%)")}
              <input
                type="number"
                inputMode="numeric"
                min={0}
                max={99}
                value={draft.monthlyDiscountPct || ""}
                onChange={(e) => set("monthlyDiscountPct", Math.min(99, Math.max(0, Number(e.target.value) || 0)))}
                className={inputCls}
              />
            </label>
          </div>
          <p className="text-xs text-[#888]">
            {draft.rentalMode === "monthly"
              ? t("En renta mensual la estancia mínima es de al menos {n} noches.", { n: MONTHLY_RENTAL_NIGHTS })
              : t("No se acumulan: si aplican varios, el huésped recibe el mayor.")}
          </p>
        </section>

        <label className="block text-sm font-medium text-[#222]">
          {t("Descripción")}
          <textarea
            value={draft.description}
            rows={6}
            onChange={(e) => set("description", e.target.value)}
            className={inputCls}
            placeholder={t("Qué hace especial tu espacio, qué hay cerca, cómo es la llegada…")}
          />
        </label>

        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-[#222]">{t("Amenidades")}</h2>
          {[
            ...AMENITY_GROUPS,
            { key: "other", title: "Otras", items: draft.amenities.filter((a) => !AMENITY_OPTIONS.includes(a)) },
          ]
            .filter((g) => g.items.length > 0)
            .map((g) => (
              <div key={g.key}>
                <p className="mb-2 text-sm font-semibold text-[#222]">{t(g.title)}</p>
                <div className="flex flex-wrap gap-2">
                  {g.items.map((a) => {
                    const on = draft.amenities.includes(a);
                    return (
                      <button
                        key={a}
                        type="button"
                        onClick={() => toggleAmenity(a)}
                        className={`rounded-full border px-3 py-1.5 text-sm font-medium ${on ? "border-[#222] bg-[#222] text-white" : "border-[#ddd] text-[#444]"}`}
                      >
                        {on ? "✓ " : ""}
                        {t(a)}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-[#222]">{t("Llegada")}</h2>
          <Choice
            label={t("¿Cómo es la entrada?")}
            value={draft.selfCheckIn === null ? null : draft.selfCheckIn ? "self" : "host"}
            options={[
              ["self", t("Entrada autónoma")],
              ["host", t("Te recibe el anfitrión")],
            ]}
            onChange={(v) => set("selfCheckIn", v === null ? null : v === "self")}
          />
          <label className="block text-sm font-medium text-[#222]">
            {t("Código de acceso")}
            <input
              value={draft.accessCode}
              maxLength={ACCESS_CODE_MAX}
              onChange={(e) => set("accessCode", e.target.value)}
              placeholder={t("Ej.: Puerta 4821#, caja de llaves 0912")}
              className={inputCls}
            />
          </label>
          <label className="flex items-start gap-3 text-sm text-[#222]">
            <input
              type="checkbox"
              checked={draft.agentCanShareAccessCode}
              onChange={(e) => set("agentCanShareAccessCode", e.target.checked)}
              className="mt-0.5 h-5 w-5 shrink-0"
            />
            {t("El asistente de IA puede dar el código de entrada a huéspedes con reserva confirmada")}
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm font-medium text-[#222]">
              {t("Wifi")}
              <input value={draft.wifiName} onChange={(e) => set("wifiName", e.target.value)} placeholder={t("Nombre de la red")} className={inputCls} />
            </label>
            <label className="block text-sm font-medium text-[#222]">
              {t("Contraseña")}
              <input value={draft.wifiPassword} onChange={(e) => set("wifiPassword", e.target.value)} className={inputCls} />
            </label>
          </div>
          <p className="text-xs text-[#888]">{t("Se le comparte al huésped sólo cuando reserva y paga con el Motor de reservas.")}</p>
        </section>

        <WebLink
          path={`/host/listings/${listing.id}/edit`}
          className="flex items-center justify-between rounded-2xl bg-[#f7f7f7] px-4 py-3.5 text-sm text-[#333]"
        >
          <span>{t("Reglas, calendario, contrato y ubicación exacta")}</span>
          <span className="flex shrink-0 items-center gap-1 text-xs text-[#999]">
            {t("web")} <IconExternal />
          </span>
        </WebLink>
      </div>

      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[#ebebeb] bg-white"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="mx-auto flex max-w-xl md:max-w-3xl gap-3 px-5 py-3">
          <button
            type="button"
            disabled={saving}
            onClick={() => void save()}
            className="flex-1 rounded-xl border border-[#222] py-3 text-[15px] font-semibold text-[#222] disabled:opacity-50"
          >
            {t("Guardar")}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void save(!listing.published)}
            className="flex-1 rounded-xl bg-[#dcb81e] py-3 text-[15px] font-semibold text-black disabled:opacity-50"
          >
            {listing.published ? t("Pausar") : t("Publicar")}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Dos opciones en botones; tocar la elegida la quita, salvo que sea obligatoria. */
function Choice<V extends string>({
  label,
  value,
  options,
  onChange,
  required,
}: {
  label: string;
  value: V | null;
  options: [V, string][];
  onChange: (v: V | null) => void;
  required?: boolean;
}) {
  return (
    <div>
      <p className="text-[15px] text-[#222]">{label}</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {options.map(([v, text]) => (
          <button
            key={v}
            type="button"
            onClick={() => onChange(value === v && !required ? null : v)}
            className={`rounded-xl border px-3 py-2.5 text-sm font-semibold ${value === v ? "border-[#222] bg-[#222] text-white" : "border-[#ddd] text-[#222]"}`}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

function Counter({ label, value, min, onChange }: { label: string; value: number; min: number; onChange: (v: number) => void }) {
  const t = useT();
  return (
    <div className="flex items-center justify-between">
      <span className="text-[15px] text-[#222]">{label}</span>
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-[#bbb] text-lg text-[#222] disabled:opacity-30"
          aria-label={t("Menos {label}", { label: label.toLowerCase() })}
        >
          −
        </button>
        <span className="w-6 text-center text-[15px] font-medium">{value}</span>
        <button
          type="button"
          onClick={() => onChange(Math.min(50, value + 1))}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-[#bbb] text-lg text-[#222]"
          aria-label={t("Más {label}", { label: label.toLowerCase() })}
        >
          +
        </button>
      </div>
    </div>
  );
}
