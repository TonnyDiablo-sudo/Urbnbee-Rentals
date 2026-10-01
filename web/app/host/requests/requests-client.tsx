"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { BookingDepositPanel } from "@/components/booking-deposit-panel";
import { BookingReviewPanel } from "@/components/booking-review-panel";
import { BookingScreeningPanel } from "@/components/booking-screening-panel";
import { useLang, useT } from "@/components/i18n-provider";
import { numberLocale } from "@/lib/i18n";
import type { BookingDepositRecord } from "@/lib/booking-deposit-types";
import type { ScreeningPublicView, ScreeningQuote } from "@/lib/screening-types";
import type { StayReviewRecord } from "@/lib/stay-review-types";

type HostListing = { id: string; title: string; published: boolean };

type BookingRow = {
  id: string;
  status: string;
  token: string;
  guestName: string;
  guestEmail: string;
  paidAt?: string;
  refundedAt?: string;
  refundAmountMxn?: number;
  checkIn: string;
  checkOut: string;
  hostAdjustedCheckIn?: string;
  hostAdjustedCheckOut?: string;
  hostAdjustedListingId?: string;
  listingId: string;
  listingTitle: string;
  effectiveListingTitle?: string;
  nights: number;
  estimatedTotalMxn: number;
  createdAt: string;
  contract?: {
    generatedAt?: string;
    guestAcceptedAt?: string;
    hostAcceptedAt?: string;
  };
  deposit?: BookingDepositRecord;
  canReview?: boolean;
  myReview?: StayReviewRecord;
  guestReviewOfListing?: StayReviewRecord;
  screening?: ScreeningPublicView | null;
  canRequestScreening?: boolean;
};

const statusLabel: Record<string, string> = {
  AWAITING_PAYMENT: "Esperando pago del huésped",
  PENDING: "Pendiente de tu respuesta",
  PENDING_HOST: "Pendiente de tu respuesta",
  AWAITING_DETAILS: "Esperando datos huésped",
  CONFIRMED: "Confirmada",
  REJECTED: "Rechazada",
  CANCELLED: "Cancelada",
  COMPLETED: "Completada",
  EXPIRED: "Expirada (sin pago)",
};

