"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { ContractReviewNotice } from "@/components/host/contract-review-notice";
import { ContractTips, MIN_STAY_CLAUSE } from "@/components/host/contract-tips";
import { useT } from "@/components/i18n-provider";
import {
  BOOKING_CONTRACT_TEMPLATES,
  defaultListingContract,
  getContractTemplate,
  type BookingContractTemplateId,
} from "@/lib/booking-contract-templates";
import { listingStreet } from "@/lib/listing-address";
import { useCached } from "../../_components/cached-fetch";
import { Sheet } from "../../_components/sheet";
import { TopBar } from "../../_components/top-bar";
import { patchListing, useHostListings, type HostListing } from "../_shared/host-data";

type Account = { fullName: string; addressLine: string; email: string; phone: string };

type Form = {
  templateId: BookingContractTemplateId;
  hostLegalName: string;
  hostAddress: string;
  propertyAddress: string;
  depositMxn: string;
  cancellation: string;
  extraClauses: string;
  hostAcknowledged: boolean;
  hostReviewed: boolean;
};

function formFor(l: HostListing): Form {
  const c = defaultListingContract(l.contract);
  const tpl = getContractTemplate(c.templateId);
  return {
    templateId: c.templateId,
    hostLegalName: c.hostLegalName,
    hostAddress: c.hostAddress,
    propertyAddress: c.propertyAddress,
    depositMxn: c.depositMxn ? String(c.depositMxn) : "",
    cancellation: c.cancellationOverride || tpl.defaultCancellation,
    extraClauses: c.extraClauses,
    hostAcknowledged: c.hostAcknowledged,
    hostReviewed: c.hostReviewed,
  };
}

function payload(f: Form, includeProperty: boolean) {
  const tpl = getContractTemplate(f.templateId);
  return {
    templateId: f.templateId,
    hostLegalName: f.hostLegalName.trim(),
    hostAddress: f.hostAddress.trim(),
    ...(includeProperty ? { propertyAddress: f.propertyAddress.trim() } : {}),
    depositMxn: Math.max(0, Math.round(Number(f.depositMxn) || 0)),
    cancellationOverride: f.cancellation.trim() === tpl.defaultCancellation ? "" : f.cancellation.trim(),
    extraClauses: f.extraClauses.trim(),
    hostAcknowledged: f.hostReviewed && f.hostAcknowledged,
    hostReviewed: f.hostReviewed,
  };
}

export function ContractsEditor() {
  const t = useT();
  const params = useSearchParams();
  const listings = useHostListings();
  const { data: meta } = useCached<{ account?: Account }>("/api/host/contracts");
  const account = meta?.account;
  const [pickedId, setPickedId] = useState<string | null>(params.get("anuncio"));
  const listing = listings?.find((l) => l.id === pickedId) ?? listings?.[0] ?? null;

  return (
    <div className="pb-[calc(110px+env(safe-area-inset-bottom))]">
      <TopBar title={t("Contratos")} back="/host/menu" />
      <div className="px-5 pt-4">
        <p className="text-[15px] leading-relaxed text-[#484848]">
          {t(
            "Cada anuncio usa un machote. En cada reserva se llenan solos tus datos y los del huésped. Los cambios aplican a reservas nuevas; un contrato ya firmado no cambia."
          )}
        </p>
      </div>

      {listings === null ? (
        <p className="px-5 py-6 text-sm text-[#999]">{t("Cargando…")}</p>
      ) : !listing ? (
        <p className="px-5 py-6 text-sm text-[#717171]">{t("Todavía no tienes anuncios.")}</p>
      ) : (
        <>
          {listings.length > 1 && (
            <div className="mt-4 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none]">
              {listings.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setPickedId(l.id)}
                  className={`max-w-[220px] shrink-0 truncate rounded-full border px-4 py-2 text-[13px] font-medium ${
                    l.id === listing.id ? "border-black bg-black text-white" : "border-[#e0e0e0] text-[#484848]"
                  }`}
                >
                  {l.title || t("Sin título")}
                </button>
              ))}
            </div>
          )}
          <ListingContractForm
            key={listing.id}
            listing={listing}
            others={listings.filter((l) => l.id !== listing.id)}
            account={account}
          />
        </>
      )}
    </div>
  );
}

