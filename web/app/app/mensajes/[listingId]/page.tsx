import { notFound } from "next/navigation";
import { resolveListingDetail } from "@/lib/get-listing-detail";
import { getT } from "@/lib/i18n/server";
import { getListingById } from "@/lib/marketplace-store";
import { getSessionUser } from "@/lib/session";
import { AuthGate } from "../../_components/auth-gate";
import { TopBar } from "../../_components/top-bar";
import { GuestChat } from "./guest-chat";

type Props = { params: Promise<{ listingId: string }> };

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Chat") };
}

export default async function AppGuestThreadPage({ params }: Props) {
  const { listingId } = await params;
  const record = getListingById(listingId);
  if (!record?.published) notFound();
  const detail = resolveListingDetail(listingId);
  const user = await getSessionUser();
  const t = await getT();
  const hostName = detail?.host.name ?? t("Anfitrión");

  if (!user) {
    return (
      <>
        <TopBar title={record.title} back={`/alojamiento/${record.slug}`} />
        <AuthGate
          title={t("Escríbele a {name}", { name: hostName })}
          message="Necesitas una cuenta gratuita para chatear. Así ligamos cada conversación a una persona real."
          next={`/mensajes/${listingId}`}
        />
      </>
    );
  }

  return <GuestChat listingId={listingId} title={hostName} subtitle={record.title} slug={record.slug} />;
}
