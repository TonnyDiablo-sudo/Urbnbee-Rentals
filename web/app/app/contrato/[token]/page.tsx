import { getT } from "@/lib/i18n/server";
import { TopBar } from "../../_components/top-bar";
import { ContractReader } from "./contract-reader";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Contrato") };
}

/** Contrato de una reserva dentro de la app (sin encabezado ni pie del sitio). */
export default async function AppContractPage({ params }: { params: Promise<{ token: string }> }) {
  const [{ token: raw }, t] = await Promise.all([params, getT()]);
  const token = raw.replace(/\D/g, "").slice(0, 6);
  return (
    <>
      <TopBar title={t("Contrato")} back="/" />
      <div className="px-4 pt-4 sm:px-6">
        {token.length === 6 ? (
          <ContractReader token={token} />
        ) : (
          <p className="py-10 text-center text-sm text-[#717171]">{t("No encontramos este contrato.")}</p>
        )}
      </div>
    </>
  );
}
