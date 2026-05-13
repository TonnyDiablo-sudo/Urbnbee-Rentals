import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { FinishBookingClient } from "./finish-booking-client";

type Props = { params: Promise<{ token: string }> };

export default async function FinishBookingPage({ params }: Props) {
  const { token: raw } = await params;
  const token = raw.replace(/\D/g, "").slice(0, 6);

  return (
    <>
      <SiteHeader />
      <div style={{ paddingTop: 72 }}>
        <FinishBookingClient token={token.length === 6 ? token : ""} />
      </div>
      <SiteFooter />
    </>
  );
}
