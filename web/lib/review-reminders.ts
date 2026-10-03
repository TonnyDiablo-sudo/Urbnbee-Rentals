import "server-only";
import { applyBookingLifecycle } from "@/lib/booking-deposit";
import { listAllBookings, patchBookingRecord } from "@/lib/bookings-store";
import { notifyGuestReviewReminder, notifyHostReviewReminder } from "@/lib/push";
import { reviewsForBooking, stayReviewEligible } from "@/lib/stay-reviews";

/** Estancias más viejas no reciben recordatorio (evita avisar de golpe por todo el historial). */
const WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

/** Al terminar una estancia, avisa a cada lado que puede dejar su reseña. */
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
      patch.reviewReminderGuestAt = at;
      sent++;
    }
    if (!b.reviewReminderHostAt && !reviews.hostToGuest) {
      notifyHostReviewReminder(b);
      patch.reviewReminderHostAt = at;
      sent++;
    }
    if (patch.reviewReminderGuestAt || patch.reviewReminderHostAt) patchBookingRecord(b.id, patch);
  }
  return sent;
}

let started = false;
export function startReviewReminderWorker() {
  if (started) return;
  started = true;
  const tick = () => {
    try {
      sendReviewReminders();
    } catch (e) {
      console.warn("[review reminders]", e);
    }
  };
  setTimeout(tick, 45_000);
  setInterval(tick, 30 * 60 * 1000);
}
