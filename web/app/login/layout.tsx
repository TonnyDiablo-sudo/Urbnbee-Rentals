import { Suspense } from "react";
import { getT } from "@/lib/i18n/server";

export default async function LoginLayout({ children }: { children: React.ReactNode }) {
  const t = await getT();
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#fafafa]" style={{ paddingTop: 72 }}>
          <div className="py-24 text-center text-sm text-[#888]">{t("Cargando…")}</div>
        </div>
      }
    >
      {children}
    </Suspense>
  );
}
