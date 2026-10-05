import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { attachmentView } from "@/lib/chat-attachments";
import { chatMediaAllowed } from "@/lib/chat-media-access";
import { emailConfirmed } from "@/lib/email-gate";
import { resolveListingDetail } from "@/lib/get-listing-detail";
import { guestSessionIdForUser, listAllThreadsForGuest, listThreadMerged } from "@/lib/host-inbox-store";
import { getT } from "@/lib/i18n/server";
import { nameForViewer, shareABooking } from "@/lib/display-name";
import { getListingById } from "@/lib/marketplace-store";
import { getSessionUser } from "@/lib/session";
import { AuthGate } from "../../_components/auth-gate";
import type { ChatMessage } from "../../_components/chat-thread";
import { TopBar } from "../../_components/top-bar";
import { GuestChat } from "./guest-chat";

type Props = { params: Promise<{ listingId: string }> };

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Chat") };
}

/** Mismo hilo que devuelve GET /api/listings/[id]/messages, para pintarlo sin esperar. */
async function initialMessages(listingId: string, userId: string): Promise<ChatMessage[]> {
  const jar = await cookies();
  let cookieSid: string | undefined;
  try {
    cookieSid = (JSON.parse(jar.get("urb_chat_sess")?.value ?? "{}") as Record<string, string>)[listingId];
  } catch {
    cookieSid = undefined;
  }
  const ids = [guestSessionIdForUser(userId), cookieSid].filter(Boolean) as string[];
  return listThreadMerged(listingId, ids).map((m) => ({
    id: m.id,
    sender: m.sender,
    body: m.body,
    createdAt: m.createdAt,
    attachment: attachmentView(m),
  }));
}

export default async function AppGuestThreadPage({ params }: Props) {
  const { listingId: raw } = await params;
  const listingId = decodeURIComponent(raw);
  const record = getListingById(listingId);
  const user = await getSessionUser();
  const t = await getT();

  if (!record?.published) {
    // Si el anuncio se pausó o se borró, la conversación sigue siendo del huésped.
    const thread = user ? listAllThreadsForGuest(user.id).find((th) => th.listingId === listingId) : undefined;
    if (!thread || !user) notFound();
    const hostId = thread.messages[0]?.hostId;
    const hostName =
      (hostId && nameForViewer(hostId, Boolean(user && shareABooking(hostId, user.id)))) || t("Anfitrión");
    return (
      <GuestChat
        listingId={listingId}
        title={hostName}
        subtitle={record?.title ?? t("Anuncio no disponible")}
        initial={await initialMessages(listingId, user.id)}
        closed
      />
    );
  }

  const detail = resolveListingDetail(listingId);
  const hostName =
    (user && nameForViewer(record.hostId, shareABooking(record.hostId, user.id))) ||
    detail?.host.name ||
    t("Anfitrión");

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

  return (
    <GuestChat
      listingId={listingId}
      title={hostName}
      subtitle={record.title}
      slug={record.slug}
      initial={await initialMessages(listingId, user.id)}
      mediaAllowed={chatMediaAllowed(user)}
      emailGate={
        emailConfirmed(user) || user.id === record.hostId
          ? undefined
          : { email: user.email, placeholder: Boolean(user.placeholderEmail) }
      }
    />
  );
}
