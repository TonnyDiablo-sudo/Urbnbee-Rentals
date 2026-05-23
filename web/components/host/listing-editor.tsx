"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { HostListingRecord, HostProfileRecord } from "@/lib/marketplace-types";
import type { ListingCategory } from "@/lib/mock-data";
import { AMENITY_OPTIONS } from "@/lib/amenity-options";

type Tab = "fotos" | "info" | "ubicacion" | "contacto" | "precio" | "comodidades";

const TABS: { id: Tab; label: string }[] = [
  { id: "fotos", label: "Fotos" },
  { id: "info", label: "Información" },
  { id: "ubicacion", label: "Ubicación" },
  { id: "contacto", label: "Tu perfil y contacto" },
  { id: "precio", label: "Precio" },
  { id: "comodidades", label: "Comodidades y reglas" },
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
  const [tab, setTab] = useState<Tab>("fotos");
  const [listing, setListing] = useState<HostListingRecord | null>(null);
  const [profile, setProfile] = useState<HostProfileRecord | null>(null);
  const [loginEmail, setLoginEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [geocodeLoading, setGeocodeLoading] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarLoadFailed, setAvatarLoadFailed] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [importWarnings, setImportWarnings] = useState<string[] | null>(null);

  useEffect(() => {
    if (searchParams.get("fromImport") !== "1") return;
    try {
      const raw = sessionStorage.getItem("urbnbee_listing_import_meta");
      if (!raw) return;
      const meta = JSON.parse(raw) as { warnings?: string[] };
      if (Array.isArray(meta.warnings) && meta.warnings.length) {
        setImportWarnings(meta.warnings);
      }
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

  async function saveListing(patch: Partial<HostListingRecord> & { regenerateSlug?: boolean }) {
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
    if (!listing || !confirm("¿Eliminar esta foto?")) return;
    const photos = listing.photos.filter((_, i) => i !== index);
    saveListing({ photos });
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-[#ebebeb] bg-white p-12 text-center text-[#888]">
        Cargando editor…
      </div>
    );
  }

  if (notFound || !listing) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-[#ebebeb] bg-white p-10 text-center shadow-sm">
        <p className="text-[#484848]">Este alojamiento no existe o el enlace es antiguo (por ejemplo, un borrador ya no guardado).</p>
        <p className="mt-2 text-sm text-[#888]">Abre la lista actualizada y edita el anuncio correcto.</p>
        <Link
          href="/host/listings"
          className="mt-6 inline-block rounded-full px-6 py-2.5 text-sm font-semibold text-black"
          style={{ backgroundColor: "#dcb81e" }}
        >
          Ir a mis alojamientos
        </Link>
      </div>
    );
  }

  const previewUrl = listing.published ? `/listings/${listing.slug}` : null;

  return (
    <div className="space-y-6">
      {importWarnings && importWarnings.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          <p className="font-semibold">Borrador generado con IA — revísalo antes de publicar</p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-amber-900/90">
            {importWarnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
          <button
            type="button"
            className="mt-2 text-xs font-medium underline"
            onClick={() => setImportWarnings(null)}
          >
            Entendido
          </button>
        </div>
      )}
      {toast && (
        <div
          className="fixed bottom-6 left-1/2 z-[200] -translate-x-1/2 rounded-full px-5 py-2 text-sm font-medium text-black shadow-lg"
          style={{ backgroundColor: "#dcb81e" }}
        >
          {toast}
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-[#484848]">Editar alojamiento</h1>
          <p className="mt-1 text-sm text-[#888]">
            Slug público:{" "}
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
            <span className="font-medium text-[#484848]">Publicado en el directorio</span>
          </label>
          {previewUrl && (
            <Link
              href={previewUrl}
              target="_blank"
              className="rounded-full border border-[#dcb81e] px-4 py-2 text-sm font-semibold text-[#484848] transition hover:bg-[#dcb81e]/10"
            >
              Ver página pública →
            </Link>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-[#ebebeb] pb-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              tab === t.id ? "bg-black text-white" : "bg-[#f5f5f5] text-[#484848] hover:bg-[#ebebeb]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ─── Fotos ─── */}
      {tab === "fotos" && (
        <section className="rounded-xl border border-[#ebebeb] bg-white p-6 shadow-sm">
          <p className="mb-4 text-sm text-[#666]">
            La primera foto es la portada. Arrastra el orden con los botones.
          </p>
          <label className="mb-6 inline-flex cursor-pointer items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-black shadow transition hover:brightness-95" style={{ backgroundColor: "#dcb81e" }}>
            <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="hidden" onChange={onUpload} disabled={uploading} />
            {uploading ? "Subiendo…" : "+ Subir foto"}
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
                    Quitar
                  </button>
                </div>
                {i === 0 && (
                  <span className="absolute left-2 top-2 rounded bg-[#dcb81e] px-2 py-0.5 text-[10px] font-bold text-black">
                    Portada
                  </span>
                )}
              </div>
            ))}
            {listing.photos.length === 0 && (
              <p className="col-span-full text-sm text-[#aaa]">Aún no hay fotos. Sube al menos una para publicar.</p>
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
                Fotos del anuncio (vista previa)
              </span>
              <button
                type="button"
                className="text-sm font-semibold text-[#dcb81e] underline"
                onClick={() => setTab("fotos")}
              >
                Gestionar fotos →
              </button>
            </div>
            {listing.photos.length === 0 ? (
              <p className="text-sm text-[#888]">
                Aún no hay fotos.{" "}
                <button type="button" className="font-semibold text-[#dcb81e] underline" onClick={() => setTab("fotos")}>
                  Ir a la pestaña Fotos para subirlas
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
                        Portada
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
                    {c.label}
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
                placeholder="Ej. Espacio completo, Habitación privada…"
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
          <Field label="Tamaño (opcional)">
            <input
              className="w-full rounded-lg border border-[#ddd] px-3 py-2 text-sm outline-none focus:border-[#dcb81e]"
              value={listing.size ?? ""}
              onChange={(e) => setListing({ ...listing, size: e.target.value })}
              onBlur={() => saveListing({ size: listing.size || undefined })}
              placeholder="Ej. 85 m²"
            />
          </Field>
          <button
            type="button"
            className="text-xs font-medium text-[#dcb81e] underline"
            onClick={() => {
              if (confirm("¿Generar un nuevo enlace (slug) desde el título actual? Los enlaces antiguos dejarán de funcionar.")) {
                saveListing({ regenerateSlug: true, title: listing.title });
              }
            }}
          >
            Regenerar URL amigable desde el título
          </button>
        </section>
      )}

      {/* ─── Ubicación ─── */}
      {tab === "ubicacion" && (
        <section className="space-y-4 rounded-xl border border-[#ebebeb] bg-white p-6 shadow-sm">
          <Field label="Dirección (no se muestra completa hasta la reserva)">
            <input
              className="w-full rounded-lg border border-[#ddd] px-3 py-2 text-sm outline-none focus:border-[#dcb81e]"
              value={listing.addressLine}
              onChange={(e) => setListing({ ...listing, addressLine: e.target.value })}
              onBlur={() => saveListing({ addressLine: listing.addressLine })}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Ciudad">
              <input
                className="w-full rounded-lg border border-[#ddd] px-3 py-2 text-sm outline-none focus:border-[#dcb81e]"
                value={listing.city}
                onChange={(e) => setListing({ ...listing, city: e.target.value })}
                onBlur={() => saveListing({ city: listing.city })}
              />
            </Field>
            <Field label="Zona / barrio">
              <input
                className="w-full rounded-lg border border-[#ddd] px-3 py-2 text-sm outline-none focus:border-[#dcb81e]"
                value={listing.zone}
                onChange={(e) => setListing({ ...listing, zone: e.target.value })}
                onBlur={() => saveListing({ zone: listing.zone })}
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Estado / provincia">
              <input
                className="w-full rounded-lg border border-[#ddd] px-3 py-2 text-sm outline-none focus:border-[#dcb81e]"
                value={listing.county}
                onChange={(e) => setListing({ ...listing, county: e.target.value })}
                onBlur={() => saveListing({ county: listing.county })}
              />
            </Field>
            <Field label="País">
              <input
                className="w-full rounded-lg border border-[#ddd] px-3 py-2 text-sm outline-none focus:border-[#dcb81e]"
                value={listing.country}
                onChange={(e) => setListing({ ...listing, country: e.target.value })}
                onBlur={() => saveListing({ country: listing.country })}
              />
            </Field>
          </div>

          <div className="overflow-hidden rounded-xl border border-[#ebebeb] bg-[#fafafa]">
            <div className="flex flex-col gap-3 border-b border-[#ebebeb] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-[#484848]">Mapa de ubicación</p>
                <p className="mt-0.5 max-w-xl text-xs text-[#888]">
                  Usa el botón para colocar el pin según tu dirección; revisa que coincida con tu lugar y ajusta lat/lng si hace falta.
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
                  {geocodeLoading ? "Buscando…" : "Centrar mapa según dirección"}
                </button>
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${listing.lat},${listing.lng}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center rounded-full border border-[#ddd] bg-white px-4 py-2.5 text-sm font-semibold text-[#484848] transition hover:bg-[#f5f5f5]"
                >
                  Abrir en Google Maps
                </a>
              </div>
            </div>
            <div className="relative aspect-[21/9] min-h-[280px] w-full bg-[#e5e5e5] sm:aspect-auto sm:min-h-[320px]">
              <iframe
                key={`${listing.lat}-${listing.lng}`}
                title="Vista previa del mapa"
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
            El mapa usa Google Maps en vista incrustada (sin API propia). Si mueves lat/lng manualmente, el mapa se actualiza al guardar.
          </p>
        </section>
      )}

      {/* ─── Contacto anfitrión ─── */}
      {tab === "contacto" && profile && (
        <section className="space-y-4 rounded-xl border border-[#ebebeb] bg-white p-6 shadow-sm">
          <p className="text-sm text-[#666]">
            Correo de acceso: <strong>{loginEmail}</strong> (solo para iniciar sesión). Los datos de abajo son los que verán los huéspedes.
          </p>
          <Field label="Nombre público">
            <input
              className="w-full rounded-lg border border-[#ddd] px-3 py-2 text-sm outline-none focus:border-[#dcb81e]"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              onBlur={(e) => saveAccount({ fullName: e.target.value })}
            />
          </Field>
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
              Foto de perfil (la ven los huéspedes)
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
                      alt="Tu foto de perfil"
                      className="h-full w-full object-cover"
                      onError={() => setAvatarLoadFailed(true)}
                    />
                  ) : null}
                  {(!profile.avatarUrl?.trim() || avatarLoadFailed) && (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-[#e8e8e8] px-2 text-center text-xs font-medium text-[#888]">
                      {!profile.avatarUrl?.trim() ? (
                        "Sin foto"
                      ) : (
                        <>
                          <span>No se pudo cargar</span>
                          <span className="font-normal text-[#aaa]">Revisa la URL</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
                <span className="max-w-[140px] text-center text-[10px] text-[#aaa]">
                  Vista previa actual
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
                  {avatarUploading ? "Subiendo…" : "Subir imagen desde tu equipo"}
                </label>
                <p className="text-xs text-[#888]">JPG, PNG, WebP o GIF · máx. 4 MB</p>
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
                    <span className="font-semibold text-[#484848]">URL guardada:</span> {profile.avatarUrl}
                  </p>
                ) : (
                  <p className="text-xs text-[#aaa]">Aún no hay URL de foto.</p>
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
            <Field label="Enlace Airbnb u otra plataforma">
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
          <div className="grid gap-4 sm:grid-cols-2">
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
          <div className="rounded-lg border border-[#ebebeb] bg-[#fafafa] p-4">
            <p className="mb-3 text-sm font-medium text-[#484848]">Reservas</p>
            <p className="mb-3 text-xs text-[#888]">
              El huésped debe tener cuenta e iniciar sesión; siempre paga el total estimado antes de que la reserva avance.
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
                  <span className="font-medium text-[#484848]">Validar cada solicitud</span>
                  <span className="mt-1 block text-xs text-[#888]">
                    Tras el pago la reserva queda pendiente hasta que aceptes o rechaces.
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
                  <span className="font-medium text-[#484848]">Aceptación automática</span>
                  <span className="mt-1 block text-xs text-[#888]">
                    Tras el pago la reserva queda confirmada sin paso manual (salvo solapes o bloqueos).
                  </span>
                </span>
              </label>
            </div>
          </div>
        </section>
      )}

      {/* ─── Comodidades ─── */}
      {tab === "comodidades" && (
        <section className="space-y-6 rounded-xl border border-[#ebebeb] bg-white p-6 shadow-sm">
          <div>
            <p className="mb-3 text-sm font-medium text-[#484848]">Comodidades</p>
            <div className="flex flex-wrap gap-2">
              {AMENITY_OPTIONS.map((a) => {
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
                    {a}
                  </button>
                );
              })}
            </div>
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
        </section>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-[#888]">{label}</span>
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
  return (
    <div className="flex items-center justify-between rounded-lg border border-[#ebebeb] px-4 py-3">
      <span className="text-sm font-medium text-[#484848]">{label}</span>
      <select
        className="rounded border border-[#ddd] px-2 py-1 text-sm"
        value={value === null ? "null" : value ? "yes" : "no"}
        onChange={(e) => {
          const v = e.target.value === "null" ? null : e.target.value === "yes";
          onChange(v);
        }}
      >
        <option value="no">No</option>
        <option value="yes">Sí</option>
        <option value="null">Preguntar / no indicado</option>
      </select>
    </div>
  );
}
