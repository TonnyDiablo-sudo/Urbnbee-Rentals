"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useLang, useT } from "@/components/i18n-provider";
import type { AdminActivity, AdminConversation, AdminReportRow, AdminUserDetail } from "@/lib/admin-user-detail";
import { numberLocale } from "@/lib/i18n";
import { REPORT_STATUS_LABEL, reportKindLabel } from "@/lib/user-reports-types";
import { relTime } from "../users-explorer";

const STATUS_ES: Record<string, string> = {
  AWAITING_PAYMENT: "Esperando pago",
  PENDING: "Pendiente",
  PENDING_HOST: "Pendiente anfitrión",
  AWAITING_DETAILS: "Esperando datos",
  CONFIRMED: "Confirmada",
  REJECTED: "Rechazada",
  CANCELLED: "Cancelada",
  COMPLETED: "Completada",
  EXPIRED: "Expirada",
};

function useFormat() {
  const locale = numberLocale(useLang());
  return {
    locale,
    mxn: (n: number) => (n ? `$${n.toLocaleString(locale, { maximumFractionDigits: 0 })}` : "—"),
    when: (iso: string) => new Date(iso).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" }),
  };
}

function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="mt-1 text-xl font-bold text-gray-900">{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-gray-500">{sub}</p>}
    </div>
  );
}

function StatusBars({ data }: { data: Partial<Record<string, number>> }) {
  const t = useT();
  const entries = Object.entries(data).filter(([, n]) => (n ?? 0) > 0) as [string, number][];
  const max = Math.max(1, ...entries.map(([, n]) => n));
  if (!entries.length) return <p className="text-sm text-gray-400">{t("Sin reservas.")}</p>;
  return (
    <ul className="space-y-1.5">
      {entries
        .sort((a, b) => b[1] - a[1])
        .map(([s, n]) => (
          <li key={s} className="flex items-center gap-3 text-sm">
            <span className="w-40 shrink-0 text-gray-600">{STATUS_ES[s] ? t(STATUS_ES[s]) : s}</span>
            <span className="h-2.5 rounded bg-amber-400" style={{ width: `${(n / max) * 60}%` }} />
            <span className="text-gray-700">{n}</span>
          </li>
        ))}
    </ul>
  );
}

