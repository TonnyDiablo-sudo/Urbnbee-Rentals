"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { AdminActivity, AdminConversation, AdminReportRow, AdminUserDetail } from "@/lib/admin-user-detail";
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

const mxn = (n: number) => (n ? `$${n.toLocaleString("es-MX", { maximumFractionDigits: 0 })}` : "—");
const when = (iso: string) => new Date(iso).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" });

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
  const entries = Object.entries(data).filter(([, n]) => (n ?? 0) > 0) as [string, number][];
  const max = Math.max(1, ...entries.map(([, n]) => n));
  if (!entries.length) return <p className="text-sm text-gray-400">Sin reservas.</p>;
  return (
    <ul className="space-y-1.5">
      {entries
        .sort((a, b) => b[1] - a[1])
        .map(([s, n]) => (
          <li key={s} className="flex items-center gap-3 text-sm">
            <span className="w-40 shrink-0 text-gray-600">{STATUS_ES[s] ?? s}</span>
            <span className="h-2.5 rounded bg-amber-400" style={{ width: `${(n / max) * 60}%` }} />
            <span className="text-gray-700">{n}</span>
          </li>
        ))}
    </ul>
  );
}

export function StatsTab({ d }: { d: AdminUserDetail }) {
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
        <h2 className="mb-3 text-sm font-semibold text-gray-700">Uso de la plataforma</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Última visita" value={<span suppressHydrationWarning>{relTime(d.stats.lastSeenAt)}</span>} sub={d.stats.place} />
          <Stat label="Páginas vistas (con sesión)" value={d.stats.pageViews} />
          <Stat label="Conversaciones" value={host.threads + guest.threads} sub={`${host.threads} como anfitrión · ${guest.threads} como huésped`} />
          <Stat label="Reportes" value={d.reportsAgainst.length} sub={`en su contra · ${d.reportsBy.length} enviados`} />
          {d.associate.accounts.length > 0 && (
            <Stat
              label="Altas como asociado"
              value={d.associate.accounts.length}
              sub={`${d.associate.accounts.filter((a) => a.claimed).length} reclamadas · ${d.associate.drafts.pending} borradores por revisar`}
            />
          )}
        </div>
      </section>

      {isHost && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-gray-700">Como anfitrión</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Anuncios" value={host.listings} sub={`${host.published} publicados`} />
            <Stat label="Vistas de sus anuncios" value={host.views30} sub={`últimos 30 días · ${host.viewsTotal} en total`} />
            <Stat label="Vieron su contacto" value={host.contacts30} sub={`últimos 30 días · ${host.contactsTotal} en total`} />
            <Stat
              label="Conversión vista → contacto"
              value={host.viewsTotal ? `${Math.round((host.contactsTotal / host.viewsTotal) * 1000) / 10}%` : "—"}
            />
            <Stat label="Reservas recibidas" value={host.bookingsReceived} sub={`${host.nightsHosted} noches pagadas`} />
            <Stat label="Ingresos por estancias" value={mxn(host.revenueMxn)} sub="pagadas y no reembolsadas" />
            <Stat label="Tasa de respuesta" value={responseRate === null ? "—" : `${responseRate}%`} sub={`${host.threadsAnswered} de ${host.threads} hilos · 1ª respuesta en ${replyLabel}`} />
            <Stat
              label="Calificación"
              value={host.ratingAvg === null ? "—" : `${host.ratingAvg}★`}
              sub={`${host.reviewsReceived} reseñas recibidas · ${host.reviewsWritten} escritas`}
            />
            <Stat
              label="Ubicación verificada"
              value={`${d.listings.filter((l) => l.locationVerified).length} / ${d.listings.length}`}
              sub={`${d.addressProofs.length} comprobantes subidos · ${d.addressProofs.filter((p) => p.status === "review").length} por revisar`}
            />
            <Stat
              label="Reclamos de sus anuncios"
              value={d.listingClaims.length}
              sub={`${d.listingClaims.filter((c) => c.status === "open").length} abiertos`}
            />
            {d.associate.provisionedBy && (
              <Stat label="Alta con IA" value="Sí" sub={`por ${d.associate.provisionedBy.name}${d.account.claimedAt ? " · ya reclamada" : " · sin reclamar"}`} />
            )}
          </div>
          <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Reservas recibidas por estado</p>
            <StatusBars data={host.bookingsByStatus} />
          </div>
          {d.listings.length > 0 && (
            <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs text-gray-500">
                    <th className="px-4 py-2 font-medium">Anuncio</th>
                    <th className="px-4 py-2 font-medium">Estado</th>
                    <th className="px-4 py-2 text-right font-medium">Vistas 30d</th>
                    <th className="px-4 py-2 text-right font-medium">Contactos 30d</th>
                    <th className="px-4 py-2 font-medium">Actualizado</th>
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
                        {l.published ? <span className="text-green-700">Publicado</span> : <span className="text-gray-400">Borrador</span>}
                      </td>
                      <td className="px-4 py-2 text-right">{l.views30}</td>
                      <td className="px-4 py-2 text-right">{l.contacts30}</td>
                      <td className="px-4 py-2 text-xs text-gray-400">{new Date(l.updatedAt).toLocaleDateString("es-MX")}</td>
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
          <h2 className="mb-3 text-sm font-semibold text-gray-700">Como huésped</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Reservas" value={guest.bookings} sub={`${guest.nights} noches pagadas`} />
            <Stat label="Total pagado" value={mxn(guest.paidMxn)} sub="incluye cargo de plataforma" />
            <Stat label="Mensajes enviados" value={guest.messagesSent} sub={`en ${guest.threads} conversaciones`} />
            <Stat label="Favoritos" value={guest.savedListings} sub={`en ${guest.wishlists} listas`} />
            <Stat label="Reseñas escritas" value={guest.reviewsWritten} />
            <Stat
              label="Calificación de anfitriones"
              value={guest.ratingAvg === null ? "—" : `${guest.ratingAvg}★`}
              sub={`${guest.reviewsReceived} reseñas recibidas`}
            />
          </div>
          <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Reservas por estado</p>
            <StatusBars data={guest.bookingsByStatus} />
          </div>
        </section>
      )}
    </div>
  );
}

