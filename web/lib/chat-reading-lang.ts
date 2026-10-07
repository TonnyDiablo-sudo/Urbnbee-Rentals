import "server-only";
import { chatTranslatorAllowed } from "@/lib/chat-media-access";
import { findUserById } from "@/lib/marketplace-store";
import type { Lang } from "@/lib/i18n";

/**
 * Idioma al que se traduce lo que le escriben a esta persona en el chat: el que puso en su perfil o,
 * si no, el idioma con que usa el sitio. El traductor es sólo de la membresía de identidad verificada:
 * sin ella regresa `null` y los mensajes se muestran tal cual.
 */
export function chatReadingLang(
  user: { id: string; role?: string } | null | undefined,
  uiLang: Lang,
  ctx?: { as?: "guest" | "host"; listingHostId?: string }
): string | null {
  if (!user || !chatTranslatorAllowed(user, ctx)) return null;
  return findUserById(user.id)?.chatLang || uiLang;
}

/** Idioma preferido de la otra persona del chat (para traducirle lo que se le manda), si lo configuró. */
export function preferredChatLangOf(userId: string | undefined): string | null {
  if (!userId) return null;
  return findUserById(userId)?.chatLang ?? null;
}
