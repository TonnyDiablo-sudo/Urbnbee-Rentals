import type { Lang, TFn } from "@/lib/i18n";
import type { UserRecord } from "@/lib/marketplace-types";
import { hasAcceptedTerms } from "@/lib/terms";

/** Texto «Aceptaste esta versión el …» para quien ya aceptó los Términos vigentes. */
export function termsAcceptedNote(user: UserRecord | null, t: TFn, lang: Lang): string | null {
  if (!user || !hasAcceptedTerms(user) || !user.termsAcceptedAt) return null;
  const date = new Date(user.termsAcceptedAt).toLocaleDateString(lang === "en" ? "en-US" : "es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return t("Aceptaste esta versión el {date}.", { date });
}
