"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BOOKING_CONTRACT_TEMPLATES,
  defaultListingContract,
  type ListingContractSettings,
} from "@/lib/booking-contract-templates";
import type { HostListingRecord, HostProfileRecord } from "@/lib/marketplace-types";
import type { ListingCategory } from "@/lib/mock-data";
import { AMENITY_GROUPS, AMENITY_OPTIONS } from "@/lib/amenity-options";
import { ACCESS_CODE_MAX, type ArrivalGuide } from "@/lib/arrival-guide";
import { arrivalMessageOf, type ArrivalMessageSettings } from "@/lib/arrival-message-template";
import { CREDIT_CHECK_ENABLED } from "@/lib/feature-flags";
import { MONTHLY_RENTAL_NIGHTS, type ListingPricing } from "@/lib/listing-pricing";
import { ArrivalMessageEditor } from "@/components/host/arrival-message-editor";
import { ListingImportUsagePanel } from "@/components/host/listing-import-usage-panel";
import type { ListingImportUsageSummary } from "@/lib/listing-import-usage";
import { useT } from "@/components/i18n-provider";
import { COUNTRY_OPTIONS, isMexico, MX_STATE_LIST } from "@/lib/geo-places";
import { exactAddressProblem, listingNeedsUnit } from "@/lib/listing-address";
import { ContractReviewNotice } from "@/components/host/contract-review-notice";
import { ContractTips, MIN_STAY_CLAUSE } from "@/components/host/contract-tips";

type Tab = "fotos" | "info" | "ubicacion" | "contacto" | "precio" | "comodidades" | "llegada" | "contrato";

const TABS: { id: Tab; label: string }[] = [
  { id: "fotos", label: "Fotos" },
  { id: "info", label: "Información" },
  { id: "ubicacion", label: "Ubicación" },
  { id: "contacto", label: "Tu perfil y contacto" },
  { id: "precio", label: "Precio" },
  { id: "comodidades", label: "Comodidades y reglas" },
  { id: "llegada", label: "Guía de llegada" },
  { id: "contrato", label: "Contrato" },
];

const CATEGORY_OPTIONS: { key: ListingCategory; label: string }[] = [
  { key: "habitaciones", label: "Habitaciones" },
  { key: "casas", label: "Casas" },
  { key: "departamentos", label: "Departamentos" },
  { key: "cabanas", label: "Cabañas" },
  { key: "vinos", label: "Viñedos / experiencias" },
];

