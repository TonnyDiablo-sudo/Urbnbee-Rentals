"use client";

import { useCallback, useEffect, useState } from "react";
import { useT } from "@/components/i18n-provider";
import {
  REPORT_CATEGORIES,
  REPORT_KINDS,
  REPORT_STATUS_LABEL,
  reportKindLabel,
  type MyReportView,
  type ReportCounterpart,
  type UserReportKind,
  type UserReportStatus,
} from "@/lib/user-reports-types";

const STATUS_BADGE: Record<UserReportStatus, string> = {
  open: "bg-[#fdf6d8] text-[#8a6d0f]",
  in_review: "bg-[#e8f0fb] text-[#1d4f91]",
  resolved: "bg-[#e7f5ec] text-[#1e7a3a]",
  dismissed: "bg-[#f3f3f3] text-[#717171]",
};

const KIND_ICON: Record<UserReportKind, string> = {
  report_account: "🚩",
  claim_account: "🪪",
  complaint: "⚠️",
  suggestion: "💡",
};

export type ReportPrefill = {
  kind?: UserReportKind;
  listingId?: string;
  listingTitle?: string;
  targetUserId?: string;
};

export function ReportCenter({ mode, prefill }: { mode: "guest" | "host"; prefill?: ReportPrefill }) {
  const t = useT();
  const [kind, setKind] = useState<UserReportKind | null>(prefill?.kind ?? (prefill?.listingId ? "report_account" : null));
  const [category, setCategory] = useState("");
  const [targetUserId, setTargetUserId] = useState(prefill?.targetUserId ?? "");
  const [targetLabel, setTargetLabel] = useState("");
  const [listingId, setListingId] = useState(prefill?.listingId ?? "");
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [reports, setReports] = useState<MyReportView[] | null>(null);
  const [counterparts, setCounterparts] = useState<ReportCounterpart[]>([]);

  const [version, setVersion] = useState(0);
  const load = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let alive = true;
    fetch("/api/reports", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : {}))
      .catch(() => ({}))
      .then((j: { reports?: MyReportView[]; counterparts?: ReportCounterpart[] }) => {
        if (!alive) return;
        setReports(j.reports ?? []);
        setCounterparts(j.counterparts ?? []);
      });
    return () => {
      alive = false;
    };
  }, [version]);

  const meta = REPORT_KINDS.find((k) => k.kind === kind);
  const categories = kind ? REPORT_CATEGORIES[kind] : [];
  const showTarget = Boolean(meta?.needsTarget);

  function pickKind(k: UserReportKind) {
    setKind(k);
    setCategory("");
    setError("");
    setSent(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!kind) return;
    setBusy(true);
    setError("");
    const res = await fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind,
        category: category || "Otro",
        mode,
        targetUserId: showTarget ? targetUserId : undefined,
        targetLabel: showTarget ? targetLabel : undefined,
        listingId: listingId || undefined,
        message,
        contact,
      }),
    }).catch(() => null);
    setBusy(false);
    if (!res) {
      setError(t("Error de red. Intenta de nuevo."));
      return;
    }
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    if (!res.ok) {
      setError(j.error ? t(j.error) : t("No se pudo enviar."));
      return;
    }
    setSent(true);
    setKind(null);
    setCategory("");
    setTargetUserId("");
    setTargetLabel("");
    setListingId("");
    setMessage("");
    setContact("");
    load();
  }

  const input =
    "w-full rounded-xl border border-[#dcdcdc] bg-white px-3 py-2.5 text-[15px] text-[#222] focus:border-[#222] focus:outline-none";

  return (
    <div className="space-y-8">
      {sent && (
        <p className="rounded-xl bg-[#e7f5ec] px-4 py-3 text-sm text-[#1e5a32]">
          {t("¡Gracias! Lo recibimos. El equipo de Cabibee lo revisa y te avisamos aquí y en tus notificaciones.")}
        </p>
      )}

      <section>
        <h2 className="mb-3 text-base font-semibold text-[#222]">{t("¿Qué quieres enviar?")}</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {REPORT_KINDS.map((k) => (
            <button
              key={k.kind}
              type="button"
              onClick={() => pickKind(k.kind)}
              className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition-colors ${
                kind === k.kind ? "border-[#222] bg-[#fafafa] ring-1 ring-[#222]" : "border-[#ebebeb] bg-white hover:border-[#bbb]"
              }`}
            >
              <span className="text-xl" aria-hidden>
                {KIND_ICON[k.kind]}
              </span>
              <span className="min-w-0">
                <span className="block text-[15px] font-semibold text-[#222]">{t(k.label)}</span>
                <span className="block text-xs leading-snug text-[#717171]">{t(k.hint)}</span>
              </span>
            </button>
          ))}
        </div>
      </section>

      {kind && (
        <form onSubmit={submit} className="space-y-5 rounded-2xl border border-[#ebebeb] bg-white p-5">
          <div>
            <p className="mb-2 text-sm font-semibold text-[#222]">{t("Motivo")}</p>
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategory(c)}
                  className={`rounded-full border px-3 py-1.5 text-sm ${
                    category === c ? "border-[#222] bg-[#222] text-white" : "border-[#dcdcdc] text-[#484848] hover:border-[#222]"
                  }`}
                >
                  {t(c)}
                </button>
              ))}
            </div>
          </div>

          {showTarget && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-[#222]">
                {kind === "claim_account" ? t("¿Qué cuenta o anuncio usa tus datos? (opcional)") : t("¿Qué cuenta quieres denunciar?")}
              </p>
              {listingId && prefill?.listingTitle && (
                <p className="flex items-center justify-between gap-2 rounded-xl bg-[#f7f7f7] px-3 py-2 text-sm text-[#484848]">
                  <span className="min-w-0 truncate">
                    {t("Anuncio")}: <strong>{prefill.listingTitle}</strong>
                  </span>
                  <button type="button" onClick={() => setListingId("")} className="shrink-0 text-xs text-[#717171] underline">
                    {t("Quitar")}
                  </button>
                </p>
              )}
              {!listingId && counterparts.length > 0 && (
                <select value={targetUserId} onChange={(e) => setTargetUserId(e.target.value)} className={input}>
                  <option value="">{t("Elige una persona con la que trataste…")}</option>
                  {counterparts.map((c) => (
                    <option key={`${c.userId}:${c.relation}`} value={c.userId}>
                      {c.name} · {c.relation === "host" ? t("anfitrión") : t("huésped")}
                      {c.listingTitle ? ` · ${c.listingTitle}` : ""}
                    </option>
                  ))}
                </select>
              )}
              {!listingId && !targetUserId && (
                <input
                  value={targetLabel}
                  onChange={(e) => setTargetLabel(e.target.value)}
                  placeholder={t("O pega la liga del anuncio, el correo o el nombre de la cuenta")}
                  className={input}
                  maxLength={300}
                />
              )}
            </div>
          )}

          <div>
            <label className="mb-2 block text-sm font-semibold text-[#222]" htmlFor="report-message">
              {kind === "suggestion" ? t("Tu sugerencia") : t("Cuéntanos qué pasó")}
            </label>
            <textarea
              id="report-message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={6}
              maxLength={4000}
              required
              minLength={10}
              placeholder={
                kind === "suggestion"
                  ? t("¿Qué te gustaría que hiciera Cabibee?")
                  : t("Fechas, qué te dijeron o pidieron, y cualquier detalle que nos ayude a revisarlo.")
              }
              className={input}
            />
            <p className="mt-1 text-right text-[11px] text-[#999]">{message.length}/4000</p>
          </div>

          {kind !== "suggestion" && (
            <div>
              <label className="mb-2 block text-sm font-semibold text-[#222]" htmlFor="report-contact">
                {t("¿Otro correo o teléfono para contactarte? (opcional)")}
              </label>
              <input id="report-contact" value={contact} onChange={(e) => setContact(e.target.value)} maxLength={160} className={input} />
            </div>
          )}

          {kind === "report_account" && (
            <p className="text-xs leading-relaxed text-[#717171]">
              {t("La otra persona no sabrá quién la reportó. Si hay peligro inmediato, llama al 911.")}
            </p>
          )}

          {error && <p className="rounded-xl bg-[#fdecec] px-3 py-2 text-sm text-[#b42318]">{error}</p>}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={busy || message.trim().length < 10}
              className="flex-1 rounded-xl bg-[#dcb81e] py-3 text-[15px] font-semibold text-black disabled:opacity-50"
            >
              {busy ? t("Enviando…") : t("Enviar")}
            </button>
            <button type="button" onClick={() => setKind(null)} className="rounded-xl border border-[#dcdcdc] px-4 py-3 text-[15px] text-[#484848]">
              {t("Cancelar")}
            </button>
          </div>
        </form>
      )}

      <section>
        <h2 className="mb-3 text-base font-semibold text-[#222]">{t("Lo que has enviado")}</h2>
        {reports === null ? (
          <p className="animate-pulse text-sm text-[#999]">{t("Cargando…")}</p>
        ) : reports.length === 0 ? (
          <p className="text-sm text-[#999]">{t("Todavía no has enviado nada.")}</p>
        ) : (
          <ul className="space-y-3">
            {reports.map((r) => (
              <li key={r.id} className="rounded-2xl border border-[#ebebeb] bg-white p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-base" aria-hidden>
                    {KIND_ICON[r.kind]}
                  </span>
                  <span className="text-sm font-semibold text-[#222]">{t(reportKindLabel(r.kind))}</span>
                  <span className="text-xs text-[#717171]">· {t(r.category)}</span>
                  <span className={`ml-auto rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[r.status]}`}>
                    {t(REPORT_STATUS_LABEL[r.status])}
                  </span>
                </div>
                {(r.targetName || r.targetLabel) && (
                  <p className="mt-1 text-xs text-[#717171]">
                    {t("Sobre")}: {r.targetName ?? r.targetLabel}
                  </p>
                )}
                <p className="mt-2 line-clamp-4 whitespace-pre-wrap text-sm text-[#484848]">{r.message}</p>
                {r.adminReply && (
                  <div className="mt-3 rounded-xl bg-[#fffbea] px-3 py-2">
                    <p className="text-xs font-semibold text-[#8a6d0f]">{t("Respuesta de Cabibee")}</p>
                    <p className="mt-0.5 whitespace-pre-wrap text-sm text-[#333]">{r.adminReply}</p>
                  </div>
                )}
                <p className="mt-2 text-[11px] text-[#aaa]">{new Date(r.createdAt).toLocaleDateString()}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
