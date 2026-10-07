import "server-only";
import { chatTranslatorAllowed } from "@/lib/chat-media-access";
import { findUserById } from "@/lib/marketplace-store";
import type { Lang } from "@/lib/i18n";

/**
 * Idioma al que se traduce lo que le escriben a esta persona en el chat: el que puso en su perfil
 * (traductor, con membresía de identidad verificada) o, si no, el idioma con que usa el sitio.
 */
export function chatReadingLang(
  user: { id: string; role?: string } | null | undefined,
  uiLang: Lang,
  ctx?: { as?: "guest" | "host"; listingHostId?: string }
): string {
  if (!user) return uiLang;
  const pref = findUserById(user.id)?.chatLang;
  if (!pref || pref === uiLang) return uiLang;
  return chatTranslatorAllowed(user, ctx) ? pref : uiLang;
}

/** Idioma preferido de la otra persona del chat (para traducirle lo que se le manda), si lo configuró. */
export function preferredChatLangOf(userId: string | undefined): string | null {
  if (!userId) return null;
  return findUserById(userId)?.chatLang ?? null;
}
