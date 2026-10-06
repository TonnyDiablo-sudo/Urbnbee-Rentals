import type { ChatAttachment } from "@/lib/host-inbox-types";

/** Un mensaje de la estancia: texto con datos de la reserva y, si quiere, fotos o audios. */
export type StayMessageRule = {
  id: string;
  enabled: boolean;
  /** auto: sale solo; manual: el anfitrión lo manda desde la reservación. */
  mode: "auto" | "manual";
  text: string;
  attachments: ChatAttachment[];
};

export type StayMidRule = StayMessageRule & {
  /** Cada cuántos días de estancia se repite (desde la llegada). */
  everyDays: number;
};

export type StayCheckoutRule = StayMessageRule & {
  /** 0 = el día de salida, 1 = un día antes. */
  daysBefore: 0 | 1;
};

export type StayMessagesSettings = {
  welcome: StayMessageRule;
  mid: StayMidRule[];
  checkout: StayCheckoutRule;
};

export type StayMessageKind = "welcome" | "mid" | "checkout";

export const STAY_MESSAGE_MAX = 2000;
export const STAY_MESSAGE_MAX_IMAGES = 4;
export const STAY_MESSAGE_MAX_AUDIOS = 4;
export const STAY_MID_MAX = 5;
export const STAY_MID_EVERY_MAX = 30;
/** Los automáticos no salen de madrugada (hora de la Ciudad de México). */
export const STAY_AUTO_FROM_HOUR = 9;

export type StayTemplate = { name: string; text: string };

/** Plantillas listas para cada mensaje: el anfitrión elige una y la ajusta. */
export const STAY_TEMPLATES: Record<StayMessageKind, StayTemplate[]> = {
  welcome: [
    {
      name: "Cálida",
      text: `¡Hola {huesped}! Bienvenido a {anuncio} 🏡

Qué gusto tenerte aquí. Espero que el viaje haya estado tranquilo.

📶 Wifi: {wifi}
🔒 Contraseña: {wifi_clave}

Ponte cómodo y siéntete en casa. Si algo no está como esperabas o te hace falta cualquier cosa, escríbeme por aquí y lo resolvemos.

{anfitrion}`,
    },
    {
      name: "Breve",
      text: `¡Bienvenido, {huesped}! Ya estás en {anuncio}.

📶 {wifi} · 🔒 {wifi_clave}

Cualquier cosa, aquí estoy.
{anfitrion}`,
    },
    {
      name: "Con reglas de la casa",
      text: `Hola {huesped}, ¡bienvenido a {anuncio}!

Para que tu estancia sea perfecta, te dejo lo más importante:
📶 Wifi: {wifi} — contraseña {wifi_clave}
🕒 Salida: {fecha_salida} antes de las {salida}
🏠 {reglas}

Si tienes alguna duda sobre la casa, pregúntame cuando quieras.
{anfitrion}`,
    },
    {
      name: "Recomendaciones de la zona",
      text: `¡Hola {huesped}! Bienvenido a {anuncio} 😊

Ya con el wifi ({wifi} / {wifi_clave}) puedes descansar un poco. Cuando quieras salir, pídeme recomendaciones: te paso mis lugares favoritos para comer, tomar un café o pasear cerca.

Estoy al pendiente por este chat.
{anfitrion}`,
    },
    {
      name: "Viaje de trabajo",
      text: `Hola {huesped}, bienvenido a {anuncio}.

Todo listo para que trabajes y descanses:
📶 Wifi: {wifi}
🔒 Contraseña: {wifi_clave}

Si necesitas factura, un escritorio extra o algo para tu estancia, avísame por aquí.
{anfitrion}`,
    },
  ],
  mid: [
    {
      name: "¿Todo bien?",
      text: `Hola {huesped}, ¿cómo va todo en {anuncio}?

Sólo quería saber si estás cómodo y si te hace falta algo. Estamos para servirte.
{anfitrion}`,
    },
    {
      name: "Cambio de blancos",
      text: `Hola {huesped} 👋 ¿Cómo va tu estancia?

Si quieres toallas o sábanas limpias, o que pasemos a hacer limpieza, dime qué día te queda mejor y lo agendamos.
{anfitrion}`,
    },
    {
      name: "Estancia larga",
      text: `Hola {huesped}, ¡ya llevas unos días en {anuncio}!

¿Todo funciona bien? Si algo se descompuso, se acabó algo de la casa o necesitas cualquier cosa para que tu estancia siga siendo cómoda, escríbeme y lo resolvemos rápido.
{anfitrion}`,
    },
    {
      name: "Breve",
      text: `Hola {huesped}, ¿todo bien en {anuncio}? Si necesitas algo, aquí estoy.
{anfitrion}`,
    },
    {
      name: "Recomendaciones",
      text: `Hola {huesped}, ¿cómo la estás pasando?

Si quieres ideas para esta semana (restaurantes, paseos, mercados), con gusto te paso mis favoritos. Y si te falta algo en la casa, sólo dime.
{anfitrion}`,
    },
  ],
  checkout: [
    {
      name: "Recordatorio amable",
      text: `Hola {huesped}, gracias por quedarte en {anuncio} 🙏

Te recuerdo que la salida es el {fecha_salida} antes de las {salida}.
{instrucciones_salida}

¡Buen viaje! Si te gustó la estancia, tu reseña nos ayuda muchísimo.
{anfitrion}`,
    },
    {
      name: "Instrucciones de salida",
      text: `Hola {huesped}, mañana es tu salida de {anuncio}.

Antes de irte, por favor:
✅ Sal antes de las {salida}
✅ {instrucciones_salida}
✅ Revisa que no se te olvide nada

Gracias por cuidar la casa.
{anfitrion}`,
    },
    {
      name: "Breve",
      text: `Hola {huesped}, la salida es el {fecha_salida} a las {salida}. ¡Gracias por tu visita y buen viaje!
{anfitrion}`,
    },
    {
      name: "Pedir reseña",
      text: `Hola {huesped}, fue un gusto recibirte en {anuncio}.

La salida es el {fecha_salida} antes de las {salida}. Si todo estuvo bien, me ayudaría mucho que dejaras una reseña; y si algo pudo ser mejor, dímelo por aquí para mejorarlo.

¡Esperamos verte pronto!
{anfitrion}`,
    },
    {
      name: "¿Necesitas más tiempo?",
      text: `Hola {huesped}, se acerca tu salida de {anuncio} ({fecha_salida}, {salida}).

Si necesitas salir un poco más tarde o quieres quedarte más noches, avísame y reviso si se puede.
{anfitrion}`,
    },
  ],
};

