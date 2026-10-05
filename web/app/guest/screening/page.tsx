import { redirect } from "next/navigation";
import { Suspense } from "react";
import { CREDIT_CHECK_ENABLED } from "@/lib/feature-flags";
import { getT } from "@/lib/i18n/server";
import { GuestScreeningPanel } from "./screening-panel";

export default async function GuestScreeningPage() {
  if (!CREDIT_CHECK_ENABLED) redirect("/guest");
  const t = await getT();
  return (
    <Suspense fallback={<p className="text-sm text-[#888]">{t("Cargando…")}</p>}>
      <GuestScreeningPanel />
    </Suspense>
  );
}
