import Link from "next/link";
import { getAdminOverview } from "@/lib/admin-data";
import { numberLocale } from "@/lib/i18n";
import { getLang, getT } from "@/lib/i18n/server";
import { listMailboxesPublic } from "@/lib/mailboxes-store";

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

export default async function AdminOverviewPage() {
  const t = await getT();
  const locale = numberLocale(await getLang());
  const fmx = (n: number) => `$${n.toLocaleString(locale, { maximumFractionDigits: 0 })} MXN`;
  const d = getAdminOverview();
  const boxes = listMailboxesPublic();
  const missingMail = boxes.filter((b) => !b.connected);
  const noMail = missingMail.length === boxes.length;

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">{t("Resumen de la plataforma")}</h1>
        <p className="text-sm text-gray-500 mt-1">
          {t("Vista en tiempo real del estado de Cabibee.")}
        </p>
      </div>

      {missingMail.length > 0 && (
        <Link
          href="/admin/correo"
          className={`mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${
            noMail
              ? "border-red-200 bg-red-50 text-red-900 hover:bg-red-100"
              : "border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100"
          }`}
        >
          <span>
            {noMail
              ? t("No hay ningún correo conectado: no salen confirmaciones, recuperación de contraseña ni copias de quejas.")
              : t("Falta conectar {emails}. Mientras, todo sale por el otro buzón.", {
                  emails: missingMail.map((b) => b.email).join(t(" y ")),
                })}
          </span>
          <span className="font-semibold">{t("Ir a Correo →")}</span>
        </Link>
      )}

      {/* Users */}
      <section className="mb-8">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
          {t("Usuarios")}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label={t("Total")} value={d.totalUsers} />
          <StatCard label={t("Huéspedes")} value={d.totalGuests} sub="role: guest" />
          <StatCard label={t("Anfitriones")} value={d.totalHosts} sub="role: host" />
          <StatCard label={t("Administradores")} value={d.totalAdmins} sub="role: admin" />
        </div>
      </section>

      {/* Listings */}
      <section className="mb-8">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
          {t("Alojamientos")}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label={t("Total")} value={d.totalListings} />
          <StatCard label={t("Publicados")} value={d.publishedListings} sub={t("visibles en el sitio")} />
          <StatCard label={t("Borradores")} value={d.draftListings} sub={t("no publicados")} />
          <StatCard
            label={t("Verificados")}
            value={d.verifiedListings}
            sub={
              d.unearnedBadges > 0
                ? t("{count} sin anfitrión verificado", { count: d.unearnedBadges })
                : t("insignia respaldada")
            }
          />
        </div>
      </section>

      {/* Bookings */}
      <section className="mb-8">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
          {t("Reservas")}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label={t("Total")} value={d.totalBookings} />
          <StatCard label={t("Pagadas")} value={d.paidBookings} sub={t("sin contar devueltas")} accent />
          <StatCard
            label={t("Ingreso de estancias")}
            value={fmx(d.totalStayRevenueMxn)}
            sub={t("neto de reembolsos")}
            accent
          />
          <StatCard
            label={t("Comisión Cabibee")}
            value={fmx(d.totalPlatformFeeMxn)}
            sub={t("neto de reembolsos")}
            accent
          />
        </div>
        {d.refundedBookings > 0 && (
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label={t("Reembolsadas")} value={d.refundedBookings} />
            <StatCard
              label={t("Devuelto a huéspedes")}
              value={fmx(d.totalRefundedMxn)}
              sub={t("rechazos del anfitrión")}
            />
          </div>
        )}

        {/* Status breakdown */}
        <div className="mt-4 bg-white border border-gray-200 rounded-xl p-5">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
            {t("Reservas por estado")}
          </p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(d.bookingsByStatus).length === 0 && (
              <p className="text-sm text-gray-400">{t("Sin reservas todavía.")}</p>
            )}
            {Object.entries(d.bookingsByStatus).map(([status, count]) => (
              <span
                key={status}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${
                  STATUS_COLORS[status] ?? "bg-gray-100 text-gray-700"
                }`}
              >
                {STATUS_LABELS[status] ? t(STATUS_LABELS[status]) : status}
                <span className="font-bold">{count}</span>
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Verification */}
      <section className="mb-8">
        <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
          {t("Verificación de huéspedes")}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <StatCard
            label={t("Suscripciones activas")}
            value={d.activeVerificationSubscriptions}
            sub={t("active + trialing en Stripe")}
            accent={d.activeVerificationSubscriptions > 0}
          />
        </div>
      </section>
    </div>
  );
}
