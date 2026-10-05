import "server-only";
import { appBrowseListings, type AppListingCard } from "@/lib/app-listings";
import { matchesBrowseQuery } from "@/lib/browse-query";
import { getListingDetail } from "@/lib/get-listing-detail";

export type RecommendPrefs = {
  place: string;
  guests: number;
  /** Tope por noche en MXN; 0 = sin tope. */
  budget: number;
  type: "" | "casas" | "departamentos" | "habitaciones" | "cabanas";
  vibe: "" | "playa" | "ciudad" | "naturaleza" | "vinedos";
  musts: string[];
  verifiedOnly: boolean;
};

export const RECOMMEND_MUSTS: { key: string; label: string; match: RegExp }[] = [
  { key: "alberca", label: "Alberca", match: /alberca|piscina|pool/i },
  { key: "wifi", label: "Wifi", match: /wifi|internet|inal[aá]mbric/i },
  { key: "estacionamiento", label: "Estacionamiento", match: /estacionamiento|cochera|parking|garage/i },
  { key: "cocina", label: "Cocina", match: /cocina|kitchen/i },
  { key: "aire", label: "Aire acondicionado", match: /aire acondicionado|a\/c|minisplit|clima/i },
  { key: "mascotas", label: "Mascotas", match: /mascota|pet friendly|perro/i },
  { key: "trabajo", label: "Para trabajar", match: /escritorio|workspace|home office|zona de trabajo/i },
];

const VIBE: Record<Exclude<RecommendPrefs["vibe"], "">, RegExp> = {
  playa: /playa|mar\b|frente al mar|bah[ií]a|caribe|pac[ií]fico|canc[uú]n|tulum|vallarta|mazatl[aá]n|acapulco|puerto/i,
  ciudad: /centro|ciudad|downtown|condesa|roma|polanco|metro|caminable/i,
  naturaleza: /bosque|monta[ñn]a|lago|r[ií]o|caba[ñn]a|selva|cascada|valle|campo/i,
  vinedos: /vi[ñn]edo|vino|valle de guadalupe|parras|quer[eé]taro|bodega/i,
};

const CATEGORY_OF_TYPE: Record<Exclude<RecommendPrefs["type"], "">, string> = {
  casas: "Casas",
  departamentos: "Departamentos",
  habitaciones: "Habitaciones",
  cabanas: "Cabañas",
};

/** `text` es clave de i18n; `term` es otra clave que va traducida en {x}. */
export type RecommendReason = { text: string; vars?: Record<string, string | number>; term?: string };
export type Recommendation = { card: AppListingCard; score: number; reasons: RecommendReason[] };

export function recommendListings(prefs: RecommendPrefs, limit = 8): Recommendation[] {
  const out: Recommendation[] = [];
  for (const card of appBrowseListings({ verifiedOnly: prefs.verifiedOnly })) {
    const d = getListingDetail(card.slug);
    if (!d) continue;
    const text = `${d.title} ${d.description} ${d.city} ${d.zone} ${d.amenities.join(" ")}`;
    const reasons: RecommendReason[] = [];
    let score = 0;

    if (prefs.place) {
      if (!matchesBrowseQuery(`${d.title} ${d.city} ${d.zone} ${d.county}`, prefs.place)) continue;
      score += 30;
      reasons.push({ text: "En {place}", vars: { place: [d.zone, d.city].filter((x) => x && x !== "—").join(", ") } });
    }

    if (prefs.guests > 0) {
      if (d.guests < prefs.guests) continue;
      score += d.guests - prefs.guests <= 2 ? 15 : 8;
      reasons.push({ text: "Caben {n} huéspedes", vars: { n: d.guests } });
    }

    if (prefs.budget > 0) {
      if (d.pricePerNight > prefs.budget * 1.15) continue;
      if (d.pricePerNight <= prefs.budget) {
        score += 20;
        reasons.push({
          text: "{price} por noche, dentro de tu presupuesto",
          vars: { price: `$${d.pricePerNight.toLocaleString("es-MX")}` },
        });
      } else {
        score += 5;
        reasons.push({ text: "Un poco arriba de tu presupuesto" });
      }
    }

    if (prefs.type) {
      if (d.category === CATEGORY_OF_TYPE[prefs.type]) {
        score += 15;
        reasons.push({ text: { casas: "Casa", departamentos: "Departamento", habitaciones: "Habitación", cabanas: "Cabaña" }[prefs.type] });
      } else {
        score -= 10;
      }
    }

    if (prefs.vibe && VIBE[prefs.vibe].test(text)) {
      score += 12;
      reasons.push({
        text: { playa: "Cerca del mar", ciudad: "Bien ubicado en la ciudad", naturaleza: "Rodeado de naturaleza", vinedos: "Zona de viñedos" }[prefs.vibe],
      });
    }

    let mustHits = 0;
    for (const key of prefs.musts) {
      const must = RECOMMEND_MUSTS.find((m) => m.key === key);
      if (!must) continue;
      const ok = key === "mascotas" ? d.rules.pets === true || must.match.test(text) : must.match.test(text);
      if (ok) {
        mustHits++;
        score += 8;
        reasons.push({ text: "Tiene {x}", term: must.label });
      } else {
        score -= 6;
      }
    }
    if (prefs.musts.length && mustHits === 0) continue;

    if (card.identityVerified) {
      score += 6;
      reasons.push({ text: "Anfitrión con identidad verificada" });
    }
    if (card.rating > 0) score += card.rating;
    if (card.bookable) score += 3;

    out.push({ card, score, reasons: reasons.slice(0, 4) });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit);
}
