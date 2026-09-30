import { Suspense } from "react";
import { getT } from "@/lib/i18n/server";
import { MembresiaPanel } from "./membresia-panel";

export default async function GuestMembresiaPage() {
  const t = await getT();
  return (
    <Suspense fallback={<p className="text-sm text-[#888]">{t("Cargando…")}</p>}>
      <MembresiaPanel />
    </Suspense>
  );
}
