import { BookingDetailsView } from "@/components/booking/booking-details-view";
import { getBookingById } from "@/lib/bookings-store";
import { getT } from "@/lib/i18n/server";
import { getSessionUser } from "@/lib/session";
import { bookingActor } from "@/lib/team-access";
import { TopBar } from "../../../_components/top-bar";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Detalles de la reserva") };
}

export default async function AppHostBookingDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, user, t] = await Promise.all([params, getSessionUser(), getT()]);
  const b = getBookingById(id);
  const chatHref =
    user && b && b.guestUserId && bookingActor(user, b)
      ? `/host/mensajes/${encodeURIComponent(b.hostAdjustedListingId ?? b.listingId)}/${encodeURIComponent(`gu_${b.guestUserId}`)}`
      : undefined;
  return (
    <>
      <TopBar title={t("Detalles de la reserva")} back="/host/calendario" />
      <div className="px-4 pt-4 sm:px-6">
        <BookingDetailsView url={`/api/host/bookings/${encodeURIComponent(id)}/details`} chatHref={chatHref} />
      </div>
    </>
  );
}
