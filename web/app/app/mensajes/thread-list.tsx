"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLang, useT } from "@/components/i18n-provider";
import { numberLocale } from "@/lib/i18n";
import { threadIsUnread } from "../_components/seen";

type Thread = {
  listingId: string;
  listingTitle: string;
  lastAt: string;
  lastPreview: string;
  lastSender?: "guest" | "host";
};

export function GuestThreadList() {
  const t = useT();
  const lang = useLang();
  const [threads, setThreads] = useState<Thread[] | null>(null);

  useEffect(() => {
    fetch("/api/guest/messages", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setThreads(Array.isArray(d.threads) ? d.threads : []))
      .catch(() => setThreads([]));
  }, []);

  if (threads === null) return <p className="px-5 py-6 text-sm text-[#999]">{t("Cargando…")}</p>;
  if (threads.length === 0) {
    return (
      <div className="px-5 py-10">
        <p className="text-base font-semibold text-[#222]">{t("Todavía no tienes mensajes")}</p>
        <p className="mt-1 text-sm text-[#717171]">
          {t("Abre un alojamiento y toca «Enviar mensaje» para escribirle al anfitrión.")}
        </p>
        <Link href="/" className="mt-5 inline-block rounded-xl border border-[#222] px-5 py-3 text-sm font-semibold">
          {t("Explorar alojamientos")}
        </Link>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-[#f0f0f0]">
      {threads.map((th) => {
        const unread = th.lastSender === "host" && threadIsUnread(`g:${th.listingId}`, th.lastAt);
        return (
          <li key={th.listingId}>
            <Link href={`/mensajes/${th.listingId}`} className="flex items-start gap-3 px-5 py-4 active:bg-[#fafafa]">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#fdf6d8] text-lg">🏠</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className={`truncate text-[15px] ${unread ? "font-bold" : "font-semibold"} text-[#222]`}>
                    {t(th.listingTitle)}
                  </p>
                  <span className="shrink-0 text-xs text-[#999]">
                    {new Date(th.lastAt).toLocaleDateString(numberLocale(lang), { day: "numeric", month: "short" })}
                  </span>
                </div>
                <p className={`mt-0.5 line-clamp-2 text-sm ${unread ? "text-[#222]" : "text-[#717171]"}`}>
                  {th.lastSender === "guest" ? t("Tú: ") : ""}
                  {th.lastPreview}
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
