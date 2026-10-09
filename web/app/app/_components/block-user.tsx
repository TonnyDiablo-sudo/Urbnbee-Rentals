"use client";

import { useEffect, useState } from "react";
import { useT } from "@/components/i18n-provider";

/** Bloquea o desbloquea a la otra persona de este chat. */
export function BlockUserButton({ userId }: { userId: string }) {
  const t = useT();
  const [blocked, setBlocked] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`/api/blocks?userId=${encodeURIComponent(userId)}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { blocked?: boolean } | null) => {
        if (alive) setBlocked(Boolean(j?.blocked));
      })
      .catch(() => {
        if (alive) setBlocked(false);
      });
    return () => {
      alive = false;
    };
  }, [userId]);

  if (blocked === null) return null;

  const toggle = async () => {
    const next = !blocked;
    if (next && !window.confirm(t("¿Bloquear a esta persona? Dejarán de poder enviarte mensajes."))) return;
    setBusy(true);
    const res = await fetch("/api/blocks", {
      method: next ? "POST" : "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    setBusy(false);
    if (res.ok) setBlocked(next);
  };

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => void toggle()}
      className="shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold text-[#222] hover:bg-[#f5f5f5] disabled:opacity-50"
    >
      {blocked ? t("Desbloquear") : t("Bloquear")}
    </button>
  );
}
