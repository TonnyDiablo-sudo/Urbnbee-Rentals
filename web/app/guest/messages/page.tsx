"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useLang, useT } from "@/components/i18n-provider";
import { chatMatches, useChatSearch } from "@/components/chat/chat-search";
import { ChatsSwitch } from "@/components/team/chats-switch";
import { numberLocale } from "@/lib/i18n";

type Thread = {
  listingId: string;
  listingTitle: string;
  listingSlug?: string;
  lastAt: string;
  lastPreview: string;
  messageCount: number;
};

export default function GuestMessagesPage() {
  return (
    <ChatsSwitch web guestsLabel="Anfitriones">
      <GuestHostChats />
    </ChatsSwitch>
  );
}

function GuestHostChats() {
  const t = useT();
  const locale = numberLocale(useLang());
  const [threads, setThreads] = useState<Thread[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const query = useChatSearch();

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
      <h1 className="text-2xl font-semibold text-[#484848]">{t("Mensajes con anfitriones")}</h1>
      <p className="mt-2 text-sm text-[#888]">
        {t("Solo aparecen conversaciones iniciadas")} <strong>{t("con tu cuenta iniciada")}</strong>{" "}
        {t("en la página del alojamiento. Si escribiste sin sesión, abre el anuncio de nuevo con sesión para unificar el hilo.")}
      </p>
      {err && <p className="mt-4 text-sm text-red-600">{t(err)}</p>}
      <ul className="mt-8 space-y-3">
        {threads.filter((th) => chatMatches(query, th.listingTitle, th.lastPreview)).map((th) => (
          <li key={th.listingId}>
            <Link
              href={th.listingSlug ? `/listings/${th.listingSlug}#section-chat-anfitrion` : "/alojamientos"}
              className="block rounded-xl border border-[#ebebeb] bg-white p-4 shadow-sm transition hover:border-[#dcb81e]"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="font-semibold text-[#484848]">{th.listingTitle}</p>
                <span className="text-xs text-[#aaa]">
                  {new Date(th.lastAt).toLocaleString(locale, { dateStyle: "short", timeStyle: "short" })}
                </span>
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-[#666]">{th.lastPreview || "…"}</p>
              <p className="mt-2 text-xs text-[#aaa]">{t("{n} mensajes", { n: th.messageCount })}</p>
            </Link>
          </li>
        ))}
      </ul>
      {threads.length === 0 && !err && (
        <p className="mt-8 text-sm text-[#888]">{t("No hay conversaciones todavía.")}</p>
      )}
    </div>
  );
}
