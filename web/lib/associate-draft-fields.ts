import { isFacebookUrl } from "@/lib/associate-link-utils";

/** Campos del borrador que la revisión con IA puede rellenar. `contact.*` son los del contacto. */
export const DRAFT_FILLABLE_FIELDS = [
  "title",
  "description",
  "categoryKey",
  "spaceType",
  "city",
  "zone",
  "county",
  "state",
  "addressApprox",
  "guests",
  "bedrooms",
  "bathrooms",
  "pricePerNight",
  "cleaningFee",
  "amenities",
  "contact.hostName",
  "contact.phone",
  "contact.whatsapp",
  "contact.email",
  "contact.profileUrl",
] as const;

export type DraftFillableField = (typeof DRAFT_FILLABLE_FIELDS)[number];

export function isDraftFillableField(v: unknown): v is DraftFillableField {
  return typeof v === "string" && (DRAFT_FILLABLE_FIELDS as readonly string[]).includes(v);
}

/** Nombre en pantalla de cada campo (clave de traducción). */
export const DRAFT_FIELD_LABEL: Record<DraftFillableField, string> = {
  title: "Título",
  description: "Descripción",
  categoryKey: "Tipo",
  spaceType: "Espacio",
  city: "Ciudad",
  zone: "Colonia / zona",
  county: "Municipio",
  state: "Estado / provincia",
  addressApprox: "Ubicación aproximada",
  guests: "Huéspedes",
  bedrooms: "Recámaras",
  bathrooms: "Baños",
  pricePerNight: "Precio por noche (MXN)",
  cleaningFee: "Limpieza (MXN)",
  amenities: "Amenidades",
  "contact.hostName": "Nombre del anfitrión",
  "contact.phone": "Teléfono",
  "contact.whatsapp": "WhatsApp",
  "contact.email": "Correo de contacto",
  "contact.profileUrl": "Anuncio de Facebook del dueño",
};

export type DraftContactLike = {
  phone?: string;
  whatsapp?: string;
  email?: string;
  profileUrl?: string;
};

/** Sin una forma de contactar al dueño la cuenta no sirve: teléfono, WhatsApp, correo o su Facebook. */
export function draftHasContact(c: DraftContactLike): boolean {
  return Boolean(c.phone?.trim() || c.whatsapp?.trim() || c.email?.trim() || cleanProfileUrl(c.profileUrl));
}

/** Sólo Facebook o Messenger: se publica en «Contactar» y un link a Trovit u otro portal no es un contacto. */
export function cleanProfileUrl(raw: string | undefined): string | undefined {
  const t = (raw ?? "").trim();
  if (!t) return undefined;
  try {
    const u = new URL(/^https?:\/\//i.test(t) ? t : `https://${t}`);
    if (u.protocol !== "https:" && u.protocol !== "http:") return undefined;
    if (!isFacebookUrl(u.toString())) return undefined;
    u.protocol = "https:";
    return u.toString().slice(0, 500);
  } catch {
    return undefined;
  }
}
