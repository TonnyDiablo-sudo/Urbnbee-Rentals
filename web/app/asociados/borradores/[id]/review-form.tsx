"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { useT } from "@/components/i18n-provider";
import {
  cleanProfileUrl,
  DRAFT_FIELD_LABEL,
  draftHasContact,
  isDraftFillableField,
  type DraftFillableField,
} from "@/lib/associate-draft-fields";
import type { AssociateDraft, DraftContact, DraftReview, DraftReviewIssue } from "@/lib/associate-drafts-store";
import type { DuplicateHit } from "@/lib/associate-duplicates";
import { streetLineProblem } from "@/lib/listing-address";
import type { ListingImportLlmPayload } from "@/lib/listing-import-types";
import { ListingPreview } from "./listing-preview";

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

const ISSUE_LABEL: Record<string, string> = {
  photos: "Fotos",
  address: "Dirección",
  addressLine: "Dirección",
  contact: "Contacto",
  general: "General",
};

const field = "mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none";
const fieldAi = "mt-1 w-full rounded-lg border-2 border-red-500 bg-red-50 px-3 py-2 text-sm focus:outline-none";

type NumKey = "guests" | "bedrooms" | "bathrooms" | "pricePerNight" | "cleaningFee";
const NUM_KEYS: NumKey[] = ["guests", "bedrooms", "bathrooms", "pricePerNight", "cleaningFee"];

function money(n: number | undefined): string {
  return n ? `$${Math.round(n).toLocaleString("es-MX")}` : "—";
}

type FieldCtx = {
  pending: DraftFillableField[];
  approved: DraftFillableField[];
  approve: (f: DraftFillableField) => void;
  issuesFor: (...fields: string[]) => DraftReviewIssue[];
  applySuggestion: (field: string, value: string) => void;
};

const FieldContext = createContext<FieldCtx | null>(null);

/** Etiqueta + control; si la IA lo rellenó queda en rojo con su botón de aprobar. */
function F({ name, label, children, wide }: { name?: DraftFillableField; label: string; children: ReactNode; wide?: boolean }) {
  const t = useT();
  const ctx = useContext(FieldContext)!;
  const ai = name ? ctx.pending.includes(name) : false;
  const notes = name ? ctx.issuesFor(name) : [];
  return (
    <div className={`text-sm text-gray-700 ${wide ? "sm:col-span-2" : ""}`}>
      <div className="flex items-center justify-between gap-2">
        <span className={ai ? "font-medium text-red-700" : ""}>{t(label)}</span>
        {name && ai && (
          <button
            type="button"
            onClick={() => ctx.approve(name)}
            className="rounded bg-red-600 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-red-700"
          >
            {t("Lo rellenó la IA · Aprobar")}
          </button>
        )}
        {name && ctx.approved.includes(name) && <span className="text-[11px] text-green-700">{t("Aprobado ✓")}</span>}
      </div>
      {children}
      {notes.map((n, i) => (
        <p key={i} className={`mt-1 text-xs ${n.severity === "error" ? "text-red-700" : "text-amber-700"}`}>
          {n.message}
          {n.suggested && (
            <button type="button" onClick={() => ctx.applySuggestion(n.field, n.suggested!)} className="ml-1 underline">
              {t("Usar «{value}»", { value: n.suggested })}
            </button>
          )}
        </p>
      ))}
    </div>
  );
}

