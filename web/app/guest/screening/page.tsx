import { Suspense } from "react";
import { getT } from "@/lib/i18n/server";
import { GuestScreeningPanel } from "./screening-panel";

export default async function GuestScreeningPage() {
  const t = await getT();
  return (
    <Suspense fallback={<p className="text-sm text-[#888]">{t("Cargando…")}</p>}>
      <GuestScreeningPanel />
    </Suspense>
  );
}
