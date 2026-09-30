"use client";

import { useState } from "react";
import type { StayReviewRecord } from "@/lib/stay-review-types";
import { useT } from "@/components/i18n-provider";

function Stars({
  value,
  onChange,
}: {
  value: number;
  onChange?: (n: number) => void;
}) {
  const t = useT();
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!onChange}
          onClick={() => onChange?.(n)}
          className="disabled:cursor-default"
          aria-label={t("{n} estrellas", { n })}
        >
          <svg className="h-5 w-5" fill={n <= value ? "#dcb81e" : "#ddd"} viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        </button>
      ))}
    </div>
  );
}

export function BookingReviewPanel({
  bookingId,
  role,
  canReview,
  myReview,
  otherReview,
  onChanged,
}: {
  bookingId: string;
  role: "guest" | "host";
  canReview?: boolean;
  myReview?: StayReviewRecord;
  otherReview?: StayReviewRecord;
  onChanged: () => void;
}) {
  const t = useT();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!canReview && !myReview && !otherReview) return null;

  const endpoint =
    role === "guest"
      ? `/api/guest/bookings/${bookingId}/review`
      : `/api/host/bookings/${bookingId}/review`;

  return (
    <div className="mt-4 rounded-lg border border-[#ebebeb] bg-white p-4 text-sm">
      <p className="font-semibold text-[#484848]">
        {role === "guest" ? t("Reseña del alojamiento") : t("Reseña del huésped")}
      </p>
      <p className="mt-1 text-xs text-[#888]">
        {t("Solo después de la estancia. Una reseña por reserva, no se edita.")}
      </p>

      {myReview && (
        <div className="mt-3">
          <Stars value={myReview.rating} />
          <p className="mt-2 text-[#3a3a3a]">{myReview.comment}</p>
        </div>
      )}

      {otherReview && (
        <div className="mt-3 rounded bg-[#fafafa] p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#aaa]">
            {role === "guest" ? t("El anfitrión te reseñó") : t("El huésped reseñó el alojamiento")}
          </p>
          <div className="mt-1">
            <Stars value={otherReview.rating} />
          </div>
          <p className="mt-2 text-[#3a3a3a]">{otherReview.comment}</p>
        </div>
      )}

      {canReview && !myReview && (
        <form
          className="mt-3 space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setErr(null);
            try {
              const res = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ rating, comment }),
              });
              const data = await res.json().catch(() => ({}));
              if (!res.ok) {
                setErr(typeof data.error === "string" ? data.error : "No se pudo publicar.");
                return;
              }
              setComment("");
              onChanged();
            } catch {
              setErr("Error de red.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <Stars value={rating} onChange={setRating} />
          <textarea
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder={
              role === "guest"
                ? t("Cómo fue el lugar y la estancia…")
                : t("Cómo se portó el huésped…")
            }
            className="w-full rounded border px-3 py-2 text-sm"
            style={{ borderColor: "#ebebeb" }}
          />
          {err && <p className="text-xs text-red-600">{t(err)}</p>}
          <button
            type="submit"
            disabled={busy || comment.trim().length < 10}
            className="rounded bg-[#dcb81e] px-4 py-2 text-xs font-semibold text-black disabled:opacity-50"
          >
            {busy ? t("Publicando…") : t("Publicar reseña")}
          </button>
        </form>
      )}
    </div>
  );
}
