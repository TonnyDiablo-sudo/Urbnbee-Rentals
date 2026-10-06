import { BookingDetailsView } from "@/components/booking/booking-details-view";
import { bookingRoleFor } from "@/lib/booking-details";
import { getBookingById } from "@/lib/bookings-store";
import { getT } from "@/lib/i18n/server";
import { getSessionUser } from "@/lib/session";
import { AuthGate } from "../../_components/auth-gate";
import { TopBar } from "../../_components/top-bar";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Detalles de la reserva") };
}

export default async function AppTripDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, user, t] = await Promise.all([params, getSessionUser(), getT()]);
  if (!user) {
    return <AuthGate title="Tus reservas, en un solo lugar" message="Entra para ver los detalles de tu reserva." next={`/viajes/${id}`} />;
  }
  const b = getBookingById(id);
  const live = b && bookingRoleFor(user.id, b) && !["CANCELLED", "EXPIRED", "REJECTED"].includes(b.status);
  const chatHref = live ? `/mensajes/${encodeURIComponent(b.hostAdjustedListingId ?? b.listingId)}` : undefined;
  return (
    <>
      <TopBar title={t("Detalles de la reserva")} back="/viajes" />
      <div className="px-4 pt-4 sm:px-6">
        <BookingDetailsView url={`/api/guest/bookings/${encodeURIComponent(id)}`} chatHref={chatHref} />
      </div>
    </>
  );
}
