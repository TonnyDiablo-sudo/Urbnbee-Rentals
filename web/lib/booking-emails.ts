import "server-only";
import { isPlaceholderEmail } from "@/lib/associate-provision";
import type { BookingRecord } from "@/lib/booking-types";
import { publicNameOf } from "@/lib/display-name";
import { emailLayout, emailT, escapeHtml, sendEmail, userLang } from "@/lib/email";
import { numberLocale, type Lang } from "@/lib/i18n";
import { findUserById, getListingById } from "@/lib/marketplace-store";

const APP_ORIGIN = (process.env.APP_PUBLIC_ORIGIN?.trim() || "https://app.cabibee.com").replace(/\/$/, "");

type Side = "guest" | "host";

function recipient(b: BookingRecord, side: Side): { email: string; name: string; lang: Lang } | null {
  const user = side === "guest" ? (b.guestUserId ? findUserById(b.guestUserId) : undefined) : findUserById(b.hostId);
  if (side === "host" && !user) return null;
  const valid = (e: string | undefined) => {
    const v = (e ?? "").trim();
    return v && !isPlaceholderEmail(v) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? v : "";
  };
  const email =
    side === "guest" ? valid(b.guestEmail) || (user?.placeholderEmail ? "" : valid(user?.email)) : user?.placeholderEmail ? "" : valid(user?.email);
  if (!email) return null;
  const name = (side === "guest" ? user?.fullName || b.guestName : user?.fullName) || "";
  return { email, name: name.trim(), lang: userLang(user) };
}

function fmtDay(iso: string, lang: Lang): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString(numberLocale(lang), {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

function stayOf(b: BookingRecord) {
  const listing = getListingById(b.hostAdjustedListingId ?? b.listingId);
  return {
    title: listing?.title?.trim() || "Cabibee",
    checkIn: b.hostAdjustedCheckIn ?? b.checkIn,
    checkOut: b.hostAdjustedCheckOut ?? b.checkOut,
    checkInTime: listing?.arrivalGuide?.checkInTime,
  };
}

/** Recordatorio de la reserva unos días antes de la llegada. */
export async function emailStayReminder(b: BookingRecord, side: Side): Promise<boolean> {
  const to = recipient(b, side);
  if (!to) return false;
  const t = emailT(to.lang);
  const stay = stayOf(b);
  const vars = {
    listing: escapeHtml(stay.title),
    checkIn: fmtDay(stay.checkIn, to.lang),
    checkOut: fmtDay(stay.checkOut, to.lang),
    guest: escapeHtml(b.guestName),
    host: escapeHtml(publicNameOf(findUserById(b.hostId)) || t("tu anfitrión")),
  };
  const lines =
    side === "guest"
      ? [
          t("Tu estancia en {listing} se acerca.", vars),
          t("Llegada: {checkIn}. Salida: {checkOut}.", vars),
          stay.checkInTime ? t("Hora de entrada: desde las {time}.", { time: escapeHtml(stay.checkInTime) }) : "",
          t("Tu anfitrión te mandará las instrucciones de llegada por el chat. Cualquier duda, escríbele desde la app."),
        ]
      : [
          t("{guest} llega pronto a {listing}.", vars),
          t("Llegada: {checkIn}. Salida: {checkOut}.", vars),
          t("Revisa que el lugar esté listo y que las instrucciones de llegada estén completas."),
        ];
  const paragraphs = [t("Hola {name},", { name: escapeHtml(to.name) }), ...lines.filter(Boolean)];
  const url = side === "guest" ? `${APP_ORIGIN}/viajes` : `${APP_ORIGIN}/host`;
  return sendEmail({
    mailbox: "noreply",
    to: to.email,
    subject: side === "guest" ? t("Tu reserva en {listing} se acerca", { listing: stay.title }) : t("Llegada próxima · {listing}", { listing: stay.title }),
    text: `${paragraphs.join("\n\n").replace(/<[^>]+>/g, "")}\n\n${url}`,
    html: emailLayout({
      lang: to.lang,
      title: side === "guest" ? t("Tu reserva se acerca") : t("Tienes una llegada próxima"),
      paragraphs,
      button: { href: url, label: side === "guest" ? t("Ver mi reserva") : t("Ver la reserva") },
    }),
  }).catch(() => false);
}

/** Al terminar la estancia: invita a cada lado a calificar al otro. */
export async function emailReviewReminder(b: BookingRecord, side: Side): Promise<boolean> {
  const to = recipient(b, side);
  if (!to) return false;
  const t = emailT(to.lang);
  const stay = stayOf(b);
  const vars = { listing: escapeHtml(stay.title), guest: escapeHtml(b.guestName) };
  const paragraphs = [
    t("Hola {name},", { name: escapeHtml(to.name) }),
    side === "guest"
      ? t("¿Qué tal tu estancia en {listing}? Califica al anfitrión y ayuda a otros viajeros.", vars)
      : t("Terminó la estancia de {guest} en {listing}. Califica al huésped para que otros anfitriones lo conozcan.", vars),
    t("En Cabibee las reseñas son de ida y vuelta: sólo se pueden dejar en reservas hechas con el motor de reservas, y las revisa un moderador automático."),
  ];
  const url =
    side === "guest"
      ? `${APP_ORIGIN}/viajes?resena=${encodeURIComponent(b.id)}`
      : `${APP_ORIGIN}/host/resenas?b=${encodeURIComponent(b.id)}`;
  return sendEmail({
    mailbox: "noreply",
    to: to.email,
    subject: side === "guest" ? t("¿Cómo te fue en {listing}?", { listing: stay.title }) : t("Califica a {guest}", { guest: b.guestName }),
    text: `${paragraphs.join("\n\n")}\n\n${url}`,
    html: emailLayout({
      lang: to.lang,
      title: t("Deja tu reseña"),
      paragraphs,
      button: { href: url, label: t("Dejar mi reseña") },
    }),
  }).catch(() => false);
}
