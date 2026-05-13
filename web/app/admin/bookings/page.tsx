"use client";

import { useEffect, useState } from "react";
import type { AdminBookingRow } from "@/lib/admin-data";

const STATUS_COLORS: Record<string, string> = {
  AWAITING_PAYMENT: "bg-yellow-100 text-yellow-800",
  PENDING: "bg-blue-100 text-blue-800",
  CONFIRMED: "bg-green-100 text-green-800",
  COMPLETED: "bg-emerald-100 text-emerald-800",
  REJECTED: "bg-red-100 text-red-800",
  CANCELLED: "bg-gray-100 text-gray-600",
  AWAITING_DETAILS: "bg-purple-100 text-purple-800",
};

const STATUS_LABELS: Record<string, string> = {
  AWAITING_PAYMENT: "Esperando pago",
  PENDING: "Pendiente",
  CONFIRMED: "Confirmada",
  COMPLETED: "Completada",
  REJECTED: "Rechazada",
  CANCELLED: "Cancelada",
  AWAITING_DETAILS: "Espera datos",
};

const ALL_STATUSES = Object.keys(STATUS_LABELS);

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState<AdminBookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/admin/bookings")
      .then((r) => r.json())
      .then((data) => {
        setBookings(data);
        setLoading(false);
      });
  }, []);

  const filtered = bookings.filter((b) => {
    if (filterStatus !== "ALL" && b.status !== filterStatus) return false;
    if (search) {
      const q = search.toLowerCase();
      if (
        !b.guestEmail.toLowerCase().includes(q) &&
        !b.guestName.toLowerCase().includes(q) &&
        !(b.listingTitle ?? "").toLowerCase().includes(q) &&
        !b.id.toLowerCase().includes(q)
      ) {
        return false;
      }
    }
    return true;
  });

  const totalRevenue = filtered
    .filter((b) => b.paidAt)
    .reduce((s, b) => s + b.totalChargeMxn, 0);

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Reservas</h1>
        <p className="text-sm text-gray-500 mt-1">
          Todas las reservas de la plataforma.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <input
          type="text"
          placeholder="Buscar por huésped, alojamiento o ID…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm flex-1 min-w-48 focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setFilterStatus("ALL")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filterStatus === "ALL"
                ? "bg-amber-500 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Todas ({bookings.length})
          </button>
          {ALL_STATUSES.map((s) => {
            const count = bookings.filter((b) => b.status === s).length;
            if (count === 0) return null;
            return (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  filterStatus === s
                    ? "bg-amber-500 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {STATUS_LABELS[s]} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Summary bar */}
      {filtered.length > 0 && (
        <div className="flex items-center gap-6 bg-amber-50 border border-amber-200 rounded-xl px-5 py-3 mb-5 text-sm">
          <span className="text-gray-600">
            <strong>{filtered.length}</strong> reserva{filtered.length !== 1 ? "s" : ""}
          </span>
          {totalRevenue > 0 && (
            <span className="text-amber-700 font-medium">
              ${totalRevenue.toLocaleString("es-MX", { maximumFractionDigits: 0 })} MXN cobrado
            </span>
          )}
        </div>
      )}

      {loading ? (
        <p className="text-gray-400 animate-pulse">Cargando reservas…</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left border-b border-gray-200">
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Reserva
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Alojamiento
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Huésped
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Anfitrión
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                    Check-in / out
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Estado
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">
                    Total
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">
                    Fee
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-gray-400">
                      Sin reservas con estos filtros.
                    </td>
                  </tr>
                )}
                {filtered.map((b) => (
                  <tr key={b.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-mono text-xs text-gray-400">{b.id.slice(0, 12)}…</p>
                      <p className="text-[11px] text-gray-300 mt-0.5">
                        {new Date(b.createdAt).toLocaleDateString("es-MX")}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-gray-800 max-w-[160px] truncate">
                      {b.listingTitle ?? b.listingId}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-gray-800">{b.guestName}</p>
                      <p className="text-xs text-gray-400">{b.guestEmail}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-gray-600 text-xs">{b.hostName ?? "—"}</p>
                      <p className="text-[11px] text-gray-400">{b.hostEmail ?? ""}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      <p>{b.checkIn}</p>
                      <p>{b.checkOut}</p>
                      <p className="text-gray-400">{b.nights} noche{b.nights !== 1 ? "s" : ""}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                          STATUS_COLORS[b.status] ?? "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {STATUS_LABELS[b.status] ?? b.status}
                      </span>
                      {b.paidAt && (
                        <p className="text-[10px] text-green-600 mt-0.5">
                          Pag. {new Date(b.paidAt).toLocaleDateString("es-MX")}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-800">
                      ${b.estimatedTotalMxn.toLocaleString("es-MX", { maximumFractionDigits: 0 })}
                    </td>
                    <td className="px-4 py-3 text-right text-amber-600 font-medium">
                      {b.platformFeeMxn > 0
                        ? `$${b.platformFeeMxn.toLocaleString("es-MX", { maximumFractionDigits: 0 })}`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
