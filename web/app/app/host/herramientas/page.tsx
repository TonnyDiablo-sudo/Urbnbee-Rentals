import { HostToolsView } from "@/components/host/host-tools-view";
import { getLang, getT } from "@/lib/i18n/server";
import { getSessionUser } from "@/lib/session";
import { TopBar } from "../../_components/top-bar";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Mis herramientas") };
}

export default async function AppHostToolsPage() {
  const user = (await getSessionUser())!;
  const [t, lang] = await Promise.all([getT(), getLang()]);
  return (
    <>
      <TopBar title={t("Mis herramientas")} back="/host/menu" />
      <div className="px-5 pb-10 pt-4">
        <HostToolsView hostId={user.id} t={t} lang={lang} surface="app" />
      </div>
    </>
  );
}
