"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { threadIsUnread } from "../../_components/seen";

export type HostThread = {
  listingId: string;
  listingTitle: string;
  guestSessionId: string;
  guestName: string;
  guestEmail?: string;
  lastAt: string;
  messages: { id: string; sender: "guest" | "host"; body: string; createdAt: string }[];
};

export function hostThreadHref(t: { listingId: string; guestSessionId: string }) {
  return `/host/mensajes/${encodeURIComponent(t.listingId)}/${encodeURIComponent(t.guestSessionId)}`;
}

export function HostInbox() {
  const [threads, setThreads] = useState<HostThread[] | null>(null);

  useEffect(() => {
    const load = () =>
      fetch("/api/host/inbox", { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => setThreads(Array.isArray(d.threads) ? d.threads : []))
        .catch(() => setThreads((t) => t ?? []));
    void load();
    const timer = window.setInterval(() => document.visibilityState === "visible" && void load(), 20_000);
    return () => window.clearInterval(timer);
  }, []);

  if (threads === null) return <p className="px-5 py-6 text-sm text-[#999]">Cargando…</p>;
  if (threads.length === 0) {
    return (
      <div className="px-5 py-8">
        <p className="text-base font-semibold text-[#222]">Aún no te escriben</p>
        <p className="mt-1 text-sm leading-relaxed text-[#717171]">
          Cuando un huésped te escriba desde tu anuncio en la web o en la app, lo verás aquí.
        </p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-[#f0f0f0]">
      {threads.map((t) => {
        const last = t.messages[t.messages.length - 1];
        const unread = last?.sender === "guest" && threadIsUnread(`h:${t.listingId}:${t.guestSessionId}`, t.lastAt);
        return (
          <li key={`${t.listingId}:${t.guestSessionId}`}>
            <Link href={hostThreadHref(t)} className="flex items-start gap-3 px-5 py-4 active:bg-[#fafafa]">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#111] text-base font-bold text-[#dcb81e]">
                {t.guestName.trim().charAt(0).toUpperCase() || "?"}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className={`truncate text-[15px] ${unread ? "font-bold" : "font-semibold"} text-[#222]`}>{t.guestName}</p>
                  <span className="shrink-0 text-xs text-[#999]">
                    {new Date(t.lastAt).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}
                  </span>
                </div>
                <p className="truncate text-xs text-[#999]">{t.listingTitle}</p>
                <p className={`mt-0.5 line-clamp-2 text-sm ${unread ? "text-[#222]" : "text-[#717171]"}`}>
                  {last?.sender === "host" ? "Tú: " : ""}
                  {last?.body}
                </p>
              </div>
              {unread && <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-[#e0452b]" />}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
