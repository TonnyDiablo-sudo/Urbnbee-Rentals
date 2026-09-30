import { groupThreads } from "@/lib/host-inbox-store";
import { getT } from "@/lib/i18n/server";
import { getListingById } from "@/lib/marketplace-store";
import { getSessionUser } from "@/lib/session";
import { HostChat, type HostChatInitial } from "./host-chat";

type Props = { params: Promise<{ listingId: string; guestSessionId: string }> };

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Chat") };
}

export default async function AppHostThreadPage({ params }: Props) {
  const raw = await params;
  const listingId = decodeURIComponent(raw.listingId);
  const guestSessionId = decodeURIComponent(raw.guestSessionId);
  const user = await getSessionUser();

  let initial: HostChatInitial | undefined;
  if (user && (user.role === "host" || user.role === "admin")) {
    const msgs = groupThreads(user.id).get(`${listingId}:${guestSessionId}`) ?? [];
    const firstGuest = msgs.find((m) => m.sender === "guest");
    initial = {
      guestName: firstGuest?.guestName ?? "",
      guestEmail: firstGuest?.guestEmail,
      listingTitle: getListingById(listingId)?.title ?? listingId,
      messages: msgs.map((m) => ({ id: m.id, sender: m.sender, body: m.body, createdAt: m.createdAt })),
    };
    if (msgs.length === 0) initial = undefined;
  }

  return <HostChat listingId={listingId} guestSessionId={guestSessionId} initial={initial} />;
}
