import { getAdminOverview } from "@/lib/admin-data";

function fmx(n: number) {
  return `$${n.toLocaleString("es-MX", { maximumFractionDigits: 0 })} MXN`;
}

type StatCardProps = {
  label: string;
  value: string | number;
  sub?: string;
  accent?: boolean;
};

function StatCard({ label, value, sub, accent }: StatCardProps) {
  return (
    <div
      className={`rounded-xl border p-5 flex flex-col gap-1 ${
        accent
          ? "bg-amber-50 border-amber-200"
          : "bg-white border-gray-200"
      }`}
    >
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`text-3xl font-bold ${accent ? "text-amber-700" : "text-gray-900"}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

const STATUS_LABELS: Record<string, string> = {
  AWAITING_PAYMENT: "Esperando pago",
  PENDING: "Pendiente (pagado)",
  AWAITING_DETAILS: "En espera de datos",
  CONFIRMED: "Confirmadas",
  REJECTED: "Rechazadas",
  CANCELLED: "Canceladas",
  COMPLETED: "Completadas",
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

export default function AdminOverviewPage() {
  const d = getAdminOverview();

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Resumen de la plataforma</h1>
        <p className="text-sm text-gray-500 mt-1">
          Vista en tiempo real del estado de Urbnbee.
        </p>
      </div>

      {/* Users */}
      <section className="mb-8">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
          Usuarios
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total" value={d.totalUsers} />
          <StatCard label="Huéspedes" value={d.totalGuests} sub="role: guest" />
          <StatCard label="Anfitriones" value={d.totalHosts} sub="role: host" />
          <StatCard label="Administradores" value={d.totalAdmins} sub="role: admin" />
        </div>
      </section>

      {/* Listings */}
      <section className="mb-8">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
          Alojamientos
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total" value={d.totalListings} />
          <StatCard label="Publicados" value={d.publishedListings} sub="visibles en el sitio" />
          <StatCard label="Borradores" value={d.draftListings} sub="no publicados" />
          <StatCard label="Verificados" value={d.verifiedListings} sub="badge de plataforma" />
        </div>
      </section>

      {/* Bookings */}
      <section className="mb-8">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
          Reservas
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total" value={d.totalBookings} />
          <StatCard label="Pagadas" value={d.paidBookings} accent />
          <StatCard
            label="Ingreso de estancias"
            value={fmx(d.totalStayRevenueMxn)}
            sub="suma de reservas pagadas"
            accent
          />
          <StatCard
            label="Comisión Urbnbee"
            value={fmx(d.totalPlatformFeeMxn)}
            sub="cargo de servicio cobrado"
            accent
          />
        </div>

        {/* Status breakdown */}
        <div className="mt-4 bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
            Reservas por estado
          </p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(d.bookingsByStatus).length === 0 && (
              <p className="text-sm text-gray-400">Sin reservas todavía.</p>
            )}
            {Object.entries(d.bookingsByStatus).map(([status, count]) => (
              <span
                key={status}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${
                  STATUS_COLORS[status] ?? "bg-gray-100 text-gray-700"
                }`}
              >
                {STATUS_LABELS[status] ?? status}
                <span className="font-bold">{count}</span>
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Verification */}
      <section className="mb-8">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
          Verificación de huéspedes
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <StatCard
            label="Suscripciones activas"
            value={d.activeVerificationSubscriptions}
            sub="active + trialing en Stripe"
            accent={d.activeVerificationSubscriptions > 0}
          />
        </div>
      </section>
    </div>
  );
}
