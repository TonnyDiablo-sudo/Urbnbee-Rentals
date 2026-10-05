"use client";

import { useT } from "@/components/i18n-provider";
import { reviewCategoriesFor, stayScore } from "@/lib/review-categories";
import type { StayReviewKind } from "@/lib/stay-review-types";

/** Estrellas del 1 al 5 por categoría y la calificación global que resulta. */
export function ReviewCategoryInput({
  kind,
  value,
  onChange,
  size = "lg",
}: {
  kind: StayReviewKind;
  value: Record<string, number>;
  onChange: (v: Record<string, number>) => void;
  size?: "lg" | "sm";
}) {
  const t = useT();
  const cats = reviewCategoriesFor(kind);
  const done = cats.every((c) => value[c.id] >= 1);
  const star = size === "lg" ? "h-9 w-9 text-[26px]" : "h-7 w-7 text-[20px]";
  return (
    <div className="space-y-3">
      {cats.map((c) => (
        <div key={c.id}>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#222]">{t(c.label)}</p>
              <p className="text-xs text-[#888]">{t(c.hint)}</p>
            </div>
            <div className="flex shrink-0" role="radiogroup" aria-label={t(c.label)}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={value[c.id] === n}
                  aria-label={`${n}/5`}
                  onClick={() => onChange({ ...value, [c.id]: n })}
                  className={`${star} leading-none ${n <= (value[c.id] ?? 0) ? "text-[#dcb81e]" : "text-[#d6d6d6]"}`}
                >
                  ★
                </button>
              ))}
            </div>
          </div>
        </div>
      ))}
      <p className="rounded-xl bg-[#f7f7f7] px-3 py-2 text-sm text-[#555]">
        {done
          ? t("Calificación global de la estancia: {score} de 5", { score: stayScore(value).toFixed(2) })
          : t("Califica cada punto del 1 al 5. La calificación global es el promedio.")}
      </p>
    </div>
  );
}

export function categoriesComplete(kind: StayReviewKind, value: Record<string, number>): boolean {
  return reviewCategoriesFor(kind).every((c) => value[c.id] >= 1 && value[c.id] <= 5);
}
