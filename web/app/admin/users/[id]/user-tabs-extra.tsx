"use client";

import Link from "next/link";
import { useState } from "react";
import { useLang, useT } from "@/components/i18n-provider";
import type { AdminAddressProofRow, AdminListingClaimRow, AdminUserDetail } from "@/lib/admin-user-detail";
import { numberLocale } from "@/lib/i18n";

function useWhen() {
  const locale = numberLocale(useLang());
  return {
    locale,
    when: (iso: string) => new Date(iso).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" }),
  };
}

const PROOF_STATUS: Record<AdminAddressProofRow["status"], [string, string]> = {
  review: ["Por revisar", "bg-amber-100 text-amber-800"],
  pending: ["Procesando", "bg-gray-100 text-gray-600"],
  approved: ["Aprobado", "bg-green-100 text-green-800"],
  rejected: ["Rechazado", "bg-red-100 text-red-700"],
};

const PROOF_INLINE: Record<AdminAddressProofRow["status"], string> = {
  review: "Comprobante por revisar",
  pending: "Comprobante procesando",
  approved: "Comprobante aprobado",
  rejected: "Comprobante rechazado",
};

const CLAIM_RESOLUTION: Record<NonNullable<AdminListingClaimRow["resolution"]>, string> = {
  listing_deleted: "Anuncio borrado",
  handed_over: "Cuenta entregada",
  dismissed: "Descartado",
};

export function pendingProofs(d: AdminUserDetail): number {
  return d.addressProofs.filter((p) => p.status === "review" || p.status === "pending").length;
}

export function openClaims(d: AdminUserDetail): number {
  return d.listingClaims.filter((c) => c.status === "open").length;
}

