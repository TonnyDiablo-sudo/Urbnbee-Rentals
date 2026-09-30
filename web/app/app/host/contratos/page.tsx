import { Suspense } from "react";
import { getT } from "@/lib/i18n/server";
import { ContractsEditor } from "./contracts-editor";

export async function generateMetadata() {
  const t = await getT();
  return { title: t("Contratos") };
}

export default function AppHostContractsPage() {
  return (
    <Suspense>
      <ContractsEditor />
    </Suspense>
  );
}
