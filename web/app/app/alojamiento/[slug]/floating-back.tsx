"use client";

import { useRouter } from "next/navigation";
import { IconBack } from "../../_components/icons";

export function FloatingBack() {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => (window.history.length > 1 ? router.back() : router.push("/app"))}
      className="absolute left-4 flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#222] shadow-md"
      style={{ top: "calc(12px + env(safe-area-inset-top))" }}
      aria-label="Regresar"
    >
      <IconBack className="h-4 w-4" />
    </button>
  );
}
