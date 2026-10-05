import type { NotificationKind } from "@/lib/notifications-store";

/** Grupos de avisos que cada persona puede apagar o prender en su centro de alarmas. */
export const ALARM_CATEGORIES = [
  { id: "messages", label: "Mensajes de huéspedes", hint: "Cuando un huésped te escribe en un anuncio." },
  { id: "bookings", label: "Solicitudes y reservas", hint: "Solicitudes nuevas, reservas aceptadas, canceladas o vencidas." },
  { id: "payments", label: "Pagos", hint: "Pagos recibidos, rechazados, reembolsos y depósitos." },
  { id: "contracts", label: "Contratos", hint: "Contratos por firmar y firmas de la otra parte." },
  { id: "reviews", label: "Reseñas", hint: "Reseñas nuevas y reseñas por escribir." },
  { id: "listings", label: "Anuncios y verificación", hint: "Recordatorios de dirección, identidad y estado de tus anuncios." },
  { id: "team", label: "Colaboradores y chats del equipo", hint: "Invitaciones, cambios de roles y mensajes en los chats del equipo." },
  { id: "cleaning", label: "Limpiezas", hint: "Limpiezas nuevas, asignadas, terminadas y asistencia." },
  { id: "supplies", label: "Insumos", hint: "Alarma cuando un insumo llega a su mínimo. También llega por correo." },
  { id: "support", label: "Soporte y reportes", hint: "Respuestas a tus reportes y sugerencias." },
] as const;

export type AlarmCategory = (typeof ALARM_CATEGORIES)[number]["id"];

export const ALARM_CATEGORY_IDS = ALARM_CATEGORIES.map((c) => c.id) as AlarmCategory[];

const BY_KIND: Record<NotificationKind, AlarmCategory> = {
  message: "messages",
  request: "bookings",
  booking: "bookings",
  payment: "payments",
  contract: "contracts",
  review: "reviews",
  verification: "listings",
  team: "team",
  cleaning: "cleaning",
  support: "support",
};

export function alarmCategoryOf(kind: NotificationKind, tag?: string): AlarmCategory {
  if (tag?.startsWith("supply:")) return "supplies";
  return BY_KIND[kind] ?? "support";
}
