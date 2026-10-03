import { StoreView } from "@/components/store/store-view";
import { getT } from "@/lib/i18n/server";
import { getSessionUser } from "@/lib/session";
import { AuthGate } from "../_components/auth-gate";
import { TopBar } from "../_components/top-bar";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Tienda") };
}

export default async function AppStorePage() {
  const user = await getSessionUser();
  const t = await getT();
  return (
    <>
      <TopBar title={t("Tienda")} back="/perfil" />
      {user ? (
        <StoreView surface="app" />
      ) : (
        <AuthGate
          title="La tienda es para miembros"
          message="Crea tu cuenta gratis para ver las membresías y herramientas de Cabibee."
          next="/tienda"
        />
      )}
    </>
  );
}
