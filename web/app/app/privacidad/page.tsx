import { TermsDocument } from "@/components/legal/terms-document";
import { getLang, getT } from "@/lib/i18n/server";
import { privacyDoc } from "@/lib/privacy";
import { TopBar } from "../_components/top-bar";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Aviso de privacidad") };
}

export default async function AppPrivacyPage() {
  const [t, lang] = await Promise.all([getT(), getLang()]);
  return (
    <>
      <TopBar title={t("Aviso de privacidad")} back="/perfil" />
      <div className="px-5 pb-12 pt-3">
        <TermsDocument doc={privacyDoc(lang)} />
        <p className="mt-8 text-sm text-[#717171]">
          <a href="/terminos" className="font-semibold text-[#222] underline">
            {t("Términos y condiciones")}
          </a>
        </p>
      </div>
    </>
  );
}
