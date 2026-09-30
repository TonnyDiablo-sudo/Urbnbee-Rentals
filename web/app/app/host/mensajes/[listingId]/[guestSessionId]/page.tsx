import { getT } from "@/lib/i18n/server";
import { HostChat } from "./host-chat";

type Props = { params: Promise<{ listingId: string; guestSessionId: string }> };

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Chat") };
}

export default async function AppHostThreadPage({ params }: Props) {
  const { listingId, guestSessionId } = await params;
  return <HostChat listingId={decodeURIComponent(listingId)} guestSessionId={decodeURIComponent(guestSessionId)} />;
}
