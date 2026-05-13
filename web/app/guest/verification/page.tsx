import { Suspense } from "react";
import { VerificationPanel } from "./verification-panel";

export default function GuestVerificationPage() {
  return (
    <Suspense fallback={<p className="text-sm text-[#888]">Cargando…</p>}>
      <VerificationPanel />
    </Suspense>
  );
}
