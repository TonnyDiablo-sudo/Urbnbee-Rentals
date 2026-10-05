"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useLang, useT } from "@/components/i18n-provider";
import { CREDIT_CHECK_ENABLED } from "@/lib/feature-flags";
import { SCREENING_BAND_LABEL, SCREENING_PAYER_LABEL, SCREENING_STATUS_LABEL } from "@/lib/screening-types";
import { TONE_CLS, fmtDay, fmtMxn, hostStatusOf } from "../../_components/booking-status";
import { Sheet } from "../../_components/sheet";
import { WebLink } from "../../_components/site-origin";
import { HostPayStatus } from "@/components/booking/pay-status";
import { hostChatHref, isPending, stayOf, type HostBooking } from "./host-data";

/** Detalle de una reserva: quién viene, cuándo, cuánto y cómo escribirle. */
export function ReservationSheet({
  booking,
  onClose,
  onReview,
}: {
  booking: HostBooking | null;
  onClose: () => void;
  /** Si viene, las solicitudes pendientes muestran «Revisar y aceptar». */
  onReview?: (b: HostBooking) => void;
}) {
  const t = useT();
  const lang = useLang();
  if (!booking) return null;
  const stay = stayOf(booking);
  const st = hostStatusOf(booking);
  const chat = hostChatHref(booking);
  const payout = booking.estimatedTotalMxn;

  return (
    <Sheet open onClose={onClose} title={t("Reservación")}>
      <div className="space-y-5">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#111] text-lg font-bold text-[#dcb81e]">
            {booking.guestName.trim().charAt(0).toUpperCase() || "?"}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-lg font-semibold text-[#222]">{booking.guestName}</p>
            <p className="truncate text-sm text-[#717171]">{stay.title}</p>
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${TONE_CLS[st.tone]}`}>{t(st.label)}</span>
        </div>

        <div className="grid grid-cols-2 overflow-hidden rounded-2xl border border-[#ebebeb]">
          <div className="border-r border-[#ebebeb] p-3">
            <p className="text-xs font-semibold uppercase text-[#717171]">{t("Llegada")}</p>
            <p className="mt-0.5 text-[15px] text-[#222]">{fmtDay(stay.checkIn, lang)}</p>
          </div>
          <div className="p-3">
            <p className="text-xs font-semibold uppercase text-[#717171]">{t("Salida")}</p>
            <p className="mt-0.5 text-[15px] text-[#222]">{fmtDay(stay.checkOut, lang)}</p>
          </div>
        </div>

        <dl className="space-y-2 text-[15px]">
          <Row label={t("Noches")} value={String(booking.nights)} />
          <Row label={t("Estancia y limpieza")} value={fmtMxn(payout)} />
          <Row label={t("Pago")} value={booking.paidAt ? t("Pagado") : t("Sin pagar")} />
          <Row label={t("Código de reservación")} value={booking.token} />
          {booking.guestEmail && <Row label={t("Correo")} value={booking.guestEmail} />}
          {booking.guestPhone && <Row label={t("Teléfono")} value={booking.guestPhone} />}
        </dl>

        <HostPayStatus
          bookingId={booking.id}
          status={booking.status}
          paidAt={booking.paidAt}
          stripePaid={Boolean(booking.stripeCheckoutSessionId)}
          payConfirmation={booking.payConfirmation}
          payProof={booking.payProof}
        />

        {(booking.status === "AWAITING_PAYMENT" || (booking.status === "EXPIRED" && booking.canReopen)) && (
          <ContractPayBox key={`${booking.id}-${booking.status}`} booking={booking} onDone={onClose} />
        )}

        {CREDIT_CHECK_ENABLED && booking.guestUserId && !CLOSED_STATUSES.has(booking.status) && (
          <ScreeningBox bookingId={booking.id} />
        )}

        {booking.status === "CONFIRMED" && (
          <ArrivalMessageBox key={booking.id} bookingId={booking.id} sentAt={booking.arrivalMessageSentAt} />
        )}

        {(booking.status === "CONFIRMED" || booking.status === "COMPLETED") && <StayMessagesBox key={`stay-${booking.id}`} bookingId={booking.id} />}

        <div className="grid gap-2">
          {isPending(booking.status) && onReview && (
            <button
              type="button"
              onClick={() => onReview(booking)}
              className="w-full rounded-xl bg-[#dcb81e] py-3 text-[15px] font-semibold text-black"
            >
              {t("Revisar y aceptar")}
            </button>
          )}
          {chat && (
            <Link href={chat} className="w-full rounded-xl border border-[#222] py-3 text-center text-[15px] font-semibold text-[#222]">
              {t("Enviar mensaje al huésped")}
            </Link>
          )}
        </div>
      </div>
    </Sheet>
  );
}

const CLOSED_STATUSES = new Set(["REJECTED", "CANCELLED", "EXPIRED", "COMPLETED"]);

/** Contrato pendiente de pago: plazo, firma del anfitrión y, si se anuló, reabrir o archivar. */
function ContractPayBox({ booking, onDone }: { booking: HostBooking; onDone: () => void }) {
  const t = useT();
  const lang = useLang();
  const stay = stayOf(booking);
  const expired = booking.status === "EXPIRED";
  const needsSign = !expired && !booking.contract?.hostAcceptedAt;
  const [checkIn, setCheckIn] = useState(stay.checkIn.slice(0, 10));
  const [checkOut, setCheckOut] = useState(stay.checkOut.slice(0, 10));
  const [signName, setSignName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const when = booking.paymentDueAt
    ? new Date(booking.paymentDueAt).toLocaleString(lang === "en" ? "en-US" : "es-MX", { dateStyle: "medium", timeStyle: "short" })
    : "";

  const send = async (body: Record<string, unknown>, fallback: string) => {
    setBusy(true);
    setErr(null);
    const res = await fetch(`/api/host/bookings/${encodeURIComponent(booking.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    const j = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (!res?.ok) {
      setErr(typeof j.error === "string" ? j.error : fallback);
      return;
    }
    setDone(body.action === "archive" ? "Reserva archivada." : body.action === "reopen" ? "Reserva reabierta con contrato nuevo. Avisamos al huésped." : "Contrato firmado. Avisamos al huésped para que pague.");
  };

  if (done) {
    return (
      <div className="space-y-3 rounded-2xl border border-[#ebebeb] p-4">
        <p className="text-sm text-[#222]">{t(done)}</p>
        <button type="button" onClick={onDone} className="w-full rounded-xl border border-[#222] py-2.5 text-sm font-semibold text-[#222]">
          {t("Cerrar")}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl border border-[#ebebeb] p-4">
      <p className="text-[15px] font-semibold text-[#222]">
        {expired ? t("El contrato se anuló porque no se pagó a tiempo") : t("Contrato y pago")}
      </p>
      {!expired && when && (
        <p className={`text-sm ${booking.paymentFailedAt ? "text-red-700" : "text-[#717171]"}`}>
          {t(
            booking.paymentFailedAt
              ? "Se rechazó el pago. El huésped tiene hasta el {when} para volver a pagar; si no, el contrato se anula."
              : "El huésped tiene hasta el {when} para pagar. Ambos firman antes; el contrato surte efectos con el pago.",
            { when }
          )}
        </p>
      )}
      {expired && (
        <>
          <p className="text-sm text-[#717171]">
            {t("Reábrela con las mismas fechas u otras: se genera un contrato nuevo (el anulado queda archivado) y el huésped tiene un nuevo plazo para firmar y pagar.")}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={checkIn}
              onChange={(e) => setCheckIn(e.target.value)}
              aria-label={t("Llegada")}
              className="rounded-xl border border-[#ddd] px-3 py-2 text-sm"
            />
            <input
              type="date"
              value={checkOut}
              onChange={(e) => setCheckOut(e.target.value)}
              aria-label={t("Salida")}
              className="rounded-xl border border-[#ddd] px-3 py-2 text-sm"
            />
          </div>
        </>
      )}
      {(needsSign || expired) && (
        <input
          value={signName}
          onChange={(e) => setSignName(e.target.value)}
          placeholder={t("Tu nombre legal (firma)")}
          className="w-full rounded-xl border border-[#ddd] px-3 py-2 text-sm"
        />
      )}
      {err && <p className="text-sm text-red-600">{t(err)}</p>}
      {needsSign && (
        <button
          type="button"
          disabled={busy || signName.trim().length < 3}
          onClick={() => void send({ action: "sign", signName: signName.trim() }, "No se pudo firmar.")}
          className="w-full rounded-xl bg-[#dcb81e] py-2.5 text-sm font-semibold text-black disabled:opacity-50"
        >
          {t("Firmar contrato")}
        </button>
      )}
      {expired && (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={busy || !checkIn || !checkOut}
            onClick={() => void send({ action: "reopen", checkIn, checkOut, signName: signName.trim() }, "No se pudo reabrir.")}
            className="rounded-xl bg-[#dcb81e] py-2.5 text-sm font-semibold text-black disabled:opacity-50"
          >
            {t("Reabrir con contrato nuevo")}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              if (window.confirm(t("¿Archivar esta reserva? Ya no se podrá reabrir."))) void send({ action: "archive" }, "No se pudo archivar.");
            }}
            className="rounded-xl border border-[#222] py-2.5 text-sm font-semibold text-[#222] disabled:opacity-50"
          >
            {t("Archivar")}
          </button>
        </div>
      )}
    </div>
  );
}

/** Manda (o vuelve a mandar) los datos de llegada por el chat y por correo. */
function ArrivalMessageBox({ bookingId, sentAt: initialSentAt }: { bookingId: string; sentAt?: string }) {
  const t = useT();
  const lang = useLang();
  const [sentAt, setSentAt] = useState(initialSentAt);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const send = async () => {
    if (sentAt && !window.confirm(t("Ya se mandaron. ¿Enviarlas otra vez?"))) return;
    setBusy(true);
    setErr(null);
    const res = await fetch(`/api/host/bookings/${encodeURIComponent(bookingId)}/arrival-message`, { method: "POST" }).catch(
      () => null
    );
    const j = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (!res?.ok) {
      setErr(typeof j.error === "string" ? j.error : "No se pudo enviar.");
      return;
    }
    setSentAt(j.sentAt);
  };

  return (
    <div className="rounded-2xl border border-[#ebebeb] p-4">
      <p className="text-[15px] font-semibold text-[#222]">{t("Instrucciones de llegada")}</p>
      <p className="mt-1 text-sm text-[#717171]">
        {sentAt
          ? t("Enviadas el {date}.", {
              date: new Date(sentAt).toLocaleString(lang === "en" ? "en-US" : "es-MX", { dateStyle: "medium", timeStyle: "short" }),
            })
          : t("Dirección, llegada, código y wifi, con la plantilla de tu anuncio. Van por el chat y por correo.")}
      </p>
      <button
        type="button"
        disabled={busy}
        onClick={() => void send()}
        className={`mt-3 w-full rounded-xl py-2.5 text-sm font-semibold disabled:opacity-50 ${
          sentAt ? "border border-[#222] text-[#222]" : "bg-[#dcb81e] text-black"
        }`}
      >
        {busy ? t("Enviando…") : sentAt ? t("Volver a enviar") : t("Enviar instrucciones de llegada")}
      </button>
      {err && <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{t(err)}</p>}
    </div>
  );
}

type StayRow = { key: string; kind: "welcome" | "mid" | "checkout"; mode: "auto" | "manual"; everyDays?: number; sentAt?: string };

const STAY_LABEL: Record<StayRow["kind"], string> = {
  welcome: "Bienvenida",
  mid: "Media estancia",
  checkout: "Salida",
};

/** Bienvenida, media estancia y salida: estado y botón para mandarlos a mano. */
function StayMessagesBox({ bookingId }: { bookingId: string }) {
  const t = useT();
  const lang = useLang();
  const url = `/api/host/bookings/${encodeURIComponent(bookingId)}/stay-message`;
  const [rows, setRows] = useState<StayRow[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(url, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => !cancelled && setRows(Array.isArray(j?.messages) ? j.messages : []))
      .catch(() => !cancelled && setRows([]));
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (!rows || rows.length === 0) return null;

  const send = async (row: StayRow) => {
    if (row.sentAt && !window.confirm(t("Ya se mandó. ¿Enviarlo otra vez?"))) return;
    setBusy(row.key);
    setErr(null);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: row.key }),
    }).catch(() => null);
    const j = res ? await res.json().catch(() => ({})) : {};
    setBusy(null);
    if (!res?.ok) {
      setErr(typeof j.error === "string" ? j.error : "No se pudo enviar.");
      return;
    }
    setRows((rs) => rs?.map((r) => (r.key === row.key ? { ...r, sentAt: j.sentAt } : r)) ?? rs);
  };

  return (
    <div className="rounded-2xl border border-[#ebebeb] p-4">
      <p className="text-[15px] font-semibold text-[#222]">{t("Mensajes de la estancia")}</p>
      <ul className="mt-2 divide-y divide-[#f0f0f0]">
        {rows.map((r) => (
          <li key={r.key} className="flex items-center justify-between gap-3 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-medium text-[#222]">
                {t(STAY_LABEL[r.kind])}
                {r.everyDays ? ` · ${t(r.everyDays === 1 ? "Todos los días" : "Cada {n} días", { n: r.everyDays })}` : ""}
              </p>
              <p className="text-xs text-[#717171]">
                {r.sentAt
                  ? t("Último envío: {date}", {
                      date: new Date(r.sentAt).toLocaleString(lang === "en" ? "en-US" : "es-MX", { dateStyle: "medium", timeStyle: "short" }),
                    })
                  : r.mode === "auto"
                    ? t("Automático")
                    : t("Manual")}
              </p>
            </div>
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void send(r)}
              className={`shrink-0 rounded-xl px-3 py-2 text-sm font-semibold disabled:opacity-50 ${
                r.sentAt || r.mode === "auto" ? "border border-[#222] text-[#222]" : "bg-[#dcb81e] text-black"
              }`}
            >
              {busy === r.key ? t("Enviando…") : r.sentAt ? t("Volver a enviar") : t("Enviar ahora")}
            </button>
          </li>
        ))}
      </ul>
      {err && <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{t(err)}</p>}
    </div>
  );
}

