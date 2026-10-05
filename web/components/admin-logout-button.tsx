"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useT } from "@/components/i18n-provider";

export function AdminLogoutButton({ compact = false }: { compact?: boolean }) {
  const t = useT();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
      router.push("/login");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void logout()}
      disabled={busy}
      className={compact ? "text-xs text-gray-500 hover:text-amber-800 disabled:opacity-50" : "mt-2 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:border-amber-300 hover:bg-amber-50 hover:text-amber-900 disabled:opacity-50"}
    >
      {busy ? t("Saliendo…") : t("Cerrar sesión")}
    </button>
  );
}
