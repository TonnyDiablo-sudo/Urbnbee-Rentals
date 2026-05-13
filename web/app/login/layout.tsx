import { Suspense } from "react";

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#fafafa]" style={{ paddingTop: 72 }}>
          <div className="py-24 text-center text-sm text-[#888]">Cargando…</div>
        </div>
      }
    >
      {children}
    </Suspense>
  );
}
