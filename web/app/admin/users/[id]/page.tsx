"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import type { AdminUserRow } from "@/lib/admin-data";
import type { AdminBookingRow } from "@/lib/admin-data";

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
  const router = useRouter();
  const [user, setUser] = useState<AdminUserRow | null>(null);
  const [bookings, setBookings] = useState<AdminBookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleChanging, setRoleChanging] = useState(false);
  const [newRole, setNewRole] = useState<string>("");
  const [roleMsg, setRoleMsg] = useState("");

  useEffect(() => {
    Promise.all([fetch("/api/admin/users"), fetch("/api/admin/bookings")]).then(
      async ([uRes, bRes]) => {
        const users: AdminUserRow[] = await uRes.json();
        const allBookings: AdminBookingRow[] = await bRes.json();
        const found = users.find((u) => u.id === id) ?? null;
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
  }, [id]);

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

  if (loading) {
    return (
      <div className="p-8">
        <p className="text-gray-400 animate-pulse">Cargando…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="p-8">
        <p className="text-red-500">Usuario no encontrado.</p>
        <Link href="/admin/users" className="text-amber-600 text-sm mt-2 block hover:underline">
          ← Volver a usuarios
        </Link>
      </div>
    );
  }

  const guestBookings = bookings.filter((b) => b.guestUserId === id);
  const hostBookings = bookings.filter((b) => b.hostId === id);

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6">
        <Link
          href="/admin/users"
          className="text-sm text-amber-600 hover:underline mb-4 inline-block"
        >
          ← Usuarios
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{user.fullName}</h1>
            <p className="text-gray-400 text-sm mt-0.5">{user.email}</p>
            <p className="text-gray-400 text-xs mt-0.5">
              ID: <code className="font-mono">{user.id}</code>
            </p>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-sm font-medium ${
              ROLE_BADGE[user.role] ?? "bg-gray-100 text-gray-700"
            }`}
          >
            {user.role}
          </span>
        </div>
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
      </div>

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
    </div>
  );
}
