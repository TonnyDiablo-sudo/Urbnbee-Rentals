import Link from "next/link";
import { BookingDetailsView } from "@/components/booking/booking-details-view";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Detalles de la reserva") };
}

export default async function HostBookingDetailsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ vista?: string }>;
}) {
  const [{ id }, sp, t] = await Promise.all([params, searchParams, getT()]);
  const receipt = sp.vista === "recibo";
  return (
    <div>
      <Link href="/host/requests" className="mb-4 inline-block text-sm font-medium text-[#717171] underline">
        ← {t("Reservas")}
      </Link>
      <h1 className="mb-4 text-2xl font-bold text-[#222]">{receipt ? t("Recibo y contrato") : t("Detalles de la reserva")}</h1>
      <BookingDetailsView
        url={`/api/host/bookings/${encodeURIComponent(id)}/details`}
        chatHref="/host/messages"
        view={receipt ? "receipt" : "full"}
      />
    </div>
  );
}
