import Link from "next/link";
import { getT } from "@/lib/i18n/server";
import { RECOMMEND_MUSTS, recommendListings, type RecommendPrefs } from "@/lib/guest-recommender";
import { AppListingCardView } from "../_components/listing-card";
import { TopBar } from "../_components/top-bar";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Te recomendamos") };
}

type Search = {
  ver?: string;
  lugar?: string;
  huespedes?: string;
  presupuesto?: string;
  tipo?: string;
  ambiente?: string;
  extras?: string | string[];
  verif?: string;
};

const TYPES: [RecommendPrefs["type"], string][] = [
  ["", "Me da igual"],
  ["casas", "Casa"],
  ["departamentos", "Departamento"],
  ["habitaciones", "Habitación"],
  ["cabanas", "Cabaña"],
];

const VIBES: [RecommendPrefs["vibe"], string][] = [
  ["", "Me da igual"],
  ["playa", "🏖️ Playa"],
  ["ciudad", "🏙️ Ciudad"],
  ["naturaleza", "🌲 Naturaleza"],
  ["vinedos", "🍷 Viñedos"],
];

const BUDGETS: [string, string][] = [
  ["0", "Sin tope"],
  ["800", "Hasta $800"],
  ["1500", "Hasta $1,500"],
  ["2500", "Hasta $2,500"],
  ["4000", "Hasta $4,000"],
];

function parsePrefs(q: Search): RecommendPrefs {
  const extras = Array.isArray(q.extras) ? q.extras : q.extras ? [q.extras] : [];
  return {
    place: (q.lugar ?? "").trim().slice(0, 80),
    guests: Math.max(0, Math.min(30, Number(q.huespedes) || 0)),
    budget: Math.max(0, Number(q.presupuesto) || 0),
    type: (TYPES.find(([k]) => k === q.tipo)?.[0] ?? "") as RecommendPrefs["type"],
    vibe: (VIBES.find(([k]) => k === q.ambiente)?.[0] ?? "") as RecommendPrefs["vibe"],
    musts: extras.filter((e) => RECOMMEND_MUSTS.some((m) => m.key === e)),
    verifiedOnly: q.verif === "1",
  };
}

const chip = "cursor-pointer rounded-full border border-[#e0e0e0] px-4 py-2 text-[13px] font-medium text-[#484848] has-[:checked]:border-black has-[:checked]:bg-black has-[:checked]:text-white";

export default async function RecommendPage({ searchParams }: { searchParams: Promise<Search> }) {
  const q = await searchParams;
  const t = await getT();
  const prefs = parsePrefs(q);
  const results = q.ver === "1" ? recommendListings(prefs) : null;

  return (
    <>
      <TopBar title={t("Te recomendamos")} back="/" />
      <div className="px-5 pb-10 pt-4">
        {results === null ? (
          <form action="/recomendar" className="space-y-6">
            <input type="hidden" name="ver" value="1" />
            <p className="text-[15px] leading-relaxed text-[#555]">
              {t("Contesta unas preguntas rápidas y te mostramos los alojamientos que mejor te quedan.")}
            </p>

            <label className="block">
              <span className="text-[15px] font-semibold text-[#222]">{t("¿A dónde vas?")}</span>
              <input
                name="lugar"
                defaultValue={prefs.place}
                placeholder={t("Ciudad o zona (opcional)")}
                className="mt-2 w-full rounded-xl border border-[#ccc] px-3.5 py-3 text-base outline-none focus:border-[#222]"
              />
            </label>

            <label className="block">
              <span className="text-[15px] font-semibold text-[#222]">{t("¿Cuántos son?")}</span>
              <input
                name="huespedes"
                type="number"
                min={1}
                max={30}
                inputMode="numeric"
                defaultValue={prefs.guests || 2}
                className="mt-2 w-28 rounded-xl border border-[#ccc] px-3.5 py-3 text-base outline-none focus:border-[#222]"
              />
            </label>

            <fieldset>
              <legend className="text-[15px] font-semibold text-[#222]">{t("Presupuesto por noche")}</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {BUDGETS.map(([v, label], i) => (
                  <label key={v} className={chip}>
                    <input type="radio" name="presupuesto" value={v} defaultChecked={i === 0} className="sr-only" />
                    {t(label)}
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-[15px] font-semibold text-[#222]">{t("¿Qué tipo de lugar?")}</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {TYPES.map(([v, label], i) => (
                  <label key={v || "any"} className={chip}>
                    <input type="radio" name="tipo" value={v} defaultChecked={i === 0} className="sr-only" />
                    {t(label)}
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-[15px] font-semibold text-[#222]">{t("¿Qué ambiente buscas?")}</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {VIBES.map(([v, label], i) => (
                  <label key={v || "any"} className={chip}>
                    <input type="radio" name="ambiente" value={v} defaultChecked={i === 0} className="sr-only" />
                    {t(label)}
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-[15px] font-semibold text-[#222]">{t("¿Qué no puede faltar?")}</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {RECOMMEND_MUSTS.map((m) => (
                  <label key={m.key} className={chip}>
                    <input type="checkbox" name="extras" value={m.key} className="sr-only" />
                    {t(m.label)}
                  </label>
                ))}
              </div>
            </fieldset>

            <label className="flex items-center gap-3 text-[15px] text-[#222]">
              <input type="checkbox" name="verif" value="1" className="h-5 w-5" />
              {t("Solo anfitriones con identidad verificada")}
            </label>

            <button type="submit" className="w-full rounded-xl bg-[#dcb81e] py-3.5 text-[15px] font-semibold text-black">
              {t("Ver recomendaciones")}
            </button>
          </form>
        ) : (
          <div className="space-y-7">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-[#717171]">
                {results.length
                  ? t("{n} alojamientos que encajan contigo", { n: results.length })
                  : t("No encontramos nada con todo eso.")}
              </p>
              <Link href="/recomendar" className="shrink-0 text-sm font-semibold underline">
                {t("Cambiar respuestas")}
              </Link>
            </div>
            {results.length === 0 && (
              <p className="rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm leading-relaxed text-[#484848]">
                {t("Prueba quitar algún requisito, subir el presupuesto o buscar en otra zona.")}
              </p>
            )}
            {results.map((r, i) => (
              <div key={r.card.id}>
                <AppListingCardView listing={r.card} t={t} priority={i === 0} />
                {r.reasons.length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {r.reasons.map((reason) => (
                      <li key={reason} className="rounded-full bg-[#fdf6d8] px-2.5 py-1 text-[12px] text-[#5c4a0a]">
                        {t(reason)}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
