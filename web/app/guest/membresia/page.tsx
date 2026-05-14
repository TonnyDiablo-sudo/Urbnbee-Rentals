import { Suspense } from "react";
import { MembresiaPanel } from "./membresia-panel";

export default function GuestMembresiaPage() {
  return (
    <Suspense fallback={<p className="text-sm text-[#888]">Cargando…</p>}>
      <MembresiaPanel />
    </Suspense>
  );
}
