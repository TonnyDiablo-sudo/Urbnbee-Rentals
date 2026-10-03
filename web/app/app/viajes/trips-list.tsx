"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { GuestPayNote } from "@/components/booking/pay-status";
import { PayDifference } from "@/components/booking/pay-difference";
import { useLang, useT } from "@/components/i18n-provider";
import type { ArrivalGuide } from "@/lib/arrival-guide";
import type { PayConfirmation, PayInstruction, PayProof } from "@/lib/booking-types";
import { TONE_CLS, fmtDay, fmtMxn, guestStatusOf } from "../_components/booking-status";
import { Sheet } from "../_components/sheet";
import { WebLink } from "../_components/site-origin";

type Trip = {
  id: string;
  token: string;
  status: string;
  listingTitle: string;
  listingSlug?: string;
  checkIn: string;
  checkOut: string;
  hostAdjustedCheckIn?: string;
  hostAdjustedCheckOut?: string;
  nights: number;
  estimatedTotalMxn: number;
  platformFeeMxn?: number;
  listingId: string;
  hostAdjustedListingId?: string;
  listingPhoto?: string;
  listingCity?: string;
  arrival?: ArrivalGuide & { address?: string };
  canReview?: boolean;
  myReview?: { rating: number; comment: string } | null;
  hostReviewOfMe?: { rating: number; comment: string } | null;
  balanceDueMxn?: number;
  paidStayMxn?: number;
  taxMxn?: number;
  taxIncluded?: boolean;
  paidAt?: string;
  stripeCheckoutSessionId?: string;
  payInstruction?: PayInstruction | null;
  payConfirmation?: PayConfirmation | null;
  payProof?: PayProof | null;
  screening?: {
    status: string;
    payer: "host" | "guest";
    needsConsent: boolean;
    needsPayGuest: boolean;
  } | null;
};

const CLOSED = new Set(["CANCELLED", "EXPIRED", "REJECTED"]);

function tripEnd(trip: Trip): string {
  return trip.hostAdjustedCheckOut ?? trip.checkOut;
}

