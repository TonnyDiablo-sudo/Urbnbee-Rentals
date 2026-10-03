"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AssociateDraft, DraftContact } from "@/lib/associate-drafts-store";
import type { DuplicateHit } from "@/lib/associate-duplicates";
import type { ListingImportLlmPayload } from "@/lib/listing-import-types";

type Account = { id: string; fullName: string; email: string };

type Published = {
  hostId: string;
  listingSlug: string;
  created: boolean;
  credentials?: { email: string; password: string };
  warnings: string[];
};

const CATEGORIES = [
  ["habitaciones", "Habitación"],
  ["casas", "Casa"],
  ["departamentos", "Departamento"],
  ["cabanas", "Cabaña"],
  ["vinos", "Viñedo"],
] as const;

const DUP_REASON: Record<DuplicateHit["reason"], string> = {
  phone: "mismo teléfono",
  source: "mismo enlace de origen",
  title: "título casi igual en la misma ciudad",
};

const field = "mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none";

export function ReviewForm({
  draft,
  duplicates,
  accounts,
  nextDraftId,
}: {
  draft: AssociateDraft;
  duplicates: DuplicateHit[];
  accounts: Account[];
  nextDraftId?: string;
}) {
  const router = useRouter();
  const [l, setL] = useState<ListingImportLlmPayload>(draft.listing);
  const [contact, setContact] = useState<DraftContact>(draft.contact);
  const [photos, setPhotos] = useState<string[]>(draft.photos);
  const [targetKind, setTargetKind] = useState<"new" | "existing">(
    draft.targetHostId && accounts.some((a) => a.id === draft.targetHostId) ? "existing" : "new"
  );
  const [hostId, setHostId] = useState(draft.targetHostId ?? accounts[0]?.id ?? "");
  const [fullName, setFullName] = useState(draft.contact.hostName ?? "");
  const [email, setEmail] = useState(draft.contact.email ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<Published | null>(null);
  const [copied, setCopied] = useState(false);

  const set = <K extends keyof ListingImportLlmPayload>(k: K, v: ListingImportLlmPayload[K]) =>
    setL((prev) => ({ ...prev, [k]: v }));
  const setNum = (k: "guests" | "bedrooms" | "bathrooms" | "pricePerNight" | "cleaningFee", v: string) =>
    set(k, v === "" ? undefined : Number(v));
  const removed = draft.photos.filter((p) => !photos.includes(p));

  async function publish() {
    setBusy(true);
    setErr(null);
    const res = await fetch(`/api/associate/drafts/${draft.id}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        listing: l,
        contact,
        photos,
        target:
          targetKind === "existing"
            ? { kind: "existing", hostId }
            : { kind: "new", fullName, email: email || undefined, phone: contact.phone, whatsapp: contact.whatsapp },
      }),
    }).catch(() => null);
    const j = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (!res?.ok) {
      setErr(typeof j.error === "string" ? j.error : "No se pudo publicar.");
      return;
    }
    setDone(j as Published);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function discard() {
    if (!confirm("¿Descartar este borrador?")) return;
    await fetch(`/api/associate/drafts/${draft.id}`, { method: "DELETE" });
    router.push(nextDraftId ? `/asociados/borradores/${nextDraftId}` : "/asociados");
    router.refresh();
  }

  if (done) {
    const origin = typeof window !== "undefined" ? window.location.origin : "https://cabibee.com";
    const message = done.credentials
      ? `Hola ${fullName.split(" ")[0] || ""}, publicamos gratis tu alojamiento en Cabibee: ${origin}/listings/${done.listingSlug}\n\nPara administrarlo entra a ${origin}/login\nUsuario: ${done.credentials.email}\nContraseña temporal: ${done.credentials.password}\n\nAl entrar te pedirá tu correo y una contraseña nueva. Puedes editar o borrar el anuncio cuando quieras.`
      : null;
    return (
      <div className="mx-auto max-w-2xl space-y-5">
        <div className="rounded-xl border border-green-200 bg-green-50 p-5">
          <h1 className="text-lg font-semibold text-green-900">Publicado ✓</h1>
          <p className="mt-1 text-sm text-green-800">
            {done.created ? "Se creó la cuenta del anfitrión y su anuncio ya está en Cabibee." : "El anuncio se agregó a la cuenta."}
          </p>
          <a href={`/listings/${done.listingSlug}`} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm text-green-900 underline">
            Ver anuncio
          </a>
        </div>
        {done.warnings.map((w) => (
          <p key={w} className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {w}
          </p>
        ))}
        {done.credentials && message && (
          <div className="rounded-xl border border-gray-200 bg-white p-5">
            <p className="text-sm font-semibold text-gray-900">Acceso del anfitrión (solo se muestra ahora)</p>
            <p className="mt-2 font-mono text-sm text-gray-800">Usuario: {done.credentials.email}</p>
            <p className="font-mono text-sm text-gray-800">Contraseña: {done.credentials.password}</p>
            <p className="mt-3 text-xs text-gray-500">
              Si la pierdes, genera otra desde la cuenta. Mensaje listo para mandarle:
            </p>
            <textarea readOnly rows={8} value={message} className="mt-1 w-full rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm" />
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(message);
                setCopied(true);
              }}
              className="mt-2 rounded-lg bg-gray-900 px-4 py-2 text-sm text-white"
            >
              {copied ? "Copiado ✓" : "Copiar mensaje"}
            </button>
          </div>
        )}
        <div className="flex flex-wrap gap-3">
          <Link href={`/asociados/capturar?host=${done.hostId}`} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm">
            + Otro anuncio para esta misma cuenta
          </Link>
          <Link href={`/asociados/cuentas/${done.hostId}`} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm">
            Ver cuenta
          </Link>
          {nextDraftId ? (
            <Link href={`/asociados/borradores/${nextDraftId}`} className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white">
              Siguiente borrador →
            </Link>
          ) : (
            <Link href="/asociados" className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white">
              Volver al inicio
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Revisar anuncio</h1>
          <p className="mt-1 text-xs text-gray-400">
            {draft.source.url ? (
              <a href={draft.source.url} target="_blank" rel="noreferrer" className="underline">
                {draft.source.site ?? draft.source.url}
              </a>
            ) : (
              "Capturas de pantalla"
            )}
            {draft.model ? ` · ${draft.model}` : ""}
          </p>
        </div>
        <button type="button" onClick={() => void discard()} className="text-sm text-gray-500 underline">
          Descartar
        </button>
      </div>

      {duplicates.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-800">Posible duplicado</p>
          <ul className="mt-1 space-y-1 text-sm text-red-700">
            {duplicates.map((d, i) => (
              <li key={i}>
                {d.hostName} ({DUP_REASON[d.reason]})
                {d.listingSlug && (
                  <>
                    {" · "}
                    <a href={`/listings/${d.listingSlug}`} target="_blank" rel="noreferrer" className="underline">
                      {d.listingTitle}
                    </a>
                  </>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {draft.warnings.length > 0 && (
        <ul className="space-y-1 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          {draft.warnings.map((w) => (
            <li key={w}>• {w}</li>
          ))}
        </ul>
      )}

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-gray-900">
          Fotos ({photos.length}) <span className="font-normal text-gray-400">· la primera es la portada</span>
        </h2>
        {photos.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">Sin fotos. Se publicará con una imagen genérica.</p>
        ) : (
          <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
            {photos.map((p, i) => (
              <li key={p} className="group relative aspect-[4/3] overflow-hidden rounded-lg border border-gray-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p} alt="" className="h-full w-full object-cover" />
                {i === 0 && <span className="absolute left-1 top-1 rounded bg-amber-500 px-1.5 py-0.5 text-[10px] text-white">Portada</span>}
                <div className="absolute inset-x-1 bottom-1 flex gap-1 opacity-0 transition group-hover:opacity-100">
                  {i > 0 && (
                    <button
                      type="button"
                      onClick={() => setPhotos((prev) => [p, ...prev.filter((x) => x !== p)])}
                      className="rounded bg-black/75 px-1.5 py-0.5 text-[10px] text-white"
                    >
                      Portada
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setPhotos((prev) => prev.filter((x) => x !== p))}
                    className="ml-auto rounded bg-red-600/90 px-1.5 py-0.5 text-[10px] text-white"
                  >
                    Quitar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {removed.length > 0 && (
          <div className="mt-3">
            <p className="text-xs text-gray-400">Quitadas (clic para regresar):</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {removed.map((p) => (
                <button key={p} type="button" onClick={() => setPhotos((prev) => [...prev, p])}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p} alt="" className="h-12 w-16 rounded object-cover opacity-50 hover:opacity-100" />
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="grid gap-4 rounded-xl border border-gray-200 bg-white p-5 sm:grid-cols-2">
        <h2 className="text-sm font-semibold text-gray-900 sm:col-span-2">Anuncio</h2>
        <label className="text-sm text-gray-700 sm:col-span-2">
          Título
          <input className={field} value={l.title ?? ""} onChange={(e) => set("title", e.target.value)} />
        </label>
        <label className="text-sm text-gray-700 sm:col-span-2">
          Descripción
          <textarea rows={6} className={field} value={l.description ?? ""} onChange={(e) => set("description", e.target.value)} />
        </label>
        <label className="text-sm text-gray-700">
          Tipo
          <select
            className={field}
            value={l.categoryKey ?? "casas"}
            onChange={(e) => set("categoryKey", e.target.value as ListingImportLlmPayload["categoryKey"])}
          >
            {CATEGORIES.map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-gray-700">
          Espacio
          <select className={field} value={l.spaceType ?? "Espacio completo"} onChange={(e) => set("spaceType", e.target.value)}>
            {["Espacio completo", "Habitación privada", "Habitación compartida"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="text-sm text-gray-700">
          Ciudad
          <input className={field} value={l.city ?? ""} onChange={(e) => set("city", e.target.value)} />
        </label>
        <label className="text-sm text-gray-700">
          Colonia / zona
          <input className={field} value={l.zone ?? ""} onChange={(e) => set("zone", e.target.value)} />
        </label>
        <label className="text-sm text-gray-700">
          Estado
          <input className={field} value={l.state ?? ""} onChange={(e) => set("state", e.target.value)} />
        </label>
        <label className="text-sm text-gray-700">
          Municipio
          <input className={field} value={l.county ?? ""} onChange={(e) => set("county", e.target.value)} />
        </label>
        <label className="text-sm text-gray-700">
          Dirección (si se ve)
          <input className={field} value={l.addressLine ?? ""} onChange={(e) => set("addressLine", e.target.value)} />
        </label>
        <div className="grid grid-cols-3 gap-3 sm:col-span-2">
          <label className="text-sm text-gray-700">
            Huéspedes
            <input type="number" min={1} className={field} value={l.guests ?? ""} onChange={(e) => setNum("guests", e.target.value)} />
          </label>
          <label className="text-sm text-gray-700">
            Recámaras
            <input type="number" min={0} className={field} value={l.bedrooms ?? ""} onChange={(e) => setNum("bedrooms", e.target.value)} />
          </label>
          <label className="text-sm text-gray-700">
            Baños
            <input type="number" min={0} step={0.5} className={field} value={l.bathrooms ?? ""} onChange={(e) => setNum("bathrooms", e.target.value)} />
          </label>
        </div>
        <label className="text-sm text-gray-700">
          Precio por noche (MXN)
          <input type="number" min={0} className={field} value={l.pricePerNight ?? ""} onChange={(e) => setNum("pricePerNight", e.target.value)} />
        </label>
        <label className="text-sm text-gray-700">
          Limpieza (MXN)
          <input type="number" min={0} className={field} value={l.cleaningFee ?? ""} onChange={(e) => setNum("cleaningFee", e.target.value)} />
        </label>
        <label className="text-sm text-gray-700 sm:col-span-2">
          Amenidades (separadas por coma)
          <input
            className={field}
            value={(l.amenities ?? []).join(", ")}
            onChange={(e) =>
              set(
                "amenities",
                e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean)
              )
            }
          />
        </label>
        <div className="flex flex-wrap gap-4 text-sm text-gray-700 sm:col-span-2">
          {(
            [
              ["pets", "Mascotas"],
              ["smoking", "Fumar"],
              ["parties", "Fiestas"],
              ["children", "Niños"],
            ] as const
          ).map(([k, label]) => (
            <label key={k} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={Boolean(l.rules?.[k])}
                onChange={(e) => set("rules", { ...(l.rules ?? {}), [k]: e.target.checked })}
              />
              {label}
            </label>
          ))}
        </div>
      </section>

      <section className="grid gap-4 rounded-xl border border-gray-200 bg-white p-5 sm:grid-cols-2">
        <h2 className="text-sm font-semibold text-gray-900 sm:col-span-2">Contacto que verán los huéspedes registrados</h2>
        <label className="text-sm text-gray-700">
          Teléfono
          <input className={field} value={contact.phone ?? ""} onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value }))} />
        </label>
        <label className="text-sm text-gray-700">
          WhatsApp
          <input className={field} value={contact.whatsapp ?? ""} onChange={(e) => setContact((c) => ({ ...c, whatsapp: e.target.value }))} />
        </label>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-gray-900">¿De quién es la cuenta?</h2>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => setTargetKind("new")}
            className={`rounded-lg px-4 py-2 text-sm ${targetKind === "new" ? "bg-gray-900 text-white" : "border border-gray-300"}`}
          >
            Cuenta nueva
          </button>
          <button
            type="button"
            disabled={!accounts.length}
            onClick={() => setTargetKind("existing")}
            className={`rounded-lg px-4 py-2 text-sm disabled:opacity-40 ${
              targetKind === "existing" ? "bg-gray-900 text-white" : "border border-gray-300"
            }`}
          >
            Agregar a una cuenta que ya creé
          </button>
        </div>
        {targetKind === "new" ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="text-sm text-gray-700">
              Nombre del anfitrión
              <input className={field} value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </label>
            <label className="text-sm text-gray-700">
              Correo real (opcional)
              <input
                type="email"
                className={field}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Si lo dejas vacío se genera un usuario interno"
              />
            </label>
            <p className="text-xs text-gray-500 sm:col-span-2">
              Se genera una contraseña temporal. Al entrar por primera vez, el dueño pone su correo y su propia contraseña.
            </p>
          </div>
        ) : (
          <select className={`${field} mt-4 max-w-md`} value={hostId} onChange={(e) => setHostId(e.target.value)}>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.fullName} · {a.email}
              </option>
            ))}
          </select>
        )}
      </section>

      {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}

      <div className="flex flex-wrap gap-3 pb-10">
        <button
          type="button"
          disabled={busy}
          onClick={() => void publish()}
          className="rounded-lg bg-amber-500 px-6 py-2.5 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
        >
          {busy ? "Publicando…" : targetKind === "new" ? "Crear cuenta y publicar" : "Publicar en esa cuenta"}
        </button>
        <Link href="/asociados" className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm">
          Después
        </Link>
      </div>
    </div>
  );
}
