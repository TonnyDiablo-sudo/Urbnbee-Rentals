import { TermsDocument } from "@/components/legal/terms-document";
import { WishlistWebShell } from "@/components/wishlist/web-shell";
import { getLang, getT } from "@/lib/i18n/server";
import { getSessionUser } from "@/lib/session";
import { termsDoc } from "@/lib/terms";
import { termsAcceptedNote } from "@/lib/terms-page";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Términos y condiciones") };
}

export default async function WebTermsPage() {
  const [user, t, lang] = await Promise.all([getSessionUser(), getT(), getLang()]);
  return (
    <WishlistWebShell>
      <div className="mx-auto max-w-3xl">
        <TermsDocument doc={termsDoc(lang)} accepted={termsAcceptedNote(user, t, lang)} />
      </div>
    </WishlistWebShell>
  );
}