export const DEFAULT_WELCOME_TEXT = STAY_TEMPLATES.welcome[0].text;
export const DEFAULT_MID_TEXT = STAY_TEMPLATES.mid[0].text;
export const DEFAULT_CHECKOUT_TEXT = STAY_TEMPLATES.checkout[0].text;

export const STAY_KIND_LABEL: Record<StayMessageKind, string> = {
  welcome: "Mensaje de bienvenida",
  mid: "Mensaje durante la estancia",
  checkout: "Mensaje de salida",
};

function rid(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function newMidRule(): StayMidRule {
  return { id: rid(), enabled: true, mode: "auto", text: DEFAULT_MID_TEXT, attachments: [], everyDays: 3 };
}

export function defaultStayMessages(): StayMessagesSettings {
  return {
    welcome: { id: "welcome", enabled: true, mode: "manual", text: DEFAULT_WELCOME_TEXT, attachments: [] },
    mid: [{ id: "mid1", enabled: true, mode: "manual", text: DEFAULT_MID_TEXT, attachments: [], everyDays: 2 }],
    checkout: { id: "checkout", enabled: true, mode: "manual", text: DEFAULT_CHECKOUT_TEXT, attachments: [], daysBefore: 0 },
  };
}

const FILE = /^[a-f0-9]{24}\.(webp|webm|ogg|m4a|aac|mp3|wav)$/;

/** Fotos y audios ya subidos de una plantilla (estancia o llegada). */
export function cleanMessageAttachments(raw: unknown): ChatAttachment[] {
  if (!Array.isArray(raw)) return [];
  const out: ChatAttachment[] = [];
  for (const a of raw) {
    if (!a || typeof a !== "object") continue;
    const o = a as Record<string, unknown>;
    const file = String(o.file ?? "");
    if (!FILE.test(file) || out.some((x) => x.file === file)) continue;
    const image = file.endsWith(".webp");
    const num = (v: unknown) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.round(Number(v)) : undefined);
    out.push({
      file,
      kind: image ? "image" : "audio",
      mime: image ? "image/webp" : String(o.mime ?? "audio/webm").slice(0, 40),
      bytes: num(o.bytes) ?? 0,
      width: image ? num(o.width) : undefined,
      height: image ? num(o.height) : undefined,
      durationSec: image ? undefined : num(o.durationSec),
    });
  }
  const images = out.filter((a) => a.kind === "image").slice(0, STAY_MESSAGE_MAX_IMAGES);
  const audios = out.filter((a) => a.kind === "audio").slice(0, STAY_MESSAGE_MAX_AUDIOS);
  return out.filter((a) => images.includes(a) || audios.includes(a));
}