function ListingContractForm({
  listing,
  others,
  account,
}: {
  listing: HostListing;
  others: HostListing[];
  account?: Account;
}) {
  const t = useT();
  const [f, setF] = useState<Form>(() => formFor(listing));
  const [saved, setSaved] = useState<Form>(() => formFor(listing));
  const [busy, setBusy] = useState<"save" | "all" | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [preview, setPreview] = useState<string[] | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const dirty = JSON.stringify(f) !== JSON.stringify(saved);
  const tpl = getContractTemplate(f.templateId);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }));

  const pickTemplate = (id: BookingContractTemplateId) =>
    setF((p) => {
      const prev = getContractTemplate(p.templateId);
      const next = getContractTemplate(id);
      return {
        ...p,
        templateId: id,
        // Si no los había personalizado, se cambian por los del machote nuevo.
        cancellation: p.cancellation.trim() === prev.defaultCancellation ? next.defaultCancellation : p.cancellation,
        extraClauses: p.extraClauses.trim() === prev.defaultExtraClauses ? next.defaultExtraClauses : p.extraClauses,
      };
    });

  async function openPreview() {
    setPreview(null);
    setPreviewOpen(true);
    const res = await fetch("/api/host/contracts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ listingId: listing.id, contract: payload(f, true) }),
    }).catch(() => null);
    const j = res ? await res.json().catch(() => ({})) : {};
    setPreview(Array.isArray(j.lines) ? j.lines : []);
  }

  async function save() {
    if (!f.hostReviewed) return setMsg({ ok: false, text: "Confirma que revisaste el contrato antes de guardarlo." });
    setBusy("save");
    setMsg(null);
    const r = await patchListing(listing.id, { contract: payload(f, true) });
    setBusy(null);
    if (r.error) return setMsg({ ok: false, text: r.error });
    setSaved(f);
    setMsg({ ok: true, text: "Contrato guardado." });
  }

  async function applyAll() {
    if (!f.hostReviewed) return setMsg({ ok: false, text: "Confirma que revisaste el contrato antes de guardarlo." });
    if (!confirm(t("Se usará este machote, tus datos y tus cláusulas en todos tus anuncios. La dirección de cada propiedad no cambia. ¿Continuar?")))
      return;
    setBusy("all");
    setMsg(null);
    const first = await patchListing(listing.id, { contract: payload(f, true) });
    const rest = await Promise.all(others.map((o) => patchListing(o.id, { contract: payload(f, false) })));
    setBusy(null);
    const failed = [first, ...rest].filter((r) => r.error).length;
    if (failed) return setMsg({ ok: false, text: t("No se pudieron guardar {n} anuncios.", { n: failed }) });
    setSaved(f);
    setMsg({ ok: true, text: t("Aplicado a tus {n} anuncios.", { n: others.length + 1 }) });
  }

  const propertyFallback = [listingStreet(listing), listing.zone, listing.city, listing.state].filter(Boolean).join(", ");

  return (
    <div className="space-y-7 px-5 pt-6">
      <ContractReviewNotice
        listing={listing}
        reviewed={f.hostReviewed}
        onReviewed={(v) => setF((p) => ({ ...p, hostReviewed: v, hostAcknowledged: v && p.hostAcknowledged }))}
      />

      <ContractTips
        hasClause={f.extraClauses.includes(MIN_STAY_CLAUSE.slice(0, 40))}
        onAddClause={(c) => set("extraClauses", [f.extraClauses.trim(), c].filter(Boolean).join("\n\n"))}
      />

      <section>
        <h2 className="text-lg font-semibold text-[#222]">{t("Machote")}</h2>
        <div className="mt-3 space-y-2.5">
          {BOOKING_CONTRACT_TEMPLATES.map((x) => {
            const on = x.id === f.templateId;
            return (
              <button
                key={x.id}
                type="button"
                onClick={() => pickTemplate(x.id)}
                aria-pressed={on}
                className={`block w-full rounded-2xl border p-4 text-left ${on ? "border-[#222] bg-[#fafafa] ring-1 ring-[#222]" : "border-[#e5e5e5]"}`}
              >
                <p className="flex items-center justify-between gap-3 text-[15px] font-semibold text-[#222]">
                  {t(x.title)}
                  <span
                    className={`h-5 w-5 shrink-0 rounded-full border-2 ${on ? "border-[#222] bg-[#222] shadow-[inset_0_0_0_3px_#fff]" : "border-[#bbb]"}`}
                  />
                </p>
                <p className="mt-1 text-sm text-[#717171]">{t(x.blurb)}</p>
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-[#222]">{t("Datos del anfitrión")}</h2>
          <p className="mt-0.5 text-sm text-[#717171]">
            {t("Si los dejas vacíos se usan los de tu cuenta. Los del huésped salen de su cuenta al reservar.")}
          </p>
        </div>
        <Field
          label={t("Nombre legal (firma)")}
          value={f.hostLegalName}
          onChange={(v) => set("hostLegalName", v)}
          placeholder={account?.fullName || t("Tu nombre completo")}
        />
        <Field
          label={t("Tu domicilio")}
          value={f.hostAddress}
          onChange={(v) => set("hostAddress", v)}
          placeholder={account?.addressLine || t("Calle, número, colonia, ciudad")}
        />
        {account && (
          <p className="rounded-xl bg-[#f7f7f7] px-3.5 py-2.5 text-[13px] text-[#555]">
            {t("También aparecen tu correo {email} y tu teléfono {phone}.", {
              email: account.email || "—",
              phone: account.phone || t("(no proporcionado)"),
            })}
          </p>
        )}
        <Field
          label={t("Dirección de la propiedad")}
          value={f.propertyAddress}
          onChange={(v) => set("propertyAddress", v)}
          placeholder={propertyFallback || t("Dirección del alojamiento")}
        />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-[#222]">{t("Condiciones")}</h2>
        <label className="block">
          <span className="text-sm font-medium text-[#222]">{t("Depósito en garantía (MXN)")}</span>
          <input
            inputMode="numeric"
            value={f.depositMxn}
            onChange={(e) => set("depositMxn", e.target.value.replace(/\D/g, "").slice(0, 7))}
            placeholder="0"
            className="mt-1.5 w-full rounded-xl border border-[#ccc] px-3.5 py-3 text-base outline-none focus:border-[#222]"
          />
          <span className="mt-1 block text-xs text-[#888]">{t(tpl.depositHint)}</span>
        </label>
        <Area label={t("Política de cancelación")} value={f.cancellation} onChange={(v) => set("cancellation", v)} rows={5} />
        <Area
          label={t("Cláusulas adicionales")}
          value={f.extraClauses}
          onChange={(v) => set("extraClauses", v)}
          rows={4}
          placeholder={t("Ej. Horario de silencio de 22:00 a 8:00. No se permiten visitas nocturnas.")}
        />
        <label className={`flex items-start gap-3 text-sm text-[#333] ${f.hostReviewed ? "" : "opacity-50"}`}>
          <input
            type="checkbox"
            disabled={!f.hostReviewed}
            checked={f.hostAcknowledged}
            onChange={(e) => set("hostAcknowledged", e.target.checked)}
            className="mt-0.5 h-5 w-5 shrink-0 accent-[#dcb81e]"
          />
          {t("Firmo este contrato por adelantado para las reservas instantáneas de este anuncio.")}
        </label>
      </section>

      <button
        type="button"
        onClick={() => void openPreview()}
        className="w-full rounded-xl border border-[#222] py-3 text-[15px] font-semibold text-[#222]"
      >
        {t("Ver cómo queda el contrato")}
      </button>

      {others.length > 0 && (
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void applyAll()}
          className="w-full text-center text-sm font-semibold text-[#222] underline disabled:opacity-40"
        >
          {busy === "all" ? t("Aplicando…") : t("Usar esto en todos mis anuncios ({n})", { n: others.length + 1 })}
        </button>
      )}

      <div
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[#ebebeb] bg-white px-5 pt-3"
        style={{ paddingBottom: "calc(12px + env(safe-area-inset-bottom))" }}
      >
        {msg && <p className={`mb-2 text-center text-sm ${msg.ok ? "text-[#1e7a3a]" : "text-red-700"}`}>{t(msg.text)}</p>}
        <button
          type="button"
          disabled={!dirty || busy !== null}
          onClick={() => void save()}
          className="mx-auto block w-full max-w-xl rounded-xl bg-[#222] py-3.5 text-[15px] font-semibold text-white disabled:opacity-40"
        >
          {busy === "save" ? t("Guardando…") : t("Guardar contrato de este anuncio")}
        </button>
      </div>

      <Sheet open={previewOpen} onClose={() => setPreviewOpen(false)} title={t("Vista previa del contrato")}>
        {preview === null ? (
          <p className="text-sm text-[#999]">{t("Cargando…")}</p>
        ) : preview.length === 0 ? (
          <p className="text-sm text-red-700">{t("No se pudo cargar el contrato.")}</p>
        ) : (
          <div className="rounded-2xl bg-[#f7f7f7] p-4 text-[13px] leading-relaxed text-[#333]">
            {preview.map((l, i) =>
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
            )}
          </div>
        )}
      </Sheet>
    </div>
  );
}

function Field(p: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-[#222]">{p.label}</span>
      <input
        value={p.value}
        onChange={(e) => p.onChange(e.target.value)}
        placeholder={p.placeholder}
        className="mt-1.5 w-full rounded-xl border border-[#ccc] px-3.5 py-3 text-base outline-none placeholder:text-[#9a9a9a] focus:border-[#222]"
      />
    </label>
  );
}

function Area(p: { label: string; value: string; onChange: (v: string) => void; rows: number; placeholder?: string }) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-[#222]">{p.label}</span>
      <textarea
        value={p.value}
        onChange={(e) => p.onChange(e.target.value)}
        rows={p.rows}
        placeholder={p.placeholder}
        className="mt-1.5 w-full rounded-xl border border-[#ccc] px-3.5 py-3 text-[15px] leading-relaxed outline-none focus:border-[#222]"
      />
    </label>
  );
}
