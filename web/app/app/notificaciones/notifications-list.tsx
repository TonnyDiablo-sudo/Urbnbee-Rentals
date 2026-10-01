"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useLang, useT } from "@/components/i18n-provider";
import { numberLocale } from "@/lib/i18n";
import { useCached } from "../_components/cached-fetch";
import { IconCalendar, IconChat, IconStar, IconToday } from "../_components/icons";
import {
  NOTIFICATIONS_URL,
  markNotificationsRead,
  type AppNotification,
  type NotificationsData,
} from "../_components/notifications";
import { TopBar } from "../_components/top-bar";

type Filter = "all" | "bookings" | "messages" | "reviews";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "Todas" },
  { id: "bookings", label: "Reservas y solicitudes" },
  { id: "messages", label: "Mensajes" },
  { id: "reviews", label: "Reseñas" },
];

function inFilter(n: AppNotification, f: Filter): boolean {
  if (f === "all") return true;
  if (f === "messages") return n.kind === "message";
  if (f === "reviews") return n.kind === "review";
  return n.kind !== "message" && n.kind !== "review";
}

function KindIcon({ kind }: { kind: AppNotification["kind"] }) {
  const cls = "h-5 w-5";
  const bg =
    kind === "message"
      ? "bg-[#e8f1fb] text-[#2563a8]"
      : kind === "review"
        ? "bg-[#fdf6d8] text-[#b38d00]"
        : kind === "payment"
          ? "bg-[#e6f6ea] text-[#1e7a3a]"
          : "bg-[#f3eefc] text-[#6b46c1]";
  return (
    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${bg}`}>
      {kind === "message" ? (
        <IconChat className={cls} />
      ) : kind === "review" ? (
        <IconStar className={cls} />
      ) : kind === "request" ? (
        <IconToday className={cls} />
      ) : (
        <IconCalendar className={cls} />
      )}
    </span>
  );
}

export function NotificationsList() {
  const t = useT();
  const lang = useLang();
  const { data, error } = useCached<NotificationsData>(NOTIFICATIONS_URL);
  const [filter, setFilter] = useState<Filter>("all");
  // Lo que estaba sin leer al abrir: se sigue resaltando aunque ya se marcó como leído.
  const [fresh, setFresh] = useState<Set<string> | null>(null);
  const marked = useRef(false);

  useEffect(() => {
    if (!data || marked.current) return;
    marked.current = true;
    const unread = data.items.filter((n) => !n.readAt).map((n) => n.id);
    setFresh(new Set(unread));
    if (unread.length) markNotificationsRead();
  }, [data]);

  const locale = numberLocale(lang);
  const now = new Date();
  const today = now.toDateString();
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).toDateString();
  const dayLabel = (iso: string) => {
    const d = new Date(iso).toDateString();
    if (d === today) return t("Hoy");
    if (d === yesterday) return t("Ayer");
    return new Date(iso).toLocaleDateString(locale, { day: "numeric", month: "long" });
  };
  const time = (iso: string) => new Date(iso).toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit" });

  const items = (data?.items ?? []).filter((n) => inFilter(n, filter));
  const groups: { label: string; items: AppNotification[] }[] = [];
  for (const n of items) {
    const label = dayLabel(n.createdAt);
    const g = groups[groups.length - 1];
    if (g?.label === label) g.items.push(n);
    else groups.push({ label, items: [n] });
  }

  return (
    <div className="pb-6">
      <TopBar title={t("Notificaciones")} back="/" />
      {error ? (
        <div className="px-5 py-8">
          <p className="text-[15px] text-[#555]">{t("Inicia sesión para ver tus notificaciones.")}</p>
          <Link
            href="/cuenta/entrar?next=/notificaciones"
            className="mt-4 inline-block rounded-xl bg-[#dcb81e] px-5 py-3 text-sm font-semibold text-black"
          >
            {t("Iniciar sesión")}
          </Link>
        </div>
      ) : !data ? (
        <p className="px-5 py-6 text-sm text-[#999]">{t("Cargando…")}</p>
      ) : (
        <>
          <div className="flex gap-2 overflow-x-auto px-5 pb-2 pt-3 [scrollbar-width:none]">
            {FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilter(f.id)}
                className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium ${
                  filter === f.id ? "border-[#222] bg-[#222] text-white" : "border-[#ddd] text-[#222]"
                }`}
              >
                {t(f.label)}
              </button>
            ))}
          </div>

          {items.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-base font-semibold text-[#222]">{t("Sin notificaciones")}</p>
              <p className="mt-1 text-sm text-[#717171]">
                {t("Aquí te avisamos de solicitudes, reservas, pagos, mensajes y reseñas.")}
              </p>
            </div>
          ) : (
            groups.map((g) => (
              <section key={g.label} className="mt-3">
                <h2 className="px-5 pb-1 text-xs font-semibold uppercase tracking-wide text-[#999]">{g.label}</h2>
                <ul>
                  {g.items.map((n) => {
                    const isNew = fresh?.has(n.id) ?? !n.readAt;
                    return (
                      <li key={n.id}>
                        <Link
                          href={n.url}
                          className={`flex items-start gap-3 px-5 py-3 ${isNew ? "bg-[#fffbea]" : ""}`}
                        >
                          <KindIcon kind={n.kind} />
                          <div className="min-w-0 flex-1">
                            <p className="text-[15px] font-semibold leading-snug text-[#222]">{t(n.title, n.vars)}</p>
                            <p className="mt-0.5 line-clamp-2 text-sm text-[#555]">
                              {n.rawBody ? n.body : t(n.body, n.vars)}
                            </p>
                            <p className="mt-1 text-xs text-[#999]">{time(n.createdAt)}</p>
                          </div>
                          {isNew && <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-[#e0452b]" aria-label={t("Nueva")} />}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))
          )}
        </>
      )}
    </div>
  );
}