export function StatsTab({ d }: { d: AdminUserDetail }) {
  const t = useT();
  const { locale, mxn } = useFormat();
  const { host, guest } = d.stats;
  const isHost = host.listings > 0 || host.bookingsReceived > 0 || host.threads > 0;
  const isGuest = guest.bookings > 0 || guest.threads > 0 || guest.wishlists > 0;
  const responseRate = host.threads ? Math.round((host.threadsAnswered / host.threads) * 100) : null;
  const replyLabel =
    host.avgFirstReplyMin === null
      ? "—"
      : host.avgFirstReplyMin < 60
        ? `${host.avgFirstReplyMin} min`
        : host.avgFirstReplyMin < 1440
          ? `${Math.round(host.avgFirstReplyMin / 60)} h`
          : `${Math.round(host.avgFirstReplyMin / 1440)} d`;

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 text-sm font-semibold text-gray-700">{t("Uso de la plataforma")}</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label={t("Última visita")} value={<span suppressHydrationWarning>{relTime(d.stats.lastSeenAt, t, locale)}</span>} sub={d.stats.place} />
          <Stat label={t("Páginas vistas (con sesión)")} value={d.stats.pageViews} />
          <Stat
            label={t("Conversaciones")}
            value={host.threads + guest.threads}
            sub={t("{host} como anfitrión · {guest} como huésped", { host: host.threads, guest: guest.threads })}
          />
          <Stat label={t("Reportes")} value={d.reportsAgainst.length} sub={t("en su contra · {count} enviados", { count: d.reportsBy.length })} />
          {d.associate.accounts.length > 0 && (
            <Stat
              label={t("Altas como asociado")}
              value={d.associate.accounts.length}
              sub={t("{claimed} reclamadas · {pending} borradores por revisar", {
                claimed: d.associate.accounts.filter((a) => a.claimed).length,
                pending: d.associate.drafts.pending,
              })}
            />
          )}
        </div>
      </section>

      {isHost && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-gray-700">{t("Como anfitrión")}</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label={t("Anuncios")} value={host.listings} sub={t("{count} publicados", { count: host.published })} />
            <Stat label={t("Vistas de sus anuncios")} value={host.views30} sub={t("últimos 30 días · {count} en total", { count: host.viewsTotal })} />
            <Stat label={t("Vieron su contacto")} value={host.contacts30} sub={t("últimos 30 días · {count} en total", { count: host.contactsTotal })} />
            <Stat
              label={t("Conversión vista → contacto")}
              value={host.viewsTotal ? `${Math.round((host.contactsTotal / host.viewsTotal) * 1000) / 10}%` : "—"}
            />
            <Stat label={t("Reservas recibidas")} value={host.bookingsReceived} sub={t("{count} noches pagadas", { count: host.nightsHosted })} />
            <Stat label={t("Ingresos por estancias")} value={mxn(host.revenueMxn)} sub={t("pagadas y no reembolsadas")} />
            <Stat
              label={t("Tasa de respuesta")}
              value={responseRate === null ? "—" : `${responseRate}%`}
              sub={t("{answered} de {total} hilos · 1ª respuesta en {time}", { answered: host.threadsAnswered, total: host.threads, time: replyLabel })}
            />
            <Stat
              label={t("Calificación")}
              value={host.ratingAvg === null ? "—" : `${host.ratingAvg}★`}
              sub={t("{received} reseñas recibidas · {written} escritas", { received: host.reviewsReceived, written: host.reviewsWritten })}
            />
            <Stat
              label={t("Ubicación verificada")}
              value={`${d.listings.filter((l) => l.locationVerified).length} / ${d.listings.length}`}
              sub={t("{uploaded} comprobantes subidos · {review} por revisar", {
                uploaded: d.addressProofs.length,
                review: d.addressProofs.filter((p) => p.status === "review").length,
              })}
            />
            <Stat
              label={t("Reclamos de sus anuncios")}
              value={d.listingClaims.length}
              sub={t("{count} abiertos", { count: d.listingClaims.filter((c) => c.status === "open").length })}
            />
            {d.associate.provisionedBy && (
              <Stat
                label={t("Alta con IA")}
                value={t("Sí")}
                sub={`${t("por {name}", { name: d.associate.provisionedBy.name })}${d.account.claimedAt ? ` · ${t("ya reclamada")}` : ` · ${t("sin reclamar")}`}`}
              />
            )}
          </div>
          <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">{t("Reservas recibidas por estado")}</p>
            <StatusBars data={host.bookingsByStatus} />
          </div>
          {d.listings.length > 0 && (
            <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs text-gray-500">
                    <th className="px-4 py-2 font-medium">{t("Anuncio")}</th>
                    <th className="px-4 py-2 font-medium">{t("Estado")}</th>
                    <th className="px-4 py-2 text-right font-medium">{t("Vistas 30d")}</th>
                    <th className="px-4 py-2 text-right font-medium">{t("Contactos 30d")}</th>
                    <th className="px-4 py-2 font-medium">{t("Actualizado")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {d.listings.map((l) => (
                    <tr key={l.id}>
                      <td className="px-4 py-2">
                        <a href={`/listings/${l.slug}`} target="_blank" rel="noreferrer" className="text-gray-800 hover:text-amber-700 hover:underline">
                          {l.title}
                        </a>
                        {l.city && <span className="ml-1 text-xs text-gray-400">· {l.city}</span>}
                      </td>
                      <td className="px-4 py-2 text-xs">
                        {l.published ? <span className="text-green-700">{t("Publicado")}</span> : <span className="text-gray-400">{t("Borrador")}</span>}
                      </td>
                      <td className="px-4 py-2 text-right">{l.views30}</td>
                      <td className="px-4 py-2 text-right">{l.contacts30}</td>
                      <td className="px-4 py-2 text-xs text-gray-400">{new Date(l.updatedAt).toLocaleDateString(locale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {(isGuest || !isHost) && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-gray-700">{t("Como huésped")}</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label={t("Reservas")} value={guest.bookings} sub={t("{count} noches pagadas", { count: guest.nights })} />
            <Stat label={t("Total pagado")} value={mxn(guest.paidMxn)} sub={t("incluye cargo de plataforma")} />
            <Stat label={t("Mensajes enviados")} value={guest.messagesSent} sub={t("en {count} conversaciones", { count: guest.threads })} />
            <Stat label={t("Favoritos")} value={guest.savedListings} sub={t("en {count} listas", { count: guest.wishlists })} />
            <Stat label={t("Reseñas escritas")} value={guest.reviewsWritten} />
            <Stat
              label={t("Calificación de anfitriones")}
              value={guest.ratingAvg === null ? "—" : `${guest.ratingAvg}★`}
              sub={t("{count} reseñas recibidas", { count: guest.reviewsReceived })}
            />
          </div>
          <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">{t("Reservas por estado")}</p>
            <StatusBars data={guest.bookingsByStatus} />
          </div>
        </section>
      )}
    </div>
  );
}

export function ConversationsTab({ d, initialKey }: { d: AdminUserDetail; initialKey?: string }) {
  const t = useT();
  const { locale } = useFormat();
  const [q, setQ] = useState("");
  const [role, setRole] = useState<"" | "host" | "guest">("");
  const [open, setOpen] = useState<string | null>(initialKey ?? d.conversations[0]?.key ?? null);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return d.conversations.filter((c) => {
      if (role && c.role !== role) return false;
      if (!needle) return true;
      return (
        c.counterpartName.toLowerCase().includes(needle) ||
        c.listingTitle.toLowerCase().includes(needle) ||
        (c.counterpartEmail ?? "").toLowerCase().includes(needle) ||
        c.messages.some((m) => m.body.toLowerCase().includes(needle))
      );
    });
  }, [d.conversations, q, role]);
  const current = list.find((c) => c.key === open) ?? list[0];

  if (!d.conversations.length) return <p className="text-sm text-gray-400">{t("Este usuario no tiene conversaciones.")}</p>;

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <div className="space-y-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("Buscar en conversaciones…")}
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
        <div className="flex gap-1 text-xs">
          {(["", "host", "guest"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              className={`rounded-full border px-3 py-1 ${role === r ? "border-amber-500 bg-amber-50 text-amber-800" : "border-gray-200 text-gray-600"}`}
            >
              {r === "" ? t("Todas") : r === "host" ? t("Como anfitrión") : t("Como huésped")}
            </button>
          ))}
        </div>
        <ul className="max-h-[560px] divide-y divide-gray-100 overflow-y-auto rounded-xl border border-gray-200 bg-white">
          {list.map((c) => (
            <li key={c.key}>
              <button
                type="button"
                onClick={() => setOpen(c.key)}
                className={`w-full px-3 py-2.5 text-left ${current?.key === c.key ? "bg-amber-50" : "hover:bg-gray-50"}`}
              >
                <p className="flex items-center justify-between gap-2 text-sm font-medium text-gray-900">
                  <span className="truncate">{c.counterpartName}</span>
                  <span className="shrink-0 text-[10px] font-normal text-gray-400" suppressHydrationWarning>
                    {relTime(c.lastAt, t, locale)}
                  </span>
                </p>
                <p className="truncate text-xs text-gray-500">{c.listingTitle}</p>
                <p className="mt-0.5 text-[10px] text-gray-400">
                  {c.role === "host" ? t("Es su huésped") : t("Es su anfitrión")} · {t("{count} mensajes", { count: c.messageCount })}
                </p>
              </button>
            </li>
          ))}
          {list.length === 0 && <li className="px-3 py-6 text-center text-xs text-gray-400">{t("Sin resultados.")}</li>}
        </ul>
      </div>
      {current && <Thread c={current} userName={d.user.fullName} highlight={q.trim()} />}
    </div>
  );
}

function Thread({ c, userName, highlight }: { c: AdminConversation; userName: string; highlight: string }) {
  const t = useT();
  const { locale, when } = useFormat();
  const userSender = c.role;
  return (
    <div id={`chat-${c.key}`} className="flex flex-col overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="border-b border-gray-100 px-4 py-3">
        <p className="text-sm font-semibold text-gray-900">
          {userName} ↔{" "}
          {c.counterpartId ? (
            <Link href={`/admin/users/${c.counterpartId}`} className="text-amber-700 hover:underline">
              {c.counterpartName}
            </Link>
          ) : (
            c.counterpartName
          )}
        </p>
        <p className="text-xs text-gray-500">
          {c.listingTitle} · {c.counterpartEmail ?? t("sin correo")} ·{" "}
          {t("desde {date}", { date: new Date(c.firstAt).toLocaleDateString(locale) })}
        </p>
      </div>
      <div className="max-h-[560px] space-y-2 overflow-y-auto bg-gray-50 px-4 py-4">
        {c.messages.map((m) => {
          const mine = m.sender === userSender;
          const hit = highlight && m.body.toLowerCase().includes(highlight.toLowerCase());
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${
                  mine ? "bg-amber-100 text-gray-900" : "border border-gray-200 bg-white text-gray-800"
                } ${hit ? "ring-2 ring-amber-500" : ""}`}
              >
                {m.attachment && (
                  <p className="text-xs text-gray-500">{m.attachment === "image" ? t("📷 Foto") : t("🎤 Nota de voz")}</p>
                )}
                {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
                <p className="mt-1 text-[10px] text-gray-400">
                  {m.sender === "host" ? t("Anfitrión") : t("Huésped")}
                  {m.via === "ai" ? ` · ${t("IA")}` : ""} · {when(m.createdAt)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const KIND_META: Record<AdminActivity["kind"], { icon: string; label: string }> = {
  account: { icon: "👤", label: "Cuenta" },
  visit: { icon: "👀", label: "Visitas" },
  listing: { icon: "🏡", label: "Anuncios" },
  booking: { icon: "📅", label: "Reservas" },
  payment: { icon: "💳", label: "Pagos" },
  message: { icon: "💬", label: "Mensajes" },
  review: { icon: "⭐", label: "Reseñas" },
  report: { icon: "🚩", label: "Reportes" },
  verification: { icon: "🛡️", label: "Verificación" },
};

export function ActivityTab({
  d,
  onOpenChat,
  onOpenTab,
}: {
  d: AdminUserDetail;
  onOpenChat: (key: string) => void;
  onOpenTab: (tab: string) => void;
}) {
  const t = useT();
  const { locale } = useFormat();
  const [kind, setKind] = useState<"" | AdminActivity["kind"]>("");
  const [q, setQ] = useState("");
  const kinds = useMemo(() => [...new Set(d.activity.map((a) => a.kind))], [d.activity]);
  const list = d.activity.filter(
    (a) =>
      (!kind || a.kind === kind) &&
      (!q || `${a.title} ${t(a.title)} ${a.detail ?? ""}`.toLowerCase().includes(q.toLowerCase()))
  );

  const byDay = new Map<string, AdminActivity[]>();
  for (const a of list) {
    const day = new Date(a.when).toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    const arr = byDay.get(day) ?? [];
    arr.push(a);
    byDay.set(day, arr);
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("Buscar en la actividad…")}
          className="min-w-[220px] flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
        <button
          type="button"
          onClick={() => setKind("")}
          className={`rounded-full border px-3 py-1 text-xs ${kind === "" ? "border-amber-500 bg-amber-50 text-amber-800" : "border-gray-200 text-gray-600"}`}
        >
          {t("Todo ({count})", { count: d.activity.length })}
        </button>
        {kinds.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={`rounded-full border px-3 py-1 text-xs ${kind === k ? "border-amber-500 bg-amber-50 text-amber-800" : "border-gray-200 text-gray-600"}`}
          >
            {KIND_META[k].icon} {t(KIND_META[k].label)} ({d.activity.filter((a) => a.kind === k).length})
          </button>
        ))}
      </div>
      {list.length === 0 && <p className="text-sm text-gray-400">{t("Sin actividad.")}</p>}
      <div className="space-y-6">
        {[...byDay.entries()].map(([day, items]) => (
          <div key={day}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">{day}</p>
            <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
              {items.map((a) => {
                const chatKey = a.href?.startsWith("#chat-") ? decodeURIComponent(a.href.slice(6)) : null;
                const tabKey = a.href?.startsWith("#tab-") ? a.href.slice(5) : null;
                const body = (
                  <>
                    <span className="mt-0.5 text-base">{KIND_META[a.kind].icon}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-gray-900">{t(a.title)}</p>
                      {a.detail && <p className="truncate text-xs text-gray-500">{t(a.detail)}</p>}
                    </div>
                    <span className="shrink-0 text-xs text-gray-400">
                      {new Date(a.when).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </>
                );
                return (
                  <li key={a.id}>
                    {chatKey ? (
                      <button type="button" onClick={() => onOpenChat(chatKey)} className="flex w-full items-start gap-3 px-4 py-2.5 text-left hover:bg-gray-50">
                        {body}
                      </button>
                    ) : tabKey ? (
                      <button type="button" onClick={() => onOpenTab(tabKey)} className="flex w-full items-start gap-3 px-4 py-2.5 text-left hover:bg-gray-50">
                        {body}
                      </button>
                    ) : a.href ? (
                      <a href={a.href} className="flex items-start gap-3 px-4 py-2.5 hover:bg-gray-50">
                        {body}
                      </a>
                    ) : (
                      <div className="flex items-start gap-3 px-4 py-2.5">{body}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

const REPORT_STATUS_BADGE: Record<string, string> = {
  open: "bg-red-100 text-red-700",
  in_review: "bg-amber-100 text-amber-800",
  resolved: "bg-green-100 text-green-800",
  dismissed: "bg-gray-100 text-gray-600",
};

export function ReportList({ rows, empty }: { rows: AdminReportRow[]; empty: string }) {
  const t = useT();
  const { when } = useFormat();
  if (!rows.length) return <p className="text-sm text-gray-400">{empty}</p>;
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.id} className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className={`rounded px-2 py-0.5 font-medium ${REPORT_STATUS_BADGE[r.status]}`}>{t(REPORT_STATUS_LABEL[r.status])}</span>
            <span className="font-semibold text-gray-800">{t(reportKindLabel(r.kind))}</span>
            <span className="text-gray-500">· {t(r.category)}</span>
            <span className="ml-auto text-gray-400">{when(r.createdAt)}</span>
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{r.message}</p>
          <p className="mt-2 text-xs text-gray-500">
            {t("De")}{" "}
            <Link href={`/admin/users/${r.reporterId}`} className="text-amber-700 hover:underline">
              {r.reporterName}
            </Link>
            {r.targetUserId && (
              <>
                {" "}
                {t("sobre")}{" "}
                <Link href={`/admin/users/${r.targetUserId}`} className="text-amber-700 hover:underline">
                  {r.targetName ?? r.targetUserId}
                </Link>
              </>
            )}
            {!r.targetUserId && r.targetLabel && (
              <>
                {" "}
                {t("sobre")} “{r.targetLabel}”
              </>
            )}
            {r.listingTitle && <> · {r.listingTitle}</>}
          </p>
          {r.adminNote && (
            <p className="mt-2 rounded bg-gray-50 px-2 py-1 text-xs text-gray-600">
              {t("Nota interna:")} {r.adminNote}
            </p>
          )}
        </li>
      ))}
      <li>
        <Link href="/admin/reportes" className="text-xs text-amber-700 hover:underline">
          {t("Gestionar en Reportes →")}
        </Link>
      </li>
    </ul>
  );
}
