import Link from "next/link";
import { BookingDetailsView } from "@/components/booking/booking-details-view";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Detalles de la reserva") };
}

export default async function GuestBookingDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, t] = await Promise.all([params, getT()]);
  return (
    <div>
      <Link href="/guest/bookings" className="mb-4 inline-block text-sm font-medium text-[#717171] underline">
        ← {t("Mis reservas")}
      </Link>
      <h1 className="mb-4 text-2xl font-bold text-[#222]">{t("Detalles de la reserva")}</h1>
      <BookingDetailsView url={`/api/guest/bookings/${encodeURIComponent(id)}`} chatHref="/guest/messages" />
    </div>
  );
}