export function ConversationsTab({ d, initialKey }: { d: AdminUserDetail; initialKey?: string }) {
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

  if (!d.conversations.length) return <p className="text-sm text-gray-400">Este usuario no tiene conversaciones.</p>;

  return (
    <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
      <div className="space-y-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar en conversaciones…"
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
              {r === "" ? "Todas" : r === "host" ? "Como anfitrión" : "Como huésped"}
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
                    {relTime(c.lastAt)}
                  </span>
                </p>
                <p className="truncate text-xs text-gray-500">{c.listingTitle}</p>
                <p className="mt-0.5 text-[10px] text-gray-400">
                  {c.role === "host" ? "Es su huésped" : "Es su anfitrión"} · {c.messageCount} mensajes
                </p>
              </button>
            </li>
          ))}
          {list.length === 0 && <li className="px-3 py-6 text-center text-xs text-gray-400">Sin resultados.</li>}
        </ul>
      </div>
      {current && <Thread c={current} userName={d.user.fullName} highlight={q.trim()} />}
    </div>
  );
}

function Thread({ c, userName, highlight }: { c: AdminConversation; userName: string; highlight: string }) {
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
          {c.listingTitle} · {c.counterpartEmail ?? "sin correo"} · desde {new Date(c.firstAt).toLocaleDateString("es-MX")}
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
                  <p className="text-xs text-gray-500">{m.attachment === "image" ? "📷 Foto" : "🎤 Nota de voz"}</p>
                )}
                {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
                <p className="mt-1 text-[10px] text-gray-400">
                  {m.sender === "host" ? "Anfitrión" : "Huésped"}
                  {m.via === "ai" ? " · IA" : ""} · {when(m.createdAt)}
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
  const [kind, setKind] = useState<"" | AdminActivity["kind"]>("");
  const [q, setQ] = useState("");
  const kinds = useMemo(() => [...new Set(d.activity.map((a) => a.kind))], [d.activity]);
  const list = d.activity.filter(
    (a) => (!kind || a.kind === kind) && (!q || `${a.title} ${a.detail ?? ""}`.toLowerCase().includes(q.toLowerCase()))
  );

  const byDay = new Map<string, AdminActivity[]>();
  for (const a of list) {
    const day = new Date(a.when).toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
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
          placeholder="Buscar en la actividad…"
          className="min-w-[220px] flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
        <button
          type="button"
          onClick={() => setKind("")}
          className={`rounded-full border px-3 py-1 text-xs ${kind === "" ? "border-amber-500 bg-amber-50 text-amber-800" : "border-gray-200 text-gray-600"}`}
        >
          Todo ({d.activity.length})
        </button>
        {kinds.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={`rounded-full border px-3 py-1 text-xs ${kind === k ? "border-amber-500 bg-amber-50 text-amber-800" : "border-gray-200 text-gray-600"}`}
          >
            {KIND_META[k].icon} {KIND_META[k].label} ({d.activity.filter((a) => a.kind === k).length})
          </button>
        ))}
      </div>
      {list.length === 0 && <p className="text-sm text-gray-400">Sin actividad.</p>}
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
                      <p className="text-sm text-gray-900">{a.title}</p>
                      {a.detail && <p className="truncate text-xs text-gray-500">{a.detail}</p>}
                    </div>
                    <span className="shrink-0 text-xs text-gray-400">
                      {new Date(a.when).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
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
  if (!rows.length) return <p className="text-sm text-gray-400">{empty}</p>;
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.id} className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className={`rounded px-2 py-0.5 font-medium ${REPORT_STATUS_BADGE[r.status]}`}>{REPORT_STATUS_LABEL[r.status]}</span>
            <span className="font-semibold text-gray-800">{reportKindLabel(r.kind)}</span>
            <span className="text-gray-500">· {r.category}</span>
            <span className="ml-auto text-gray-400">{when(r.createdAt)}</span>
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{r.message}</p>
          <p className="mt-2 text-xs text-gray-500">
            De{" "}
            <Link href={`/admin/users/${r.reporterId}`} className="text-amber-700 hover:underline">
              {r.reporterName}
            </Link>
            {r.targetUserId && (
              <>
                {" "}
                sobre{" "}
                <Link href={`/admin/users/${r.targetUserId}`} className="text-amber-700 hover:underline">
                  {r.targetName ?? r.targetUserId}
                </Link>
              </>
            )}
            {!r.targetUserId && r.targetLabel && <> sobre “{r.targetLabel}”</>}
            {r.listingTitle && <> · {r.listingTitle}</>}
          </p>
          {r.adminNote && <p className="mt-2 rounded bg-gray-50 px-2 py-1 text-xs text-gray-600">Nota interna: {r.adminNote}</p>}
        </li>
      ))}
      <li>
        <Link href="/admin/reportes" className="text-xs text-amber-700 hover:underline">
          Gestionar en Reportes →
        </Link>
      </li>
    </ul>
  );
}
