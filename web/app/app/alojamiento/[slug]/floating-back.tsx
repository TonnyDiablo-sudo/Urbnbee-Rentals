"use client";

import { useRouter } from "next/navigation";
import { useT } from "@/components/i18n-provider";
import { IconBack } from "../../_components/icons";

export function FloatingBack() {
  const t = useT();
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))}
      className="absolute left-4 flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#222] shadow-md"
      style={{ top: "calc(12px + env(safe-area-inset-top))" }}
      aria-label={t("Regresar")}
    >
      <IconBack className="h-4 w-4" />
    </button>
  );
}