function cleanRule(raw: unknown, fallback: StayMessageRule): StayMessageRule {
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const text = typeof o.text === "string" ? o.text.replace(/\r\n/g, "\n").trim().slice(0, STAY_MESSAGE_MAX) : "";
  return {
    id: typeof o.id === "string" && /^[a-z0-9]{1,16}$/.test(o.id) ? o.id : fallback.id,
    enabled: o.enabled === true,
    mode: o.mode === "manual" ? "manual" : "auto",
    text: text || fallback.text,
    attachments: cleanMessageAttachments(o.attachments),
  };
}

export function sanitizeStayMessages(raw: unknown): StayMessagesSettings {
  const d = defaultStayMessages();
  const o = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const welcome = { ...cleanRule(o.welcome, d.welcome), id: "welcome" };
  const co = o.checkout && typeof o.checkout === "object" ? (o.checkout as Record<string, unknown>) : {};
  const checkout: StayCheckoutRule = { ...cleanRule(o.checkout, d.checkout), id: "checkout", daysBefore: Number(co.daysBefore) === 1 ? 1 : 0 };
  const seen = new Set<string>();
  const mid: StayMidRule[] = [];
  for (const m of Array.isArray(o.mid) ? o.mid : []) {
    const base = cleanRule(m, newMidRule());
    if (seen.has(base.id)) base.id = rid();
    seen.add(base.id);
    const every = Math.floor(Number((m as Record<string, unknown>)?.everyDays));
    mid.push({ ...base, everyDays: Number.isFinite(every) ? Math.min(STAY_MID_EVERY_MAX, Math.max(1, every)) : 3 });
    if (mid.length >= STAY_MID_MAX) break;
  }
  return { welcome, mid, checkout };
}

/** Lo guardado (ya validado al guardar) o los valores por defecto. */
export function stayMessagesOf(s: StayMessagesSettings | undefined): StayMessagesSettings {
  if (!s) return defaultStayMessages();
  const d = defaultStayMessages();
  return {
    welcome: s.welcome ?? d.welcome,
    mid: Array.isArray(s.mid) ? s.mid : d.mid,
    checkout: s.checkout ?? d.checkout,
  };
}

export function stayDayDiff(fromIso: string, toIso: string): number {
  const [y1, m1, d1] = fromIso.slice(0, 10).split("-").map(Number);
  const [y2, m2, d2] = toIso.slice(0, 10).split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}

/** `mid:<id>` → la regla; `welcome` y `checkout` tal cual. */
export function stayRuleByKey(s: StayMessagesSettings, key: string): { kind: StayMessageKind; rule: StayMessageRule } | null {
  if (key === "welcome") return { kind: "welcome", rule: s.welcome };
  if (key === "checkout") return { kind: "checkout", rule: s.checkout };
  if (key.startsWith("mid:")) {
    const rule = s.mid.find((m) => m.id === key.slice(4));
    return rule ? { kind: "mid", rule } : null;
  }
  return null;
}

/**
 * Los automáticos que tocan hoy. `sendKey` distingue cada repetición del de media estancia
 * (`mid:<id>:<n>`) para no mandarla dos veces.
 */
export function dueStayMessages(
  s: StayMessagesSettings,
  checkIn: string,
  checkOut: string,
  today: string
): { ruleKey: string; sendKey: string }[] {
  const nights = stayDayDiff(checkIn, checkOut);
  const d = stayDayDiff(checkIn, today);
  if (!Number.isFinite(nights) || !Number.isFinite(d) || nights < 1 || d < 0 || d > nights) return [];
  const due: { ruleKey: string; sendKey: string }[] = [];
  const auto = (r: StayMessageRule) => r.enabled && r.mode === "auto";
  if (auto(s.welcome) && d === 0) due.push({ ruleKey: "welcome", sendKey: "welcome" });
  for (const m of s.mid) {
    if (!auto(m) || d < m.everyDays || d >= nights) continue;
    const n = Math.floor(d / m.everyDays);
    due.push({ ruleKey: `mid:${m.id}`, sendKey: `mid:${m.id}:${n}` });
  }
  if (auto(s.checkout) && d === Math.max(0, nights - s.checkout.daysBefore)) {
    due.push({ ruleKey: "checkout", sendKey: "checkout" });
  }
  return due;
}
