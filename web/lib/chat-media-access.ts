import { isHostIdentityVerified } from "@/lib/verification-store";

export const CHAT_MEDIA_LOCKED_ERROR = "Verifica tu identidad para mandar fotos y audios. Mientras tanto puedes escribir por texto.";
export const CHAT_TRANSLATOR_LOCKED_ERROR = "El traductor del chat viene con la membresía de identidad verificada.";

/** El traductor del chat va con la misma membresía que las fotos y audios. */
export const chatTranslatorAllowed = chatMediaAllowed;

/**
 * Fotos y notas de voz sólo con identidad verificada; sin ella el chat es sólo texto.
 * Del lado anfitrión cuenta también la identidad del dueño del anuncio (equipo que contesta por él).
 */
export function chatMediaAllowed(
  user: { id: string; role?: string },
  opts?: { as?: "guest" | "host"; listingHostId?: string }
): boolean {
  if (user.role === "admin") return true;
  if (isHostIdentityVerified(user.id)) return true;
  return opts?.as === "host" && Boolean(opts.listingHostId) && isHostIdentityVerified(opts.listingHostId!);
}
