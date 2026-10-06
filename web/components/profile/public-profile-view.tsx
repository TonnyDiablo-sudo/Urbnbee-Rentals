import Link from "next/link";
import { numberLocale, type Lang, type TFn } from "@/lib/i18n";
import { sizedImage } from "@/lib/image-url";
import type { PublicProfile } from "@/lib/public-profile";

function since(iso: string | undefined, lang: Lang): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(numberLocale(lang), { month: "long", year: "numeric" });
}

function Stars({ n }: { n: number }) {
  return (
    <span aria-label={`${n}/5`} className="text-[#dcb81e]">
      {"★".repeat(Math.round(n))}
      <span className="text-[#ddd]">{"★".repeat(5 - Math.round(n))}</span>
    </span>
  );
}

/** Perfil público tipo Airbnb; lo usan la app y la web. */
export function PublicProfileView({ p, t, lang, listingBase }: { p: PublicProfile; t: TFn; lang: Lang; listingBase: string }) {
  const box = "rounded-2xl border border-[#ebebeb] bg-white p-5";
  const isHost = p.listings.length > 0;
  return (
    <div className="mx-auto grid w-full max-w-5xl gap-5 pb-10 md:grid-cols-[320px_1fr] md:items-start">
      <section className={`${box} text-center md:sticky md:top-24`}>
        {p.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.avatarUrl} alt="" className="mx-auto h-28 w-28 rounded-full object-cover" />
        ) : (
          <span className="mx-auto flex h-28 w-28 items-center justify-center rounded-full bg-[#111] text-4xl font-bold text-[#dcb81e]">
            {p.name.charAt(0).toUpperCase()}
          </span>
        )}
        <h1 className="mt-3 text-2xl font-bold text-[#222]">{p.name}</h1>
        <p className="text-sm text-[#717171]">{isHost ? t("Anfitrión") : t("Huésped")}</p>
        <div className="mt-4 grid grid-cols-2 divide-x divide-[#ebebeb] border-y border-[#ebebeb] py-3 text-left">
          <div className="px-3">
            <p className="text-lg font-semibold text-[#222]">{p.rating.count}</p>
            <p className="text-xs text-[#717171]">{p.rating.count === 1 ? t("Reseña") : t("Reseñas")}</p>
          </div>
          <div className="px-3">
            <p className="text-lg font-semibold text-[#222]">{p.rating.count ? `${p.rating.avg.toFixed(2)} ★` : "—"}</p>
            <p className="text-xs text-[#717171]">{t("Calificación")}</p>
          </div>
        </div>
        <ul className="mt-4 space-y-2 text-left text-sm text-[#333]">
          {p.identityVerified && <li>✓ {t("Identidad verificada")}</li>}
          {p.memberSince && <li>🗓️ {t("En Cabibee desde {date}", { date: since(p.memberSince, lang) })}</li>}
          {p.work && <li>💼 {p.work}</li>}
          {p.livesIn && <li>📍 {t("Vive en {place}", { place: p.livesIn })}</li>}
          {p.languages.length > 0 && <li>🗣️ {t("Habla {langs}", { langs: p.languages.map((l) => t(l)).join(", ") })}</li>}
        </ul>
      </section>

      <div className="min-w-0 space-y-5">
        {(p.bio || p.interests.length > 0) && (
          <section className={box}>
            <h2 className="text-[17px] font-semibold text-[#222]">{t("Acerca de {name}", { name: p.name.split(" ")[0] })}</h2>
            {p.bio && <p className="mt-2 whitespace-pre-line leading-relaxed text-[#333]">{p.bio}</p>}
            {p.interests.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {p.interests.map((i) => (
                  <span key={i} className="rounded-full border border-[#ddd] px-3 py-1 text-sm text-[#333]">
                    {t(i)}
                  </span>
                ))}
              </div>
            )}
          </section>
        )}

        {isHost && (
          <section className={box}>
            <h2 className="text-[17px] font-semibold text-[#222]">{t("Anuncios de {name}", { name: p.name.split(" ")[0] })}</h2>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">
              {p.listings.map((l) => (
                <li key={l.id}>
                  <Link href={`${listingBase}/${l.slug}`} className="flex gap-3 rounded-xl border border-[#ebebeb] p-2 hover:bg-[#fafafa]">
                    <span className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-[#eee]">
                      {l.photo && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={sizedImage(l.photo, 160)} alt="" className="h-full w-full object-cover" />
                      )}
                    </span>
                    <span className="min-w-0">
                      <span className="line-clamp-2 text-sm font-semibold text-[#222]">{l.title}</span>
                      <span className="block text-xs text-[#717171]">
                        {l.city}
                        {l.reviews > 0 ? ` · ★ ${l.rating.toFixed(2)} (${l.reviews})` : ""}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className={box}>
          <h2 className="text-[17px] font-semibold text-[#222]">
            {isHost ? t("Lo que dicen los huéspedes") : t("Lo que dicen los anfitriones")}
          </h2>
          {p.reviews.length === 0 ? (
            <p className="mt-2 text-sm text-[#717171]">{t("Todavía no hay reseñas.")}</p>
          ) : (
            <ul className="mt-3 divide-y divide-[#f0f0f0]">
              {p.reviews.map((r) => (
                <li key={r.id} className="py-3">
                  <div className="flex items-center gap-2.5">
                    {r.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.avatarUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
                    ) : (
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f1f1f1] text-sm font-bold text-[#555]">
                        {r.author.charAt(0).toUpperCase()}
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#222]">{r.author}</p>
                      <p className="text-xs text-[#717171]">
                        <Stars n={r.rating} /> · {since(r.date, lang)}
                      </p>
                    </div>
                  </div>
                  {r.comment && <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-[#333]">{r.comment}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
