"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useLang, useT } from "@/components/i18n-provider";
import { HOST_STATUS, TONE_CLS, fmtDay, fmtMxn } from "../_components/booking-status";
import { IconChevron } from "../_components/icons";
import { PushPrompt } from "../_components/push";
import { threadIsUnread } from "../_components/seen";
import { Sheet } from "../_components/sheet";
import { WebLink } from "../_components/site-origin";
import { addDays, isConfirmed, isPending, stayOf, todayIso, type HostBooking } from "./_shared/host-data";
import { ReservationSheet } from "./_shared/reservation-sheet";

type Booking = HostBooking;

type Filter = "leaving" | "hosting" | "arriving" | "upcoming";

const FILTERS: { id: Filter; label: string; empty: string }[] = [
  { id: "leaving", label: "Salen hoy", empty: "Nadie sale hoy." },
  { id: "hosting", label: "Hospedando ahora", empty: "No tienes huéspedes hospedados ahora." },
  { id: "arriving", label: "Llegan pronto", empty: "Nadie llega en los próximos 3 días." },
  { id: "upcoming", label: "Próximas", empty: "Sin estancias próximas." },
];

type Status = {
  acceptsBookings: boolean;
  membershipActive: boolean;
  identityVerified: boolean;
  ribbon: boolean;
  listingsTotal: number;
};

type Thread = { listingId: string; guestSessionId: string; lastAt: string; messages: { sender: string }[] };

