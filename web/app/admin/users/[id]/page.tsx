"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import type { AdminUserRow } from "@/lib/admin-data";
import type { AdminBookingRow } from "@/lib/admin-data";
import type { AdminUserDetail } from "@/lib/admin-user-detail";
import { relTime } from "../users-explorer";
import { ProductChip } from "../user-preview";
import { ActivityTab, ConversationsTab, ReportList, StatsTab } from "./user-tabs";
import { AssociateTab, ListingsTab, hasAssociateData, openClaims, pendingProofs } from "./user-tabs-extra";

type Tab = "summary" | "stats" | "chats" | "activity" | "bookings" | "listings" | "associate" | "reports";
const TABS: Tab[] = ["summary", "stats", "chats", "activity", "bookings", "listings", "associate", "reports"];

function initialTab(): Tab {
  if (typeof window === "undefined") return "summary";
  const t = new URLSearchParams(window.location.search).get("tab") as Tab | null;
  return t && TABS.includes(t) ? t : "summary";
}

const ROLE_BADGE: Record<string, string> = {
  admin: "bg-amber-100 text-amber-800",
  host: "bg-blue-100 text-blue-800",
  guest: "bg-gray-100 text-gray-600",
};

const STATUS_COLORS: Record<string, string> = {
  AWAITING_PAYMENT: "bg-yellow-100 text-yellow-800",
  PENDING: "bg-blue-100 text-blue-800",
  CONFIRMED: "bg-green-100 text-green-800",
  COMPLETED: "bg-emerald-100 text-emerald-800",
  REJECTED: "bg-red-100 text-red-800",
  CANCELLED: "bg-gray-100 text-gray-600",
  AWAITING_DETAILS: "bg-purple-100 text-purple-800",
};

