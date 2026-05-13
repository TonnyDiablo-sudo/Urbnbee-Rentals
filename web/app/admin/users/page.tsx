import Link from "next/link";
import { getAdminUsers } from "@/lib/admin-data";

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

function fmx(n: number) {
  if (n === 0) return "—";
  return `$${n.toLocaleString("es-MX", { maximumFractionDigits: 0 })}`;
}

export default function AdminUsersPage() {
  const users = getAdminUsers();

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Usuarios</h1>
          <p className="text-sm text-gray-500 mt-1">
            {users.length} usuario{users.length !== 1 ? "s" : ""} registrado
            {users.length !== 1 ? "s" : ""} en la plataforma.
          </p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left border-b border-gray-200">
                <th className="px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">
                  Usuario
                </th>
                <th className="px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">
                  Rol
                </th>
                <th className="px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide text-center">
                  Alojamientos
                </th>
                <th className="px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide text-center">
                  Reservas (huésped)
                </th>
                <th className="px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide text-right">
                  Total pagado
                </th>
                <th className="px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">
                  Verificación
                </th>
                <th className="px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wide">
                  Registro
                </th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-gray-400">
                    Sin usuarios todavía.
                  </td>
                </tr>
              )}
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{u.fullName}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{u.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                        ROLE_BADGE[u.role] ?? "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-gray-700">
                    {u.listingsCount > 0 ? (
                      <span>
                        {u.listingsCount}
                        {u.listingsPublished > 0 && (
                          <span className="text-xs text-gray-400 ml-1">
                            ({u.listingsPublished} pub.)
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center text-gray-700">
                    {u.bookingsAsGuest > 0 ? (
                      <span>
                        {u.bookingsAsGuest}
                        {u.bookingsPaid > 0 && (
                          <span className="text-xs text-green-600 ml-1">
                            ({u.bookingsPaid} pag.)
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700 font-medium">
                    {fmx(u.totalPaidMxn)}
                    {u.platformFeePaidMxn > 0 && (
                      <p className="text-[11px] text-amber-600 font-normal">
                        +{fmx(u.platformFeePaidMxn)} fee
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                        VERIF_BADGE[u.verificationStatus] ?? "bg-gray-50 text-gray-400"
                      }`}
                    >
                      {u.verificationStatus}
                    </span>
                    {u.subscriptionPeriodEnd && (
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        hasta{" "}
                        {new Date(u.subscriptionPeriodEnd).toLocaleDateString("es-MX")}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                    {new Date(u.createdAt).toLocaleDateString("es-MX")}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/users/${u.id}`}
                      className="text-xs text-amber-600 hover:underline whitespace-nowrap"
                    >
                      Ver →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
