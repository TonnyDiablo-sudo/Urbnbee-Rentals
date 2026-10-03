import { HostToolsView } from "@/components/host/host-tools-view";
import { getLang, getT } from "@/lib/i18n/server";
import { getSessionUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Mis herramientas") };
}

export default async function WebHostToolsPage() {
  const user = (await getSessionUser())!;
  const [t, lang] = await Promise.all([getT(), getLang()]);
  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      <h1 className="mb-1 text-2xl font-bold text-[#222]">{t("Mis herramientas")}</h1>
      <p className="mb-6 text-sm text-[#717171]">
        {t("Lo que tienes contratado, en qué anuncios y con qué personas. Desde aquí entras a administrar cada una.")}
      </p>
      <HostToolsView hostId={user.id} t={t} lang={lang} surface="web" />
    </div>
  );
}
