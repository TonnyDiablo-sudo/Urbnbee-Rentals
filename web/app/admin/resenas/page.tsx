"use client";

import { useCallback, useEffect, useState } from "react";
import { useLang, useT } from "@/components/i18n-provider";
import { numberLocale } from "@/lib/i18n";

type PendingReview = {
  id: string;
  kind: "guest_to_listing" | "host_to_guest";
  rating: number;
  comment: string;
  createdAt: string;
  attempts: number;
  authorName: string;
  authorEmail?: string;
  listingTitle?: string;
  guestName?: string;
};

function ReviewCard({ r, onDone }: { r: PendingReview; onDone: () => void }) {
  const t = useT();
  const lang = useLang();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function decide(decision: "published" | "rejected") {
    setBusy(true);
    setErr("");
    const res = await fetch("/api/admin/reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: r.id, decision, reason }),
    }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (!res?.ok) {
      setErr(typeof data.error === "string" ? data.error : "No se pudo guardar.");
      return;
    }
    onDone();
  }

  return (
    <li className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-gray-800">
          {r.kind === "guest_to_listing" ? t("Huésped → alojamiento") : t("Anfitrión → huésped")} · {"★".repeat(r.rating)}
          <span className="text-gray-300">{"★".repeat(5 - r.rating)}</span>
        </p>
        <p className="text-xs text-gray-400">{new Date(r.createdAt).toLocaleString(numberLocale(lang))}</p>
      </div>
      <p className="mt-1 text-xs text-gray-500">
        {r.authorName}
        {r.authorEmail ? ` · ${r.authorEmail}` : ""}
        {r.listingTitle ? ` · ${r.listingTitle}` : ""}
        {r.kind === "host_to_guest" && r.guestName ? ` · ${t("Huésped")}: ${r.guestName}` : ""}
      </p>
      <p className="mt-3 whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-sm text-gray-800">{r.comment}</p>
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={t("Motivo si la rechazas (lo verá el autor)")}
        className="mt-3 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
      />
      {err && <p className="mt-2 text-xs text-red-600">{t(err)}</p>}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => decide("published")}
          className="rounded-lg bg-green-600 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"
        >
          {t("Aprobar y publicar")}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => decide("rejected")}
          className="rounded-lg border border-red-300 px-4 py-2 text-xs font-semibold text-red-700 disabled:opacity-50"
        >
          {t("Rechazar")}
        </button>
      </div>
    </li>
  );
}

export default function AdminReviewsPage() {
  const t = useT();
  const [rows, setRows] = useState<PendingReview[] | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/reviews", { cache: "no-store" }).catch(() => null);
    const data = res?.ok ? await res.json().catch(() => ({})) : {};
    setRows(Array.isArray(data.reviews) ? data.reviews : []);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 lg:px-8">
      <h1 className="text-xl font-bold text-gray-900">{t("Reseñas en revisión")}</h1>
      <p className="mt-1 text-sm text-gray-500">
        {t("Reseñas que el filtro no pudo revisar. Se reintenta solo cada 15 minutos; aquí puedes aprobarlas o rechazarlas a mano.")}
      </p>
      {rows === null ? (
        <p className="mt-6 text-sm text-gray-400">{t("Cargando…")}</p>
      ) : rows.length === 0 ? (
        <p className="mt-6 rounded-xl bg-white px-4 py-3 text-sm text-gray-500">{t("No hay reseñas en revisión.")}</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {rows.map((r) => (
            <ReviewCard key={r.id} r={r} onDone={load} />
          ))}
        </ul>
      )}
    </div>
  );
}
