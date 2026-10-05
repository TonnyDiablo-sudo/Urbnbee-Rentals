"use client";

import Link from "next/link";
import { Fragment, useMemo, useState } from "react";
import { useLang, useT } from "@/components/i18n-provider";
import type { AdminUserRow } from "@/lib/admin-data";
import { numberLocale, type TFn } from "@/lib/i18n";
import { ProductChip, UserPreview } from "./user-preview";

const ROLE_BADGE: Record<string, string> = {
  admin: "bg-amber-100 text-amber-800",
  host: "bg-blue-100 text-blue-800",
  guest: "bg-gray-100 text-gray-600",
};

const VERIF_BADGE: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  trialing: "bg-teal-100 text-teal-700",
  past_due: "bg-orange-100 text-orange-800",
  canceled: "bg-gray-100 text-gray-500",
  unpaid: "bg-red-100 text-red-700",
  none: "bg-gray-50 text-gray-400",
};

const DAY = 86_400_000;

type Filters = {
  q: string;
  role: "" | "guest" | "host" | "admin";
  activity: "" | "7" | "30" | "idle30" | "never";
  membership: "" | "active" | "none";
  kyc: "" | "verified" | "not_verified";
  ribbon: "" | "yes" | "no";
  hasListings: boolean;
  hasBookings: boolean;
  hasMessages: boolean;
  reported: boolean;
  pending: boolean;
  associate: boolean;
  product: string;
  from: string;
  to: string;
  sort: "newest" | "oldest" | "active" | "paid" | "earned" | "bookings" | "listings" | "messages" | "name";
};

const EMPTY: Filters = {
  q: "",
  role: "",
  activity: "",
  membership: "",
  kyc: "",
  ribbon: "",
  hasListings: false,
  hasBookings: false,
  hasMessages: false,
  reported: false,
  pending: false,
  associate: false,
  product: "",
  from: "",
  to: "",
  sort: "newest",
};

export function relTime(iso: string | undefined, t: TFn, locale: string): string {
  if (!iso) return t("nunca");
  const diff = Date.now() - Date.parse(iso);
  if (diff < 60_000) return t("ahora");
  if (diff < 3_600_000) return t("hace {n} min", { n: Math.floor(diff / 60_000) });
  if (diff < DAY) return t("hace {n} h", { n: Math.floor(diff / 3_600_000) });
  if (diff < 30 * DAY) return t("hace {n} d", { n: Math.floor(diff / DAY) });
  return new Date(iso).toLocaleDateString(locale);
}

