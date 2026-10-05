"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useLang, useT } from "@/components/i18n-provider";
import { ReviewCategoryInput, categoriesComplete } from "@/components/review-category-input";
import { ReviewStatusNote } from "@/components/review-status-note";
import { fmtDay } from "../../_components/booking-status";
import { Sheet } from "../../_components/sheet";

type Review = { rating: number; comment: string; createdAt?: string; status?: string; statusReason?: string };
type Stay = {
  id: string;
  guestName: string;
  listingTitle: string;
  effectiveListingTitle?: string;
  checkIn: string;
  checkOut: string;
  hostAdjustedCheckIn?: string;
  hostAdjustedCheckOut?: string;
  canReview?: boolean;
  myReview?: Review | null;
  guestReviewOfListing?: Review | null;
};

function Stars({ value }: { value: number }) {
  return (
    <span className="text-[#222]" aria-label={`${value}/5`}>
      {"★".repeat(value)}
      <span className="text-[#ccc]">{"★".repeat(5 - value)}</span>
    </span>
  );
}

export function HostReviews() {
  const t = useT();
  const lang = useLang();
  const params = useSearchParams();
  const focus = params.get("b");
  const [stays, setStays] = useState<Stay[] | null>(null);
  const [reviewing, setReviewing] = useState<Stay | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [opened, setOpened] = useState(false);

  const fetchStays = useCallback(async (): Promise<Stay[]> => {
    const res = await fetch("/api/host/bookings", { cache: "no-store" }).catch(() => null);
    const j = res?.ok ? await res.json().catch(() => ({})) : {};
    const rows: Stay[] = Array.isArray(j.bookings) ? j.bookings : [];
    return rows.filter((b) => b.canReview || b.myReview || b.guestReviewOfListing);
  }, []);

  useEffect(() => {
    let alive = true;
    fetchStays().then((rows) => alive && setStays(rows));
    return () => {
      alive = false;
    };
  }, [fetchStays]);

  if (focus && stays && !opened) {
    setOpened(true);
    const s = stays.find((x) => x.id === focus && x.canReview);
    if (s) setReviewing(s);
  }

  if (stays === null) return <p className="px-5 py-6 text-sm text-[#999]">{t("Cargando…")}</p>;

  const pending = stays.filter((s) => s.canReview);
  const done = stays
    .filter((s) => !s.canReview)
    .sort((a, b) => (b.hostAdjustedCheckOut ?? b.checkOut).localeCompare(a.hostAdjustedCheckOut ?? a.checkOut));

  const card = (s: Stay) => (
    <li key={s.id} className="rounded-2xl border border-[#ebebeb] bg-white p-4">
      <p className="text-[15px] font-semibold text-[#222]">{s.guestName}</p>
      <p className="text-[13px] text-[#717171]">
        {s.effectiveListingTitle ?? s.listingTitle} · {fmtDay(s.hostAdjustedCheckIn ?? s.checkIn, lang)} →{" "}
        {fmtDay(s.hostAdjustedCheckOut ?? s.checkOut, lang)}
      </p>
      {s.guestReviewOfListing && (
        <div className="mt-3 rounded-xl bg-[#f7f7f7] px-3 py-2.5">
          <p className="text-[13px] font-semibold text-[#222]">
            {t("Su reseña de tu alojamiento")} · <Stars value={s.guestReviewOfListing.rating} />
          </p>
          <p className="mt-0.5 text-[13px] text-[#555]">{s.guestReviewOfListing.comment}</p>
        </div>
      )}
      {s.myReview && (
        <div className="mt-3 rounded-xl border border-[#f0e3a8] bg-[#fffbea] px-3 py-2.5">
          <p className="text-[13px] font-semibold text-[#222]">
            {t("Tu reseña del huésped")} · <Stars value={s.myReview.rating} />
          </p>
          <p className="mt-0.5 text-[13px] text-[#555]">{s.myReview.comment}</p>
          <ReviewStatusNote status={s.myReview.status} reason={s.myReview.statusReason} className="mt-2" />
        </div>
      )}
      {s.canReview && (
        <button
          type="button"
          onClick={() => setReviewing(s)}
          className="mt-3 rounded-xl bg-[#dcb81e] px-4 py-2 text-sm font-semibold text-black"
        >
          {t("Calificar al huésped")}
        </button>
      )}
    </li>
  );

  return (
    <div className="space-y-6 px-5 pb-10 pt-4">
      {notice && <p className="rounded-2xl bg-[#e6f6ea] px-4 py-3 text-sm text-[#1e7a3a]">{t(notice)}</p>}
      <section>
        <h2 className="text-lg font-semibold text-[#222]">{t("Por calificar")}</h2>
        <p className="mt-0.5 text-sm text-[#717171]">
          {t("Cuando termina una estancia, califica al huésped. Lo verán otros anfitriones y el propio huésped.")}
        </p>
        {pending.length ? (
          <ul className="mt-3 space-y-3">{pending.map(card)}</ul>
        ) : (
          <p className="mt-3 rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm text-[#717171]">{t("No tienes reseñas pendientes.")}</p>
        )}
      </section>
      {done.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-[#222]">{t("Reseñas")}</h2>
          <ul className="mt-3 space-y-3">{done.map(card)}</ul>
        </section>
      )}

      <Sheet open={Boolean(reviewing)} onClose={() => setReviewing(null)} title={t("Calificar al huésped")}>
        {reviewing && (
          <GuestReviewForm
            key={reviewing.id}
            stay={reviewing}
            onDone={(review) => {
              setStays((prev) => prev?.map((x) => (x.id === reviewing.id ? { ...x, canReview: false, myReview: review } : x)) ?? prev);
              setReviewing(null);
              setNotice(
                review.status === "pending"
                  ? "Gracias. Tu reseña está siendo revisada por nuestro equipo y se publicará en cuanto quede aprobada."
                  : "¡Gracias! Le avisamos al huésped de tu reseña."
              );
            }}
          />
        )}
      </Sheet>
    </div>
  );
}

