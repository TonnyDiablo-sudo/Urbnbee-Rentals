"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useT } from "@/components/i18n-provider";
import { unsubscribeThisDevice } from "./push";

export function LogoutButton() {
  const t = useT();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await unsubscribeThisDevice();
        await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
        router.replace("/");
        router.refresh();
      }}
      className="mt-4 w-full rounded-xl border border-[#ddd] py-3 text-[15px] font-medium text-[#222] disabled:opacity-60"
    >
      {busy ? t("Saliendo…") : t("Cerrar sesión")}
    </button>
  );
}
