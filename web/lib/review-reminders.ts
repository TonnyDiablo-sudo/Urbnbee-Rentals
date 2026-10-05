import "server-only";
import { applyBookingLifecycle } from "@/lib/booking-deposit";
import { emailReviewReminder, emailStayReminder } from "@/lib/booking-emails";
import { listAllBookings, patchBookingRecord } from "@/lib/bookings-store";
import { pricingToday } from "@/lib/listing-pricing";
import { notifyGuestReviewReminder, notifyHostReviewReminder } from "@/lib/push";
import { reviewsForBooking, stayReviewEligible } from "@/lib/stay-reviews";

/** Estancias más viejas no reciben recordatorio (evita avisar de golpe por todo el historial). */
const WINDOW_MS = 14 * 24 * 60 * 60 * 1000;
/** El correo de «tu reserva se acerca» sale cuando faltan estos días o menos. */
const STAY_REMINDER_DAYS = 2;

/** Al terminar una estancia, avisa a cada lado que puede dejar su reseña (app y correo). */
export function sendReviewReminders(now = Date.now()): number {
  let sent = 0;
  for (const raw of listAllBookings()) {
    const b = applyBookingLifecycle(raw);
    if (!stayReviewEligible(b)) continue;
    const checkout = Date.parse(`${b.hostAdjustedCheckOut ?? b.checkOut}T12:00:00.000Z`);
    if (!Number.isFinite(checkout) || now - checkout > WINDOW_MS) continue;
    const reviews = reviewsForBooking(b.id);
    const at = new Date(now).toISOString();
    const patch: { reviewReminderGuestAt?: string; reviewReminderHostAt?: string } = {};
    if (b.guestUserId && !b.reviewReminderGuestAt && !reviews.guestToListing) {
      notifyGuestReviewReminder(b);
      void emailReviewReminder(b, "guest");
      patch.reviewReminderGuestAt = at;
      sent++;
    }
    if (!b.reviewReminderHostAt && !reviews.hostToGuest) {
      notifyHostReviewReminder(b);
      void emailReviewReminder(b, "host");
      patch.reviewReminderHostAt = at;
      sent++;
    }
    if (patch.reviewReminderGuestAt || patch.reviewReminderHostAt) patchBookingRecord(b.id, patch);
  }
  return sent;
}

function daysUntil(fromIso: string, toIso: string): number {
  const [y1, m1, d1] = fromIso.split("-").map(Number);
  const [y2, m2, d2] = toIso.split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000);
}

/** Correo a huésped y anfitrión cuando la llegada de una reserva confirmada está cerca. */
export function sendStayReminders(today = pricingToday()): number {
  let sent = 0;
  for (const raw of listAllBookings()) {
    if (raw.status !== "CONFIRMED") continue;
    if (raw.stayReminderGuestAt && raw.stayReminderHostAt) continue;
    const left = daysUntil(today, raw.hostAdjustedCheckIn ?? raw.checkIn);
    if (!Number.isFinite(left) || left < 0 || left > STAY_REMINDER_DAYS) continue;
    const at = new Date().toISOString();
    const patch: { stayReminderGuestAt?: string; stayReminderHostAt?: string } = {};
    if (!raw.stayReminderGuestAt) {
      void emailStayReminder(raw, "guest");
      patch.stayReminderGuestAt = at;
      sent++;
    }
    if (!raw.stayReminderHostAt) {
      void emailStayReminder(raw, "host");
      patch.stayReminderHostAt = at;
      sent++;
    }
    patchBookingRecord(raw.id, patch);
  }
  return sent;
}

let started = false;
export function startReviewReminderWorker() {
  if (started) return;
  started = true;
  const tick = () => {
    try {
      sendStayReminders();
      sendReviewReminders();
    } catch (e) {
      console.warn("[review reminders]", e);
    }
  };
  setTimeout(tick, 45_000);
  setInterval(tick, 30 * 60 * 1000);
}