type ScreeningState = {
  screening: {
    status: string;
    payer: "host" | "guest";
    band?: string;
    providerNote?: string;
    needsConsent: boolean;
    needsPayGuest: boolean;
    needsPayHost: boolean;
  } | null;
  canRequest: boolean;
  quote?: { offered: boolean; amount: number; currency: "mxn" | "usd" };
};

/** Revisión crediticia del huésped: el anfitrión la pide y decide quién la paga. */
function ScreeningBox({ bookingId }: { bookingId: string }) {
  const t = useT();
  const [data, setData] = useState<ScreeningState | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const url = `/api/host/bookings/${encodeURIComponent(bookingId)}/screening`;

  useEffect(() => {
    let cancelled = false;
    fetch(url, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => !cancelled && setData(j))
      .catch(() => !cancelled && setData(null));
    return () => {
      cancelled = true;
    };
  }, [url]);

  if (!data) return null;
  const s = data.screening;
  const price =
    data.quote?.offered && data.quote.amount > 0
      ? `$${data.quote.amount.toLocaleString("es-MX")} ${data.quote.currency.toUpperCase()}`
      : null;

  const request = async (payer: "host" | "guest") => {
    setBusy(true);
    setErr(null);
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payer }),
    }).catch(() => null);
    const j = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (!res?.ok) {
      setErr(typeof j.error === "string" ? j.error : "No se pudo pedir la revisión.");
      return;
    }
    setData((d) => (d ? { ...d, screening: j.screening, canRequest: false } : d));
  };

  return (
    <div className="rounded-2xl border border-[#ebebeb] p-4">
      <p className="text-[15px] font-semibold text-[#222]">{t("Historial crediticio")}</p>
      {!s ? (
        data.canRequest && price ? (
          <>
            <p className="mt-1 text-sm text-[#717171]">
              {t("Pide una revisión de crédito ({price}). El huésped tiene que autorizarla; tú decides quién la paga.", { price })}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => void request("host")}
                className="rounded-xl border border-[#222] py-2.5 text-sm font-semibold text-[#222] disabled:opacity-50"
              >
                {t("La pago yo")}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void request("guest")}
                className="rounded-xl bg-[#222] py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {t("Que la pague el huésped")}
              </button>
            </div>
          </>
        ) : (
          <p className="mt-1 text-sm text-[#717171]">{t("La revisión de crédito no está disponible por ahora.")}</p>
        )
      ) : (
        <>
          <p className="mt-1 text-sm text-[#333]">
            {s.status === "completed" && s.band
              ? t("Resultado: {band}", { band: t(SCREENING_BAND_LABEL[s.band as keyof typeof SCREENING_BAND_LABEL] ?? s.band) })
              : s.needsConsent
                ? t("Esperando a que el huésped la autorice. Ya le avisamos.")
                : s.needsPayGuest
                  ? t("El huésped autorizó; falta que pague la consulta.")
                  : s.needsPayHost
                    ? t("El huésped autorizó. Paga la consulta para ver el resultado.")
                    : t(SCREENING_STATUS_LABEL[s.status as keyof typeof SCREENING_STATUS_LABEL] ?? s.status)}
          </p>
          <p className="mt-0.5 text-xs text-[#888]">{t(SCREENING_PAYER_LABEL[s.payer])}</p>
          {s.needsPayHost && (
            <WebLink
              path="/host/requests"
              className="mt-3 inline-block rounded-xl bg-[#dcb81e] px-4 py-2.5 text-sm font-semibold text-black"
            >
              {t("Pagar consulta")}
            </WebLink>
          )}
        </>
      )}
      {err && <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{t(err)}</p>}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-[#717171]">{label}</dt>
      <dd className="min-w-0 truncate text-right font-medium text-[#222]">{value}</dd>
    </div>
  );
}
