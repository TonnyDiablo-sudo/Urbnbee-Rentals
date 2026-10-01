import { getT } from "@/lib/i18n/server";
import { TaxEditor } from "./tax-editor";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Impuestos (IVA)") };
}

export default function AppHostTaxPage() {
  return <TaxEditor />;
}
