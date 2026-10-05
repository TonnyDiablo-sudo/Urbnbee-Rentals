import type { ArrivalGuide } from "@/lib/arrival-guide";

/** Cómo se manda el mensaje de llegada de las reservas del motor. */
export type ArrivalMessageSettings = {
  mode: "auto" | "manual";
  /** Días antes de la llegada en que sale el mensaje automático (0 = el mismo día). */
  daysBefore: number;
  template: string;
};

export const ARRIVAL_MESSAGE_MAX = 4000;
export const ARRIVAL_DAYS_BEFORE_MAX = 14;

export const DEFAULT_ARRIVAL_TEMPLATE = `Hola {huesped}, ¡ya casi llega tu estancia en {anuncio}!

Te comparto los datos de llegada:
📍 Dirección: {direccion}
📅 Llegada: {fecha_entrada}
🕒 Puedes entrar desde las {entrada}
📅 Salida: {fecha_salida}
🕒 Sal antes de las {salida}
🔑 Cómo entrar: {metodo_entrada}
🔢 Código de acceso: {codigo}
📶 Wifi: {wifi}
🔒 Contraseña del wifi: {wifi_clave}
🧭 Cómo llegar: {indicaciones}

Cualquier duda, escríbeme por aquí.
{anfitrion}`;

/** Para la ayuda del editor: clave y qué pone. */
export const ARRIVAL_PLACEHOLDERS: { key: string; label: string }[] = [
  { key: "huesped", label: "Nombre del huésped" },
  { key: "anuncio", label: "Título del anuncio" },
  { key: "direccion", label: "Dirección exacta" },
  { key: "fecha_entrada", label: "Fecha de llegada" },
  { key: "entrada", label: "Hora de llegada" },
  { key: "fecha_salida", label: "Fecha de salida" },
  { key: "salida", label: "Hora de salida" },
  { key: "metodo_entrada", label: "Cómo entrar" },
  { key: "codigo", label: "Código de acceso" },
  { key: "wifi", label: "Nombre del wifi" },
  { key: "wifi_clave", label: "Contraseña del wifi" },
  { key: "indicaciones", label: "Cómo llegar" },
  { key: "anfitrion", label: "Tu nombre" },
];

export function defaultArrivalMessage(): ArrivalMessageSettings {
  return { mode: "manual", daysBefore: 1, template: DEFAULT_ARRIVAL_TEMPLATE };
}

/** Lo guardado o los valores por defecto. */
export function arrivalMessageOf(s: ArrivalMessageSettings | undefined): ArrivalMessageSettings {
  const d = defaultArrivalMessage();
  if (!s) return d;
  return {
    mode: s.mode === "auto" ? "auto" : "manual",
    daysBefore: Number.isFinite(s.daysBefore) ? s.daysBefore : d.daysBefore,
    template: s.template?.trim() ? s.template : d.template,
  };
}

export function sanitizeArrivalMessage(raw: unknown): ArrivalMessageSettings {
  const d = defaultArrivalMessage();
  if (!raw || typeof raw !== "object") return d;
  const o = raw as Record<string, unknown>;
  const days = Math.floor(Number(o.daysBefore));
  const template = typeof o.template === "string" ? o.template.replace(/\r\n/g, "\n").trim().slice(0, ARRIVAL_MESSAGE_MAX) : "";
  return {
    mode: o.mode === "auto" ? "auto" : "manual",
    daysBefore: Number.isFinite(days) ? Math.min(ARRIVAL_DAYS_BEFORE_MAX, Math.max(0, days)) : d.daysBefore,
    template: template || d.template,
  };
}

function longDate(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat("es-MX", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, d))
  );
}

export type ArrivalMessageVars = Record<string, string>;

export function arrivalMessageVars(input: {
  guestName: string;
  listingTitle: string;
  address: string;
  checkIn: string;
  checkOut: string;
  guide: ArrivalGuide | undefined;
  hostName: string;
}): ArrivalMessageVars {
  const g = input.guide ?? {};
  return {
    huesped: input.guestName.trim().split(/\s+/)[0] ?? "",
    anuncio: input.listingTitle.trim(),
    direccion: input.address.trim(),
    fecha_entrada: longDate(input.checkIn),
    entrada: g.checkInTime ?? "",
    fecha_salida: longDate(input.checkOut),
    salida: g.checkOutTime ?? "",
    metodo_entrada: g.checkInMethod ?? "",
    codigo: g.accessCode ?? "",
    wifi: g.wifiName ?? "",
    wifi_clave: g.wifiPassword ?? "",
    indicaciones: g.directions ?? "",
    anfitrion: input.hostName.trim(),
  };
}

const PLACEHOLDER = /\{([a-z_]+)\}/g;

/** Llena la plantilla. Si un dato está vacío, se quita la línea que lo usa. */
export function fillArrivalTemplate(template: string, vars: ArrivalMessageVars): string {
  const lines: string[] = [];
  for (const line of template.split("\n")) {
    let missing = false;
    const out = line.replace(PLACEHOLDER, (whole, key: string) => {
      if (!(key in vars)) return whole;
      const v = vars[key]?.trim() ?? "";
      if (!v) missing = true;
      return v;
    });
    if (!missing) lines.push(out);
  }
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
