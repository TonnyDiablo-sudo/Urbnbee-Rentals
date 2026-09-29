"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { HOST_STATUS, TONE_CLS, fmtDay, fmtMxn } from "../_components/booking-status";
import { IconChevron, IconExternal } from "../_components/icons";
import { PushPrompt } from "../_components/push";
import { threadIsUnread } from "../_components/seen";
import { Sheet } from "../_components/sheet";

type Booking = {
  id: string;
  status: string;
  guestName: string;
  checkIn: string;
  checkOut: string;
  hostAdjustedCheckIn?: string;
  hostAdjustedCheckOut?: string;
  nights: number;
  estimatedTotalMxn: number;
  listingTitle: string;
  effectiveListingTitle?: string;
  paidAt?: string;
  createdAt: string;
};

type Status = {
  acceptsBookings: boolean;
  membershipActive: boolean;
  identityVerified: boolean;
  ribbon: boolean;
  listingsTotal: number;
};

type Thread = { listingId: string; guestSessionId: string; lastAt: string; messages: { sender: string }[] };

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function HostToday() {
  const [bookings, setBookings] = useState<Booking[] | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [published, setPublished] = useState(0);
  const [newChats, setNewChats] = useState(0);
  const [reviewing, setReviewing] = useState<Booking | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [b, s, l, i] = await Promise.all([
      fetch("/api/host/bookings", { cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
      fetch("/api/host/verification/status", { cache: "no-store" }).then((r) => r.json()).catch(() => null),
      fetch("/api/host/listings", { cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
      fetch("/api/host/inbox", { cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
    ]);
    setBookings(Array.isArray(b.bookings) ? b.bookings : []);
    if (s && typeof s.acceptsBookings === "boolean") setStatus(s);
    setPublished(Array.isArray(l.listings) ? l.listings.filter((x: { published: boolean }) => x.published).length : 0);
    const threads: Thread[] = Array.isArray(i.threads) ? i.threads : [];
    setNewChats(
      threads.filter(
        (t) =>
          t.messages[t.messages.length - 1]?.sender === "guest" &&
          threadIsUnread(`h:${t.listingId}:${t.guestSessionId}`, t.lastAt)
      ).length
    );
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const reject = async (b: Booking) => {
    if (!window.confirm(`¿Rechazar la solicitud de ${b.guestName}? Si ya pagó, se le devuelve el dinero.`)) return;
    setErr(null);
    const res = await fetch(`/api/host/bookings/${b.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reject" }),
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) setErr(typeof j.error === "string" ? j.error : "No se pudo rechazar.");
    await load();
  };

  if (bookings === null) return <p className="px-5 py-6 text-sm text-[#999]">Cargando…</p>;

  const today = todayIso();
  const pending = bookings.filter((b) => b.status === "PENDING");
  const upcoming = bookings
    .filter((b) => (b.status === "CONFIRMED" || b.status === "AWAITING_DETAILS") && (b.hostAdjustedCheckOut ?? b.checkOut) >= today)
    .sort((a, b) => (a.hostAdjustedCheckIn ?? a.checkIn).localeCompare(b.hostAdjustedCheckIn ?? b.checkIn));

  return (
    <div className="space-y-6 px-5 pb-8">
      {err && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{err}</p>}

      <div className="grid grid-cols-3 gap-2.5">
        <Stat label="Por responder" value={pending.length} highlight={pending.length > 0} />
        <Stat label="Chats nuevos" value={newChats} highlight={newChats > 0} href="/app/host/mensajes" />
        <Stat label="Publicados" value={published} href="/app/host/anuncios" />
      </div>

      {status && (
        <Link
          href="/app/host/motor"
          className={`flex items-center gap-3 rounded-2xl p-4 ${status.acceptsBookings ? "border border-[#ebebeb]" : "bg-[#111] text-white"}`}
        >
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold">
              {status.acceptsBookings ? "Motor de reservas activo" : "Activa el motor de reservas"}
            </p>
            <p className={`mt-0.5 text-sm ${status.acceptsBookings ? "text-[#717171]" : "text-white/70"}`}>
              {status.acceptsBookings
                ? status.ribbon
                  ? "Tus anuncios muestran «Miembro verificado»."
                  : "Los huéspedes ya pueden reservar y pagar en tus anuncios."
                : "Hoy los huéspedes sólo te pueden escribir. Con la membresía reservan y pagan en Cabibee."}
            </p>
          </div>
          <IconChevron className={`h-5 w-5 ${status.acceptsBookings ? "text-[#999]" : "text-[#dcb81e]"}`} />
        </Link>
      )}

      {status && status.listingsTotal === 0 && (
        <Link href="/app/host/anuncios/nuevo" className="block rounded-2xl bg-[#fdf6d8] p-4">
          <p className="text-[15px] font-semibold text-[#5c4a0a]">Publica tu primer anuncio</p>
          <p className="mt-0.5 text-sm text-[#7a6414]">Toma unos minutos: fotos, precio y lo básico. Es gratis.</p>
        </Link>
      )}

      <PushPrompt />

      <section>
        <h2 className="mb-3 text-lg font-semibold text-[#222]">Solicitudes por responder</h2>
        {pending.length === 0 ? (
          <p className="rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm text-[#717171]">No tienes solicitudes pendientes.</p>
        ) : (
          <ul className="space-y-3">
            {pending.map((b) => (
              <li key={b.id} className="rounded-2xl border border-[#ebebeb] p-4">
                <BookingSummary b={b} />
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => void reject(b)}
                    className="rounded-xl border border-[#ddd] py-2.5 text-sm font-semibold text-[#222]"
                  >
                    Rechazar
                  </button>
                  <button
                    type="button"
                    onClick={() => setReviewing(b)}
                    className="rounded-xl bg-[#dcb81e] py-2.5 text-sm font-semibold text-black"
                  >
                    Revisar y aceptar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-[#222]">Próximas estancias</h2>
        {upcoming.length === 0 ? (
          <p className="rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm text-[#717171]">Sin estancias próximas.</p>
        ) : (
          <ul className="space-y-3">
            {upcoming.map((b) => (
              <li key={b.id} className="rounded-2xl border border-[#ebebeb] p-4">
                <BookingSummary b={b} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <a
        href="/host/requests"
        target="_blank"
        rel="noopener"
        className="flex items-center justify-center gap-1.5 text-sm font-medium text-[#717171] underline"
      >
        Historial, contratos y depósitos en la web <IconExternal />
      </a>

      <AcceptSheet key={reviewing?.id ?? "none"} booking={reviewing} onClose={() => setReviewing(null)} onDone={load} />
    </div>
  );
}

function Stat({ label, value, highlight, href }: { label: string; value: number; highlight?: boolean; href?: string }) {
  const body = (
    <div className={`rounded-2xl p-3 ${highlight ? "bg-[#fdf6d8]" : "bg-[#f7f7f7]"}`}>
      <p className="text-2xl font-bold text-[#222]">{value}</p>
      <p className="text-xs text-[#717171]">{label}</p>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

function BookingSummary({ b }: { b: Booking }) {
  const st = HOST_STATUS[b.status] ?? { label: b.status, tone: "off" as const };
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-[#222]">{b.guestName}</p>
          <p className="truncate text-sm text-[#717171]">{b.effectiveListingTitle ?? b.listingTitle}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${TONE_CLS[st.tone]}`}>{st.label}</span>
      </div>
      <p className="mt-1.5 text-sm text-[#333]">
        {fmtDay(b.hostAdjustedCheckIn ?? b.checkIn)} – {fmtDay(b.hostAdjustedCheckOut ?? b.checkOut)} · {b.nights}{" "}
        {b.nights === 1 ? "noche" : "noches"} · {fmtMxn(b.estimatedTotalMxn)}
        {b.paidAt ? " · pagado" : ""}
      </p>
    </>
  );
}

function AcceptSheet({
  booking,
  onClose,
  onDone,
}: {
  booking: Booking | null;
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const [lines, setLines] = useState<string[] | null>(null);
  const [agree, setAgree] = useState(false);
  const [signName, setSignName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!booking) return;
    fetch(`/api/host/bookings/${booking.id}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((j) => setLines(Array.isArray(j.lines) ? j.lines : []))
      .catch(() => setLines([]));
  }, [booking]);

  const accept = async () => {
    if (!booking) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/host/bookings/${booking.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "accept", acceptContract: true, signName: signName.trim() }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(typeof j.error === "string" ? j.error : "No se pudo aceptar.");
        return;
      }
      onClose();
      await onDone();
    } catch {
      setErr("Sin conexión.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={Boolean(booking)} onClose={onClose} title="Aceptar reserva">
      {booking && (
        <div className="space-y-4">
          <BookingSummary b={booking} />
          <div>
            <p className="mb-2 text-sm font-semibold text-[#222]">Contrato de la reserva</p>
            <div className="max-h-64 overflow-y-auto rounded-2xl bg-[#f7f7f7] p-4 text-[13px] leading-relaxed text-[#333]">
              {lines === null ? "Cargando…" : lines.length === 0 ? "No se pudo cargar el contrato." : lines.map((l, i) => <p key={i} className="mb-1.5">{l}</p>)}
            </div>
          </div>
          <label className="flex items-start gap-3 text-sm text-[#333]">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 h-5 w-5 accent-[#dcb81e]" />
            Leí el contrato y lo acepto como anfitrión.
          </label>
          <label className="block text-sm font-medium text-[#222]">
            Firma con tu nombre completo
            <input
              value={signName}
              onChange={(e) => setSignName(e.target.value)}
              autoComplete="name"
              className="mt-1 w-full rounded-xl border border-[#ccc] px-3.5 py-3 text-[15px] outline-none focus:border-[#222]"
            />
          </label>
          {err && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{err}</p>}
          <button
            type="button"
            disabled={busy || !agree || signName.trim().length < 3}
            onClick={() => void accept()}
            className="w-full rounded-xl bg-[#dcb81e] py-3.5 text-[15px] font-semibold text-black disabled:opacity-50"
          >
            {busy ? "Aceptando…" : "Aceptar y firmar"}
          </button>
          <p className="text-xs text-[#999]">¿Quieres mover fechas o cambiar de alojamiento? Hazlo desde la web.</p>
        </div>
      )}
    </Sheet>
  );
}
