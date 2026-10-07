import { attachmentView } from "@/lib/chat-attachments";
import { getChatAi } from "@/lib/chat-ai-settings";
import { chatMediaAllowed } from "@/lib/chat-media-access";
import { threadBooking } from "@/lib/chat-thread-booking";
import { emailConfirmed } from "@/lib/email-gate";
import { nameForViewer, shareABooking } from "@/lib/display-name";
import { groupThreads } from "@/lib/host-inbox-store";
import { getT } from "@/lib/i18n/server";
import { getListingById } from "@/lib/marketplace-store";
import { getSessionUser } from "@/lib/session";
import { memberCan } from "@/lib/team-access";
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
  const listing = getListingById(listingId);
  const canSee = Boolean(listing && user && (listing.hostId === user.id || memberCan(user.id, listing.hostId, "messages", listing.id)));
  const ai = canSee && listing ? getChatAi(listing.hostId, listingId, guestSessionId) : { available: false, enabled: false };
  if (user && (user.role === "host" || user.role === "admin")) {
    const msgs = groupThreads(user.id).get(`${listingId}:${guestSessionId}`) ?? [];
    const firstGuest = msgs.find((m) => m.sender === "guest");
    const guestUserId = guestSessionId.startsWith("gu_") ? guestSessionId.slice(3) : "";
    initial = {
      guestName:
        (guestUserId && nameForViewer(guestUserId, shareABooking(user.id, guestUserId))) ||
        firstGuest?.guestName ||
        "",
      guestEmail: firstGuest?.guestEmail,
      listingTitle: listing?.title ?? listingId,
      booking: threadBooking(user.id, listingId, guestSessionId, firstGuest?.guestEmail),
      messages: msgs.map((m) => ({ id: m.id, sender: m.sender, body: m.body, createdAt: m.createdAt, attachment: attachmentView(m), via: m.via })),
    };
    if (msgs.length === 0) initial = undefined;
  }

  return (
    <HostChat
      listingId={listingId}
      guestSessionId={guestSessionId}
      initial={initial}
      initialAi={{ available: ai.available, enabled: ai.enabled }}
      mediaAllowed={Boolean(user && chatMediaAllowed(user, { as: "host", listingHostId: listing?.hostId }))}
      emailGate={user && !emailConfirmed(user) ? { email: user.email, placeholder: Boolean(user.placeholderEmail) } : undefined}
    />
  );
}