function norm(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function pendingOf(u: AdminUserRow): number {
  return u.openReportsAgainst + u.pendingAddressProofs + u.openListingClaims;
}

function matches(u: AdminUserRow, f: Filters, now: number): boolean {
  if (f.q) {
    const hay = norm([u.fullName, u.email, u.id, u.phone ?? "", u.place ?? ""].join(" "));
    if (!norm(f.q).split(/\s+/).filter(Boolean).every((w) => hay.includes(w))) return false;
  }
  if (f.role && u.role !== f.role) return false;
  if (f.activity) {
    const at = u.lastActiveAt ? Date.parse(u.lastActiveAt) : 0;
    if (f.activity === "never" && at) return false;
    if (f.activity === "7" && (!at || now - at > 7 * DAY)) return false;
    if (f.activity === "30" && (!at || now - at > 30 * DAY)) return false;
    if (f.activity === "idle30" && (!at || now - at <= 30 * DAY)) return false;
  }
  const memberActive = u.verificationStatus === "active" || u.verificationStatus === "trialing" || u.hostMembershipActive;
  if (f.membership === "active" && !memberActive) return false;
  if (f.membership === "none" && memberActive) return false;
  if (f.kyc === "verified" && u.kycStatus !== "verified") return false;
  if (f.kyc === "not_verified" && u.kycStatus === "verified") return false;
  if (f.ribbon === "yes" && !u.hostRibbon) return false;
  if (f.ribbon === "no" && u.hostRibbon) return false;
  if (f.hasListings && u.listingsCount === 0) return false;
  if (f.hasBookings && u.bookingsAsGuest + u.bookingsAsHost === 0) return false;
  if (f.hasMessages && u.threads === 0) return false;
  if (f.reported && u.openReportsAgainst === 0) return false;
  if (f.pending && pendingOf(u) === 0) return false;
  if (f.associate && !u.associate && u.provisionedAccounts === 0) return false;
  if (f.product === "any" && u.products.length === 0) return false;
  if (f.product === "none" && u.products.length > 0) return false;
  if (f.product && f.product !== "any" && f.product !== "none" && !u.products.some((p) => p.key === f.product)) return false;
  if (f.from && u.createdAt.slice(0, 10) < f.from) return false;
  if (f.to && u.createdAt.slice(0, 10) > f.to) return false;
  return true;
}

function sorter(sort: Filters["sort"]) {
  switch (sort) {
    case "oldest":
      return (a: AdminUserRow, b: AdminUserRow) => a.createdAt.localeCompare(b.createdAt);
    case "active":
      return (a: AdminUserRow, b: AdminUserRow) => (b.lastActiveAt ?? "").localeCompare(a.lastActiveAt ?? "");
    case "paid":
      return (a: AdminUserRow, b: AdminUserRow) => b.totalPaidMxn - a.totalPaidMxn;
    case "earned":
      return (a: AdminUserRow, b: AdminUserRow) => b.hostRevenueMxn - a.hostRevenueMxn;
    case "bookings":
      return (a: AdminUserRow, b: AdminUserRow) => b.bookingsAsGuest + b.bookingsAsHost - (a.bookingsAsGuest + a.bookingsAsHost);
    case "listings":
      return (a: AdminUserRow, b: AdminUserRow) => b.listingsCount - a.listingsCount;
    case "messages":
      return (a: AdminUserRow, b: AdminUserRow) => b.messagesSent - a.messagesSent;
    case "name":
      return (a: AdminUserRow, b: AdminUserRow) => a.fullName.localeCompare(b.fullName, "es");
    default:
      return (a: AdminUserRow, b: AdminUserRow) => b.createdAt.localeCompare(a.createdAt);
  }
}

const sel = "rounded-lg border border-gray-200 bg-white px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400";

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        on ? "border-amber-500 bg-amber-50 text-amber-800" : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
      }`}
    >
      {children}
    </button>
  );
}

const COLUMNS = ["", "Usuario", "Rol", "Última actividad", "Anuncios", "Reservas", "Mensajes", "Dinero", "Productos", "Registro", ""];

export function UsersExplorer({ users, initialPending = false }: { users: AdminUserRow[]; initialPending?: boolean }) {
  const t = useT();
  const locale = numberLocale(useLang());
  const fmx = (n: number) => (n === 0 ? "—" : `$${n.toLocaleString(locale, { maximumFractionDigits: 0 })}`);
  const [f, setF] = useState<Filters>(() => ({ ...EMPTY, pending: initialPending }));
  const [now] = useState(() => Date.now());
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const productOptions = useMemo(() => {
    const m = new Map<string, { label: string; n: number }>();
    for (const u of users) for (const p of u.products) m.set(p.key, { label: p.label, n: (m.get(p.key)?.n ?? 0) + 1 });
    return [...m.entries()].sort((a, b) => b[1].n - a[1].n);
  }, [users]);
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => setF((p) => ({ ...p, [k]: v }));

  const rows = useMemo(() => users.filter((u) => matches(u, f, now)).sort(sorter(f.sort)), [users, f, now]);
  const dirty = JSON.stringify({ ...f, sort: "newest" }) !== JSON.stringify(EMPTY);

  const counts = useMemo(
    () => ({
      host: users.filter((u) => u.role === "host").length,
      guest: users.filter((u) => u.role === "guest").length,
      active7: users.filter((u) => u.lastActiveAt && now - Date.parse(u.lastActiveAt) <= 7 * DAY).length,
      reported: users.filter((u) => u.openReportsAgainst > 0).length,
      pending: users.filter((u) => pendingOf(u) > 0).length,
    }),
    [users, now]
  );

  function exportCsv() {
    const head = ["id", "nombre", "correo", "rol", "registro", "ultima_actividad", "anuncios", "reservas_huesped", "reservas_anfitrion", "pagado_mxn", "mensajes", "lugar", "reportes_abiertos", "cobrado_anfitrion_mxn", "productos"];
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = rows.map((u) =>
      [u.id, u.fullName, u.email, u.role, u.createdAt, u.lastActiveAt ?? "", u.listingsCount, u.bookingsAsGuest, u.bookingsAsHost, u.totalPaidMxn, u.messagesSent, u.place ?? "", u.openReportsAgainst, u.hostRevenueMxn, u.products.map((p) => p.label).join(" | ")]
        .map(esc)
        .join(",")
    );
    const blob = new Blob([[head.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `usuarios-cabibee-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t("Usuarios")}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {t("{total} en total · {hosts} anfitriones · {guests} huéspedes · {active} activos esta semana", {
              total: users.length,
              hosts: counts.host,
              guests: counts.guest,
              active: counts.active7,
            })}
            {counts.reported > 0 && (
              <span className="text-red-600"> · {t("{count} con reportes abiertos", { count: counts.reported })}</span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={exportCsv}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          {t("Exportar CSV ({count})", { count: rows.length })}
        </button>
      </div>

      <div className="mb-4 space-y-3 rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap gap-2">
          <input
            value={f.q}
            onChange={(e) => set("q", e.target.value)}
            placeholder={t("Buscar por nombre, correo, teléfono, ID o ciudad…")}
            className="min-w-[260px] flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          <select value={f.role} onChange={(e) => set("role", e.target.value as Filters["role"])} className={sel}>
            <option value="">{t("Todos los roles")}</option>
            <option value="guest">{t("Huéspedes")}</option>
            <option value="host">{t("Anfitriones")}</option>
            <option value="admin">{t("Admins")}</option>
          </select>
          <select value={f.activity} onChange={(e) => set("activity", e.target.value as Filters["activity"])} className={sel}>
            <option value="">{t("Cualquier actividad")}</option>
            <option value="7">{t("Activos últimos 7 días")}</option>
            <option value="30">{t("Activos últimos 30 días")}</option>
            <option value="idle30">{t("Inactivos +30 días")}</option>
            <option value="never">{t("Sin actividad")}</option>
          </select>
          <select value={f.sort} onChange={(e) => set("sort", e.target.value as Filters["sort"])} className={sel}>
            <option value="newest">{t("Más nuevos")}</option>
            <option value="oldest">{t("Más antiguos")}</option>
            <option value="active">{t("Actividad reciente")}</option>
            <option value="paid">{t("Más pagado (huésped)")}</option>
            <option value="earned">{t("Más cobrado (anfitrión)")}</option>
            <option value="bookings">{t("Más reservas")}</option>
            <option value="listings">{t("Más anuncios")}</option>
            <option value="messages">{t("Más mensajes")}</option>
            <option value="name">{t("Nombre A–Z")}</option>
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={f.membership} onChange={(e) => set("membership", e.target.value as Filters["membership"])} className={sel}>
            <option value="">{t("Membresía: todas")}</option>
            <option value="active">{t("Con membresía")}</option>
            <option value="none">{t("Sin membresía")}</option>
          </select>
          <select value={f.kyc} onChange={(e) => set("kyc", e.target.value as Filters["kyc"])} className={sel}>
            <option value="">{t("Identidad: todas")}</option>
            <option value="verified">{t("Identidad verificada")}</option>
            <option value="not_verified">{t("Sin verificar")}</option>
          </select>
          <select value={f.ribbon} onChange={(e) => set("ribbon", e.target.value as Filters["ribbon"])} className={sel}>
            <option value="">{t("Listón: todos")}</option>
            <option value="yes">{t("Con listón")}</option>
            <option value="no">{t("Sin listón")}</option>
          </select>
          <select value={f.product} onChange={(e) => set("product", e.target.value)} className={sel}>
            <option value="">{t("Productos: todos")}</option>
            <option value="any">{t("Con algún producto")}</option>
            <option value="none">{t("Sin productos")}</option>
            {productOptions.map(([key, o]) => (
              <option key={key} value={key}>
                {t(o.label)} ({o.n})
              </option>
            ))}
          </select>
          <label className="flex flex-wrap items-center gap-1 text-xs text-gray-500">
            {t("Registro del")}
            <input type="date" value={f.from} onChange={(e) => set("from", e.target.value)} className={`${sel} min-w-0`} />
            {t("al")}
            <input type="date" value={f.to} onChange={(e) => set("to", e.target.value)} className={`${sel} min-w-0`} />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Chip on={f.hasListings} onClick={() => set("hasListings", !f.hasListings)}>{t("Con anuncios")}</Chip>
          <Chip on={f.hasBookings} onClick={() => set("hasBookings", !f.hasBookings)}>{t("Con reservas")}</Chip>
          <Chip on={f.hasMessages} onClick={() => set("hasMessages", !f.hasMessages)}>{t("Con conversaciones")}</Chip>
          <Chip on={f.pending} onClick={() => set("pending", !f.pending)}>
            {t("Pendientes por revisar")}
            {counts.pending > 0 ? ` (${counts.pending})` : ""}
          </Chip>
          <Chip on={f.reported} onClick={() => set("reported", !f.reported)}>{t("Con reportes abiertos")}</Chip>
          <Chip on={f.associate} onClick={() => set("associate", !f.associate)}>{t("Asociados (alta con IA)")}</Chip>
          {dirty && (
            <button type="button" onClick={() => setF({ ...EMPTY, sort: f.sort })} className="ml-auto text-xs text-amber-700 hover:underline">
              {t("Limpiar filtros")}
            </button>
          )}
        </div>
      </div>

      <p className="mb-2 text-xs text-gray-400">
        {rows.length === users.length
          ? t("{count} usuarios", { count: rows.length })
          : t("{count} de {total} usuarios", { count: rows.length, total: users.length })}
      </p>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left">
                {COLUMNS.map((h, i) => (
                  <th
                    key={i}
                    className={`px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 ${
                      i >= 4 && i <= 6 ? "text-center" : i === 7 ? "text-right" : ""
                    }`}
                  >
                    {h && t(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-4 py-10 text-center text-gray-400">
                    {t("Ningún usuario coincide con los filtros.")}
                  </td>
                </tr>
              )}
              {rows.map((u) => (
                <Fragment key={u.id}>
                <tr className={`transition-colors hover:bg-gray-50 ${open.has(u.id) ? "bg-amber-50/40" : ""}`}>
                  <td className="py-3 pl-3">
                    <button
                      type="button"
                      onClick={() => toggle(u.id)}
                      title={open.has(u.id) ? t("Ocultar actividad") : t("Ver datos, actividad y productos")}
                      className="flex h-6 w-6 items-center justify-center rounded border border-gray-200 text-xs text-gray-500 hover:border-amber-400 hover:text-amber-700"
                    >
                      {open.has(u.id) ? "▾" : "▸"}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/users/${u.id}`} className="font-medium text-gray-900 hover:text-amber-700">
                      {u.fullName || t("(sin nombre)")}
                    </Link>
                    <p className="mt-0.5 text-xs text-gray-400">{u.email}</p>
                    {(u.place || pendingOf(u) > 0) && (
                      <p className="mt-0.5 text-[11px]">
                        {u.place && <span className="text-gray-400">📍 {u.place}</span>}
                        {u.openReportsAgainst > 0 && (
                          <Link href={`/admin/users/${u.id}?tab=reports`} className="ml-2 rounded bg-red-100 px-1.5 py-0.5 font-medium text-red-700">
                            {u.openReportsAgainst === 1
                              ? t("1 reporte")
                              : t("{count} reportes", { count: u.openReportsAgainst })}
                          </Link>
                        )}
                        {u.pendingAddressProofs > 0 && (
                          <Link href={`/admin/users/${u.id}?tab=listings`} className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-800">
                            {u.pendingAddressProofs === 1
                              ? t("1 comprobante por revisar")
                              : t("{count} comprobantes por revisar", { count: u.pendingAddressProofs })}
                          </Link>
                        )}
                        {u.openListingClaims > 0 && (
                          <Link href={`/admin/users/${u.id}?tab=listings`} className="ml-2 rounded bg-orange-100 px-1.5 py-0.5 font-medium text-orange-800">
                            {u.openListingClaims === 1
                              ? t("1 reclamo de anuncio")
                              : t("{count} reclamos de anuncio", { count: u.openListingClaims })}
                          </Link>
                        )}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${ROLE_BADGE[u.role] ?? "bg-gray-100 text-gray-700"}`}>
                      {u.role}
                    </span>
                    {u.associate && (
                      <p className="mt-1 text-[10px] text-purple-600">
                        {t("asociado")}
                        {u.provisionedAccounts > 0 ? ` · ${t("{count} altas", { count: u.provisionedAccounts })}` : ""}
                      </p>
                    )}
                    {u.provisionedById && <p className="mt-1 text-[10px] text-purple-500">{t("alta con IA")}</p>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500" title={u.lastActiveAt} suppressHydrationWarning>
                    {relTime(u.lastActiveAt, t, locale)}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-700">
                    {u.listingsCount > 0 ? (
                      <span>
                        {u.listingsCount}
                        {u.listingsPublished > 0 && (
                          <span className="ml-1 text-xs text-gray-400">{t("({count} pub.)", { count: u.listingsPublished })}</span>
                        )}
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center text-xs text-gray-700">
                    {u.bookingsAsGuest + u.bookingsAsHost > 0 ? (
                      <span>
                        {u.bookingsAsGuest > 0 && <span title={t("Como huésped")}>🧳 {u.bookingsAsGuest}</span>}
                        {u.bookingsAsGuest > 0 && u.bookingsAsHost > 0 && " · "}
                        {u.bookingsAsHost > 0 && <span title={t("Como anfitrión")}>🏠 {u.bookingsAsHost}</span>}
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center text-xs text-gray-700">
                    {u.threads > 0 ? (
                      <span title={t("{messages} mensajes enviados en {threads} conversaciones", { messages: u.messagesSent, threads: u.threads })}>
                        {u.messagesSent} <span className="text-gray-400">{t("/ {count} hilos", { count: u.threads })}</span>
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-xs text-gray-700">
                    {u.totalPaidMxn > 0 && (
                      <p title={t("Pagado como huésped")}>
                        🧳 <span className="font-medium">{fmx(u.totalPaidMxn)}</span>
                      </p>
                    )}
                    {u.platformFeePaidMxn > 0 && <p className="text-[11px] text-amber-600">+{fmx(u.platformFeePaidMxn)} fee</p>}
                    {u.hostRevenueMxn > 0 && (
                      <p title={t("Cobrado como anfitrión")}>
                        🏠 <span className="font-medium">{fmx(u.hostRevenueMxn)}</span>
                      </p>
                    )}
                    {!u.totalPaidMxn && !u.hostRevenueMxn && <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex max-w-[220px] flex-wrap gap-1">
                      {u.products.slice(0, 3).map((p) => (
                        <ProductChip key={p.key} p={p} />
                      ))}
                      {u.products.length > 3 && <span className="text-[10px] text-gray-400">+{u.products.length - 3}</span>}
                      {u.products.length === 0 && u.verificationStatus !== "none" && (
                        <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${VERIF_BADGE[u.verificationStatus] ?? "bg-gray-50 text-gray-400"}`}>
                          {t("membresía {status}", { status: u.verificationStatus })}
                        </span>
                      )}
                      {u.products.length === 0 && u.verificationStatus === "none" && <span className="text-gray-300">—</span>}
                    </div>
                    {u.kycStatus === "verified" && <p className="mt-0.5 text-[10px] text-green-600">{t("ID verificada")}</p>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-400">{new Date(u.createdAt).toLocaleDateString(locale)}</td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/users/${u.id}`} className="whitespace-nowrap text-xs text-amber-600 hover:underline">
                      {t("Ver →")}
                    </Link>
                  </td>
                </tr>
                {open.has(u.id) && (
                  <tr className="bg-gray-50">
                    <td colSpan={11} className="px-4 py-2">
                      <UserPreview id={u.id} />
                    </td>
                  </tr>
                )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
