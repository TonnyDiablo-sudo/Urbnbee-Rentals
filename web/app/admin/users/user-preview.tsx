"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLang, useT } from "@/components/i18n-provider";
import type { AdminProduct } from "@/lib/admin-data";
import type { AdminActivity, AdminUserDetail } from "@/lib/admin-user-detail";
import { numberLocale, type TFn } from "@/lib/i18n";

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

function byStatus(m: Partial<Record<string, number>>, t: TFn): string {
  const parts = Object.entries(m)
    .filter(([, n]) => (n ?? 0) > 0)
    .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
    .map(([s, n]) => `${n} ${STATUS_ES[s] ? t(STATUS_ES[s]) : s.toLowerCase()}`);
  return parts.join(" · ");
}

/** Estado y detalle de un producto, traducidos cuando son fijos. */
export function productInfo(p: AdminProduct, t: TFn): string {
  return [p.detail && t(p.detail), p.status && t(p.status)].filter(Boolean).join(" · ");
}

export function ProductChip({ p }: { p: AdminProduct }) {
  const t = useT();
  const locale = numberLocale(useLang());
  const warn = p.status === "past_due" || p.status === "cancela al vencer";
  return (
    <span
      title={[p.detail && t(p.detail), p.until ? t("vence {date}", { date: new Date(p.until).toLocaleDateString(locale) }) : "", p.status && t(p.status)]
        .filter(Boolean)
        .join(" · ")}
      className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${warn ? "bg-orange-100 text-orange-800" : "bg-emerald-50 text-emerald-800"}`}
    >
      {t(p.label)}
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
  const t = useT();
  const locale = numberLocale(useLang());
  const mxn = (n: number) => (n ? `$${n.toLocaleString(locale, { maximumFractionDigits: 0 })}` : "—");
  const when = (iso: string) => new Date(iso).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" });
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

  if (d === undefined) return <p className="animate-pulse px-2 py-4 text-sm text-gray-400">{t("Cargando actividad…")}</p>;
  if (d === null) return <p className="px-2 py-4 text-sm text-red-500">{t("No se pudo cargar.")}</p>;

  const { host, guest } = d.stats;
  const u = d.user;
  const isHost = host.listings > 0 || host.bookingsReceived > 0;
  const tab = (name: string) => `/admin/users/${u.id}?tab=${name}`;

  return (
    <div className="grid gap-4 p-2 lg:grid-cols-[1fr_1.1fr]">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {isHost && (
            <>
              <Num
                label={t("Anuncios")}
                value={host.listings}
                sub={t("{published} publicados · {drafts} borradores", { published: host.published, drafts: host.listings - host.published })}
              />
              <Num label={t("Vistas 30 días")} value={host.views30} sub={t("{count} vieron su contacto", { count: host.contacts30 })} />
              <Num
                label={t("Reservas recibidas")}
                value={host.bookingsReceived}
                sub={byStatus(host.bookingsByStatus, t) || t("{count} noches", { count: host.nightsHosted })}
              />
              <Num label={t("Cobrado como anfitrión")} value={mxn(host.revenueMxn)} sub={t("{count} noches pagadas", { count: host.nightsHosted })} />
            </>
          )}
          <Num label={t("Reservas como huésped")} value={guest.bookings} sub={byStatus(guest.bookingsByStatus, t) || t("sin reservas")} />
          <Num label={t("Pagado como huésped")} value={mxn(guest.paidMxn)} sub={t("{count} noches", { count: guest.nights })} />
          <Num label={t("Mensajes")} value={u.messagesSent} sub={t("{count} conversaciones", { count: host.threads + guest.threads })} />
          <Num
            label={t("Reseñas")}
            value={host.reviewsReceived + guest.reviewsReceived}
            sub={[
              host.ratingAvg !== null ? t("{rating}★ anfitrión", { rating: host.ratingAvg }) : "",
              guest.ratingAvg !== null ? t("{rating}★ huésped", { rating: guest.ratingAvg }) : "",
              t("{count} escritas", { count: host.reviewsWritten + guest.reviewsWritten }),
            ]
              .filter(Boolean)
              .join(" · ")}
          />
          <Num label={t("Favoritos")} value={guest.savedListings} sub={t("{count} listas", { count: guest.wishlists })} />
          <Num label={t("Páginas vistas")} value={d.stats.pageViews} sub={d.stats.place ?? t("con sesión")} />
        </div>

        <div className="rounded-lg border border-gray-100 bg-white p-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-gray-400">{t("Productos y servicios")}</p>
          {u.products.length === 0 ? (
            <p className="text-xs text-gray-400">{t("No ha comprado nada ni tiene servicios activos.")}</p>
          ) : (
            <ul className="space-y-1">
              {u.products.map((p) => (
                <li key={p.key} className="flex flex-wrap items-center gap-2 text-xs">
                  <ProductChip p={p} />
                  <span className="text-gray-600">{productInfo(p, t)}</span>
                  {p.until && <span className="text-gray-400">{t("vence {date}", { date: new Date(p.until).toLocaleDateString(locale) })}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg border border-gray-100 bg-white p-3 text-xs text-gray-600">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">{t("Datos")}</p>
          <p>
            {u.email} {d.account.emailVerifiedAt ? <span className="text-green-600">✓</span> : <span className="text-gray-400">{t("(sin verificar)")}</span>}
            {d.account.phone && <> · 📞 {d.account.phone}</>}
          </p>
          {d.account.addressLine && <p>🏠 {d.account.addressLine}</p>}
          <p>
            {t("Registro {date}", { date: new Date(u.createdAt).toLocaleDateString(locale) })} ·{" "}
            {u.kycStatus === "verified" ? t("identidad verificada") : t("identidad {status}", { status: u.kycStatus })}
            {u.hostRibbon && ` · ${t("listón de anfitrión")}`}
            {d.associate.provisionedBy && ` · ${t("alta con IA por {name}", { name: d.associate.provisionedBy.name })}`}
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-gray-100 bg-white p-3">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{t("Actividad reciente")}</p>
          <Link href={tab("activity")} className="text-xs text-amber-700 hover:underline">
            {t("Ver toda ({count}) →", { count: d.activity.length })}
          </Link>
        </div>
        {d.activity.length === 0 ? (
          <p className="text-xs text-gray-400">{t("Sin actividad.")}</p>
        ) : (
          <ul className="divide-y divide-gray-50">
            {d.activity.slice(0, 10).map((a) => (
              <li key={a.id} className="flex items-start gap-2 py-1.5 text-xs">
                <span>{ICON[a.kind]}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-gray-800">{t(a.title)}</p>
                  {a.detail && <p className="truncate text-gray-400">{t(a.detail)}</p>}
                </div>
                <span className="shrink-0 text-gray-400">{when(a.when)}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 flex flex-wrap gap-2 border-t border-gray-50 pt-2 text-xs">
          <Link href={tab("chats")} className="text-amber-700 hover:underline">{t("Conversaciones")}</Link>
          <Link href={tab("bookings")} className="text-amber-700 hover:underline">{t("Reservas")}</Link>
          {isHost && <Link href={tab("listings")} className="text-amber-700 hover:underline">{t("Anuncios y domicilio")}</Link>}
          <Link href={tab("stats")} className="text-amber-700 hover:underline">{t("Estadísticas")}</Link>
        </div>
      </div>
    </div>
  );
}
