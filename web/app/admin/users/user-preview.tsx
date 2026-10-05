"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { AdminProduct } from "@/lib/admin-data";
import type { AdminActivity, AdminUserDetail } from "@/lib/admin-user-detail";

const ICON: Record<AdminActivity["kind"], string> = {
  account: "👤",
  visit: "👀",
  listing: "🏡",
  booking: "📅",
  payment: "💳",
  message: "💬",
  review: "⭐",
  report: "🚩",
  verification: "🛡️",
};

const STATUS_ES: Record<string, string> = {
  AWAITING_PAYMENT: "esperando pago",
  PENDING: "pendientes",
  PENDING_HOST: "pendientes",
  AWAITING_DETAILS: "esperando datos",
  CONFIRMED: "confirmadas",
  REJECTED: "rechazadas",
  CANCELLED: "canceladas",
  COMPLETED: "completadas",
  EXPIRED: "expiradas",
};

const mxn = (n: number) => (n ? `$${n.toLocaleString("es-MX", { maximumFractionDigits: 0 })}` : "—");
const when = (iso: string) => new Date(iso).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" });

function byStatus(m: Partial<Record<string, number>>): string {
  const parts = Object.entries(m)
    .filter(([, n]) => (n ?? 0) > 0)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
    .map(([s, n]) => `${n} ${STATUS_ES[s] ?? s.toLowerCase()}`);
  return parts.join(" · ");
}

export function ProductChip({ p }: { p: AdminProduct }) {
  const warn = p.status === "past_due" || p.status === "cancela al vencer";
  return (
    <span
      title={[p.detail, p.until ? `vence ${new Date(p.until).toLocaleDateString("es-MX")}` : "", p.status].filter(Boolean).join(" · ")}
      className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${warn ? "bg-orange-100 text-orange-800" : "bg-emerald-50 text-emerald-800"}`}
    >
      {p.label}
    </span>
  );
}

function Num({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="rounded-lg border border-gray-100 bg-white px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-gray-400">{label}</p>
      <p className="text-lg font-bold text-gray-900">{value}</p>
      {sub && <p className="truncate text-[10px] text-gray-500" title={sub}>{sub}</p>}
    </div>
  );
}

export function UserPreview({ id }: { id: string }) {
  const [d, setD] = useState<AdminUserDetail | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    fetch(`/api/admin/users/${encodeURIComponent(id)}`)
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then((j: AdminUserDetail | null) => {
        if (alive) setD(j);
      });
    return () => {
      alive = false;
    };
  }, [id]);

  if (d === undefined) return <p className="animate-pulse px-2 py-4 text-sm text-gray-400">Cargando actividad…</p>;
  if (d === null) return <p className="px-2 py-4 text-sm text-red-500">No se pudo cargar.</p>;

  const { host, guest } = d.stats;
  const u = d.user;
  const isHost = host.listings > 0 || host.bookingsReceived > 0;
  const tab = (t: string) => `/admin/users/${u.id}?tab=${t}`;

  return (
    <div className="grid gap-4 p-2 lg:grid-cols-[1fr_1.1fr]">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {isHost && (
            <>
              <Num label="Anuncios" value={host.listings} sub={`${host.published} publicados · ${host.listings - host.published} borradores`} />
              <Num label="Vistas 30 días" value={host.views30} sub={`${host.contacts30} vieron su contacto`} />
              <Num label="Reservas recibidas" value={host.bookingsReceived} sub={byStatus(host.bookingsByStatus) || `${host.nightsHosted} noches`} />
              <Num label="Cobrado como anfitrión" value={mxn(host.revenueMxn)} sub={`${host.nightsHosted} noches pagadas`} />
            </>
          )}
          <Num label="Reservas como huésped" value={guest.bookings} sub={byStatus(guest.bookingsByStatus) || "sin reservas"} />
          <Num label="Pagado como huésped" value={mxn(guest.paidMxn)} sub={`${guest.nights} noches`} />
          <Num label="Mensajes" value={u.messagesSent} sub={`${host.threads + guest.threads} conversaciones`} />
          <Num
            label="Reseñas"
            value={host.reviewsReceived + guest.reviewsReceived}
            sub={[host.ratingAvg !== null ? `${host.ratingAvg}★ anfitrión` : "", guest.ratingAvg !== null ? `${guest.ratingAvg}★ huésped` : "", `${host.reviewsWritten + guest.reviewsWritten} escritas`]
              .filter(Boolean)
              .join(" · ")}
          />
          <Num label="Favoritos" value={guest.savedListings} sub={`${guest.wishlists} listas`} />
          <Num label="Páginas vistas" value={d.stats.pageViews} sub={d.stats.place ?? "con sesión"} />
        </div>

        <div className="rounded-lg border border-gray-100 bg-white p-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Productos y servicios</p>
          {u.products.length === 0 ? (
            <p className="text-xs text-gray-400">No ha comprado nada ni tiene servicios activos.</p>
          ) : (
            <ul className="space-y-1">
              {u.products.map((p) => (
                <li key={p.key} className="flex flex-wrap items-center gap-2 text-xs">
                  <ProductChip p={p} />
                  <span className="text-gray-600">{[p.detail, p.status].filter(Boolean).join(" · ")}</span>
                  {p.until && <span className="text-gray-400">vence {new Date(p.until).toLocaleDateString("es-MX")}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg border border-gray-100 bg-white p-3 text-xs text-gray-600">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">Datos</p>
          <p>
            {u.email} {d.account.emailVerifiedAt ? <span className="text-green-600">✓</span> : <span className="text-gray-400">(sin verificar)</span>}
            {d.account.phone && <> · 📞 {d.account.phone}</>}
          </p>
          {d.account.addressLine && <p>🏠 {d.account.addressLine}</p>}
          <p>
            Registro {new Date(u.createdAt).toLocaleDateString("es-MX")} · identidad {u.kycStatus === "verified" ? "verificada" : u.kycStatus}
            {u.hostRibbon && " · listón de anfitrión"}
            {d.associate.provisionedBy && ` · alta con IA por ${d.associate.provisionedBy.name}`}
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-gray-100 bg-white p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Actividad reciente</p>
          <Link href={tab("activity")} className="text-xs text-amber-700 hover:underline">
            Ver toda ({d.activity.length}) →
          </Link>
        </div>
        {d.activity.length === 0 ? (
          <p className="text-xs text-gray-400">Sin actividad.</p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {d.activity.slice(0, 10).map((a) => (
              <li key={a.id} className="flex items-start gap-2 py-1.5 text-xs">
                <span>{ICON[a.kind]}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-gray-800">{a.title}</p>
                  {a.detail && <p className="truncate text-gray-400">{a.detail}</p>}
                </div>
                <span className="shrink-0 text-gray-400">{when(a.when)}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 flex flex-wrap gap-2 border-t border-gray-50 pt-2 text-xs">
          <Link href={tab("chats")} className="text-amber-700 hover:underline">Conversaciones</Link>
          <Link href={tab("bookings")} className="text-amber-700 hover:underline">Reservas</Link>
          {isHost && <Link href={tab("listings")} className="text-amber-700 hover:underline">Anuncios y domicilio</Link>}
          <Link href={tab("stats")} className="text-amber-700 hover:underline">Estadísticas</Link>
        </div>
      </div>
    </div>
  );
}
