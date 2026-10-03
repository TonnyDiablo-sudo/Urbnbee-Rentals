import { TermsDocument } from "@/components/legal/terms-document";
import { getLang, getT } from "@/lib/i18n/server";
import { getSessionUser } from "@/lib/session";
import { termsDoc } from "@/lib/terms";
import { termsAcceptedNote } from "@/lib/terms-page";
import { TopBar } from "../_components/top-bar";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Términos y condiciones") };
}

export default async function AppTermsPage() {
  const [user, t, lang] = await Promise.all([getSessionUser(), getT(), getLang()]);
  return (
    <>
      <TopBar title={t("Términos y condiciones")} back="/perfil" />
      <div className="px-5 pb-12 pt-3">
        <TermsDocument doc={termsDoc(lang)} accepted={termsAcceptedNote(user, t, lang)} />
      </div>
    </>
  );
}
