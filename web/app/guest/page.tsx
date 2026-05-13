import Link from "next/link";
import { listBookingsForGuest } from "@/lib/bookings-store";
import { listAllThreadsForGuest } from "@/lib/host-inbox-store";
import { getSessionUser } from "@/lib/session";

export default async function GuestDashboardPage() {
  const user = await getSessionUser();
  if (!user) return null;

  const bookings = listBookingsForGuest(user.id);
  const threads = listAllThreadsForGuest(user.id);
  const activeBookings = bookings.filter((b) =>
    ["AWAITING_PAYMENT", "PENDING", "AWAITING_DETAILS", "CONFIRMED"].includes(b.status)
  );

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold text-[#484848]">
        Hola{user.fullName ? `, ${user.fullName.split(" ")[0]}` : ""}
      </h1>
      <p className="mt-2 text-sm text-[#888]">
        Aquí ves el resumen de tus reservas y conversaciones. El historial completo está en cada sección.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <Link
          href="/guest/bookings"
          className="rounded-xl border border-[#ebebeb] bg-white p-5 shadow-sm transition hover:border-[#dcb81e]"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-[#aaa]">Reservas activas</p>
          <p className="mt-2 text-3xl font-bold text-[#484848]">{activeBookings.length}</p>
          <p className="mt-2 text-sm text-[#dcb81e]">Ver todas →</p>
        </Link>
        <Link
          href="/guest/messages"
          className="rounded-xl border border-[#ebebeb] bg-white p-5 shadow-sm transition hover:border-[#dcb81e]"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-[#aaa]">Chats con anfitriones</p>
          <p className="mt-2 text-3xl font-bold text-[#484848]">{threads.length}</p>
          <p className="mt-2 text-sm text-[#dcb81e]">Abrir mensajes →</p>
        </Link>
        <Link
          href={user.role === "guest" ? "/guest/profile" : "/host/dashboard"}
          className="rounded-xl border border-[#ebebeb] bg-white p-5 shadow-sm transition hover:border-[#dcb81e]"
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-[#aaa]">Tu perfil</p>
          <p className="mt-2 text-sm leading-snug text-[#484848]">
            {user.role === "guest" ? "Nombre, foto y datos de contacto" : "Editar en panel anfitrión"}
          </p>
          <p className="mt-2 text-sm text-[#dcb81e]">Ir →</p>
        </Link>
      </div>

      <div className="mt-10 rounded-xl border border-[#ebebeb] bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-[#484848]">Historial reciente</h2>
        <p className="mt-1 text-xs text-[#888]">
          Últimas reservas (cualquier estado). Para detalle y código de consulta entra en Mis reservas.
        </p>
        <ul className="mt-4 divide-y divide-[#ebebeb] text-sm">
          {bookings.slice(0, 5).map((b) => (
            <li key={b.id} className="flex flex-wrap justify-between gap-2 py-3">
              <span className="text-[#484848]">
                {b.checkIn} → {b.checkOut}
              </span>
              <span className="rounded-full bg-[#f5f5f5] px-2 py-0.5 text-xs font-medium text-[#666]">
                {b.status}
              </span>
            </li>
          ))}
          {bookings.length === 0 && (
            <li className="py-6 text-center text-[#888]">Aún no tienes reservas con esta cuenta.</li>
          )}
        </ul>
      </div>
    </div>
  );
}
