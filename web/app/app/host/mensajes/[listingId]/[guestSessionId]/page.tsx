import { HostChat } from "./host-chat";

type Props = { params: Promise<{ listingId: string; guestSessionId: string }> };

export const metadata = { title: "Chat" };

export default async function AppHostThreadPage({ params }: Props) {
  const { listingId, guestSessionId } = await params;
  return <HostChat listingId={decodeURIComponent(listingId)} guestSessionId={decodeURIComponent(guestSessionId)} />;
}
