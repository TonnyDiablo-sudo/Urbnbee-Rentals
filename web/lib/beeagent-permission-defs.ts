/** Lo que el anfitrión deja hacer al agente de urbnbeeai. Las claves son las mismas en la API de socio. */
export type BotPermission =
  | "listings"
  | "messages"
  | "booking_links"
  | "bookings_view"
  | "bookings_decide"
  | "contracts_sign"
  | "cleanings_view"
  | "cleanings_manage";

export type BotPermissions = Record<BotPermission, boolean>;

export const BOT_PERMISSION_DEFS: {
  key: BotPermission;
  label: string;
  hint: string;
  /** Sin esto el agente no sirve, así que no se puede apagar. */
  locked?: boolean;
  /** Permiso que se prende solo al prender este. */
  needs?: BotPermission;
}[] = [
  {
    key: "listings",
    label: "Ver tus anuncios, fechas y precios",
    hint: "Para contestar dudas y cotizar. Siempre activo.",
    locked: true,
  },
  {
    key: "messages",
    label: "Contestar el chat de tus huéspedes",
    hint: "Lee y contesta los mensajes de tus anuncios. Puedes apagar la IA en cada conversación.",
  },
  {
    key: "booking_links",
    label: "Mandar ligas para reservar",
    hint: "El huésped reserva y paga él mismo en Cabibee.",
  },
  {
    key: "bookings_view",
    label: "Ver tus reservas",
    hint: "Fechas, estado del pago y del contrato, y el primer nombre del huésped.",
  },
  {
    key: "bookings_decide",
    label: "Aceptar o rechazar solicitudes de reserva",
    hint: "Si rechaza una solicitud pagada, se le devuelve el dinero al huésped.",
    needs: "bookings_view",
  },
  {
    key: "contracts_sign",
    label: "Firmar contratos en tu nombre",
    hint: "Firma con el nombre legal de tu contrato. Sin esto, sólo acepta reservas de anuncios que ya firmaste por adelantado.",
    needs: "bookings_view",
  },
  {
    key: "cleanings_view",
    label: "Ver tus limpiezas",
    hint: "Fechas, quién limpia y si ya quedó.",
  },
  {
    key: "cleanings_manage",
    label: "Organizar limpiezas",
    hint: "Asignar a tu equipo, agregar, marcar como hechas o cancelar.",
    needs: "cleanings_view",
  },
];

export const BOT_PERMISSION_KEYS: BotPermission[] = BOT_PERMISSION_DEFS.map((d) => d.key);

/** Lo que se marca al conectar y lo que tienen los vínculos de antes de que existieran los permisos. */
export const DEFAULT_BOT_PERMISSIONS: BotPermissions = {
  listings: true,
  messages: true,
  booking_links: true,
  bookings_view: true,
  bookings_decide: false,
  contracts_sign: false,
  cleanings_view: true,
  cleanings_manage: false,
};

export function sanitizeBotPermissions(raw: unknown, base: BotPermissions = DEFAULT_BOT_PERMISSIONS): BotPermissions {
  const src = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const out = { ...base };
  for (const k of BOT_PERMISSION_KEYS) {
    if (typeof src[k] === "boolean") out[k] = src[k] as boolean;
  }
  for (const d of BOT_PERMISSION_DEFS) {
    if (d.locked) out[d.key] = true;
    if (d.needs && out[d.key]) out[d.needs] = true;
  }
  return out;
}