export function HostRequestsClient() {
  const t = useT();
  const lang = useLang();
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [listings, setListings] = useState<HostListing[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);
  const [quote, setQuote] = useState<ScreeningQuote | undefined>();

  const load = useCallback(async () => {
    setLoadErr(null);
    try {
      const [bRes, lRes] = await Promise.all([
        fetch("/api/host/bookings", { cache: "no-store" }),
        fetch("/api/host/listings", { cache: "no-store" }),
      ]);
      if (!bRes.ok) {
        setLoadErr("No se pudieron cargar las reservas.");
        return;
      }
      const bData = await bRes.json();
      setBookings(bData.bookings ?? []);
      if (bData.screeningQuote) setQuote(bData.screeningQuote);
      if (lRes.ok) {
        const lData = await lRes.json();
        setListings(lData.listings ?? []);
      }
    } catch {
      setLoadErr("Error de red.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const sessionId = new URLSearchParams(window.location.search).get("session_id");
    if (!sessionId?.startsWith("cs_")) return;
    let cancelled = false;
    (async () => {
      await fetch("/api/guest/screening/verify-session", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      if (!cancelled) await load();
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const publishedListings = listings.filter((l) => l.published);

  return (
    <div className="max-w-4xl">
      {loadErr && <p className="text-sm text-red-600">{t(loadErr)}</p>}

      <div className="mt-6 space-y-6">
        {bookings.length === 0 && !loadErr && (
          <p className="text-sm text-[#888]">{t("Aún no hay solicitudes de reserva.")}</p>
        )}
        {bookings.map((b) => {
          const pending = b.status === "PENDING" || b.status === "PENDING_HOST";
          const awaitingPay = b.status === "AWAITING_PAYMENT";
          return (
            <div
              key={b.id}
              className="rounded border bg-white p-5 text-sm shadow-sm"
              style={{ borderColor: "#ebebeb" }}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-[#484848]">{b.effectiveListingTitle ?? b.listingTitle}</p>
                  <p className="mt-1 text-[#888]">
                    {b.guestName} · {b.guestEmail}
                  </p>
                  <p className="mt-2 text-[#3a3a3a]">
                    {t("Solicitado: {checkIn} → {checkOut} ({n} noches)", {
                      checkIn: b.checkIn,
                      checkOut: b.checkOut,
                      n: b.nights,
                    })}
                  </p>
                  <p className="mt-1">
                    {t("Total estimado:")}{" "}
                    <span className="font-medium">${b.estimatedTotalMxn.toLocaleString(numberLocale(lang))} MXN</span>
                    {b.paidAt && !b.refundedAt && (
                      <span className="ml-2 rounded bg-green-100 px-2 py-0.5 text-xs text-green-900">
                        {t("Pagado")}
                      </span>
                    )}
                    {b.refundedAt && (
                      <span className="ml-2 rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-900">
                        {t("Reembolsado al huésped")}
                      </span>
                    )}
                  </p>
                  <p className="mt-2 text-xs text-[#aaa]">
                    {t("Código huésped:")} <span className="font-mono tracking-wide">{b.token}</span>
                  </p>
                  <p className="mt-2 text-xs text-[#3a3a3a]">
                    <Link href={`/contrato/${b.token}`} className="font-medium text-[#dcb81e] underline">
                      {t("Ver contrato")}
                    </Link>
                    {b.contract && (
                      <>
                        {" · "}
                        {b.contract.hostAcceptedAt && b.contract.guestAcceptedAt
                          ? t("firmado por ambas partes")
                          : b.contract.hostAcceptedAt
                            ? t("falta firma del huésped")
                            : t("falta tu firma")}
                        {" · "}
                        <a
                          href={`/api/bookings/contract?id=${encodeURIComponent(b.id)}&format=pdf`}
                          className="font-medium text-[#dcb81e] underline"
                        >
                          PDF
                        </a>
                      </>
                    )}
                  </p>
                </div>
                <span
                  className="rounded-full px-3 py-1 text-xs font-semibold"
                  style={{
                    backgroundColor: pending ? "#fef3c7" : awaitingPay ? "#e0f2fe" : "#f3f4f6",
                    color: "#484848",
                  }}
                >
                  {t(statusLabel[b.status] ?? b.status)}
                </span>
              </div>

              {pending && (
                <PendingActions
                  booking={b}
                  publishedListings={publishedListings}
                  acting={acting}
                  setActing={setActing}
                  onDone={() => void load()}
                />
              )}
              {!pending && b.contract && !b.contract.hostAcceptedAt && (
                <HostSignOnly bookingId={b.id} acting={acting} setActing={setActing} onDone={() => void load()} />
              )}
              {!pending && b.contract && (
                <HostContractText bookingId={b.id} />
              )}
              <BookingScreeningPanel
                bookingId={b.id}
                role="host"
                screening={b.screening}
                canRequest={b.canRequestScreening}
                quote={quote}
                onChanged={() => void load()}
              />
              <BookingDepositPanel
                bookingId={b.id}
                deposit={b.deposit}
                role="host"
                onChanged={() => void load()}
              />
              <BookingReviewPanel
                bookingId={b.id}
                role="host"
                canReview={b.canReview}
                myReview={b.myReview}
                otherReview={b.guestReviewOfListing}
                onChanged={() => void load()}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PendingActions({
  booking,
  publishedListings,
  acting,
  setActing,
  onDone,
}: {
  booking: BookingRow;
  publishedListings: HostListing[];
  acting: string | null;
  setActing: (id: string | null) => void;
  onDone: () => void;
}) {
  const t = useT();
  const [adjIn, setAdjIn] = useState(booking.checkIn);
  const [adjOut, setAdjOut] = useState(booking.checkOut);
  const [adjListingId, setAdjListingId] = useState(booking.listingId);
  const [lines, setLines] = useState<string[]>([]);
  const [preview, setPreview] = useState<{
    changes?: string[];
    guestMustResign?: boolean;
    estimatedTotalMxn?: number;
    paidTotalMxn?: number;
    blocked?: boolean;
    overlapping?: boolean;
    taxAvailable?: boolean;
    chargeTax?: boolean;
    taxMxn?: number;
    taxIncluded?: boolean;
    error?: string;
  }>({});
  const [signName, setSignName] = useState("");
  const [acceptContract, setAcceptContract] = useState(false);
  const [chargeTax, setChargeTax] = useState<boolean | null>(null);
  const taxOn = chargeTax ?? Boolean(preview.chargeTax);

  useEffect(() => {
    let cancelled = false;
    const q = new URLSearchParams({ checkIn: adjIn, checkOut: adjOut, listingId: adjListingId });
    if (chargeTax !== null) q.set("tax", chargeTax ? "1" : "0");
    const timer = setTimeout(async () => {
      const res = await fetch(`/api/host/bookings/${booking.id}?${q}`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (cancelled) return;
      if (Array.isArray(data.lines)) setLines(data.lines);
      setPreview(res.ok ? data : { error: typeof data.error === "string" ? data.error : "No se pudo armar el contrato." });
      // Si cambian los términos, la firma anterior ya no aplica: hay que volver a revisar.
      setAcceptContract(false);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [booking.id, adjIn, adjOut, adjListingId, chargeTax]);

  const listingOptions: HostListing[] =
    publishedListings.length > 0
      ? publishedListings
      : [{ id: booking.listingId, title: booking.listingTitle, published: true }];

  return (
    <div className="mt-4 border-t pt-4" style={{ borderColor: "#ebebeb" }}>
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[#aaa]">
        {t("Ajustes antes de aceptar (opcional)")}
      </p>
      <p className="mb-3 text-xs text-[#888]">
        {t(
          "Revisa el contrato con los datos del huésped (su cuenta) y los tuyos (la plantilla del anuncio). Al aceptar lo firmas."
        )}
      </p>
      {preview.error && <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{t(preview.error)}</p>}
      {(preview.blocked || preview.overlapping) && (
        <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">
          {t(preview.blocked ? "Hay noches bloqueadas en ese rango." : "Esas fechas ya tienen otra solicitud o reserva activa.")}
        </p>
      )}
      {preview.changes && preview.changes.length > 0 && (
        <div className="mb-3 rounded border border-[#f0d77a] bg-[#fdf6d8] px-3 py-2 text-sm text-[#6b5308]">
          <p className="font-semibold">{t("El contrato se actualizará")}</p>
          <p className="mt-0.5">{preview.changes.join(" · ")}</p>
          {preview.guestMustResign && (
            <p className="mt-1">
              {t("El huésped ya había firmado: su firma queda archivada y tendrá que firmar la versión nueva antes de que se confirme.")}
            </p>
          )}
          {preview.paidTotalMxn != null && preview.estimatedTotalMxn != null && preview.estimatedTotalMxn !== preview.paidTotalMxn && (
            <p className="mt-1">
              {t(
                preview.estimatedTotalMxn > preview.paidTotalMxn
                  ? "El huésped pagó {paid}; el nuevo total es {total}. Al aceptar le cobramos la diferencia ({diff}) y la reserva se confirma cuando la pague."
                  : "El huésped pagó {paid}; el nuevo total es {total}. Al aceptar le devolvemos la diferencia ({diff}) automáticamente.",
                {
                  paid: `$${preview.paidTotalMxn.toLocaleString("es-MX")}`,
                  total: `$${preview.estimatedTotalMxn.toLocaleString("es-MX")}`,
                  diff: `$${Math.abs(preview.estimatedTotalMxn - preview.paidTotalMxn).toLocaleString("es-MX")}`,
                }
              )}
            </p>
          )}
        </div>
      )}
      {lines.length > 0 && (
        <pre
          className="mb-4 max-h-56 overflow-auto whitespace-pre-wrap rounded border bg-[#fafafa] p-3 text-xs leading-relaxed text-[#3a3a3a]"
          style={{ borderColor: "#ebebeb" }}
        >
          {lines.join("\n")}
        </pre>
      )}
      <label className="mb-3 block">
        <span className="text-xs text-[#888]">{t("Tu nombre legal (firma)")}</span>
        <input
          value={signName}
          onChange={(e) => setSignName(e.target.value)}
          className="mt-1 w-full rounded border px-3 py-2 text-sm"
          style={{ borderColor: "#ebebeb" }}
        />
      </label>
      <label className="mb-4 flex items-start gap-2 text-sm text-[#484848]">
        <input
          type="checkbox"
          checked={acceptContract}
          onChange={(e) => setAcceptContract(e.target.checked)}
          className="mt-1 accent-[#dcb81e]"
        />
        <span>{t("He leído este contrato y lo firmo como anfitrión.")}</span>
      </label>
      <div className="grid gap-3 sm:grid-cols-3">
        <label>
          <span className="text-xs text-[#888]">{t("Entrada")}</span>
          <input
            type="date"
            value={adjIn}
            onChange={(e) => setAdjIn(e.target.value)}
            className="mt-1 w-full rounded border px-2 py-2 text-sm"
            style={{ borderColor: "#ebebeb" }}
          />
        </label>
        <label>
          <span className="text-xs text-[#888]">{t("Salida")}</span>
          <input
            type="date"
            value={adjOut}
            onChange={(e) => setAdjOut(e.target.value)}
            className="mt-1 w-full rounded border px-2 py-2 text-sm"
            style={{ borderColor: "#ebebeb" }}
          />
        </label>
        <label>
          <span className="text-xs text-[#888]">{t("Alojamiento")}</span>
          <select
            value={adjListingId}
            onChange={(e) => setAdjListingId(e.target.value)}
            className="mt-1 w-full rounded border px-2 py-2 text-sm text-[#484848]"
            style={{ borderColor: "#ebebeb" }}
          >
            {listingOptions.map((l) => (
              <option key={l.id} value={l.id}>
                {l.title}
              </option>
            ))}
          </select>
        </label>
      </div>
      {preview.taxAvailable && (
        <label className="mt-3 flex items-start gap-2 text-sm text-[#484848]">
          <input
            type="checkbox"
            checked={taxOn}
            onChange={(e) => setChargeTax(e.target.checked)}
            className="mt-1 accent-[#dcb81e]"
          />
          <span>
            <span className="font-semibold">{t("Cobrar impuestos en esta reserva")}</span>
            <span className="block text-xs text-[#888]">
              {taxOn
                ? preview.taxMxn
                  ? t(preview.taxIncluded ? "Incluye {amount} de impuestos." : "Se suman {amount} de impuestos.", {
                      amount: `$${preview.taxMxn.toLocaleString("es-MX")}`,
                    })
                  : t("Se agregan al total y al contrato.")
                : t("El huésped no paga impuestos en esta reserva.")}
              {preview.estimatedTotalMxn != null
                ? ` ${t("Total: {total}", { total: `$${preview.estimatedTotalMxn.toLocaleString("es-MX")}` })}`
                : ""}
            </span>
          </span>
        </label>
      )}
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          disabled={acting === booking.id || !acceptContract || signName.trim().length < 3}
          className="rounded bg-[#dcb81e] px-5 py-2.5 text-sm font-semibold text-black disabled:opacity-50"
          onClick={async () => {
            setActing(booking.id);
            try {
              const body: Record<string, unknown> = {
                action: "accept",
                acceptContract: true,
                signName: signName.trim(),
              };
              if (adjIn !== booking.checkIn) body.hostAdjustedCheckIn = adjIn;
              if (adjOut !== booking.checkOut) body.hostAdjustedCheckOut = adjOut;
              if (adjListingId !== booking.listingId) body.hostAdjustedListingId = adjListingId;
              if (preview.taxAvailable) body.chargeTax = taxOn;
              const res = await fetch(`/api/host/bookings/${booking.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
              });
              const data = await res.json().catch(() => ({}));
              if (!res.ok) {
                alert(t(typeof data.error === "string" ? data.error : "No se pudo aceptar."));
                return;
              }
              onDone();
            } finally {
              setActing(null);
            }
          }}
        >
          {t("Firmar y aceptar")}
        </button>
        <button
          type="button"
          disabled={acting === booking.id}
          className="rounded border border-[#ebebeb] px-5 py-2.5 text-sm font-medium text-[#484848] disabled:opacity-50"
          onClick={async () => {
            const msg = booking.paidAt
              ? t("Al rechazar se devuelve al huésped el total que pagó, incluido el cargo de servicio. ¿Continuar?")
              : t("¿Rechazar esta solicitud?");
            if (!confirm(msg)) return;
            setActing(booking.id);
            try {
              const res = await fetch(`/api/host/bookings/${booking.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "reject" }),
              });
              const data = await res.json().catch(() => ({}));
              if (!res.ok) {
                alert(t(typeof data.error === "string" ? data.error : "No se pudo rechazar."));
                return;
              }
              onDone();
            } finally {
              setActing(null);
            }
          }}
        >
          {t("Rechazar")}
        </button>
      </div>
    </div>
  );
}

function HostContractText({ bookingId }: { bookingId: string }) {
  const [lines, setLines] = useState<string[]>([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/host/bookings/${bookingId}`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!cancelled && Array.isArray(data.lines)) setLines(data.lines);
    })();
    return () => {
      cancelled = true;
    };
  }, [bookingId]);
  if (!lines.length) return null;
  return (
    <pre
      className="mt-4 max-h-56 overflow-auto whitespace-pre-wrap rounded border bg-[#fafafa] p-3 text-xs leading-relaxed text-[#3a3a3a]"
      style={{ borderColor: "#ebebeb" }}
    >
      {lines.join("\n")}
    </pre>
  );
}

function HostSignOnly({
  bookingId,
  acting,
  setActing,
  onDone,
}: {
  bookingId: string;
  acting: string | null;
  setActing: (id: string | null) => void;
  onDone: () => void;
}) {
  const t = useT();
  const [signName, setSignName] = useState("");
  return (
    <div className="mt-4 border-t pt-4" style={{ borderColor: "#ebebeb" }}>
      <p className="mb-2 text-sm font-medium text-[#484848]">{t("Falta tu firma en este contrato")}</p>
      <input
        value={signName}
        onChange={(e) => setSignName(e.target.value)}
        placeholder={t("Tu nombre legal")}
        className="w-full rounded border px-3 py-2 text-sm"
        style={{ borderColor: "#ebebeb" }}
      />
      <button
        type="button"
        disabled={acting === bookingId || signName.trim().length < 3}
        className="mt-3 rounded bg-[#dcb81e] px-5 py-2 text-sm font-semibold text-black disabled:opacity-50"
        onClick={async () => {
          setActing(bookingId);
          try {
            const res = await fetch(`/api/host/bookings/${bookingId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "sign", signName: signName.trim() }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
              alert(t(typeof data.error === "string" ? data.error : "No se pudo firmar."));
              return;
            }
            onDone();
          } finally {
            setActing(null);
          }
        }}
      >
        {t("Firmar contrato")}
      </button>
    </div>
  );
}