export function HostToday() {
  const t = useT();
  const [filter, setFilter] = useState<Filter | null>(null);
  const [opened, setOpened] = useState<Booking | null>(null);
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
        (th) =>
          th.messages[th.messages.length - 1]?.sender === "guest" &&
          threadIsUnread(`h:${th.listingId}:${th.guestSessionId}`, th.lastAt)
      ).length
    );
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const reject = async (b: Booking) => {
    if (!window.confirm(t("¿Rechazar la solicitud de {name}? Si ya pagó, se le devuelve el dinero.", { name: b.guestName }))) return;
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

  if (bookings === null) return <p className="px-5 py-6 text-sm text-[#999]">{t("Cargando…")}</p>;

  const today = todayIso();
  const soon = addDays(today, 3);
  const pending = bookings.filter((b) => isPending(b.status));
  const confirmed = bookings
    .filter((b) => isConfirmed(b.status))
    .sort((a, b) => stayOf(a).checkIn.localeCompare(stayOf(b).checkIn));
  const groups: Record<Filter, Booking[]> = {
    leaving: confirmed.filter((b) => stayOf(b).checkOut === today),
    hosting: confirmed.filter((b) => stayOf(b).checkIn <= today && stayOf(b).checkOut > today),
    arriving: confirmed.filter((b) => stayOf(b).checkIn >= today && stayOf(b).checkIn <= soon),
    upcoming: confirmed.filter((b) => stayOf(b).checkIn > today),
  };
  const active = filter ?? FILTERS.find((f) => groups[f.id].length > 0)?.id ?? "upcoming";
  const shown = groups[active];
  const activeFilter = FILTERS.find((f) => f.id === active)!;

  return (
    <div className="space-y-6 px-5 pb-8">
      {err && <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{t(err)}</p>}

      <div className="grid grid-cols-3 gap-2.5">
        <Stat label={t("Por responder")} value={pending.length} highlight={pending.length > 0} />
        <Stat label={t("Chats nuevos")} value={newChats} highlight={newChats > 0} href="/host/mensajes" />
        <Stat label={t("Publicados")} value={published} href="/host/anuncios" />
      </div>

      {status && (
        <Link
          href="/host/motor"
          className={`flex items-center gap-3 rounded-2xl p-4 ${status.acceptsBookings ? "border border-[#ebebeb]" : "bg-[#111] text-white"}`}
        >
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold">
              {status.acceptsBookings ? t("Reservas en línea activas") : t("Activa Reservas en línea")}
            </p>
            <p className={`mt-0.5 text-sm ${status.acceptsBookings ? "text-[#717171]" : "text-white/70"}`}>
              {status.acceptsBookings
                ? status.ribbon
                  ? t("Tus anuncios muestran «Miembro verificado».")
                  : t("Los huéspedes ya pueden reservar y pagar en tus anuncios.")
                : t("Hoy los huéspedes sólo te pueden escribir. Con la membresía reservan y pagan en Cabibee.")}
            </p>
          </div>
          <IconChevron className={`h-5 w-5 ${status.acceptsBookings ? "text-[#999]" : "text-[#dcb81e]"}`} />
        </Link>
      )}

      {status && status.listingsTotal === 0 && (
        <Link href="/host/anuncios/nuevo" className="block rounded-2xl bg-[#fdf6d8] p-4">
          <p className="text-[15px] font-semibold text-[#5c4a0a]">{t("Publica tu primer anuncio")}</p>
          <p className="mt-0.5 text-sm text-[#7a6414]">{t("Toma unos minutos: fotos, precio y lo básico. Es gratis.")}</p>
        </Link>
      )}

      <PushPrompt />

      <section>
        <h2 className="mb-3 text-lg font-semibold text-[#222]">{t("Solicitudes por responder")}</h2>
        {pending.length === 0 ? (
          <p className="rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm text-[#717171]">{t("No tienes solicitudes pendientes.")}</p>
        ) : (
          <ul className="space-y-3">
            {pending.map((b) => (
              <li key={b.id} className="rounded-2xl border border-[#ebebeb] p-4">
                <button type="button" onClick={() => setOpened(b)} className="block w-full text-left">
                  <BookingSummary b={b} />
                </button>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => void reject(b)}
                    className="rounded-xl border border-[#ddd] py-2.5 text-sm font-semibold text-[#222]"
                  >
                    {t("Rechazar")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setReviewing(b)}
                    className="rounded-xl bg-[#dcb81e] py-2.5 text-sm font-semibold text-black"
                  >
                    {t("Revisar y aceptar")}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-[#222]">{t("Tus reservaciones")}</h2>
        <div className="-mx-5 mb-3 flex gap-2 overflow-x-auto px-5 [scrollbar-width:none]">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium ${
                active === f.id ? "border-[#222] bg-[#222] text-white" : "border-[#ddd] text-[#222]"
              }`}
            >
              {t(f.label)} ({groups[f.id].length})
            </button>
          ))}
        </div>
        {shown.length === 0 ? (
          <p className="rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm text-[#717171]">{t(activeFilter.empty)}</p>
        ) : (
          <ul className="space-y-3">
            {shown.map((b) => (
              <li key={b.id}>
                <button type="button" onClick={() => setOpened(b)} className="block w-full rounded-2xl border border-[#ebebeb] p-4 text-left">
                  <BookingSummary b={b} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <Link href="/host/calendario" className="mt-3 block text-center text-sm font-medium text-[#222] underline">
          {t("Ver todo en el calendario")}
        </Link>
      </section>

      <ReservationSheet
        booking={opened}
        onClose={() => setOpened(null)}
        onReview={(b) => {
          setOpened(null);
          setReviewing(b);
        }}
      />

      <WebLink
        path="/host/requests"
        icon
        className="flex items-center justify-center gap-1.5 text-sm font-medium text-[#717171] underline"
      >
        {t("Historial, contratos y depósitos en la web")}{" "}
      </WebLink>

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
  const t = useT();
  const lang = useLang();
  const st = HOST_STATUS[b.status] ?? { label: b.status, tone: "off" as const };
  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[15px] font-semibold text-[#222]">{b.guestName}</p>
          <p className="truncate text-sm text-[#717171]">{b.effectiveListingTitle ?? b.listingTitle}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${TONE_CLS[st.tone]}`}>{t(st.label)}</span>
      </div>
      <p className="mt-1.5 text-sm text-[#333]">
        {fmtDay(b.hostAdjustedCheckIn ?? b.checkIn, lang)} – {fmtDay(b.hostAdjustedCheckOut ?? b.checkOut, lang)} · {b.nights}{" "}
        {b.nights === 1 ? t("noche") : t("noches")} · {fmtMxn(b.estimatedTotalMxn)}
        {b.paidAt ? ` · ${t("pagado")}` : ""}
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
  const t = useT();
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
    <Sheet open={Boolean(booking)} onClose={onClose} title={t("Aceptar reserva")}>
      {booking && (
        <div className="space-y-4">
          <BookingSummary b={booking} />
          <div>
            <p className="mb-2 text-sm font-semibold text-[#222]">{t("Contrato de la reserva")}</p>
            <div className="max-h-64 overflow-y-auto rounded-2xl bg-[#f7f7f7] p-4 text-[13px] leading-relaxed text-[#333]">
              {lines === null ? t("Cargando…") : lines.length === 0 ? t("No se pudo cargar el contrato.") : lines.map((l, i) => <p key={i} className="mb-1.5">{l}</p>)}
            </div>
          </div>
          <label className="flex items-start gap-3 text-sm text-[#333]">
            <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="mt-0.5 h-5 w-5 accent-[#dcb81e]" />
            {t("Leí el contrato y lo acepto como anfitrión.")}
          </label>
          <label className="block text-sm font-medium text-[#222]">
            {t("Firma con tu nombre completo")}
            <input
              value={signName}
              onChange={(e) => setSignName(e.target.value)}
              autoComplete="name"
              className="mt-1 w-full rounded-xl border border-[#ccc] px-3.5 py-3 text-[15px] outline-none focus:border-[#222]"
            />
          </label>
          {err && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{t(err)}</p>}
          <button
            type="button"
            disabled={busy || !agree || signName.trim().length < 3}
            onClick={() => void accept()}
            className="w-full rounded-xl bg-[#dcb81e] py-3.5 text-[15px] font-semibold text-black disabled:opacity-50"
          >
            {busy ? t("Aceptando…") : t("Aceptar y firmar")}
          </button>
          <p className="text-xs text-[#999]">{t("¿Quieres mover fechas o cambiar de alojamiento? Hazlo desde la web.")}</p>
        </div>
      )}
    </Sheet>
  );
}
