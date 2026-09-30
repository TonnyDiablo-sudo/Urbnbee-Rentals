import { redirect } from "next/navigation";

/** En cabibee.com /viajes no existía (la lista vive en app.cabibee.com). El Checkout volvía aquí. */
export default async function SiteViajesPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { session_id: sessionId } = await searchParams;
  if (sessionId?.startsWith("cs_")) {
    redirect(`/bookings/confirm?session_id=${encodeURIComponent(sessionId)}`);
  }
  redirect("/guest/bookings");
}
