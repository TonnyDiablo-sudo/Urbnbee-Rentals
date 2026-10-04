/** Una pregunta que los huéspedes hacen seguido, con la respuesta del anfitrión. La lee su agente de IA. */
export type AgentFaqItem = { q: string; a: string };

export const AGENT_FAQ_MAX = 40;
export const AGENT_FAQ_Q_MAX = 200;
export const AGENT_FAQ_A_MAX = 1500;
export const AGENT_NOTES_MAX = 4000;

/** Preguntas que casi todos los huéspedes hacen; se ofrecen como atajo al anfitrión. */
export const AGENT_FAQ_SUGGESTIONS = [
  "¿Hay estacionamiento?",
  "¿Puedo llegar antes o salir más tarde?",
  "¿Dónde está la tienda o el súper más cercano?",
  "¿Cómo llego desde el aeropuerto?",
  "¿Hay agua caliente todo el día?",
  "¿Dónde dejo la basura?",
  "¿Puedo dejar mis maletas antes de la llegada?",
  "¿Hay lavadora o servicio de lavandería?",
];

export function sanitizeAgentFaq(raw: unknown): AgentFaqItem[] {
  if (!Array.isArray(raw)) return [];
  const out: AgentFaqItem[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const q = typeof o.q === "string" ? o.q.trim().slice(0, AGENT_FAQ_Q_MAX) : "";
    const a = typeof o.a === "string" ? o.a.trim().slice(0, AGENT_FAQ_A_MAX) : "";
    if (q && a) out.push({ q, a });
    if (out.length >= AGENT_FAQ_MAX) break;
  }
  return out;
}

export function sanitizeAgentNotes(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().slice(0, AGENT_NOTES_MAX) : "";
}