export function ListingsTab({ d, onChanged }: { d: AdminUserDetail; onChanged: () => void }) {
  const t = useT();
  const { when } = useWhen();
  const [busy, setBusy] = useState<string | null>(null);

  async function proofAction(id: string, action: "approve" | "reject") {
    const message = action === "reject" ? (prompt(t("Mensaje para el anfitrión (opcional):")) ?? undefined) : undefined;
    setBusy(id);
    await fetch("/api/admin/address-proofs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action, message }),
    });
    setBusy(null);
    onChanged();
  }

  async function claimAction(c: AdminListingClaimRow, action: "delete_listing" | "handed_over" | "dismiss") {
    if (action === "delete_listing" && !confirm(t("¿Borrar «{title}»? No se puede deshacer.", { title: c.listingTitle }))) return;
    setBusy(c.id);
    await fetch("/api/admin/claims", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: c.id, action }),
    });
    setBusy(null);
    onChanged();
  }

  const verified = d.listings.filter((l) => l.locationVerified).length;
  const yesNo = (v: boolean) => (v ? t("sí") : t("no"));

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-1 text-sm font-semibold text-gray-700">{t("Anuncios ({count})", { count: d.listings.length })}</h2>
        <p className="mb-3 text-xs text-gray-400">
          {t("{verified} de {total} con ubicación verificada por comprobante de domicilio.", { verified, total: d.listings.length })}
        </p>
        {d.listings.length === 0 ? (
          <p className="text-sm text-gray-400">{t("No tiene anuncios.")}</p>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs text-gray-500">
                  <th className="px-4 py-2 font-medium">{t("Anuncio")}</th>
                  <th className="px-4 py-2 font-medium">{t("Estado")}</th>
                  <th className="px-4 py-2 font-medium">{t("Ubicación")}</th>
                  <th className="px-4 py-2 text-right font-medium">{t("Vistas 30d")}</th>
                  <th className="px-4 py-2 text-right font-medium">{t("Contactos 30d")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {d.listings.map((l) => (
                  <tr key={l.id}>
                    <td className="px-4 py-2">
                      <a href={`/listings/${l.slug}`} target="_blank" rel="noreferrer" className="text-gray-800 hover:text-amber-700 hover:underline">
                        {l.title}
                      </a>
                      {l.city && <span className="ml-1 text-xs text-gray-400">· {l.city}</span>}
                    </td>
                    <td className="px-4 py-2 text-xs">
                      {l.published ? <span className="text-green-700">{t("Publicado")}</span> : <span className="text-gray-400">{t("Borrador")}</span>}
                    </td>
                    <td className="px-4 py-2 text-xs">
                      {l.locationVerified ? (
                        <span className="text-green-700">{t("✓ Verificada")}</span>
                      ) : l.proofStatus ? (
                        <span className="text-gray-500">{t(PROOF_INLINE[l.proofStatus])}</span>
                      ) : (
                        <span className="text-gray-400">{t("Sin comprobante")}</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">{l.views30}</td>
                    <td className="px-4 py-2 text-right">{l.contacts30}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-1 text-sm font-semibold text-gray-700">{t("Comprobantes de domicilio ({count})", { count: d.addressProofs.length })}</h2>
        <p className="mb-3 text-xs text-gray-400">{t("La IA aprueba o rechaza sola los casos claros; los dudosos quedan aquí por revisar.")}</p>
        {d.addressProofs.length === 0 ? (
          <p className="text-sm text-gray-400">{t("No ha subido comprobantes.")}</p>
        ) : (
          <div className="space-y-3">
            {d.addressProofs.map((r) => (
              <div key={r.id} className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-gray-900">
                      {r.listingSlug ? (
                        <a href={`/listings/${r.listingSlug}`} target="_blank" rel="noreferrer" className="hover:underline">
                          {r.listingTitle}
                        </a>
                      ) : (
                        r.listingTitle
                      )}
                    </p>
                    <p className="text-xs text-gray-500">{when(r.createdAt)}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${PROOF_STATUS[r.status][1]}`}>
                    {t(PROOF_STATUS[r.status][0])}
                    {r.reviewedBy === "ai" ? ` ${t("por IA")}` : ""}
                  </span>
                </div>
                <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-gray-400">{t("Dirección del anuncio")}</dt>
                    <dd className="text-gray-900">{r.addressSnapshot}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-gray-400">{t("Dirección en el documento")}</dt>
                    <dd className="text-gray-900">{r.ai?.addressOnDocument ?? "—"}</dd>
                  </div>
                  {r.deviceLocation && (
                    <div>
                      <dt className="text-xs text-gray-400">{t("Ubicación del teléfono")}</dt>
                      <dd className={r.deviceDistanceM != null && r.deviceDistanceM > 500 ? "text-red-700" : "text-gray-900"}>
                        {r.deviceDistanceM != null
                          ? t("a {distance} del anuncio", {
                              distance: r.deviceDistanceM >= 1000 ? `${(r.deviceDistanceM / 1000).toFixed(1)} km` : `${r.deviceDistanceM} m`,
                            })
                          : t("anuncio sin punto en el mapa")}{" "}
                        · {t("precisión ±{meters} m", { meters: r.deviceLocation.accuracyM })} ·{" "}
                        <a
                          href={`https://www.google.com/maps?q=${r.deviceLocation.lat},${r.deviceLocation.lng}`}
                          target="_blank"
                          rel="noreferrer"
                          className="underline"
                        >
                          {t("ver mapa")}
                        </a>
                      </dd>
                    </div>
                  )}
                  {r.ai && (
                    <>
                      <div>
                        <dt className="text-xs text-gray-400">{t("Documento")}</dt>
                        <dd className="text-gray-900">
                          {r.ai.documentType} · {r.ai.issueDate ?? t("sin fecha")} · {t("titular:")} {r.ai.holderName ?? "—"}
                          {r.ai.nameMatch && ` (${t("nombre: {match}", { match: r.ai.nameMatch })})`}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-gray-400">{t("IA ({model})", { model: r.ai.model })}</dt>
                        <dd className="text-gray-900">
                          {t("coincide: {match} · reciente: {recent} · alteración: {tampering} · confianza {confidence}%", {
                            match: r.ai.addressMatch,
                            recent: yesNo(r.ai.recent),
                            tampering: r.ai.tamperingSigns ? t("posible") : t("no"),
                            confidence: Math.round(r.ai.confidence * 100),
                          })}
                        </dd>
                      </div>
                    </>
                  )}
                </dl>
                {r.ai?.reasons.length ? (
                  <ul className="mt-2 list-disc pl-5 text-sm text-gray-600">
                    {r.ai.reasons.map((x, i) => (
                      <li key={i}>{x}</li>
                    ))}
                  </ul>
                ) : null}
                {r.aiError && (
                  <p className="mt-2 text-sm text-red-600">
                    {t("Error de la IA:")} {r.aiError}
                  </p>
                )}
                {r.hostMessage && r.status === "rejected" && (
                  <p className="mt-2 rounded bg-gray-50 px-2 py-1 text-xs text-gray-600">
                    {t("Mensaje al anfitrión:")} {r.hostMessage}
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  <a
                    href={`/api/admin/address-proofs/${r.id}/file`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    {t("Ver comprobante")}
                  </a>
                  {r.status !== "approved" && (
                    <button
                      disabled={busy === r.id}
                      onClick={() => void proofAction(r.id, "approve")}
                      className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      {t("Aprobar")}
                    </button>
                  )}
                  {r.status !== "rejected" && (
                    <button
                      disabled={busy === r.id}
                      onClick={() => void proofAction(r.id, "reject")}
                      className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                    >
                      {t("Rechazar")}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-1 text-sm font-semibold text-gray-700">{t("Reclamos sobre sus anuncios ({count})", { count: d.listingClaims.length })}</h2>
        <p className="mb-3 text-xs text-gray-400">{t("Personas que dicen ser dueñas del alojamiento o piden quitarlo.")}</p>
        {d.listingClaims.length === 0 ? (
          <p className="text-sm text-gray-400">{t("Nadie ha reclamado sus anuncios.")}</p>
        ) : (
          <div className="space-y-3">
            {d.listingClaims.map((c) => (
              <div key={c.id} className="rounded-xl border border-gray-200 bg-white p-4">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className={`rounded px-2 py-0.5 font-medium ${c.status === "open" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"}`}>
                    {c.status === "open" ? t("Abierto") : c.resolution ? t(CLAIM_RESOLUTION[c.resolution]) : t("Cerrado")}
                  </span>
                  <span className="font-semibold text-gray-800">{c.kind === "remove" ? t("Pide quitar el anuncio") : t("Reclama ser el dueño")}</span>
                  <span className="text-gray-500">
                    ·{" "}
                    {c.listingSlug ? (
                      <a href={`/listings/${c.listingSlug}`} target="_blank" rel="noreferrer" className="hover:underline">
                        {c.listingTitle}
                      </a>
                    ) : (
                      t("{title} (borrado)", { title: c.listingTitle })
                    )}
                  </span>
                  <span className="ml-auto text-gray-400">{when(c.createdAt)}</span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{c.message}</p>
                <p className="mt-1 text-xs text-gray-500">
                  {c.name} · {c.contact}
                </p>
                {c.status === "open" && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {c.listingExists && (
                      <button
                        disabled={busy === c.id}
                        onClick={() => void claimAction(c, "delete_listing")}
                        className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                      >
                        {t("Borrar anuncio")}
                      </button>
                    )}
                    <button
                      disabled={busy === c.id}
                      onClick={() => void claimAction(c, "handed_over")}
                      className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-semibold text-white hover:bg-black disabled:opacity-50"
                    >
                      {t("Ya le entregué la cuenta")}
                    </button>
                    <button
                      disabled={busy === c.id}
                      onClick={() => void claimAction(c, "dismiss")}
                      className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      {t("Descartar")}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

const DRAFT_STATUS: Record<string, [string, string]> = {
  pending: ["Por revisar", "bg-amber-100 text-amber-800"],
  published: ["Publicado", "bg-green-100 text-green-800"],
  discarded: ["Descartado", "bg-gray-100 text-gray-600"],
};

export function hasAssociateData(d: AdminUserDetail): boolean {
  const a = d.associate;
  return d.user.associate || d.user.role === "admin" || Boolean(a.provisionedBy) || a.accounts.length > 0 || a.recentDrafts.length > 0;
}

export function AssociateTab({ d }: { d: AdminUserDetail }) {
  const t = useT();
  const { locale } = useWhen();
  const a = d.associate;
  const claimed = a.accounts.filter((x) => x.claimed).length;
  const views = a.accounts.reduce((s, x) => s + x.views, 0);
  const contacts = a.accounts.reduce((s, x) => s + x.contacts, 0);
  const isAssociate = d.user.associate || d.user.role === "admin";

  return (
    <div className="space-y-8">
      {a.provisionedBy && (
        <p className="rounded-xl border border-purple-200 bg-purple-50 px-4 py-3 text-sm text-purple-900">
          {t("Esta cuenta la dio de alta con IA el asociado")}{" "}
          <Link href={`/admin/users/${a.provisionedBy.id}`} className="font-semibold underline">
            {a.provisionedBy.name}
          </Link>
          . {d.account.claimedAt ? t("El dueño ya tomó control de ella.") : t("El dueño todavía no la reclama.")}
        </p>
      )}

      {(isAssociate || a.accounts.length > 0) && (
        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-gray-700">{t("Como asociado (alta de anfitriones con IA)")}</h2>
            {d.user.associate || d.user.role === "admin" ? (
              <a href="/asociados" target="_blank" rel="noreferrer" className="text-xs text-amber-700 hover:underline">
                {t("Abrir panel de asociados →")}
              </a>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <Mini label={t("Cuentas creadas")} value={a.accounts.length} />
            <Mini label={t("Reclamadas por el dueño")} value={claimed} />
            <Mini label={t("Borradores por revisar")} value={a.drafts.pending} />
            <Mini label={t("Anuncios publicados")} value={a.drafts.published} sub={t("{count} descartados", { count: a.drafts.discarded })} />
            <Mini label={t("Vistas / contactos")} value={`${views} / ${contacts}`} sub={t("de sus cuentas")} />
          </div>

          {a.accounts.length > 0 && (
            <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs text-gray-500">
                    <th className="px-4 py-2 font-medium">{t("Anfitrión")}</th>
                    <th className="px-4 py-2 font-medium">{t("Correo")}</th>
                    <th className="px-4 py-2 text-right font-medium">{t("Anuncios")}</th>
                    <th className="px-4 py-2 text-right font-medium">{t("Vistas / contactos")}</th>
                    <th className="px-4 py-2 font-medium">{t("Estado")}</th>
                    <th className="px-4 py-2 font-medium">{t("Alta")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {a.accounts.map((x) => (
                    <tr key={x.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2">
                        <Link href={`/admin/users/${x.id}`} className="font-medium text-gray-900 hover:text-amber-700 hover:underline">
                          {x.name}
                        </Link>
                      </td>
                      <td className="px-4 py-2 font-mono text-xs text-gray-500">{x.email}</td>
                      <td className="px-4 py-2 text-right">{x.listings}</td>
                      <td className="px-4 py-2 text-right">
                        {x.views} / {x.contacts}
                      </td>
                      <td className="px-4 py-2 text-xs">
                        {x.claimed ? <span className="text-green-700">{t("Reclamada")}</span> : <span className="text-gray-400">{t("Sin reclamar")}</span>}
                      </td>
                      <td className="px-4 py-2 text-xs text-gray-400">{new Date(x.createdAt).toLocaleDateString(locale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {a.recentDrafts.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">{t("Últimos borradores importados")}</p>
              <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
                {a.recentDrafts.map((x) => (
                  <li key={x.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${DRAFT_STATUS[x.status][1]}`}>{t(DRAFT_STATUS[x.status][0])}</span>
                    <span className="min-w-0 flex-1 truncate text-gray-800">{t(x.title)}</span>
                    <span className="text-xs text-gray-400">{x.site}</span>
                    <span className="text-xs text-gray-400">{new Date(x.createdAt).toLocaleDateString(locale)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {!a.accounts.length && !a.recentDrafts.length && <p className="mt-3 text-sm text-gray-400">{t("Todavía no ha dado de alta cuentas.")}</p>}
        </section>
      )}
    </div>
  );
}

function Mini({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="mt-1 text-xl font-bold text-gray-900">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-gray-500">{sub}</p>}
    </div>
  );
}
