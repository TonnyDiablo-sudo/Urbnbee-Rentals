import { notFound } from "next/navigation";
import { resolveListingDetail } from "@/lib/get-listing-detail";
import { getListingById } from "@/lib/marketplace-store";
import { getSessionUser } from "@/lib/session";
import { AuthGate } from "../../_components/auth-gate";
import { TopBar } from "../../_components/top-bar";
import { GuestChat } from "./guest-chat";

type Props = { params: Promise<{ listingId: string }> };

export const metadata = { title: "Chat" };

export default async function AppGuestThreadPage({ params }: Props) {
  const { listingId } = await params;
  const record = getListingById(listingId);
  if (!record?.published) notFound();
  const detail = resolveListingDetail(listingId);
  const user = await getSessionUser();
  const hostName = detail?.host.name ?? "Anfitrión";

  if (!user) {
    return (
      <>
        <TopBar title={record.title} back={`/app/alojamiento/${record.slug}`} />
        <AuthGate
          title={`Escríbele a ${hostName}`}
          message="Necesitas una cuenta gratuita para chatear. Así ligamos cada conversación a una persona real."
          next={`/app/mensajes/${listingId}`}
        />
      </>
    );
  }

  return <GuestChat listingId={listingId} title={hostName} subtitle={record.title} slug={record.slug} />;
}
