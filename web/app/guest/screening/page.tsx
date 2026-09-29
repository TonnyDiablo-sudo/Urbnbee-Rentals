import { Suspense } from "react";
import { GuestScreeningPanel } from "./screening-panel";

export default function GuestScreeningPage() {
  return (
    <Suspense fallback={<p className="text-sm text-[#888]">Cargando…</p>}>
      <GuestScreeningPanel />
    </Suspense>
  );
}
