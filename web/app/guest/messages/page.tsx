"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Thread = {
  listingId: string;
  listingTitle: string;
  listingSlug?: string;
  lastAt: string;
  lastPreview: string;
  messageCount: number;
};

export default function GuestMessagesPage() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const res = await fetch("/api/guest/messages", { credentials: "include", cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.error ?? "Error");
        return;
      }
      setThreads(data.threads ?? []);
    } catch {
      setErr("Error de red.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-semibold text-[#484848]">Mensajes con anfitriones</h1>
      <p className="mt-2 text-sm text-[#888]">
        Solo aparecen conversaciones iniciadas <strong>con tu cuenta iniciada</strong> en la página del alojamiento. Si
        escribiste sin sesión, abre el anuncio de nuevo con sesión para unificar el hilo.
      </p>
      {err && <p className="mt-4 text-sm text-red-600">{err}</p>}
      <ul className="mt-8 space-y-3">
        {threads.map((t) => (
          <li key={t.listingId}>
            <Link
              href={t.listingSlug ? `/listings/${t.listingSlug}#section-chat-anfitrion` : "/alojamientos"}
              className="block rounded-xl border border-[#ebebeb] bg-white p-4 shadow-sm transition hover:border-[#dcb81e]"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="font-semibold text-[#484848]">{t.listingTitle}</p>
                <span className="text-xs text-[#aaa]">
                  {new Date(t.lastAt).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}
                </span>
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-[#666]">{t.lastPreview || "…"}</p>
              <p className="mt-2 text-xs text-[#aaa]">{t.messageCount} mensajes</p>
            </Link>
          </li>
        ))}
      </ul>
      {threads.length === 0 && !err && (
        <p className="mt-8 text-sm text-[#888]">No hay conversaciones todavía.</p>
      )}
    </div>
  );
}
