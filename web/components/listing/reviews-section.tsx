"use client";
import type { Review, ReviewSummary } from "@/lib/listing-detail-data";
import { LISTING_REVIEW_CATEGORIES } from "@/lib/review-categories";
import { useT } from "@/components/i18n-provider";

function Stars({ n }: { n: number }) {
  return (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map((i) => (
        <svg key={i} className="h-3.5 w-3.5" fill={i <= n ? "#dcb81e" : "#ddd"} viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

export function ReviewsSection({ reviews, ratingAvg, summary }: { reviews: Review[]; ratingAvg?: number; summary?: ReviewSummary }) {
  const t = useT();
  if (reviews.length === 0) {
    return (
      <div className="rounded border p-8 text-center" style={{ borderColor: "#ebebeb" }}>
        <p className="text-sm text-[#aaa]">{t("Aún no hay reseñas de estancias en este alojamiento.")}</p>
        {summary && summary.host.count > 0 && (
          <p className="mt-2 text-sm text-[#717171]">
            {t("El anfitrión tiene {avg}★ con {n} reseñas en sus otros anuncios.", { avg: summary.host.avg.toFixed(2), n: summary.host.count })}
          </p>
        )}
      </div>
    );
  }

  const avg = summary?.count ? summary.avg : ratingAvg ?? reviews.reduce((s, r) => s + (r.score ?? r.rating), 0) / reviews.length;
  const cats = LISTING_REVIEW_CATEGORIES.filter((c) => summary?.categories[c.id] !== undefined);

  return (
    <div>
      {/* Summary */}
      <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex items-center gap-3">
          <span className="text-4xl font-bold" style={{ color: "#dcb81e" }}>{avg.toFixed(2)}</span>
          <div>
            <Stars n={Math.round(avg)} />
            <p className="mt-1 text-sm text-[#aaa]">{reviews.length !== 1 ? t("{n} reseñas", { n: reviews.length }) : t("{n} reseña", { n: reviews.length })}</p>
          </div>
        </div>
        {summary && summary.host.count > reviews.length && (
          <p className="text-sm text-[#717171]">
            {t("Anfitrión: {avg}★ en {n} reseñas de todos sus anuncios", { avg: summary.host.avg.toFixed(2), n: summary.host.count })}
          </p>
        )}
      </div>

      {cats.length > 0 && (
        <div className="mb-6">
          <div className="grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
            {cats.map((c) => {
              const v = summary!.categories[c.id];
              return (
                <div key={c.id} className="flex items-center gap-3 text-sm">
                  <span className="w-40 shrink-0 text-[#484848]">{t(c.label)}</span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#eee]">
                    <span className="block h-full rounded-full bg-[#222]" style={{ width: `${(v / 5) * 100}%` }} />
                  </span>
                  <span className="w-8 text-right font-semibold text-[#222]">{v.toFixed(1)}</span>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-[#999]">
            {t("La calificación global es el promedio de estos puntos. Las reseñas de los últimos 6 meses pesan más que las anteriores.")}
          </p>
        </div>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        {reviews.map((r) => (
          <div key={r.id} className="rounded border p-5" style={{ borderColor: "#ebebeb" }}>
            <div className="flex items-start gap-3">
              <img src={r.avatarUrl} alt={r.author} className="h-10 w-10 rounded-full object-cover shrink-0" />
              <div className="flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-[#484848]">{r.author}</span>
                  <span className="text-xs text-[#aaa]">{r.date}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Stars n={r.rating} />
                  {r.score !== undefined && <span className="text-xs text-[#717171]">{r.score.toFixed(1)}</span>}
                </div>
                {r.fromStay && (
                  <p className="mt-1 text-[11px] font-medium text-[#dcb81e]">{t("Estancia en Cabibee")}</p>
                )}
                <p className="mt-2 text-sm leading-relaxed text-[#3a3a3a]">{r.comment}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