export function ReviewForm({
  draft,
  duplicates,
  accounts,
  nextDraftId,
  canReview,
}: {
  draft: AssociateDraft;
  duplicates: DuplicateHit[];
  accounts: Account[];
  nextDraftId?: string;
  canReview: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const [l, setL] = useState<ListingImportLlmPayload>(draft.listing);
  const [contact, setContact] = useState<DraftContact>(draft.contact);
  const [photos, setPhotos] = useState<string[]>(draft.photos);
  const [addressMode, setAddressMode] = useState<"exact" | "approximate">(
    draft.addressMode ?? (streetLineProblem(draft.listing.addressLine) ? "approximate" : "exact")
  );
  const [addressApprox, setAddressApprox] = useState(draft.addressApprox ?? "");
  const [pending, setPending] = useState<DraftFillableField[]>(draft.aiFilled ?? []);
  const [approved, setApproved] = useState<DraftFillableField[]>([]);
  const [review, setReview] = useState<DraftReview | undefined>(draft.review);
  const [targetKind, setTargetKind] = useState<"new" | "existing">(
    draft.targetHostId && accounts.some((a) => a.id === draft.targetHostId) ? "existing" : "new"
  );
  const [hostId, setHostId] = useState(draft.targetHostId ?? accounts[0]?.id ?? "");
  const [fullName, setFullName] = useState(draft.contact.hostName ?? "");
  const [email, setEmail] = useState(draft.contact.email ?? "");
  const [busy, setBusy] = useState<"publish" | "review" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<Published | null>(null);
  const [copied, setCopied] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const set = <K extends keyof ListingImportLlmPayload>(k: K, v: ListingImportLlmPayload[K]) =>
    setL((prev) => ({ ...prev, [k]: v }));
  const setNum = (k: NumKey, v: string) => set(k, v === "" ? undefined : Number(v));
  const setC = (k: keyof DraftContact, v: string) => setContact((c) => ({ ...c, [k]: v }));
  const removed = [...draft.photos, ...(draft.removedPhotos ?? [])].filter((p) => !photos.includes(p));

  const isAi = (f: DraftFillableField) => pending.includes(f);
  const cls = (f: DraftFillableField) => (isAi(f) ? fieldAi : field);
  const approve = (f: DraftFillableField) => {
    setPending((p) => p.filter((x) => x !== f));
    setApproved((a) => (a.includes(f) ? a : [...a, f]));
  };
  const issuesFor = (...fields: string[]) => (review?.issues ?? []).filter((i) => fields.includes(i.field));

  /** Aplica el valor que sugirió la IA; queda en rojo para que el asociado lo apruebe. */
  function applySuggestion(f: string, value: string) {
    if (f === "addressLine") {
      setAddressMode("exact");
      set("addressLine", value);
      return;
    }
    if (!isDraftFillableField(f)) return;
    if (f.startsWith("contact.")) setC(f.slice(8) as keyof DraftContact, value);
    else if (f === "addressApprox") setAddressApprox(value);
    else if ((NUM_KEYS as string[]).includes(f)) setNum(f as NumKey, value.replace(/[^\d.]/g, ""));
    else if (f === "amenities") set("amenities", value.split(",").map((s) => s.trim()).filter(Boolean));
    else set(f as keyof ListingImportLlmPayload, value as never);
    setPending((p) => (p.includes(f) ? p : [...p, f]));
  }

  const edits = () => ({
    listing: { ...l, addressLine: addressMode === "exact" ? l.addressLine : "" },
    contact,
    photos,
    addressMode,
    addressApprox: addressApprox || undefined,
    approvedAiFields: approved,
  });

  const publishBody = () => ({
    ...edits(),
    target:
      targetKind === "existing"
        ? { kind: "existing", hostId }
        : { kind: "new", fullName, email: email || undefined, phone: contact.phone, whatsapp: contact.whatsapp },
  });

  const problems = useMemo(() => {
    const out: string[] = [];
    if (!l.title?.trim()) out.push("El anuncio necesita título.");
    if (!photos.length) out.push("Agrega al menos una foto del inmueble.");
    if (!draftHasContact(contact) && targetKind === "new") {
      out.push("Falta el contacto del dueño: teléfono, WhatsApp, correo o su Facebook.");
    }
    if (!l.city?.trim()) out.push("Falta la ciudad.");
    if (addressMode === "exact") {
      const p = streetLineProblem(l.addressLine);
      if (p) out.push(p);
    } else if (!l.zone?.trim() && !addressApprox.trim()) {
      out.push("Escribe la colonia o una ubicación aproximada.");
    }
    if (pending.length) out.push("Aprueba los campos que rellenó la IA (marcados en rojo).");
    return out;
  }, [l, photos, contact, targetKind, addressMode, addressApprox, pending]);

  async function runReview() {
    setBusy("review");
    setErr(null);
    const res = await fetch(`/api/associate/drafts/${draft.id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(edits()),
    }).catch(() => null);
    const j = res ? await res.json().catch(() => ({})) : {};
    setBusy(null);
    if (!res?.ok || !j.draft) {
      setErr(typeof j.error === "string" ? t(j.error) : t("No se pudo revisar con IA."));
      return;
    }
    const d = j.draft as AssociateDraft;
    setL(d.listing);
    setContact(d.contact);
    setAddressApprox(d.addressApprox ?? "");
    setPending(d.aiFilled ?? []);
    setApproved([]);
    setReview(d.review);
    if (!fullName && d.contact.hostName) setFullName(d.contact.hostName);
    if (!email && d.contact.email) setEmail(d.contact.email);
  }

  async function publish() {
    setBusy("publish");
    setErr(null);
    const res = await fetch(`/api/associate/drafts/${draft.id}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(publishBody()),
    }).catch(() => null);
    const j = res ? await res.json().catch(() => ({})) : {};
    setBusy(null);
    setPreviewOpen(false);
    if (!res?.ok) {
      setErr(typeof j.error === "string" ? t(j.error) : t("No se pudo publicar."));
      return;
    }
    setDone(j as Published);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function discard() {
    if (!confirm(t("¿Descartar este borrador?"))) return;
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
          <h1 className="text-lg font-semibold text-green-900">{t("Publicado ✓")}</h1>
          <p className="mt-1 text-sm text-green-800">
            {done.created ? t("Se creó la cuenta del anfitrión y su anuncio ya está en Cabibee.") : t("El anuncio se agregó a la cuenta.")}
          </p>
          <a href={`/listings/${done.listingSlug}`} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm text-green-900 underline">
            {t("Ver anuncio")}
          </a>
        </div>
        {done.warnings.map((w) => (
          <p key={w} className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {t(w)}
          </p>
        ))}
        {done.credentials && message && (
          <div className="rounded-xl border-2 border-amber-300 bg-white p-5">
            <p className="text-sm font-semibold text-gray-900">{t("Acceso del anfitrión (solo se muestra ahora)")}</p>
            <div className="mt-3 rounded-lg bg-gray-50 p-3 font-mono text-base text-gray-900">
              <p>
                {t("Usuario:")} <strong>{done.credentials.email}</strong>
              </p>
              <p>
                {t("Contraseña:")} <strong>{done.credentials.password}</strong>
              </p>
            </div>
            <p className="mt-3 text-xs text-gray-500">
              {t("Si la pierdes, genera otra desde la cuenta. Mensaje listo para mandarle (en español):")}
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
              {copied ? t("Copiado ✓") : t("Copiar mensaje")}
            </button>
          </div>
        )}
        <div className="flex flex-wrap gap-3">
          <Link href={`/asociados/capturar?host=${done.hostId}`} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm">
            {t("+ Otro anuncio para esta misma cuenta")}
          </Link>
          <Link href={`/asociados/cuentas/${done.hostId}`} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm">
            {t("Ver cuenta")}
          </Link>
          {nextDraftId ? (
            <Link href={`/asociados/borradores/${nextDraftId}`} className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white">
              {t("Siguiente borrador →")}
            </Link>
          ) : (
            <Link href="/asociados" className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white">
              {t("Volver al inicio")}
            </Link>
          )}
        </div>
      </div>
    );
  }

  const fieldCtx: FieldCtx = { pending, approved, approve, issuesFor, applySuggestion };

  const checks: [string, boolean][] = [
    ["Fotos", photos.length > 0],
    ["Contacto", draftHasContact(contact) || targetKind === "existing"],
    [
      "Ubicación",
      Boolean(l.city?.trim()) &&
        (addressMode === "exact" ? !streetLineProblem(l.addressLine) : Boolean(l.zone?.trim() || addressApprox.trim())),
    ],
    ["Campos de la IA aprobados", pending.length === 0],
  ];
  const contactLines = [
    contact.phone && `☎ ${contact.phone}`,
    contact.whatsapp && `WhatsApp ${contact.whatsapp}`,
    contact.email && `✉ ${contact.email}`,
    cleanProfileUrl(contact.profileUrl) && "Facebook",
  ].filter(Boolean) as string[];

  return (
    <FieldContext.Provider value={fieldCtx}>
    {previewOpen && (
      <ListingPreview
        draftId={draft.id}
        body={publishBody()}
        problems={problems}
        publishLabel={targetKind === "new" ? t("Crear cuenta y publicar") : t("Publicar en esa cuenta")}
        publishing={busy === "publish"}
        onPublish={() => void publish()}
        onClose={() => setPreviewOpen(false)}
      />
    )}
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{t("Revisar anuncio")}</h1>
          <p className="mt-1 text-xs text-gray-400">
            {draft.source.url ? (
              <a href={draft.source.url} target="_blank" rel="noreferrer" className="underline">
                {t("Ver página original")} ({draft.source.site ?? draft.source.url})
              </a>
            ) : (
              t("Capturas de pantalla")
            )}
          </p>
        </div>
        <button type="button" onClick={() => void discard()} className="text-sm text-gray-500 underline">
          {t("Descartar")}
        </button>
      </div>

      {duplicates.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-semibold text-red-800">{t("Posible duplicado")}</p>
          <ul className="mt-1 space-y-1 text-sm text-red-700">
            {duplicates.map((d, i) => (
              <li key={i}>
                {d.hostName} ({t(DUP_REASON[d.reason])})
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

      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            {photos[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photos[0]} alt="" className="aspect-[4/3] w-full object-cover" />
            ) : (
              <div className="flex aspect-[4/3] items-center justify-center bg-red-50 text-sm text-red-700">{t("Sin fotos")}</div>
            )}
            <div className="space-y-2 p-4 text-sm">
              <p className="font-semibold text-gray-900">{l.title || t("Sin título")}</p>
              <p className="text-gray-600">
                {[l.zone, l.city, l.state].filter(Boolean).join(", ") || t("Sin ubicación")}
              </p>
              <p className="text-xs text-gray-500">
                {addressMode === "exact" ? l.addressLine || "—" : `${t("Aproximada:")} ${addressApprox || l.zone || "—"}`}
              </p>
              <p className="text-gray-800">
                <strong>{money(l.pricePerNight)}</strong> {t("/ noche")} · {l.guests ?? "—"} {t("huésp.")} · {l.bedrooms ?? "—"} {t("rec.")} ·{" "}
                {l.bathrooms ?? "—"} {t("baños")}
              </p>
              <p className="text-gray-700">
                {contact.hostName || fullName || t("Sin nombre")}
                {contactLines.length ? ` · ${contactLines.join(" · ")}` : ""}
              </p>
              <p className="text-xs text-gray-500">{t("Fotos ({count})", { count: photos.length })}</p>
            </div>
          </div>

          <ul className="space-y-1 rounded-xl border border-gray-200 bg-white p-4 text-sm">
            {checks.map(([label, ok]) => (
              <li key={label} className={ok ? "text-green-700" : "text-red-700"}>
                {ok ? "✓" : "✗"} {t(label)}
              </li>
            ))}
          </ul>

          <div className="space-y-2">
            <button
              type="button"
              disabled={busy !== null || !canReview}
              onClick={() => void runReview()}
              title={canReview ? undefined : t("Este borrador no guardó la página original. Vuelve a importarlo para poder revisarlo con IA.")}
              className="w-full rounded-lg border-2 border-gray-900 bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 hover:bg-gray-50 disabled:opacity-40"
            >
              {busy === "review" ? t("La IA está revisando… (1-2 min)") : review ? t("Volver a revisar con IA") : t("Revisar con IA")}
            </button>
            <button
              type="button"
              onClick={() => setPreviewOpen(true)}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-900 hover:bg-gray-50"
            >
              👁 {t("Vista previa del anuncio")}
            </button>
            <button
              type="button"
              disabled={busy !== null || problems.length > 0}
              onClick={() => void publish()}
              className="w-full rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-40"
            >
              {busy === "publish" ? t("Publicando…") : targetKind === "new" ? t("Crear cuenta y publicar") : t("Publicar en esa cuenta")}
            </button>
            {problems.length > 0 && (
              <ul className="space-y-0.5 text-xs text-red-700">
                {problems.map((p) => (
                  <li key={p}>• {t(p)}</li>
                ))}
              </ul>
            )}
            {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
          </div>
        </aside>

        <div className="min-w-0 space-y-6">
          {review && (
            <section className="rounded-xl border border-gray-300 bg-white p-5">
              <h2 className="text-sm font-semibold text-gray-900">{t("Revisión de la IA")}</h2>
              {review.summary && <p className="mt-1 text-sm text-gray-700">{review.summary}</p>}
              {review.filled.length > 0 && (
                <p className="mt-2 text-sm text-red-700">
                  {t("Rellenó {count} campos (en rojo). Revísalos y apruébalos uno por uno.", { count: review.filled.length })}
                </p>
              )}
              {review.issues.length === 0 ? (
                <p className="mt-2 text-sm text-green-700">{t("No encontró errores.")}</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {review.issues.map((i, idx) => (
                    <li
                      key={idx}
                      className={`rounded-lg px-3 py-2 text-sm ${i.severity === "error" ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-800"}`}
                    >
                      <span className="font-medium">
                        {t(isDraftFillableField(i.field) ? DRAFT_FIELD_LABEL[i.field] : (ISSUE_LABEL[i.field] ?? i.field))}:
                      </span>{" "}
                      {i.message}
                      {i.suggested && (isDraftFillableField(i.field) || i.field === "addressLine") && (
                        <button type="button" onClick={() => applySuggestion(i.field, i.suggested!)} className="ml-2 underline">
                          {t("Usar «{value}»", { value: i.suggested })}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {draft.warnings.length > 0 && (
            <ul className="space-y-1 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              {draft.warnings.map((w) => (
                <li key={w}>• {t(w)}</li>
              ))}
            </ul>
          )}

          <section className={`rounded-xl border bg-white p-5 ${photos.length ? "border-gray-200" : "border-red-300"}`}>
            <h2 className="text-sm font-semibold text-gray-900">
              {t("Fotos ({count})", { count: photos.length })}{" "}
              <span className="font-normal text-gray-400">{t("· la primera es la portada · obligatorias")}</span>
            </h2>
            {issuesFor("photos").map((n, i) => (
              <p key={i} className="mt-1 text-xs text-amber-700">
                {n.message}
              </p>
            ))}
            {photos.length === 0 ? (
              <p className="mt-2 text-sm text-red-700">{t("Sin fotos no se puede publicar. Vuelve a importar con la galería abierta.")}</p>
            ) : (
              <ul className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 xl:grid-cols-5">
                {photos.map((p, i) => (
                  <li key={p} className="group relative aspect-[4/3] overflow-hidden rounded-lg border border-gray-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p} alt="" className="h-full w-full object-cover" />
                    <span className="absolute right-1 top-1 rounded bg-black/60 px-1 text-[10px] text-white">F{i + 1}</span>
                    {i === 0 && <span className="absolute left-1 top-1 rounded bg-amber-500 px-1.5 py-0.5 text-[10px] text-white">{t("Portada")}</span>}
                    <div className="absolute inset-x-1 bottom-1 flex gap-1 opacity-0 transition group-hover:opacity-100">
                      {i > 0 && (
                        <button
                          type="button"
                          onClick={() => setPhotos((prev) => [p, ...prev.filter((x) => x !== p)])}
                          className="rounded bg-black/75 px-1.5 py-0.5 text-[10px] text-white"
                        >
                          {t("Portada")}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setPhotos((prev) => prev.filter((x) => x !== p))}
                        className="ml-auto rounded bg-red-600/90 px-1.5 py-0.5 text-[10px] text-white"
                      >
                        {t("Quitar")}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {removed.length > 0 && (
              <div className="mt-3">
                <p className="text-xs text-gray-400">{t("Quitadas (clic para regresar):")}</p>
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

          <section
            className={`grid gap-4 rounded-xl border bg-white p-5 sm:grid-cols-2 ${
              draftHasContact(contact) || targetKind === "existing" ? "border-gray-200" : "border-red-300"
            }`}
          >
            <div className="sm:col-span-2">
              <h2 className="text-sm font-semibold text-gray-900">{t("Contacto del dueño (obligatorio)")}</h2>
              <p className="mt-0.5 text-xs text-gray-500">
                {t("Al menos uno: teléfono, WhatsApp, correo o su Facebook. Se muestra en «Contactar» a quien tenga cuenta en Cabibee.")}
              </p>
              {issuesFor("contact").map((n, i) => (
                <p key={i} className="mt-1 text-xs text-amber-700">
                  {n.message}
                </p>
              ))}
            </div>
            <F name="contact.hostName" label="Nombre del anfitrión">
              <input className={cls("contact.hostName")} value={contact.hostName ?? ""} onChange={(e) => setC("hostName", e.target.value)} />
            </F>
            <F name="contact.phone" label="Teléfono">
              <input className={cls("contact.phone")} value={contact.phone ?? ""} onChange={(e) => setC("phone", e.target.value)} />
            </F>
            <F name="contact.whatsapp" label="WhatsApp">
              <input className={cls("contact.whatsapp")} value={contact.whatsapp ?? ""} onChange={(e) => setC("whatsapp", e.target.value)} />
            </F>
            <F name="contact.email" label="Correo de contacto">
              <input type="email" className={cls("contact.email")} value={contact.email ?? ""} onChange={(e) => setC("email", e.target.value)} />
            </F>
            <F name="contact.profileUrl" label="Anuncio de Facebook del dueño" wide>
              <div className="flex gap-2">
                <input
                  className={cls("contact.profileUrl")}
                  value={contact.profileUrl ?? ""}
                  onChange={(e) => setC("profileUrl", e.target.value)}
                  placeholder="https://www.facebook.com/marketplace/item/…"
                />
                {cleanProfileUrl(contact.profileUrl) && (
                  <a href={contact.profileUrl} target="_blank" rel="noreferrer" className="mt-1 shrink-0 self-center text-xs underline">
                    {t("Abrir")}
                  </a>
                )}
              </div>
              {contact.profileUrl?.trim() && !cleanProfileUrl(contact.profileUrl) && (
                <p className="mt-1 text-xs text-red-700">
                  {t("Sólo se aceptan enlaces de Facebook o Messenger. Este no se va a guardar.")}
                </p>
              )}
            </F>
          </section>

          <section className="grid gap-4 rounded-xl border border-gray-200 bg-white p-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <h2 className="text-sm font-semibold text-gray-900">{t("Ubicación (obligatoria)")}</h2>
              <div className="mt-2 flex gap-2">
                {(
                  [
                    ["approximate", "Aproximada"],
                    ["exact", "Exacta (calle y número)"],
                  ] as const
                ).map(([k, label]) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setAddressMode(k)}
                    className={`rounded-lg px-3 py-1.5 text-xs ${addressMode === k ? "bg-gray-900 text-white" : "border border-gray-300"}`}
                  >
                    {t(label)}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-xs text-gray-500">
                {addressMode === "approximate"
                  ? t("Si el anuncio no trae calle y número, basta con la colonia o una referencia. El dueño completa la dirección exacta después.")
                  : t("Calle y número exterior tal como vienen en el anuncio.")}
              </p>
              {issuesFor("address", "addressLine").map((n, i) => (
                <p key={i} className="mt-1 text-xs text-amber-700">
                  {n.message}
                  {n.suggested && (
                    <button type="button" onClick={() => applySuggestion("addressLine", n.suggested!)} className="ml-1 underline">
                      {t("Usar «{value}»", { value: n.suggested })}
                    </button>
                  )}
                </p>
              ))}
            </div>
            {addressMode === "exact" ? (
              <F label="Calle y número" wide>
                <input className={field} value={l.addressLine ?? ""} onChange={(e) => set("addressLine", e.target.value)} />
              </F>
            ) : (
              <F name="addressApprox" label="Ubicación aproximada" wide>
                <input
                  className={cls("addressApprox")}
                  value={addressApprox}
                  onChange={(e) => setAddressApprox(e.target.value)}
                  placeholder={t("Ej. a dos cuadras del malecón, Col. Centro")}
                />
              </F>
            )}
            <F name="zone" label="Colonia / zona">
              <input className={cls("zone")} value={l.zone ?? ""} onChange={(e) => set("zone", e.target.value)} />
            </F>
            <F name="city" label="Ciudad">
              <input className={cls("city")} value={l.city ?? ""} onChange={(e) => set("city", e.target.value)} />
            </F>
            <F name="county" label="Municipio">
              <input className={cls("county")} value={l.county ?? ""} onChange={(e) => set("county", e.target.value)} />
            </F>
            <F name="state" label="Estado / provincia">
              <input className={cls("state")} value={l.state ?? ""} onChange={(e) => set("state", e.target.value)} />
            </F>
          </section>

          <section className="grid gap-4 rounded-xl border border-gray-200 bg-white p-5 sm:grid-cols-2">
            <h2 className="text-sm font-semibold text-gray-900 sm:col-span-2">{t("Anuncio")}</h2>
            <F name="title" label="Título" wide>
              <input className={cls("title")} value={l.title ?? ""} onChange={(e) => set("title", e.target.value)} />
            </F>
            <F name="description" label="Descripción" wide>
              <textarea rows={6} className={cls("description")} value={l.description ?? ""} onChange={(e) => set("description", e.target.value)} />
            </F>
            <F name="categoryKey" label="Tipo">
              <select
                className={cls("categoryKey")}
                value={l.categoryKey ?? "casas"}
                onChange={(e) => set("categoryKey", e.target.value as ListingImportLlmPayload["categoryKey"])}
              >
                {CATEGORIES.map(([k, label]) => (
                  <option key={k} value={k}>
                    {t(label)}
                  </option>
                ))}
              </select>
            </F>
            <F name="spaceType" label="Espacio">
              <select className={cls("spaceType")} value={l.spaceType ?? "Espacio completo"} onChange={(e) => set("spaceType", e.target.value)}>
                {["Espacio completo", "Habitación privada", "Habitación compartida"].map((s) => (
                  <option key={s} value={s}>
                    {t(s)}
                  </option>
                ))}
              </select>
            </F>
            <div className="grid grid-cols-3 gap-3 sm:col-span-2">
              <F name="guests" label="Huéspedes">
                <input type="number" min={1} className={cls("guests")} value={l.guests ?? ""} onChange={(e) => setNum("guests", e.target.value)} />
              </F>
              <F name="bedrooms" label="Recámaras">
                <input type="number" min={0} className={cls("bedrooms")} value={l.bedrooms ?? ""} onChange={(e) => setNum("bedrooms", e.target.value)} />
              </F>
              <F name="bathrooms" label="Baños">
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  className={cls("bathrooms")}
                  value={l.bathrooms ?? ""}
                  onChange={(e) => setNum("bathrooms", e.target.value)}
                />
              </F>
            </div>
            <F name="pricePerNight" label="Precio por noche (MXN)">
              <input
                type="number"
                min={0}
                className={cls("pricePerNight")}
                value={l.pricePerNight ?? ""}
                onChange={(e) => setNum("pricePerNight", e.target.value)}
              />
            </F>
            <F name="cleaningFee" label="Limpieza (MXN)">
              <input
                type="number"
                min={0}
                className={cls("cleaningFee")}
                value={l.cleaningFee ?? ""}
                onChange={(e) => setNum("cleaningFee", e.target.value)}
              />
            </F>
            <F name="amenities" label="Amenidades (separadas por coma)" wide>
              <input
                className={cls("amenities")}
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
            </F>
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
                  {t(label)}
                </label>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="text-sm font-semibold text-gray-900">{t("¿De quién es la cuenta?")}</h2>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => setTargetKind("new")}
                className={`rounded-lg px-4 py-2 text-sm ${targetKind === "new" ? "bg-gray-900 text-white" : "border border-gray-300"}`}
              >
                {t("Cuenta nueva")}
              </button>
              <button
                type="button"
                disabled={!accounts.length}
                onClick={() => setTargetKind("existing")}
                className={`rounded-lg px-4 py-2 text-sm disabled:opacity-40 ${
                  targetKind === "existing" ? "bg-gray-900 text-white" : "border border-gray-300"
                }`}
              >
                {t("Agregar a una cuenta que ya creé")}
              </button>
            </div>
            {targetKind === "new" ? (
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="text-sm text-gray-700">
                  {t("Nombre en la cuenta")}
                  <input className={field} value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </label>
                <label className="text-sm text-gray-700">
                  {t("Correo real (opcional)")}
                  <input
                    type="email"
                    className={field}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t("Si lo dejas vacío, el usuario será tipo juanperez4821")}
                  />
                </label>
                <p className="text-xs text-gray-500 sm:col-span-2">
                  {t("Se genera una contraseña temporal. Al entrar por primera vez, el dueño pone su correo y su propia contraseña.")}
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

          <div className="flex flex-wrap gap-3 pb-10">
            <Link href="/asociados" className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm">
              {t("Después")}
            </Link>
          </div>
        </div>
      </div>
    </div>
    </FieldContext.Provider>
  );
}
