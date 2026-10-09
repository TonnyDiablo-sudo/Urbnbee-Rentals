import { TermsDocument } from "@/components/legal/terms-document";
import { WishlistWebShell } from "@/components/wishlist/web-shell";
import { getLang, getT } from "@/lib/i18n/server";
import { privacyDoc } from "@/lib/privacy";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Aviso de privacidad") };
}

export default async function WebPrivacyPage() {
  const [t, lang] = await Promise.all([getT(), getLang()]);
  return (
    <WishlistWebShell>
      <div className="mx-auto max-w-3xl">
        <TermsDocument doc={privacyDoc(lang)} />
        <p className="mt-8 text-sm text-[#717171]">
          <a href="/terminos" className="font-semibold underline">
            {t("Términos y condiciones")}
          </a>
        </p>
      </div>
    </WishlistWebShell>
  );
}