export function ListingEditor({ listingId }: { listingId: string }) {
  const searchParams = useSearchParams();
  const t = useT();
  const [tab, setTab] = useState<Tab>(() => {
    const q = searchParams.get("tab");
    return TABS.find((x) => x.id === q)?.id ?? "fotos";
  });
  const [listing, setListing] = useState<HostListingRecord | null>(null);
  const [profile, setProfile] = useState<HostProfileRecord | null>(null);
  const [loginEmail, setLoginEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [nameLocked, setNameLocked] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [geocodeLoading, setGeocodeLoading] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [importWarnings, setImportWarnings] = useState<string[] | null>(null);
  const [importUsage, setImportUsage] = useState<ListingImportUsageSummary | null>(null);

  useEffect(() => {
    if (searchParams.get("fromImport") !== "1") return;
    try {
      const raw = sessionStorage.getItem("urbnbee_listing_import_meta");
      if (!raw) return;
      const meta = JSON.parse(raw) as {
        warnings?: string[];
        usage?: ListingImportUsageSummary | null;
      };
      if (Array.isArray(meta.warnings) && meta.warnings.length) {
        setImportWarnings(meta.warnings);
      }
      if (meta.usage?.actions?.length) setImportUsage(meta.usage);
      sessionStorage.removeItem("urbnbee_listing_import_meta");
    } catch {
      /* ignore */
    }
  }, [searchParams]);

  async function load() {
    setLoading(true);
    setNotFound(false);
    try {
      const [lrRes, pr] = await Promise.all([
        fetch(`/api/host/listings/${listingId}`, { credentials: "include" }),
        fetch(`/api/host/profile`, { credentials: "include" }).then((r) => r.json()),
      ]);
      const lr = await lrRes.json();
      if (!lrRes.ok || !lr.listing) {
        setListing(null);
        setNotFound(true);
      } else {
        setListing(lr.listing);
      }
      if (pr.profile) setProfile(pr.profile);
      if (pr.user?.email) setLoginEmail(pr.user.email);
      if (pr.user?.fullName) setFullName(pr.user.fullName);
      setNameLocked(Boolean(pr.user?.nameLocked));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [listingId]);

  useEffect(() => {
    setAvatarLoadFailed(false);
  }, [profile?.avatarUrl]);

  function notify(text: string) {
    setToast(text);
    setTimeout(() => setToast(null), 2500);
  }

  async function saveListing(
    patch: Omit<Partial<HostListingRecord>, "bathroomType" | "selfCheckIn"> & {
      regenerateSlug?: boolean;
      /** null borra el dato. */
      bathroomType?: HostListingRecord["bathroomType"] | null;
      selfCheckIn?: boolean | null;
    }
  ) {
    const res = await fetch(`/api/host/listings/${listingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    if (!res.ok) {
      notify(data.error ?? "Error al guardar");
      return;
    }
    if (data.listing) setListing(data.listing);
    notify("Cambios guardados");
  }

  /** El servidor reemplaza `pricing` completo: se manda lo guardado con el cambio encima. */
  function savePricing(change: Partial<ListingPricing>) {
    if (!listing) return;
    void saveListing({ pricing: { ...(listing.pricing ?? {}), ...change } });
  }

  async function saveAccount(payload: { fullName?: string; phone?: string }) {
    const res = await fetch(`/api/host/account`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      notify(data.error ?? "Error");
      return;
    }
    if (data.user?.fullName) setFullName(data.user.fullName);
    notify("Datos guardados");
  }

  async function saveProfile(payload: Record<string, string>) {
    const res = await fetch(`/api/host/profile`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      notify(data.error ?? "Error al guardar perfil");
      return;
    }
    if (data.profile) setProfile(data.profile);
    notify("Perfil actualizado");
  }

  async function onAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/host/profile/avatar", {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        notify(data.error ?? "No se pudo subir la foto");
        return;
      }
      if (data.profile) setProfile(data.profile);
      notify("Foto de perfil actualizada");
    } finally {
      setAvatarUploading(false);
      e.target.value = "";
    }
  }

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/host/listings/${listingId}/photos`, {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        notify(data.error ?? "No se pudo subir");
        return;
      }
      if (data.photos) setListing((prev) => (prev ? { ...prev, photos: data.photos } : prev));
      notify("Foto agregada");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  function movePhoto(from: number, dir: -1 | 1) {
    if (!listing) return;
    const to = from + dir;
    if (to < 0 || to >= listing.photos.length) return;
    const photos = [...listing.photos];
    [photos[from], photos[to]] = [photos[to], photos[from]];
    saveListing({ photos });
  }

  function removePhoto(index: number) {
    if (!listing || !confirm(t("¿Eliminar esta foto?"))) return;
    const photos = listing.photos.filter((_, i) => i !== index);
    saveListing({ photos });
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-[#ebebeb] bg-white p-12 text-center text-[#888]">
        {t("Cargando editor…")}
      </div>
    );
  }

  if (notFound || !listing) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-[#ebebeb] bg-white p-10 text-center shadow-sm">
        <p className="text-[#484848]">{t("Este alojamiento no existe o el enlace es antiguo (por ejemplo, un borrador ya no guardado).")}</p>
        <p className="mt-2 text-sm text-[#888]">{t("Abre la lista actualizada y edita el anuncio correcto.")}</p>
        <Link
          href="/host/listings"
          className="mt-6 inline-block rounded-full px-6 py-2.5 text-sm font-semibold text-black"
          style={{ backgroundColor: "#dcb81e" }}
        >
          {t("Ir a mis alojamientos")}
        </Link>
      </div>
    );
  }

  const previewUrl = listing.published ? `/listings/${listing.slug}` : null;

  return (
    <div className="space-y-6">
      {(importWarnings?.length || importUsage) && (
        <div className="space-y-3">
          {importUsage && <ListingImportUsagePanel usage={importUsage} />}
          {importWarnings && importWarnings.length > 0 && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              <p className="font-semibold">{t("Borrador generado con IA — revísalo antes de publicar")}</p>
              <ul className="mt-2 list-inside list-disc space-y-1 text-amber-900/90">
                {importWarnings.map((w) => (
                  <li key={w}>{t(w)}</li>
                ))}
              </ul>
              <button
                type="button"
                className="mt-2 text-xs font-medium underline"
                onClick={() => setImportWarnings(null)}
              >
                {t("Entendido")}
              </button>
            </div>
          )}
        </div>
      )}
      {toast && (
        <div
          className="fixed bottom-6 left-1/2 z-[200] -translate-x-1/2 rounded-full px-5 py-2 text-sm font-medium text-black shadow-lg"
          style={{ backgroundColor: "#dcb81e" }}
        >
          {t(toast)}
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[#484848]">{t("Editar alojamiento")}</h1>
          <p className="mt-1 text-sm text-[#888]">
            {t("Slug público:")}{" "}
            <code className="rounded bg-black/[0.06] px-1.5 py-0.5 text-xs">{listing.slug}</code>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={listing.published}
              onChange={(e) => saveListing({ published: e.target.checked })}
              className="h-4 w-4 rounded border-[#ccc]"
            />
            <span className="font-medium text-[#484848]">{t("Publicado en el directorio")}</span>
          </label>
          {previewUrl && (
            <Link
              href={previewUrl}
              target="_blank"
              className="rounded-full border border-[#dcb81e] px-4 py-2 text-sm font-semibold text-[#484848] transition hover:bg-[#dcb81e]/10"
            >
              {t("Ver página pública →")}
            </Link>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-[#ebebeb] pb-2">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              tab === item.id ? "bg-black text-white" : "bg-[#f5f5f5] text-[#484848] hover:bg-[#ebebeb]"
            }`}
          >
            {t(item.label)}
          </button>
        ))}
      </div>

      {/* ─── Fotos ─── */}
      {tab === "fotos" && (
        <section className="rounded-xl border border-[#ebebeb] bg-white p-6 shadow-sm">
          <p className="mb-4 text-sm text-[#666]">
            {t("La primera foto es la portada. Arrastra el orden con los botones.")}
          </p>
          <label className="mb-6 inline-flex cursor-pointer items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-black shadow transition hover:brightness-95" style={{ backgroundColor: "#dcb81e" }}>
            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={onUpload} disabled={uploading} />
            {uploading ? t("Subiendo…") : t("+ Subir foto")}
          </label>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {listing.photos.map((src, i) => (
              <div key={`${src}-${i}`} className="group relative overflow-hidden rounded-lg border border-[#ebebeb]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="aspect-[4/3] w-full object-cover" />
                <div className="absolute inset-x-0 bottom-0 flex justify-between gap-1 bg-black/60 p-2 opacity-0 transition group-hover:opacity-100">
                  <button type="button" className="rounded bg-white/90 px-2 py-1 text-xs font-medium" onClick={() => movePhoto(i, -1)} disabled={i === 0}>
                    ↑
                  </button>
                  <button type="button" className="rounded bg-white/90 px-2 py-1 text-xs font-medium" onClick={() => movePhoto(i, 1)} disabled={i === listing.photos.length - 1}>
                    ↓
                  </button>
                  <button type="button" className="rounded bg-red-500 px-2 py-1 text-xs font-medium text-white" onClick={() => removePhoto(i)}>
                    {t("Quitar")}
                  </button>
                </div>
                {i === 0 && (
                  <span className="absolute left-2 top-2 rounded bg-[#dcb81e] px-2 py-0.5 text-[10px] font-bold text-black">
                    {t("Portada")}
                  </span>
                )}
              </div>
            ))}
            {listing.photos.length === 0 && (
              <p className="col-span-full text-sm text-[#aaa]">{t("Aún no hay fotos. Sube al menos una para publicar.")}</p>
            )}
          </div>
        </section>
      )}

      {/* ─── Información ─── */}
      {tab === "info" && (
        <section className="space-y-4 rounded-xl border border-[#ebebeb] bg-white p-6 shadow-sm">
          <div className="rounded-xl border border-[#ebebeb] bg-[#fafafa] p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-[#888]">
                {t("Fotos del anuncio (vista previa)")}
              </span>
              <button
                type="button"
                className="text-sm font-semibold text-[#dcb81e] underline"
                onClick={() => setTab("fotos")}
              >
                {t("Gestionar fotos →")}
              </button>
            </div>
            {listing.photos.length === 0 ? (
              <p className="text-sm text-[#888]">
                {t("Aún no hay fotos.")}{" "}
                <button type="button" className="font-semibold text-[#dcb81e] underline" onClick={() => setTab("fotos")}>
                  {t("Ir a la pestaña Fotos para subirlas")}
                </button>
              </p>
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-1 pt-1">
                {listing.photos.map((src, i) => (
                  <button
                    key={`info-prev-${src}-${i}`}
                    type="button"
                    onClick={() => setTab("fotos")}
                    className="relative h-28 w-40 shrink-0 overflow-hidden rounded-lg border-2 border-[#ebebeb] bg-[#eee] shadow-sm transition hover:border-[#dcb81e]"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt="" className="h-full w-full object-cover" />
                    {i === 0 && (
                      <span className="absolute left-2 top-2 rounded bg-[#dcb81e] px-2 py-0.5 text-[10px] font-bold text-black shadow">
                        {t("Portada")}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <Field label="Título del anuncio">
            <input
              className="w-full rounded-lg border border-[#ddd] px-3 py-2 text-sm outline-none focus:border-[#dcb81e]"
              value={listing.title}
              onChange={(e) => setListing({ ...listing, title: e.target.value })}
              onBlur={() => saveListing({ title: listing.title })}
            />
          </Field>
          <Field label="Descripción">
            <textarea
              rows={8}
              className="w-full rounded-lg border border-[#ddd] px-3 py-2 text-sm outline-none focus:border-[#dcb81e]"
              value={listing.description}
              onChange={(e) => setListing({ ...listing, description: e.target.value })}
              onBlur={() => saveListing({ description: listing.description })}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Categoría">
              <select
                className="w-full rounded-lg border border-[#ddd] px-3 py-2 text-sm outline-none focus:border-[#dcb81e]"
                value={listing.categoryKey}
                onChange={(e) => {
                  const categoryKey = e.target.value as ListingCategory;
                  setListing({ ...listing, categoryKey });
                  saveListing({ categoryKey });
                }}
              >
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c.key} value={c.key}>
                    {t(c.label)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Tipo de espacio">
              <input
                className="w-full rounded-lg border border-[#ddd] px-3 py-2 text-sm outline-none focus:border-[#dcb81e]"
                value={listing.spaceType}
                onChange={(e) => setListing({ ...listing, spaceType: e.target.value })}
                onBlur={() => saveListing({ spaceType: listing.spaceType })}
                placeholder={t("Ej. Espacio completo, Habitación privada…")}
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Huéspedes">
              <input
                type="number"
                min={1}
                className="w-full rounded-lg border border-[#ddd] px-3 py-2 text-sm"
                value={listing.guests}
                onChange={(e) => setListing({ ...listing, guests: Number(e.target.value) })}
                onBlur={() => saveListing({ guests: listing.guests })}
              />
            </Field>
            <Field label="Recámaras">
              <input
                type="number"
                min={0}
                className="w-full rounded-lg border border-[#ddd] px-3 py-2 text-sm"
                value={listing.bedrooms}
                onChange={(e) => setListing({ ...listing, bedrooms: Number(e.target.value) })}
                onBlur={() => saveListing({ bedrooms: listing.bedrooms })}
              />
            </Field>
            <Field label="Baños">
              <input
                type="number"
                min={0}
                className="w-full rounded-lg border border-[#ddd] px-3 py-2 text-sm"
                value={listing.bathrooms}
                onChange={(e) => setListing({ ...listing, bathrooms: Number(e.target.value) })}
                onBlur={() => saveListing({ bathrooms: listing.bathrooms })}
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tipo de baño">
              <select
                className="w-full rounded-lg border border-[#ddd] px-3 py-2 text-sm outline-none focus:border-[#dcb81e]"
                value={listing.bathroomType ?? ""}
                onChange={(e) => {
                  const v = e.target.value === "private" || e.target.value === "shared" ? e.target.value : undefined;
                  setListing({ ...listing, bathroomType: v });
                  void saveListing({ bathroomType: v ?? null });
                }}
              >
                <option value="">{t("Sin indicar")}</option>
                <option value="private">{t("Privados (sólo para tus huéspedes)")}</option>
                <option value="shared">{t("Compartidos")}</option>
              </select>
            </Field>
            <Field label="Entrada">
              <select
                className="w-full rounded-lg border border-[#ddd] px-3 py-2 text-sm outline-none focus:border-[#dcb81e]"
                value={listing.selfCheckIn === true ? "self" : listing.selfCheckIn === false ? "host" : ""}
                onChange={(e) => {
                  const v = e.target.value === "self" ? true : e.target.value === "host" ? false : undefined;
                  setListing({ ...listing, selfCheckIn: v });
                  void saveListing({ selfCheckIn: v ?? null });
                }}
              >
                <option value="">{t("Sin indicar")}</option>
                <option value="self">{t("Entrada autónoma")}</option>
                <option value="host">{t("Te recibe el anfitrión")}</option>
              </select>
            </Field>
          </div>
          <Field label="Tamaño (opcional)">
            <input
              className="w-full rounded-lg border border-[#ddd] px-3 py-2 text-sm outline-none focus:border-[#dcb81e]"
              value={listing.size ?? ""}
              onChange={(e) => setListing({ ...listing, size: e.target.value })}
              onBlur={() => saveListing({ size: listing.size || undefined })}
              placeholder={t("Ej. 85 m²")}
            />
          </Field>
          <button
            type="button"
            className="text-xs font-medium text-[#dcb81e] underline"
            onClick={() => {
              if (confirm(t("¿Generar un nuevo enlace (slug) desde el título actual? Los enlaces antiguos dejarán de funcionar."))) {
                saveListing({ regenerateSlug: true, title: listing.title });
              }
            }}
          >
            {t("Regenerar URL amigable desde el título")}
          </button>
        </section>
      )}

      {/* ─── Ubicación ─── */}
      {tab === "ubicacion" && (
        <section className="space-y-4 rounded-xl border border-[#ebebeb] bg-white p-6 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="País">
              <input
                list="cb-countries"
                className="w-full rounded-lg border border-[#ddd] px-3 py-2 text-sm outline-none focus:border-[#dcb81e]"
                value={listing.country}
                onChange={(e) => setListing({ ...listing, country: e.target.value })}
                onBlur={() => saveListing({ country: listing.country })}
              />
              <datalist id="cb-countries">
                {COUNTRY_OPTIONS.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </Field>
            <Field label="Estado / provincia">
              <input
                list={isMexico(listing.country) ? "cb-mx-states" : undefined}
                className="w-full rounded-lg border border-[#ddd] px-3 py-2 text-sm outline-none focus:border-[#dcb81e]"
                value={listing.state ?? ""}
                onChange={(e) => setListing({ ...listing, state: e.target.value })}
                onBlur={() => saveListing({ state: listing.state ?? "" })}
                placeholder={isMexico(listing.country) ? t("Ej. Jalisco") : ""}
              />
              <datalist id="cb-mx-states">
                {MX_STATE_LIST.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Ciudad">
              <input
                className="w-full rounded-lg border border-[#ddd] px-3 py-2 text-sm outline-none focus:border-[#dcb81e]"
                value={listing.city}
                onChange={(e) => setListing({ ...listing, city: e.target.value })}
                onBlur={() => saveListing({ city: listing.city })}
              />
            </Field>
            <Field label="Municipio / alcaldía (opcional)">
              <input
                className="w-full rounded-lg border border-[#ddd] px-3 py-2 text-sm outline-none focus:border-[#dcb81e]"
                value={listing.county}
                onChange={(e) => setListing({ ...listing, county: e.target.value })}
                onBlur={() => saveListing({ county: listing.county })}
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Colonia / zona">
              <input
                className="w-full rounded-lg border border-[#ddd] px-3 py-2 text-sm outline-none focus:border-[#dcb81e]"
                value={listing.zone}
                onChange={(e) => setListing({ ...listing, zone: e.target.value })}
                onBlur={() => saveListing({ zone: listing.zone })}
              />
            </Field>
            <Field label="Calle, número exterior y código postal">
              <input
                className="w-full rounded-lg border border-[#ddd] px-3 py-2 text-sm outline-none focus:border-[#dcb81e]"
                value={listing.addressLine}
                placeholder={t("Ej.: Colima 123, CP 06700")}
                onChange={(e) => setListing({ ...listing, addressLine: e.target.value })}
                onBlur={() => saveListing({ addressLine: listing.addressLine })}
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={listingNeedsUnit(listing) ? "Número interior o departamento" : "Número interior, depto o piso (si aplica)"}>
              <input
                className="w-full rounded-lg border border-[#ddd] px-3 py-2 text-sm outline-none focus:border-[#dcb81e] disabled:bg-[#f2f2f2]"
                value={listing.noAddressUnit ? "" : (listing.addressUnit ?? "")}
                disabled={listing.noAddressUnit === true}
                maxLength={60}
                placeholder={t("Ej.: Depto 4B, Torre 2")}
                onChange={(e) => setListing({ ...listing, addressUnit: e.target.value })}
                onBlur={() => saveListing({ addressUnit: listing.addressUnit ?? "" })}
              />
            </Field>
            <label className="flex items-center gap-2 self-end pb-2 text-sm text-[#484848]">
              <input
                type="checkbox"
                checked={listing.noAddressUnit === true}
                onChange={(e) => {
                  setListing({ ...listing, noAddressUnit: e.target.checked });
                  void saveListing({ noAddressUnit: e.target.checked, ...(e.target.checked ? { addressUnit: "" } : {}) });
                }}
              />
              {t("No tiene número interior")}
            </label>
          </div>
          {exactAddressProblem(listing) && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {t(exactAddressProblem(listing)!)}{" "}
              {t("La dirección exacta siempre es obligatoria: va en el contrato, en la guía de llegada y la usa tu agente de IA. Tú eliges abajo qué ve el público antes de reservar.")}
            </p>
          )}

          <fieldset className="rounded-xl border border-[#ebebeb] p-4">
            <legend className="px-1 text-sm font-semibold text-[#484848]">{t("¿Qué ven los huéspedes antes de reservar?")}</legend>
            {(
              [
                ["approximate", "Ubicación aproximada (recomendado)", "El mapa muestra un círculo de unos cientos de metros y la calle se comparte al confirmar la reserva."],
                ["exact", "Ubicación exacta", "El mapa muestra el punto exacto y la calle es pública desde el anuncio."],
              ] as const
            ).map(([value, label, help]) => (
              <label key={value} className="mt-2 flex cursor-pointer items-start gap-3 text-sm">
                <input
                  type="radio"
                  name="locationPrecision"
                  className="mt-1"
                  checked={(listing.locationPrecision ?? "approximate") === value}
                  onChange={() => {
                    setListing({ ...listing, locationPrecision: value });
                    void saveListing({ locationPrecision: value });
                  }}
                />
                <span>
                  <span className="font-medium text-[#222]">{t(label)}</span>
                  <span className="block text-xs text-[#888]">{t(help)}</span>
                </span>
              </label>
            ))}
            <p className="mt-3 text-xs text-[#888]">
              {t("Con reserva confirmada por el motor de reservas, el huésped siempre recibe la dirección exacta y queda en el contrato.")}
            </p>
          </fieldset>

          <div className="overflow-hidden rounded-xl border border-[#ebebeb] bg-[#fafafa]">
            <div className="flex flex-col gap-3 border-b border-[#ebebeb] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-[#484848]">{t("Mapa de ubicación")}</p>
                <p className="mt-0.5 max-w-xl text-xs text-[#888]">
                  {t("Usa el botón para colocar el pin según tu dirección; revisa que coincida con tu lugar y ajusta lat/lng si hace falta.")}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={geocodeLoading}
                  className="rounded-full px-4 py-2.5 text-sm font-semibold text-black shadow transition hover:brightness-95 disabled:opacity-50"
                  style={{ backgroundColor: "#dcb81e" }}
                  onClick={async () => {
                    const parts = [
                      listing.addressLine,
                      listing.zone,
                      listing.city,
                      listing.county,
                      listing.state ?? "",
                      listing.country,
                    ].filter((x) => String(x).trim().length > 0);
                    const q = parts.join(", ");
                    if (q.length < 5) {
                      notify("Completa calle, ciudad o país para buscar en el mapa.");
                      return;
                    }
                    setGeocodeLoading(true);
                    try {
                      const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
                      const data = await res.json();
                      if (!res.ok) {
                        notify(data.error ?? "No se encontró la dirección");
                        return;
                      }
                      await saveListing({
                        lat: data.lat as number,
                        lng: data.lng as number,
                      });
                      notify(
                        data.displayName
                          ? "Ubicación encontrada. Revisa el mapa."
                          : "Coordenadas actualizadas."
                      );
                    } finally {
                      setGeocodeLoading(false);
                    }
                  }}
                >
                  {geocodeLoading ? t("Buscando…") : t("Centrar mapa según dirección")}
                </button>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${listing.lat},${listing.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center rounded-full border border-[#ddd] bg-white px-4 py-2.5 text-sm font-semibold text-[#484848] transition hover:bg-[#f5f5f5]"
                >
                  {t("Abrir en Google Maps")}
                </a>
              </div>
            </div>
            <div className="relative aspect-[21/9] min-h-[280px] w-full bg-[#e5e5e5] sm:aspect-auto sm:min-h-[320px]">
              <iframe
                key={`${listing.lat}-${listing.lng}`}
                title={t("Vista previa del mapa")}
                className="absolute inset-0 h-full w-full border-0"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                src={`https://maps.google.com/maps?q=${listing.lat},${listing.lng}&z=16&hl=es&output=embed`}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Latitud">
              <input
                type="number"
                step="any"
                className="w-full rounded-lg border border-[#ddd] px-3 py-2 text-sm outline-none focus:border-[#dcb81e]"
                value={listing.lat}
                onChange={(e) => setListing({ ...listing, lat: Number(e.target.value) })}
                onBlur={() => saveListing({ lat: listing.lat, lng: listing.lng })}
              />
            </Field>
            <Field label="Longitud">
              <input
                type="number"
                step="any"
                className="w-full rounded-lg border border-[#ddd] px-3 py-2 text-sm outline-none focus:border-[#dcb81e]"
                value={listing.lng}
                onChange={(e) => setListing({ ...listing, lng: Number(e.target.value) })}
                onBlur={() => saveListing({ lat: listing.lat, lng: listing.lng })}
              />
            </Field>
          </div>
          <p className="text-xs text-[#888]">
            {t("El mapa usa Google Maps en vista incrustada (sin API propia). Si mueves lat/lng manualmente, el mapa se actualiza al guardar.")}
          </p>
        </section>
      )}

      {/* ─── Contacto anfitrión ─── */}
      {tab === "contacto" && profile && (
        <section className="space-y-4 rounded-xl border border-[#ebebeb] bg-white p-6 shadow-sm">
          <p className="text-sm text-[#666]">
            {t("Correo de acceso:")} <strong>{loginEmail}</strong>{" "}
            {t("(solo para iniciar sesión). Los datos de abajo son los que verán los huéspedes.")}
          </p>
          <Field label="Nombre público">
            <input
              className="w-full rounded-lg border border-[#ddd] px-3 py-2 text-sm outline-none focus:border-[#dcb81e] disabled:bg-[#f7f7f7]"
              value={fullName}
              disabled={nameLocked}
              onChange={(e) => setFullName(e.target.value)}
              onBlur={(e) => {
                if (!nameLocked) saveAccount({ fullName: e.target.value });
              }}
            />
          </Field>
          {nameLocked && (
            <p className="text-xs text-[#717171]">
              {t("Tu identidad ya está verificada. El nombre real queda fijo, aunque canceles la membresía.")}{" "}
              {t("El alias se elige en Editar perfil.")}
            </p>
          )}
          <Field label="Bio / sobre ti">
            <textarea
              rows={4}
              className="w-full rounded-lg border border-[#ddd] px-3 py-2 text-sm outline-none focus:border-[#dcb81e]"
              value={profile.bio}
              onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
              onBlur={(e) => saveProfile({ bio: e.target.value })}
            />
          </Field>

          <div className="rounded-xl border border-[#ebebeb] bg-[#fafafa] p-5">
            <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-[#888]">
              {t("Foto de perfil (la ven los huéspedes)")}
            </p>
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
              <div className="flex shrink-0 flex-col items-center gap-2">
                <div
                  className="relative h-32 w-32 overflow-hidden rounded-full border-4 shadow-md"
                  style={{ borderColor: "#dcb81e" }}
                >
                  {profile.avatarUrl?.trim() && !avatarLoadFailed ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={profile.avatarUrl}
                      alt={t("Tu foto de perfil")}
                      className="h-full w-full object-cover"
                      onError={() => setAvatarLoadFailed(true)}
                    />
                  ) : null}
                  {(!profile.avatarUrl?.trim() || avatarLoadFailed) && (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-[#e8e8e8] px-2 text-center text-xs font-medium text-[#888]">
                      {!profile.avatarUrl?.trim() ? (
                        t("Sin foto")
                      ) : (
                        <>
                          <span>{t("No se pudo cargar")}</span>
                          <span className="font-normal text-[#aaa]">{t("Revisa la URL")}</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
                <span className="max-w-[140px] text-center text-[10px] text-[#aaa]">
                  {t("Vista previa actual")}
                </span>
              </div>
              <div className="min-w-0 flex-1 space-y-3">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-black shadow transition hover:brightness-95 disabled:opacity-50" style={{ backgroundColor: "#dcb81e" }}>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={onAvatarUpload}
                    disabled={avatarUploading}
                  />
                  {avatarUploading ? t("Subiendo…") : t("Subir imagen desde tu equipo")}
                </label>
                <p className="text-xs text-[#888]">{t("JPG, PNG, WebP o GIF · máx. 4 MB")}</p>
                <Field label="O pega una URL de imagen">
                  <input
                    className="w-full rounded-lg border border-[#ddd] px-3 py-2 text-sm outline-none focus:border-[#dcb81e]"
                    value={profile.avatarUrl ?? ""}
                    onChange={(e) => setProfile({ ...profile, avatarUrl: e.target.value })}
                    onBlur={(e) => saveProfile({ avatarUrl: e.target.value })}
                    placeholder="https://…"
                  />
                </Field>
                {profile.avatarUrl?.trim() ? (
                  <p className="break-all text-xs text-[#666]">
                    <span className="font-semibold text-[#484848]">{t("URL guardada:")}</span> {profile.avatarUrl}
                  </p>
                ) : (
                  <p className="text-xs text-[#aaa]">{t("Aún no hay URL de foto.")}</p>
                )}
              </div>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="WhatsApp (solo número, sin +)">
              <input
                className="w-full rounded-lg border border-[#ddd] px-3 py-2 text-sm outline-none focus:border-[#dcb81e]"
                value={profile.whatsapp ?? ""}
                onChange={(e) => setProfile({ ...profile, whatsapp: e.target.value })}
                onBlur={(e) => saveProfile({ whatsapp: e.target.value })}
              />
            </Field>
            <Field label="Teléfono">
              <input
                className="w-full rounded-lg border border-[#ddd] px-3 py-2 text-sm outline-none focus:border-[#dcb81e]"
                value={profile.phone ?? ""}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                onBlur={(e) => saveProfile({ phone: e.target.value })}
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Email de contacto público">
              <input
                type="email"
                className="w-full rounded-lg border border-[#ddd] px-3 py-2 text-sm outline-none focus:border-[#dcb81e]"
                value={profile.email ?? ""}
                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                onBlur={(e) => saveProfile({ contactEmail: e.target.value })}
              />
            </Field>
            <Field label="Instagram">
              <input
                className="w-full rounded-lg border border-[#ddd] px-3 py-2 text-sm outline-none focus:border-[#dcb81e]"
                value={profile.instagram ?? ""}
                onChange={(e) => setProfile({ ...profile, instagram: e.target.value })}
                onBlur={(e) => saveProfile({ instagram: e.target.value })}
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Sitio web">
              <input
                className="w-full rounded-lg border border-[#ddd] px-3 py-2 text-sm outline-none focus:border-[#dcb81e]"
                value={profile.website ?? ""}
                onChange={(e) => setProfile({ ...profile, website: e.target.value })}
                onBlur={(e) => saveProfile({ website: e.target.value })}
              />
            </Field>
            <Field label="Otro enlace del anfitrión">
              <input
                className="w-full rounded-lg border border-[#ddd] px-3 py-2 text-sm outline-none focus:border-[#dcb81e]"
                value={profile.airbnbUrl ?? ""}
                onChange={(e) => setProfile({ ...profile, airbnbUrl: e.target.value })}
                onBlur={(e) => saveProfile({ airbnbUrl: e.target.value })}
              />
            </Field>
          </div>
        </section>
      )}

      {/* ─── Precio ─── */}
      {tab === "precio" && (
        <section className="space-y-4 rounded-xl border border-[#ebebeb] bg-white p-6 shadow-sm">
          <fieldset className="rounded-xl border border-[#ebebeb] p-4">
            <legend className="px-1 text-sm font-semibold text-[#484848]">{t("¿Cómo cobras?")}</legend>
            <div className="flex flex-col gap-3 sm:flex-row">
              {(
                [
                  ["nightly", "Por noche", "Estancias cortas."],
                  ["monthly", "Renta mensual", "Mínimo 30 noches."],
                ] as const
              ).map(([mode, label, help]) => (
                <label key={mode} className="flex cursor-pointer items-start gap-3 text-sm">
                  <input
                    type="radio"
                    name="rentalMode"
                    className="mt-1"
                    checked={(listing.rentalMode ?? "nightly") === mode}
                    onChange={() => {
                      setListing({ ...listing, rentalMode: mode });
                      if (mode === "nightly" || (listing.pricePerMonth ?? 0) > 0) void saveListing({ rentalMode: mode });
                    }}
                  />
                  <span>
                    <span className="font-medium text-[#222]">{t(label)}</span>
                    <span className="block text-xs text-[#888]">{t(help)}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-2">
            {listing.rentalMode === "monthly" ? (
              <Field label="Renta mensual (MXN)">
                <input
                  type="number"
                  min={0}
                  className="w-full rounded-lg border border-[#ddd] px-3 py-2 text-sm outline-none focus:border-[#dcb81e]"
                  value={listing.pricePerMonth ?? ""}
                  onChange={(e) => setListing({ ...listing, pricePerMonth: Number(e.target.value) || undefined })}
                  onBlur={() => {
                    if ((listing.pricePerMonth ?? 0) > 0) {
                      void saveListing({ rentalMode: "monthly", pricePerMonth: listing.pricePerMonth });
                    } else notify("Escribe la renta mensual.");
                  }}
                />
                <span className="mt-1 block text-xs text-[#888]">
                  {t("Se cobra por noche como la renta entre 30. La estancia mínima queda en 30 noches.")}
                </span>
              </Field>
            ) : (
              <Field label="Precio por noche (MXN)">
                <input
                  type="number"
                  min={0}
                  className="w-full rounded-lg border border-[#ddd] px-3 py-2 text-sm outline-none focus:border-[#dcb81e]"
                  value={listing.pricePerNight}
                  onChange={(e) => setListing({ ...listing, pricePerNight: Number(e.target.value) })}
                  onBlur={() => saveListing({ pricePerNight: listing.pricePerNight })}
                />
              </Field>
            )}
            <Field label="Tarifa de limpieza (MXN)">
              <input
                type="number"
                min={0}
                className="w-full rounded-lg border border-[#ddd] px-3 py-2 text-sm outline-none focus:border-[#dcb81e]"
                value={listing.cleaningFee}
                onChange={(e) => setListing({ ...listing, cleaningFee: Number(e.target.value) })}
                onBlur={() => saveListing({ cleaningFee: listing.cleaningFee })}
              />
            </Field>
          </div>
          <div className="rounded-lg border border-[#ebebeb] p-4">
            <p className="mb-3 text-sm font-medium text-[#484848]">{t("Descuentos por estancia larga")}</p>
            <div className="grid gap-4 sm:grid-cols-3">
              {(
                [
                  ["weeklyDiscountPct", "Descuento por 7 noches o más (%)", 99],
                  ["monthlyDiscountPct", "Descuento por 28 noches o más (%)", 99],
                  ["minNights", "Mínimo de noches", 365],
                ] as const
              ).map(([k, label, max]) => (
                <Field key={k} label={label}>
                  <input
                    type="number"
                    min={0}
                    max={max}
                    className="w-full rounded-lg border border-[#ddd] px-3 py-2 text-sm outline-none focus:border-[#dcb81e]"
                    value={listing.pricing?.[k] ?? ""}
                    onChange={(e) =>
                      setListing({
                        ...listing,
                        pricing: { ...listing.pricing, [k]: e.target.value === "" ? undefined : Number(e.target.value) },
                      })
                    }
                    onBlur={() => savePricing({ [k]: listing.pricing?.[k] })}
                  />
                </Field>
              ))}
            </div>
            <p className="mt-2 text-xs text-[#888]">
              {listing.rentalMode === "monthly"
                ? t("En renta mensual la estancia mínima es de al menos {n} noches.", { n: MONTHLY_RENTAL_NIGHTS })
                : t("No se acumulan: si aplican varios, el huésped recibe el mayor.")}{" "}
              {t("Fin de semana, temporadas y más opciones están en el calendario de la app.")}
            </p>
          </div>
          <div className="rounded-lg border border-[#ebebeb] bg-[#fafafa] p-4">
            <p className="mb-3 text-sm font-medium text-[#484848]">{t("Reservas")}</p>
            <p className="mb-3 text-xs text-[#888]">
              {t("El huésped debe tener cuenta e iniciar sesión; siempre paga el total estimado antes de que la reserva avance.")}
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[#ddd] bg-white p-3 text-sm">
                <input
                  type="radio"
                  name="bookingMode"
                  checked={(listing.bookingApprovalMode ?? "approval") === "approval"}
                  onChange={() => saveListing({ bookingApprovalMode: "approval" })}
                />
                <span>
                  <span className="font-medium text-[#484848]">{t("Validar cada solicitud")}</span>
                  <span className="mt-1 block text-xs text-[#888]">
                    {t("Cuando aceptas, el huésped recibe el contrato, cómo pagarte y, si lo pediste, la liga del historial crediticio.")}
                  </span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[#ddd] bg-white p-3 text-sm">
                <input
                  type="radio"
                  name="bookingMode"
                  checked={(listing.bookingApprovalMode ?? "approval") === "instant"}
                  onChange={() => saveListing({ bookingApprovalMode: "instant" })}
                />
                <span>
                  <span className="font-medium text-[#484848]">{t("Aceptación automática")}</span>
                  <span className="mt-1 block text-xs text-[#888]">
                    {t("Si paga con Stripe y el pago se confirma, la reserva queda aceptada sola. Tú no apruebas nada.")}
                  </span>
                </span>
              </label>
            </div>
            {CREDIT_CHECK_ENABLED && (
            <div className="mt-4 rounded-lg border border-[#ddd] bg-white p-3">
              <label className="flex cursor-pointer items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={listing.requireCreditCheck === true}
                  onChange={(e) => saveListing({ requireCreditCheck: e.target.checked })}
                />
                <span>
                  <span className="font-medium text-[#484848]">{t("Pedir historial crediticio")}</span>
                  <span className="mt-1 block text-xs text-[#888]">
                    {t("Para seguir con la reserva hace falta una consulta de crédito. El huésped recibe la liga para autorizar y, si le toca, pagar. Igual si la reserva es inmediata.")}
                  </span>
                </span>
              </label>
              {listing.requireCreditCheck && (
                <div className="mt-3 flex gap-3 text-sm">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="creditPayer"
                      checked={(listing.creditCheckPayer ?? "guest") === "guest"}
                      onChange={() => saveListing({ creditCheckPayer: "guest" })}
                    />
                    {t("Lo paga el huésped")}
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="creditPayer"
                      checked={listing.creditCheckPayer === "host"}
                      onChange={() => saveListing({ creditCheckPayer: "host" })}
                    />
                    {t("Lo pagas tú")}
                  </label>
                </div>
              )}
            </div>
            )}
          </div>
        </section>
      )}

      {/* ─── Comodidades ─── */}
      {tab === "comodidades" && (
        <section className="space-y-6 rounded-xl border border-[#ebebeb] bg-white p-6 shadow-sm">
          <div className="space-y-4">
            <p className="text-sm font-medium text-[#484848]">{t("Comodidades")}</p>
            {[
              ...AMENITY_GROUPS,
              { key: "other", title: "Otras", items: listing.amenities.filter((a) => !AMENITY_OPTIONS.includes(a)) },
            ]
              .filter((g) => g.items.length > 0)
              .map((g) => (
                <div key={g.key}>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#888]">{t(g.title)}</p>
                  <div className="flex flex-wrap gap-2">
                    {g.items.map((a) => {
                      const on = listing.amenities.includes(a);
                      return (
                        <button
                          key={a}
                          type="button"
                          onClick={() => {
                            const amenities = on ? listing.amenities.filter((x) => x !== a) : [...listing.amenities, a];
                            setListing({ ...listing, amenities });
                            saveListing({ amenities });
                          }}
                          className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                            on ? "border-[#dcb81e] bg-[#dcb81e]/20 text-black" : "border-[#ddd] bg-white text-[#666] hover:border-[#dcb81e]"
                          }`}
                        >
                          {t(a)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <RuleToggle
              label="Fumar"
              value={listing.rules.smoking}
              onChange={(smoking) => saveListing({ rules: { ...listing.rules, smoking } })}
            />
            <RuleToggle
              label="Mascotas"
              value={listing.rules.pets}
              onChange={(pets) => saveListing({ rules: { ...listing.rules, pets } })}
            />
            <RuleToggle
              label="Fiestas / eventos"
              value={listing.rules.parties}
              onChange={(parties) => saveListing({ rules: { ...listing.rules, parties } })}
            />
            <RuleToggle
              label="Niños"
              value={listing.rules.children}
              onChange={(children) => saveListing({ rules: { ...listing.rules, children } })}
            />
          </div>
          <Field label="Otras reglas">
            <textarea
              rows={5}
              maxLength={2000}
              className="w-full rounded-lg border border-[#ddd] px-3 py-2 text-sm outline-none focus:border-[#dcb81e]"
              value={listing.houseRules ?? ""}
              placeholder={t("Ej.: Silencio de 22:00 a 8:00. No se permiten visitas después de las 21:00.")}
              onChange={(e) => setListing({ ...listing, houseRules: e.target.value })}
              onBlur={() => saveListing({ houseRules: (listing.houseRules ?? "").trim() })}
            />
            <p className="mt-1 text-xs text-[#888]">
              {t("Horas de silencio, visitas, uso de la alberca, basura… Se muestran en el anuncio y entran al contrato.")}
            </p>
          </Field>
        </section>
      )}

      {tab === "llegada" && (
        <ArrivalTab
          listing={listing}
          hostName={fullName}
          onSave={(patch) => {
            setListing({ ...listing, ...patch });
            void saveListing(patch);
          }}
        />
      )}

      {tab === "contrato" && (
        <ContractTab
          listing={listing}
          hostName={fullName}
          onSave={(contract) => {
            setListing({ ...listing, contract });
            void saveListing({ contract });
          }}
        />
      )}
    </div>
  );
}

function ArrivalTab({
  listing,
  hostName,
  onSave,
}: {
  listing: HostListingRecord;
  hostName: string;
  onSave: (patch: { arrivalGuide?: ArrivalGuide; arrivalMessage?: ArrivalMessageSettings; agentCanShareAccessCode?: boolean }) => void;
}) {
  const t = useT();
  const [guide, setGuide] = useState<ArrivalGuide>(() => ({ ...(listing.arrivalGuide ?? {}) }));
  const [message, setMessage] = useState<ArrivalMessageSettings>(() => arrivalMessageOf(listing.arrivalMessage));
  const [agentCode, setAgentCode] = useState(listing.agentCanShareAccessCode !== false);
  const setG = (k: keyof ArrivalGuide, v: string) => setGuide((g) => ({ ...g, [k]: v }));
  const input = "w-full rounded-lg border border-[#ddd] px-3 py-2 text-sm outline-none focus:border-[#dcb81e]";
  const area = (k: keyof ArrivalGuide, label: string, placeholder: string) => (
    <Field label={label}>
      <textarea rows={4} className={input} value={guide[k] ?? ""} placeholder={t(placeholder)} onChange={(e) => setG(k, e.target.value)} />
    </Field>
  );

  return (
    <div className="space-y-6">
      <section className="space-y-4 rounded-xl border border-[#ebebeb] bg-white p-6 shadow-sm">
        <div>
          <h2 className="text-lg font-semibold text-[#484848]">{t("Guía de llegada")}</h2>
          <p className="mt-1 text-sm text-[#888]">
            {t("Se le comparte al huésped sólo cuando reserva y paga con el Motor de reservas.")}
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Llegada desde">
            <input type="time" className={input} value={guide.checkInTime ?? ""} onChange={(e) => setG("checkInTime", e.target.value)} />
          </Field>
          <Field label="Salida antes de">
            <input type="time" className={input} value={guide.checkOutTime ?? ""} onChange={(e) => setG("checkOutTime", e.target.value)} />
          </Field>
        </div>
        {area("checkInMethod", "Cómo entrar", "Ej.: Caja de llaves junto a la puerta, código 1234. O: te recibo en persona.")}
        <Field label="Código de acceso">
          <input
            className={input}
            maxLength={ACCESS_CODE_MAX}
            value={guide.accessCode ?? ""}
            placeholder={t("Ej.: Puerta 4821#, caja de llaves 0912")}
            onChange={(e) => setG("accessCode", e.target.value)}
          />
        </Field>
        <label className="-mt-2 flex items-start gap-2 text-sm text-[#484848]">
          <input type="checkbox" checked={agentCode} onChange={(e) => setAgentCode(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0" />
          {t("El asistente de IA puede dar el código de entrada a huéspedes con reserva confirmada")}
        </label>
        {area("directions", "Cómo llegar", "Cómo llegar, dónde estacionarse, qué timbre tocar…")}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre de la red">
            <input className={input} value={guide.wifiName ?? ""} onChange={(e) => setG("wifiName", e.target.value)} />
          </Field>
          <Field label="Contraseña">
            <input className={input} value={guide.wifiPassword ?? ""} onChange={(e) => setG("wifiPassword", e.target.value)} />
          </Field>
        </div>
        {area("houseManual", "Manual de la casa", "Cómo usar el boiler, la tele, la basura, reglas de los vecinos…")}
        {area("checkoutInstructions", "Instrucciones de salida", "Ej.: Deja las llaves en la caja, saca la basura y apaga el aire.")}
        <button
          type="button"
          onClick={() => onSave({ arrivalGuide: guide, agentCanShareAccessCode: agentCode })}
          className="rounded-full px-5 py-2.5 text-sm font-semibold text-black shadow transition hover:brightness-95"
          style={{ backgroundColor: "#dcb81e" }}
        >
          {t("Guardar guía de llegada")}
        </button>
      </section>

      <section className="space-y-4 rounded-xl border border-[#ebebeb] bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-[#484848]">{t("Mensaje de llegada")}</h2>
        <ArrivalMessageEditor listing={listing} guide={guide} value={message} onChange={setMessage} hostName={hostName} />
        <button
          type="button"
          onClick={() => onSave({ arrivalMessage: message })}
          className="rounded-full px-5 py-2.5 text-sm font-semibold text-black shadow transition hover:brightness-95"
          style={{ backgroundColor: "#dcb81e" }}
        >
          {t("Guardar mensaje de llegada")}
        </button>
      </section>
    </div>
  );
}

function ContractTab({
  listing,
  hostName,
  onSave,
}: {
  listing: HostListingRecord;
  hostName: string;
  onSave: (c: ListingContractSettings) => void;
}) {
  const t = useT();
  const [draft, setDraft] = useState<ListingContractSettings>(() =>
    defaultListingContract({
      ...listing.contract,
      hostLegalName: listing.contract?.hostLegalName || hostName,
      propertyAddress:
        listing.contract?.propertyAddress ||
        [listing.addressLine, listing.zone, listing.city, listing.state].filter(Boolean).join(", "),
    })
  );

  const [preview, setPreview] = useState<string[] | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);

  function patch(partial: Partial<ListingContractSettings>, persist = false) {
    const next = defaultListingContract({ ...draft, ...partial });
    setDraft(next);
    if (persist) onSave(next);
  }

  async function loadPreview() {
    setPreviewBusy(true);
    const res = await fetch("/api/host/contracts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId: listing.id, contract: draft }),
    }).catch(() => null);
    const j = res ? await res.json().catch(() => ({})) : {};
    setPreview(Array.isArray(j.lines) ? j.lines : []);
    setPreviewBusy(false);
  }

  const selected = BOOKING_CONTRACT_TEMPLATES.find((tpl) => tpl.id === draft.templateId) ?? BOOKING_CONTRACT_TEMPLATES[0];

  return (
    <section className="space-y-5 rounded-xl border border-[#ebebeb] bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold text-[#484848]">{t("Contrato de cada reserva")}</h2>
        <p className="mt-1 text-sm text-[#888]">
          {t(
            "Eliges la plantilla y pones tus datos. Al reservar, el huésped entra con el nombre, correo, teléfono y dirección de su cuenta. Ambos firman el mismo documento."
          )}
        </p>
      </div>

      <ContractReviewNotice
        listing={listing}
        reviewed={draft.hostReviewed}
        onReviewed={(v) => patch(v ? { hostReviewed: true } : { hostReviewed: false, hostAcknowledged: false }, true)}
      />

      <ContractTips
        hasClause={draft.extraClauses.includes(MIN_STAY_CLAUSE.slice(0, 40))}
        onAddClause={(c) => patch({ extraClauses: [draft.extraClauses.trim(), c].filter(Boolean).join("\n\n") }, true)}
      />

      <div className="grid gap-3">
        {BOOKING_CONTRACT_TEMPLATES.map((tpl) => (
          <label
            key={tpl.id}
            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm ${
              draft.templateId === tpl.id ? "border-[#dcb81e] bg-[#dcb81e]/10" : "border-[#ebebeb] bg-white"
            }`}
          >
            <input
              type="radio"
              name="contractTemplate"
              checked={draft.templateId === tpl.id}
              onChange={() =>
                patch(
                  {
                    templateId: tpl.id,
                    extraClauses: draft.extraClauses || tpl.defaultExtraClauses,
                    cancellationOverride: undefined,
                  },
                  true
                )
              }
            />
            <span>
              <span className="font-medium text-[#484848]">{t(tpl.title)}</span>
              <span className="mt-1 block text-xs text-[#888]">{t(tpl.blurb)}</span>
            </span>
          </label>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Tu nombre legal (firma)">
          <input
            className="w-full rounded-lg border border-[#ddd] px-3 py-2 text-sm"
            value={draft.hostLegalName}
            onChange={(e) => patch({ hostLegalName: e.target.value })}
            onBlur={() => onSave(draft)}
          />
        </Field>
        <Field label="Tu domicilio">
          <input
            className="w-full rounded-lg border border-[#ddd] px-3 py-2 text-sm"
            value={draft.hostAddress}
            onChange={(e) => patch({ hostAddress: e.target.value })}
            onBlur={() => onSave(draft)}
          />
        </Field>
      </div>
      <Field label="Dirección del inmueble">
        <input
          className="w-full rounded-lg border border-[#ddd] px-3 py-2 text-sm"
          value={draft.propertyAddress}
          onChange={(e) => patch({ propertyAddress: e.target.value })}
          onBlur={() => onSave(draft)}
        />
      </Field>
      <Field label={`${t("Depósito pactado (MXN)")} · ${t(selected.depositHint)}`}>
        <input
          type="number"
          min={0}
          className="w-full rounded-lg border border-[#ddd] px-3 py-2 text-sm sm:max-w-xs"
          value={draft.depositMxn}
          onChange={(e) => patch({ depositMxn: Number(e.target.value) })}
          onBlur={() => onSave(draft)}
        />
      </Field>
      <Field label="Cláusulas tuyas (se suman a la plantilla)">
        <textarea
          rows={4}
          className="w-full rounded-lg border border-[#ddd] px-3 py-2 text-sm"
          value={draft.extraClauses}
          onChange={(e) => patch({ extraClauses: e.target.value })}
          onBlur={() => onSave(draft)}
        />
      </Field>
      <Field label="Cancelación (deja vacío para usar la de la plantilla)">
        <textarea
          rows={3}
          className="w-full rounded-lg border border-[#ddd] px-3 py-2 text-sm"
          value={draft.cancellationOverride ?? ""}
          onChange={(e) => patch({ cancellationOverride: e.target.value })}
          onBlur={() => onSave(draft)}
        />
      </Field>
      <label className={`flex items-start gap-2 text-sm text-[#484848] ${draft.hostReviewed ? "" : "opacity-50"}`}>
        <input
          type="checkbox"
          className="mt-1 accent-[#dcb81e]"
          disabled={!draft.hostReviewed}
          checked={draft.hostAcknowledged}
          onChange={(e) => patch({ hostAcknowledged: e.target.checked }, true)}
        />
        <span>
          {t(
            "Confirmo esta plantilla y mis datos. En reservas de aceptación automática, esto cuenta como mi firma de oferta."
          )}
        </span>
      </label>

      <div>
        <button
          type="button"
          disabled={previewBusy}
          onClick={() => (preview ? setPreview(null) : void loadPreview())}
          className="rounded-lg border border-[#484848] px-4 py-2 text-sm font-semibold text-[#484848] disabled:opacity-50"
        >
          {previewBusy ? t("Cargando…") : preview ? t("Ocultar contrato") : t("Ver contrato completo")}
        </button>
        {preview && (
          <div className="mt-3 max-h-[480px] overflow-y-auto rounded-lg bg-[#f7f7f7] p-4 text-[13px] leading-relaxed text-[#333]">
            {preview.length === 0 ? (
              <p className="text-red-700">{t("No se pudo cargar el contrato.")}</p>
            ) : (
              preview.map((l, i) =>
                l === "" ? (
                  <div key={i} className="h-2" />
                ) : /^[A-ZÁÉÍÓÚÑ ]+$/.test(l) ? (
                  <p key={i} className="mb-1 mt-2 text-xs font-bold tracking-wide text-[#222]">
                    {l}
                  </p>
                ) : (
                  <p key={i} className="mb-1">
                    {l}
                  </p>
                )
              )
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const t = useT();
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#888]">{t(label)}</span>
      {children}
    </label>
  );
}

function RuleToggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean | null;
  onChange: (v: boolean | null) => void;
}) {
  const t = useT();
  return (
    <div className="flex items-center justify-between rounded-lg border border-[#ebebeb] px-4 py-3">
      <span className="text-sm font-medium text-[#484848]">{t(label)}</span>
      <select
        className="rounded border border-[#ddd] px-2 py-1 text-sm"
        value={value === null ? "null" : value ? "yes" : "no"}
        onChange={(e) => {
          const v = e.target.value === "null" ? null : e.target.value === "yes";
          onChange(v);
        }}
      >
        <option value="no">{t("No")}</option>
        <option value="yes">{t("Sí")}</option>
        <option value="null">{t("Preguntar / no indicado")}</option>
      </select>
    </div>
  );
}
