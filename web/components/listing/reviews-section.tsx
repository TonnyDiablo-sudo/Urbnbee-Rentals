import type { Review } from "@/lib/listing-detail-data";

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

export function ReviewsSection({ reviews, ratingAvg }: { reviews: Review[]; ratingAvg?: number }) {
  if (reviews.length === 0) {
    return (
      <div className="rounded border p-8 text-center" style={{ borderColor: "#ebebeb" }}>
        <p className="text-sm text-[#aaa]">Aún no hay reseñas para este alojamiento.</p>
      </div>
    );
  }

  const avg = ratingAvg ?? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length);

  return (
    <div>
      {/* Summary */}
      <div className="mb-6 flex items-center gap-3">
        <span className="text-4xl font-bold" style={{ color: "#dcb81e" }}>{avg.toFixed(2)}</span>
        <div>
          <Stars n={Math.round(avg)} />
          <p className="mt-1 text-sm text-[#aaa]">{reviews.length} reseña{reviews.length !== 1 ? "s" : ""}</p>
        </div>
      </div>

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
                <Stars n={r.rating} />
                <p className="mt-2 text-sm leading-relaxed text-[#3a3a3a]">{r.comment}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