function GuestReviewForm({ stay, onDone }: { stay: Stay; onDone: (r: Review) => void }) {
  const t = useT();
  const [categories, setCategories] = useState<Record<string, number>>({});
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const ok = categoriesComplete("host_to_guest", categories) && comment.trim().length >= 10;

  async function submit() {
    setBusy(true);
    setErr(null);
    const res = await fetch(`/api/host/bookings/${encodeURIComponent(stay.id)}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categories, comment: comment.trim() }),
    }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (!res?.ok) {
      setErr(typeof data.error === "string" ? data.error : "No se pudo guardar. Intenta de nuevo.");
      return;
    }
    onDone({ rating: data.review?.rating ?? 5, comment: comment.trim(), status: data.pending ? "pending" : "published" });
  }

  return (
    <div className="space-y-5">
      <p className="text-[15px] font-semibold text-[#222]">
        {stay.guestName} · {stay.effectiveListingTitle ?? stay.listingTitle}
      </p>
      <div>
        <p className="mb-3 text-sm font-semibold text-[#222]">{t("¿Qué tal fue como huésped?")}</p>
        <ReviewCategoryInput kind="host_to_guest" value={categories} onChange={setCategories} />
      </div>
      <div>
        <p className="text-sm font-semibold text-[#222]">{t("Cuéntale a otros anfitriones")}</p>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={5}
          maxLength={1200}
          placeholder={t("¿Respetó las reglas? ¿Dejó todo en orden? ¿Fue fácil comunicarse?")}
          className="mt-2 w-full rounded-2xl border border-[#ddd] px-4 py-3 text-base outline-none focus:border-[#222]"
        />
        <p className="text-xs text-[#999]">{t("Mínimo 10 caracteres.")}</p>
      </div>
      {err && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{t(err)}</p>}
      <button
        type="button"
        disabled={!ok || busy}
        onClick={() => void submit()}
        className="w-full rounded-xl bg-[#222] py-3.5 text-[15px] font-semibold text-white disabled:opacity-40"
      >
        {busy ? t("Enviando…") : t("Publicar reseña")}
      </button>
    </div>
  );
}