export default function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [user, setUser] = useState<AdminUserRow | null>(null);
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [bookings, setBookings] = useState<AdminBookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>(initialTab);
  const [version, setVersion] = useState(0);
  const [chatKey, setChatKey] = useState<string | undefined>();
  const [roleChanging, setRoleChanging] = useState(false);
  const [newRole, setNewRole] = useState<string>("");
  const [roleMsg, setRoleMsg] = useState("");
  const [badgeBusy, setBadgeBusy] = useState(false);
  const [badgeMsg, setBadgeMsg] = useState("");
  const [passBusy, setPassBusy] = useState(false);
  const [passMsg, setPassMsg] = useState("");

  useEffect(() => {
    let alive = true;
    Promise.all([fetch(`/api/admin/users/${encodeURIComponent(id)}`), fetch("/api/admin/bookings")]).then(
      async ([uRes, bRes]) => {
        const d: AdminUserDetail | null = uRes.ok ? await uRes.json() : null;
        const allBookings: AdminBookingRow[] = await bRes.json();
        if (!alive) return;
        const found = d?.user ?? null;
        setDetail(d);
        setUser(found);
        setNewRole(found?.role ?? "guest");
        setBookings(
          allBookings.filter(
            (b) => b.guestUserId === id || b.hostId === id
          )
        );
        setLoading(false);
      }
    );
    return () => {
      alive = false;
    };
  }, [id, version]);

  async function handleRoleChange() {
    if (!user || newRole === user.role) return;
    setRoleChanging(true);
    setRoleMsg("");
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: newRole }),
    });
    setRoleChanging(false);
    if (res.ok) {
      setRoleMsg("Rol actualizado correctamente.");
      setUser((prev) => (prev ? { ...prev, role: newRole as AdminUserRow["role"] } : prev));
    } else {
      const err = await res.json().catch(() => ({}));
      setRoleMsg((err as { error?: string }).error ?? "Error al cambiar el rol.");
    }
  }

  async function patchHostVerification(body: { verified?: boolean; membership?: boolean }) {
    if (!user) return;
    setBadgeBusy(true);
    setBadgeMsg("");
    try {
      const res = await fetch(`/api/admin/hosts/${id}/verification`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setBadgeMsg((j as { error?: string }).error ?? "No se pudo guardar.");
        return;
      }
      const v = j.verification as
        | {
            identityVerified?: boolean;
            membershipActive?: boolean;
            ribbon?: boolean;
            verifiedAt?: string;
            source?: "identity" | "admin";
          }
        | undefined;
      setBadgeMsg(`Listo. ${j.listingsUpdated ?? 0} alojamientos actualizados.`);
      setUser((prev) =>
        prev
          ? {
              ...prev,
              hostVerified: v?.identityVerified ?? prev.hostVerified,
              hostVerifiedAt: v?.verifiedAt,
              hostVerificationSource: v?.source,
              hostMembershipActive: v?.membershipActive ?? prev.hostMembershipActive,
              hostRibbon: v?.ribbon ?? prev.hostRibbon,
            }
          : prev
      );
    } catch {
      setBadgeMsg("Error de red.");
    } finally {
      setBadgeBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <p className="text-gray-400 animate-pulse">Cargando…</p>
      </div>
    );
  }

  if (!user || !detail) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <p className="text-red-500">Usuario no encontrado.</p>
        <Link href="/admin/users" className="text-amber-600 text-sm mt-2 block hover:underline">
          ← Volver a usuarios
        </Link>
      </div>
    );
  }

  const guestBookings = bookings.filter((b) => b.guestUserId === id);
  const hostBookings = bookings.filter((b) => b.hostId === id);
  const openReports = detail.reportsAgainst.filter((r) => r.status === "open" || r.status === "in_review").length;
  const tabs: { id: Tab; label: string; badge?: number; alert?: boolean }[] = [
    { id: "summary", label: "Resumen y gestión" },
    { id: "stats", label: "Estadísticas" },
    { id: "chats", label: "Conversaciones", badge: detail.conversations.length },
    { id: "activity", label: "Actividad", badge: detail.activity.length },
    { id: "bookings", label: "Reservas", badge: guestBookings.length + hostBookings.length },
    ...(detail.listings.length || detail.addressProofs.length || detail.listingClaims.length
      ? [
          {
            id: "listings" as const,
            label: "Anuncios y domicilio",
            badge: pendingProofs(detail) + openClaims(detail) || detail.listings.length,
            alert: pendingProofs(detail) + openClaims(detail) > 0,
          },
        ]
      : []),
    ...(hasAssociateData(detail) ? [{ id: "associate" as const, label: "Asociado (IA)", badge: detail.associate.accounts.length }] : []),
    { id: "reports", label: "Reportes", badge: detail.reportsAgainst.length + detail.reportsBy.length, alert: openReports > 0 },
  ];
  const acct = detail.account;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl">
      <div className="mb-6">
        <Link
          href="/admin/users"
          className="text-sm text-amber-600 hover:underline mb-4 inline-block"
        >
          ← Usuarios
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            {acct.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={acct.avatarUrl} alt="" className="h-16 w-16 rounded-full object-cover" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-900 text-2xl font-bold text-amber-400">
                {(user.fullName || user.email).charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {user.fullName}
                {acct.alias && <span className="ml-2 text-sm font-normal text-gray-400">alias “{acct.alias}”</span>}
              </h1>
              <p className="text-gray-500 text-sm mt-0.5">
                {user.email}
                {acct.emailVerifiedAt ? (
                  <span className="ml-2 text-xs text-green-600">✓ verificado</span>
                ) : (
                  <span className="ml-2 text-xs text-gray-400">sin verificar</span>
                )}
                {acct.placeholderEmail && <span className="ml-2 text-xs text-purple-600">correo interno</span>}
              </p>
              <p className="text-gray-400 text-xs mt-0.5">
                {acct.phone && <>📞 {acct.phone} · </>}
                {detail.stats.place && <>📍 {detail.stats.place} · </>}
                Última actividad <span suppressHydrationWarning>{relTime(user.lastActiveAt)}</span> · ID{" "}
                <code className="font-mono">{user.id}</code>
              </p>
              {acct.addressLine && <p className="text-gray-400 text-xs mt-0.5">🏠 {acct.addressLine}</p>}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium ${
                ROLE_BADGE[user.role] ?? "bg-gray-100 text-gray-700"
              }`}
            >
              {user.role}
            </span>
            {openReports > 0 && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                {openReports} reporte{openReports !== 1 ? "s" : ""} abierto{openReports !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
      </div>

      <nav className="mb-6 flex flex-wrap gap-1 border-b border-gray-200">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
              tab === t.id ? "border-amber-500 text-amber-700" : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            {t.label}
            {t.badge !== undefined && t.badge > 0 && (
              <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] ${t.alert ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"}`}>
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </nav>

      {tab === "stats" && <StatsTab d={detail} />}
      {tab === "chats" && <ConversationsTab key={chatKey ?? "all"} d={detail} initialKey={chatKey} />}
      {tab === "activity" && (
        <ActivityTab
          d={detail}
          onOpenChat={(key) => {
            setChatKey(key);
            setTab("chats");
          }}
          onOpenTab={(t) => {
            if (TABS.includes(t as Tab)) setTab(t as Tab);
          }}
        />
      )}
      {tab === "listings" && <ListingsTab d={detail} onChanged={() => setVersion((v) => v + 1)} />}
      {tab === "associate" && <AssociateTab d={detail} />}
      {tab === "reports" && (
        <div className="space-y-8">
          <section>
            <h2 className="mb-3 text-sm font-semibold text-gray-700">Reportes en su contra ({detail.reportsAgainst.length})</h2>
            <ReportList rows={detail.reportsAgainst} empty="Nadie ha reportado esta cuenta." />
          </section>
          <section>
            <h2 className="mb-3 text-sm font-semibold text-gray-700">Lo que ha enviado ({detail.reportsBy.length})</h2>
            <ReportList rows={detail.reportsBy} empty="No ha enviado reportes ni sugerencias." />
          </section>
        </div>
      )}

      {tab === "summary" && (<>
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Productos y servicios</h2>
        {user.products.length === 0 ? (
          <p className="text-sm text-gray-400">No ha comprado nada ni tiene servicios activos.</p>
        ) : (
          <ul className="space-y-1.5">
            {user.products.map((p) => (
              <li key={p.key} className="flex flex-wrap items-center gap-2 text-sm">
                <ProductChip p={p} />
                <span className="text-gray-600">{[p.detail, p.status].filter(Boolean).join(" · ")}</span>
                {p.until && <span className="text-xs text-gray-400">vence {new Date(p.until).toLocaleDateString("es-MX")}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{user.listingsCount}</p>
          <p className="text-xs text-gray-400 mt-1">Alojamientos</p>
          {user.listingsPublished > 0 && (
            <p className="text-[11px] text-blue-500">{user.listingsPublished} publicados</p>
          )}
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{user.bookingsAsGuest}</p>
          <p className="text-xs text-gray-400 mt-1">Reservas (huésped)</p>
          {user.bookingsPaid > 0 && (
            <p className="text-[11px] text-green-600">{user.bookingsPaid} pagadas</p>
          )}
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
          <p className="text-xl font-bold text-gray-900">
            {user.totalPaidMxn > 0
              ? `$${user.totalPaidMxn.toLocaleString("es-MX", { maximumFractionDigits: 0 })}`
              : "—"}
          </p>
          <p className="text-xs text-gray-400 mt-1">Total pagado MXN</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
          <p className="text-sm font-bold text-gray-900">{user.verificationStatus}</p>
          <p className="text-xs text-gray-400 mt-1">Verificación</p>
          {user.hasStripeCustomer && (
            <p className="text-[11px] text-amber-600 mt-0.5">Con cliente Stripe</p>
          )}
        </div>
      </div>

      {/* Role change */}
      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-8">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Cambiar rol</h2>
        <div className="flex items-center gap-3">
          <select
            value={newRole}
            onChange={(e) => setNewRole(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          >
            <option value="guest">guest</option>
            <option value="host">host</option>
            <option value="admin">admin</option>
          </select>
          <button
            onClick={handleRoleChange}
            disabled={roleChanging || newRole === user.role}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {roleChanging ? "Guardando…" : "Guardar rol"}
          </button>
          {roleMsg && (
            <p className="text-sm text-gray-600">{roleMsg}</p>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Registro: {new Date(user.createdAt).toLocaleString("es-MX")}
        </p>
        <div className="mt-4 flex items-center gap-3 border-t border-gray-100 pt-4">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={user.associate}
              onChange={async (e) => {
                const associate = e.target.checked;
                const res = await fetch(`/api/admin/users/${id}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ associate }),
                });
                if (res.ok) setUser((prev) => (prev ? { ...prev, associate } : prev));
              }}
            />
            Asociado: puede dar de alta anfitriones con IA en /asociados
          </label>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 mb-8">
        <h2 className="text-sm font-semibold text-gray-700 mb-2">Pase por reserva (cortesía)</h2>
        <p className="text-sm text-gray-600 mb-3">
          Pases sin usar: <strong>{user.bookingPassesRemaining}</strong>
        </p>
        <button
          onClick={async () => {
            setPassBusy(true);
            setPassMsg("");
            const res = await fetch(`/api/admin/users/${id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ grantPass: true }),
            });
            const j = await res.json().catch(() => ({}));
            setPassBusy(false);
            if (res.ok) {
              const n = Number(j.bookingPassesRemaining ?? 0);
              setUser((prev) => (prev ? { ...prev, bookingPassesRemaining: n } : prev));
              setPassMsg(`Pase acreditado. Quedan ${n}.`);
            } else {
              setPassMsg((j as { error?: string }).error ?? "No se pudo acreditar.");
            }
          }}
          disabled={passBusy}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-40"
        >
          {passBusy ? "Acreditando…" : "Regalar 1 pase (sin cobro)"}
        </button>
        {passMsg && <p className="text-sm text-gray-600 mt-2">{passMsg}</p>}
        <p className="text-sm text-gray-600 mt-4 mb-2">
          Identidad (KYC): <strong>{user.kycStatus}</strong>
        </p>
        <button
          onClick={async () => {
            setPassBusy(true);
            setPassMsg("");
            const res = await fetch(`/api/admin/users/${id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ verifyGuestIdentity: true }),
            });
            const j = await res.json().catch(() => ({}));
            setPassBusy(false);
            if (res.ok) {
              setUser((prev) => (prev ? { ...prev, kycStatus: "verified" } : prev));
              setPassMsg("Identidad marcada como verificada (sin Stripe Identity).");
            } else {
              setPassMsg((j as { error?: string }).error ?? "No se pudo verificar.");
            }
          }}
          disabled={passBusy || user.kycStatus === "verified"}
          className="px-4 py-2 rounded-lg text-sm font-medium border border-amber-500 text-amber-800 hover:bg-amber-50 disabled:opacity-40"
        >
          Marcar identidad verificada
        </button>
      </div>

      {(user.role === "host" || user.role === "admin" || user.listingsCount > 0) && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-8">
          <h2 className="text-sm font-semibold text-gray-700 mb-1">
            Miembro verificado
          </h2>
          <p className="text-xs text-gray-400 mb-3">
            El listón pide identidad y membresía. Se refleja en los {user.listingsCount}{" "}
            alojamientos. Sirve para probar sin Stripe y para retirar un sello dado por error.
          </p>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span
              className={`px-2.5 py-1 rounded text-xs font-medium ${
                user.hostRibbon ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"
              }`}
            >
              {user.hostRibbon ? "Listón visible" : "Sin listón"}
            </span>
            <span className="text-xs text-gray-400">
              Identidad: {user.hostVerified ? "sí" : "no"} · Membresía:{" "}
              {user.hostMembershipActive ? "sí" : "no"} · KYC {user.kycStatus}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => void patchHostVerification({ verified: !user.hostVerified })}
              disabled={badgeBusy}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-40"
            >
              {user.hostVerified ? "Quitar identidad" : "Conceder identidad"}
            </button>
            <button
              onClick={() => void patchHostVerification({ membership: !user.hostMembershipActive })}
              disabled={badgeBusy}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-gray-800 text-white hover:bg-gray-900 disabled:opacity-40"
            >
              {user.hostMembershipActive ? "Quitar membresía" : "Activar membresía"}
            </button>
            {badgeMsg && <p className="text-sm text-gray-600">{badgeMsg}</p>}
          </div>
        </div>
      )}
      </>)}

      {tab === "bookings" && (<>
      {/* Bookings as guest */}
      {guestBookings.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-6">
          <div className="px-5 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">
              Reservas como huésped ({guestBookings.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left border-b border-gray-100">
                  <th className="px-4 py-2 text-xs text-gray-500 font-medium">Alojamiento</th>
                  <th className="px-4 py-2 text-xs text-gray-500 font-medium">Fechas</th>
                  <th className="px-4 py-2 text-xs text-gray-500 font-medium">Estado</th>
                  <th className="px-4 py-2 text-xs text-gray-500 font-medium text-right">Total</th>
                  <th className="px-4 py-2 text-xs text-gray-500 font-medium">Contrato</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {guestBookings.map((b) => (
                  <tr key={b.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-800">
                      {b.listingTitle ?? b.listingId}
                    </td>
                    <td className="px-4 py-2 text-gray-500 whitespace-nowrap">
                      {b.checkIn} → {b.checkOut}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                          STATUS_COLORS[b.status] ?? "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {b.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right text-gray-800 font-medium">
                      ${b.totalChargeMxn.toLocaleString("es-MX", { maximumFractionDigits: 0 })}
                    </td>
                    <td className="px-4 py-2 text-xs">
                      {b.hasContract ? (
                        <a
                          href={`/api/bookings/contract?id=${encodeURIComponent(b.id)}&format=pdf`}
                          className="font-medium text-amber-600 underline"
                        >
                          PDF
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Bookings as host */}
      {hostBookings.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">
              Reservas como anfitrión ({hostBookings.length})
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left border-b border-gray-100">
                  <th className="px-4 py-2 text-xs text-gray-500 font-medium">Alojamiento</th>
                  <th className="px-4 py-2 text-xs text-gray-500 font-medium">Huésped</th>
                  <th className="px-4 py-2 text-xs text-gray-500 font-medium">Fechas</th>
                  <th className="px-4 py-2 text-xs text-gray-500 font-medium">Estado</th>
                  <th className="px-4 py-2 text-xs text-gray-500 font-medium text-right">Total</th>
                  <th className="px-4 py-2 text-xs text-gray-500 font-medium">Contrato</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {hostBookings.map((b) => (
                  <tr key={b.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-800">
                      {b.listingTitle ?? b.listingId}
                    </td>
                    <td className="px-4 py-2 text-gray-500">{b.guestEmail}</td>
                    <td className="px-4 py-2 text-gray-500 whitespace-nowrap">
                      {b.checkIn} → {b.checkOut}
                    </td>
                    <td className="px-4 py-2">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                          STATUS_COLORS[b.status] ?? "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {b.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right text-gray-800 font-medium">
                      ${b.totalChargeMxn.toLocaleString("es-MX", { maximumFractionDigits: 0 })}
                    </td>
                    <td className="px-4 py-2 text-xs">
                      {b.hasContract ? (
                        <a
                          href={`/api/bookings/contract?id=${encodeURIComponent(b.id)}&format=pdf`}
                          className="font-medium text-amber-600 underline"
                        >
                          PDF
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {guestBookings.length === 0 && hostBookings.length === 0 && (
        <p className="text-gray-400 text-sm">Este usuario no tiene reservas registradas.</p>
      )}
      </>)}
    </div>
  );
}
