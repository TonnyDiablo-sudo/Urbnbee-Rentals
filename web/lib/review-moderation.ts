import "server-only";
import { makeT, type Lang } from "@/lib/i18n";
import { callListingImportOpenAiJson } from "@/lib/listing-import-openai";

export type ReviewModeration = {
  /** `unavailable`: el filtro no respondió; la reseña queda en revisión hasta que lo haga. */
  verdict: "approve" | "reject" | "unavailable";
  /** Explicación corta, en el idioma de quien escribió la reseña. */
  reason?: string;
  model?: string;
};

function reviewModerationModel(): string {
  return process.env.REVIEW_MODERATION_OPENAI_MODEL?.trim() || "gpt-4o-mini";
}

const SYSTEM = `Eres parte del equipo de revisión de reseñas de Cabibee, una plataforma de rentas. Huéspedes califican alojamientos y anfitriones califican huéspedes después de una estancia.
Las reseñas negativas y honestas SÍ se permiten (limpieza, ruido, trato, puntualidad, daños, reglas incumplidas).
Rechaza ("reject") sólo si la reseña:
- insulta, humilla o usa groserías dirigidas a una persona;
- discrimina por raza, origen, religión, género, orientación, discapacidad, edad o nacionalidad;
- contiene amenazas, acoso o contenido sexual;
- publica datos personales o de contacto (teléfonos, correos, direcciones exactas, redes sociales, documentos);
- hace spam, publicidad, o pide tratos fuera de la plataforma;
- no tiene que ver con la estancia.
Todo lo demás es "approve". En caso de duda, "approve".
"reason": una frase corta dirigida a quien escribió, explicando qué cambiar, como la escribiría una persona del equipo de Cabibee. Nunca menciones inteligencia artificial, sistemas automáticos, filtros ni modelos. Vacía si approve.
Responde SOLO JSON: {"verdict": "approve"|"reject", "reason": string}`;

const CONTACT_RE = /(\+?\d[\d\s().-]{8,}\d)|([\w.+-]+@[\w-]+\.[\w.]+)|(wa\.me|whatsapp\.com|instagram\.com|facebook\.com|t\.me)\//i;

/**
 * Revisa una reseña antes de publicarla. Los datos de contacto se detectan sin depender
 * del servicio; si el servicio no responde, la reseña no se publica todavía.
 */
export async function moderateReview(opts: {
  kind: "guest_to_listing" | "host_to_guest";
  rating: number;
  comment: string;
  lang: Lang;
}): Promise<ReviewModeration> {
  const t = makeT(opts.lang);
  if (CONTACT_RE.test(opts.comment)) {
    return { verdict: "reject", reason: t("Quita teléfonos, correos o redes sociales de tu reseña.") };
  }
  const who = opts.kind === "guest_to_listing" ? "Un huésped califica el alojamiento y al anfitrión" : "Un anfitrión califica al huésped";
  const reasonLang = opts.lang === "en" ? "Escribe \"reason\" en inglés." : "Escribe \"reason\" en español.";
  const res = await callListingImportOpenAiJson<{ verdict?: string; reason?: string }>({
    model: reviewModerationModel(),
    system: `${SYSTEM}\n${reasonLang}`,
    userText: `${who}. Calificación: ${opts.rating}/5.\nReseña:\n"""${opts.comment}"""`,
    maxTokens: 200,
    timeoutMs: 20_000,
    reasoningEffort: "minimal",
  }).catch(() => null);
  if (!res || !res.ok) {
    if (res && !res.ok) console.warn("[review moderation] sin respuesta:", res.error);
    return { verdict: "unavailable" };
  }
  if (res.data.verdict === "reject") {
    const reason = String(res.data.reason ?? "").trim().slice(0, 240);
    return {
      verdict: "reject",
      reason: reason || t("Tu reseña no cumple las reglas de la comunidad. Escríbela sin insultos ni datos personales."),
      model: res.model,
    };
  }
  if (res.data.verdict !== "approve") return { verdict: "unavailable" };
  return { verdict: "approve", model: res.model };
}