export function TripsList() {
  const t = useT();
  const lang = useLang();
  const router = useRouter();
  const params = useSearchParams();
  const sessionId = params.get("session_id");
  const reviewParam = params.get("resena");
  const [trips, setTrips] = useState<Trip[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [guide, setGuide] = useState<Trip | null>(null);
  const [reviewing, setReviewing] = useState<Trip | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/guest/bookings", { cache: "no-store" });
      const data = await res.json();
      setTrips(Array.isArray(data.bookings) ? data.bookings : []);
    } catch {
      setTrips([]);
    }
  }, []);

  useEffect(() => {
    if (!sessionId?.startsWith("cs_")) {
      void load();
      return;
    }
    (async () => {
      const res = await fetch("/api/bookings/verify-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      }).catch(() => null);
      const data = res ? await res.json().catch(() => ({})) : {};
      if (res?.ok) {
        setNotice(
          data.booking?.status === "CONFIRMED"
            ? "Pago recibido. Tu reserva está confirmada."
            : "Pago recibido. El anfitrión revisará tu solicitud y te responderá."
        );
      } else {
        setErr(typeof data.error === "string" ? data.error : "No pudimos confirmar el pago todavía.");
      }
      router.replace("/viajes");
      await load();
    })();
  }, [sessionId, load, router]);

  /** /viajes?resena=<id> (desde la notificación «Deja tu reseña») abre el formulario de esa estancia. */
  const [openedFromLink, setOpenedFromLink] = useState(false);
  if (reviewParam && trips && !openedFromLink) {
    setOpenedFromLink(true);
    const trip = trips.find((x) => x.id === reviewParam && x.canReview);
    if (trip) setReviewing(trip);
  }

  if (trips === null) return <p className="px-5 py-6 text-sm text-[#999]">{t("Cargando…")}</p>;

  const today = new Date().toISOString().slice(0, 10);
  const isPast = (x: Trip) => x.status === "COMPLETED" || CLOSED.has(x.status) || tripEnd(x) < today;
  const sections = [
    {
      title: "Próximos viajes",
      past: false,
      items: trips.filter((x) => !isPast(x)).sort((a, b) => a.checkIn.localeCompare(b.checkIn)),
    },
    {
      title: "Viajes anteriores",
      past: true,
      items: trips
        .filter(isPast)
        .sort((a, b) => Number(Boolean(b.canReview)) - Number(Boolean(a.canReview)) || tripEnd(b).localeCompare(tripEnd(a))),
    },
  ];

  return (
    <div className="px-5 pb-6">
      {notice && <p className="mb-4 rounded-2xl bg-[#e6f6ea] px-4 py-3 text-sm text-[#1e7a3a]">{t(notice)}</p>}
      {err && <p className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{t(err)}</p>}

      {trips.length === 0 ? (
        <div className="py-8">
          <p className="text-base font-semibold text-[#222]">{t("Aún no tienes viajes")}</p>
          <p className="mt-1 text-sm text-[#717171]">{t("Cuando reserves un alojamiento aparecerá aquí.")}</p>
          <Link href="/" className="mt-5 inline-block rounded-xl bg-[#dcb81e] px-5 py-3 text-sm font-semibold text-black">
            {t("Empieza a buscar")}
          </Link>
        </div>
      ) : (
        <div className="space-y-7">
          {sections.map((sec) =>
            sec.items.length === 0 ? null : (
        <section key={sec.title}>
        <h2 className="mb-3 text-[17px] font-semibold text-[#222]">{t(sec.title)}</h2>
        <ul className="space-y-3">
          {sec.items.map((trip) => {
            const st = guestStatusOf(trip);
            const inD = trip.hostAdjustedCheckIn ?? trip.checkIn;
            const outD = trip.hostAdjustedCheckOut ?? trip.checkOut;
            return (
              <li key={trip.id} className="rounded-2xl border border-[#ebebeb] p-4">
                <div className="flex items-start gap-3">
                  {trip.listingPhoto && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={trip.listingPhoto} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" loading="lazy" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-semibold leading-snug text-[#222]">{trip.listingTitle}</p>
                    {trip.listingCity && <p className="text-[13px] text-[#717171]">{trip.listingCity}</p>}
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${TONE_CLS[st.tone]}`}>
                    {t(st.label)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-[#555]">
                  {fmtDay(inD, lang)} – {fmtDay(outD, lang)} · {trip.nights} {trip.nights === 1 ? t("noche") : t("noches")}
                </p>
                <p className="text-sm text-[#555]">
                  {fmtMxn(trip.estimatedTotalMxn)} · {t("código {code}", { code: trip.token })}
                </p>
                {trip.screening && (trip.screening.needsConsent || trip.screening.needsPayGuest) && !sec.past && (
                  <div className="mt-3 rounded-xl bg-[#fdf6d8] px-3 py-3 text-sm text-[#5c4a0a]">
                    <p className="font-semibold">{t("Tu anfitrión pide revisar tu historial crediticio")}</p>
                    <p className="mt-0.5">
                      {trip.screening.payer === "guest"
                        ? t("Autoriza y paga la consulta para que pueda continuar con tu reserva.")
                        : t("Autoriza la consulta para continuar. La paga el anfitrión.")}
                    </p>
                    <WebLink
                      path="/guest/screening"
                      className="mt-2 inline-block rounded-lg bg-[#222] px-3 py-2 text-sm font-semibold text-white"
                    >
                      {trip.screening.needsConsent ? t("Revisar y autorizar") : t("Pagar consulta")}
                    </WebLink>
                  </div>
                )}
                {(trip.payConfirmation || trip.paidAt) && (
                  <GuestPayNote
                    bookingId={trip.id}
                    payConfirmation={trip.payConfirmation}
                    payProof={trip.payProof}
                    paidAt={trip.paidAt}
                    stripePaid={Boolean(trip.stripeCheckoutSessionId) || trip.payConfirmation?.by === "stripe"}
                  />
                )}
                {(trip.balanceDueMxn ?? 0) > 0 && (
                  <div className="mt-3">
                    <PayDifference
                      compact
                      bookingId={trip.id}
                      amountMxn={trip.balanceDueMxn ?? 0}
                      paidMxn={trip.paidStayMxn}
                      returnPath="/viajes"
                      onPaid={() => {
                        setNotice("Diferencia pagada. Gracias.");
                        void load();
                      }}
                    />
                  </div>
                )}
                {trip.myReview && (
                  <div className="mt-3 rounded-xl bg-[#f7f7f7] px-3 py-2.5">
                    <p className="text-[13px] font-semibold text-[#222]">
                      {t("Tu reseña")} · <Stars value={trip.myReview.rating} />
                    </p>
                    <p className="mt-0.5 line-clamp-3 text-[13px] text-[#555]">{trip.myReview.comment}</p>
                  </div>
                )}
                {trip.hostReviewOfMe && (
                  <div className="mt-3 rounded-xl border border-[#f0e3a8] bg-[#fffbea] px-3 py-2.5">
                    <p className="text-[13px] font-semibold text-[#222]">
                      {t("Reseña de tu anfitrión")} · <Stars value={trip.hostReviewOfMe.rating} />
                    </p>
                    <p className="mt-0.5 line-clamp-4 text-[13px] text-[#555]">{trip.hostReviewOfMe.comment}</p>
                  </div>
                )}
                <div className="mt-3 flex flex-wrap gap-2">
                  {trip.canReview && (
                    <button
                      type="button"
                      onClick={() => setReviewing(trip)}
                      className="rounded-xl bg-[#dcb81e] px-4 py-2 text-sm font-semibold text-black"
                    >
                      {t("Dejar reseña")}
                    </button>
                  )}
                  {trip.arrival && !sec.past && (
                    <button
                      type="button"
                      onClick={() => setGuide(trip)}
                      className="rounded-xl bg-[#111] px-4 py-2 text-sm font-semibold text-white"
                    >
                      {t("Guía de llegada")}
                    </button>
                  )}
                  {trip.status !== "CANCELLED" && trip.status !== "EXPIRED" && trip.status !== "REJECTED" && (
                    <Link
                      href={`/mensajes/${encodeURIComponent(trip.hostAdjustedListingId ?? trip.listingId)}`}
                      className="rounded-xl border border-[#ddd] px-4 py-2 text-sm font-medium text-[#222]"
                    >
                      {t("Mensaje al anfitrión")}
                    </Link>
                  )}
                  {trip.status === "AWAITING_PAYMENT" && (
                    <WebLink
                      path={`/contrato/${trip.token}?pay=1`}
                      className="rounded-xl bg-[#dcb81e] px-4 py-2 text-sm font-semibold text-black"
                    >
                      {t("Firmar y pagar")}
                    </WebLink>
                  )}
                  {trip.status === "AWAITING_DETAILS" && (
                    <WebLink
                      path={`/finish/${trip.token}`}
                      className="rounded-xl bg-[#dcb81e] px-4 py-2 text-sm font-semibold text-black"
                    >
                      {t("Completar datos")}
                    </WebLink>
                  )}
                  {trip.listingSlug && (
                    <Link
                      href={`/alojamiento/${trip.listingSlug}`}
                      className="rounded-xl border border-[#ddd] px-4 py-2 text-sm font-medium text-[#222]"
                    >
                      {t("Ver alojamiento")}
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        </section>
            )
          )}
        </div>
      )}

      <WebLink
        path="/guest/bookings"
        icon
        className="mt-6 flex items-center justify-center gap-1.5 text-sm font-medium text-[#717171] underline"
      >
        {t("Contratos, depósitos y reseñas en la web")}{" "}
      </WebLink>

      <Sheet open={Boolean(guide)} onClose={() => setGuide(null)} title={t("Guía de llegada")}>
        {guide?.arrival && <ArrivalGuideView trip={guide} />}
      </Sheet>

      <Sheet open={Boolean(reviewing)} onClose={() => setReviewing(null)} title={t("Dejar reseña")}>
        {reviewing && (
          <ReviewForm
            key={reviewing.id}
            trip={reviewing}
            onDone={(review) => {
              setTrips((prev) =>
                prev?.map((x) => (x.id === reviewing.id ? { ...x, canReview: false, myReview: review } : x)) ?? prev
              );
              setReviewing(null);
              setNotice("¡Gracias! Tu reseña ya aparece en el anuncio.");
            }}
          />
        )}
      </Sheet>
    </div>
  );
}

function Stars({ value }: { value: number }) {
  return (
    <span className="text-[#222]" aria-label={`${value}/5`}>
      {"★".repeat(value)}
      <span className="text-[#ccc]">{"★".repeat(5 - value)}</span>
    </span>
  );
}

const RATING_WORDS = ["", "Malo", "Regular", "Bien", "Muy bien", "Excelente"];

function ReviewForm({ trip, onDone }: { trip: Trip; onDone: (r: { rating: number; comment: string }) => void }) {
  const t = useT();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const ok = rating > 0 && comment.trim().length >= 10;

  async function submit() {
    setBusy(true);
    setErr(null);
    const res = await fetch(`/api/guest/bookings/${encodeURIComponent(trip.id)}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating, comment: comment.trim() }),
    }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (!res?.ok) {
      setErr(typeof data.error === "string" ? data.error : "No se pudo guardar. Intenta de nuevo.");
      return;
    }
    onDone({ rating, comment: comment.trim() });
  }

  return (
    <div className="space-y-5">
      <p className="text-[15px] font-semibold text-[#222]">{trip.listingTitle}</p>
      <div>
        <p className="text-sm font-semibold text-[#222]">{t("¿Cómo estuvo tu estancia?")}</p>
        <div className="mt-2 flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              aria-label={`${n}/5`}
              className={`h-11 w-11 text-[32px] leading-none ${n <= rating ? "text-[#dcb81e]" : "text-[#d6d6d6]"}`}
            >
              ★
            </button>
          ))}
        </div>
        {rating > 0 && <p className="mt-1 text-sm text-[#717171]">{t(RATING_WORDS[rating])}</p>}
      </div>
      <div>
        <p className="text-sm font-semibold text-[#222]">{t("Cuéntale a otros viajeros")}</p>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={5}
          maxLength={1200}
          placeholder={t("¿Qué te gustó? ¿Algo que mejorar?")}
          className="mt-2 w-full rounded-2xl border border-[#ddd] px-4 py-3 text-base outline-none focus:border-[#222]"
        />
        <p className="text-xs text-[#999]">{t("Mínimo 10 caracteres.")}</p>
      </div>
      {err && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{t(err)}</p>}
      <button
        type="button"
        disabled={!ok || busy}
        onClick={() => void submit()}
        className="w-full rounded-xl bg-[#222] py-3.5 text-[15px] font-semibold text-white disabled:opacity-40"
      >
        {busy ? t("Enviando…") : t("Publicar reseña")}
      </button>
    </div>
  );
}

function ArrivalGuideView({ trip }: { trip: Trip }) {
  const t = useT();
  const lang = useLang();
  const g = trip.arrival ?? {};
  const inD = trip.hostAdjustedCheckIn ?? trip.checkIn;
  const outD = trip.hostAdjustedCheckOut ?? trip.checkOut;
  const items: { label: string; value?: string }[] = [
    { label: "Dirección", value: g.address },
    { label: "Cómo llegar", value: g.directions },
    { label: "Cómo entrar", value: g.checkInMethod },
    { label: "Wifi", value: g.wifiName ? `${g.wifiName}${g.wifiPassword ? `\n${t("Contraseña")}: ${g.wifiPassword}` : ""}` : undefined },
    { label: "Manual de la casa", value: g.houseManual },
    { label: "Instrucciones de salida", value: g.checkoutInstructions },
  ];
  const filled = items.filter((i) => i.value);
  return (
    <div className="space-y-5">
      <p className="text-[15px] font-semibold text-[#222]">{trip.listingTitle}</p>
      <div className="grid grid-cols-2 overflow-hidden rounded-2xl border border-[#ebebeb]">
        <div className="border-r border-[#ebebeb] p-3">
          <p className="text-xs font-semibold uppercase text-[#717171]">{t("Llegada")}</p>
          <p className="mt-0.5 text-[15px] text-[#222]">{fmtDay(inD, lang)}</p>
          {g.checkInTime && <p className="text-sm text-[#717171]">{t("desde las {time}", { time: g.checkInTime })}</p>}
        </div>
        <div className="p-3">
          <p className="text-xs font-semibold uppercase text-[#717171]">{t("Salida")}</p>
          <p className="mt-0.5 text-[15px] text-[#222]">{fmtDay(outD, lang)}</p>
          {g.checkOutTime && <p className="text-sm text-[#717171]">{t("antes de las {time}", { time: g.checkOutTime })}</p>}
        </div>
      </div>
      {filled.map((i) => (
        <div key={i.label}>
          <p className="text-sm font-semibold text-[#222]">{t(i.label)}</p>
          <p className="mt-1 whitespace-pre-line text-[15px] leading-relaxed text-[#333]">{i.value}</p>
        </div>
      ))}
      {filled.length <= 1 && (
        <p className="rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm text-[#717171]">
          {t("El anfitrión todavía no llena su guía de llegada. Escríbele por el chat si necesitas algo.")}
        </p>
      )}
    </div>
  );
}
