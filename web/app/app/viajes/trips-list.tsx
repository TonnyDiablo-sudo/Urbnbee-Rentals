"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useLang, useT } from "@/components/i18n-provider";
import { GUEST_STATUS, TONE_CLS, fmtDay, fmtMxn } from "../_components/booking-status";
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
};

export function TripsList() {
  const t = useT();
  const lang = useLang();
  const router = useRouter();
  const params = useSearchParams();
  const sessionId = params.get("session_id");
  const [trips, setTrips] = useState<Trip[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

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

  if (trips === null) return <p className="px-5 py-6 text-sm text-[#999]">{t("Cargando…")}</p>;

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
        <ul className="space-y-3">
          {trips.map((trip) => {
            const st = GUEST_STATUS[trip.status] ?? { label: trip.status, tone: "off" as const };
            const inD = trip.hostAdjustedCheckIn ?? trip.checkIn;
            const outD = trip.hostAdjustedCheckOut ?? trip.checkOut;
            return (
              <li key={trip.id} className="rounded-2xl border border-[#ebebeb] p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 text-[15px] font-semibold text-[#222]">{trip.listingTitle}</p>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${TONE_CLS[st.tone]}`}>
                    {t(st.label)}
                  </span>
                </div>
                <p className="mt-1 text-sm text-[#555]">
                  {fmtDay(inD, lang)} – {fmtDay(outD, lang)} · {trip.nights} {trip.nights === 1 ? t("noche") : t("noches")}
                </p>
                <p className="text-sm text-[#555]">
                  {fmtMxn(trip.estimatedTotalMxn + (trip.platformFeeMxn ?? 0))} · {t("código {code}", { code: trip.token })}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
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
      )}

      <WebLink
        path="/guest/bookings"
        icon
        className="mt-6 flex items-center justify-center gap-1.5 text-sm font-medium text-[#717171] underline"
      >
        {t("Contratos, depósitos y reseñas en la web")}{" "}
      </WebLink>
    </div>
  );
}
