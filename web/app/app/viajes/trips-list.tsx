"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { GUEST_STATUS, TONE_CLS, fmtDay, fmtMxn } from "../_components/booking-status";
import { IconExternal } from "../_components/icons";

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
  const router = useRouter();
  const params = useSearchParams();
  const sessionId = params.get("session_id");
  const [trips, setTrips] = useState<Trip[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

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
      router.replace("/app/viajes");
      await load();
    })();
  }, [sessionId, load, router]);

  const pay = async (t: Trip) => {
    setBusyId(t.id);
    setErr(null);
    try {
      const res = await fetch(`/api/bookings/${t.id}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cancelPath: "/app/viajes", returnPath: "/app/viajes" }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(typeof data.error === "string" ? data.error : "No se pudo iniciar el pago.");
        return;
      }
      if (typeof data.checkoutUrl === "string") {
        window.location.assign(data.checkoutUrl);
        return;
      }
      if (data.simulatePayment) {
        const sim = await fetch(`/api/bookings/${t.id}/simulate-payment`, { method: "POST" });
        if (!sim.ok) {
          const j = await sim.json().catch(() => ({}));
          setErr(typeof j.error === "string" ? j.error : "No se pudo confirmar el pago (demo).");
        } else {
          setNotice("Pago de prueba registrado.");
        }
        await load();
      }
    } catch {
      setErr("Sin conexión.");
    } finally {
      setBusyId(null);
    }
  };

  if (trips === null) return <p className="px-5 py-6 text-sm text-[#999]">Cargando…</p>;

  return (
    <div className="px-5 pb-6">
      {notice && <p className="mb-4 rounded-2xl bg-[#e6f6ea] px-4 py-3 text-sm text-[#1e7a3a]">{notice}</p>}
      {err && <p className="mb-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">{err}</p>}

      {trips.length === 0 ? (
        <div className="py-8">
          <p className="text-base font-semibold text-[#222]">Aún no tienes viajes</p>
          <p className="mt-1 text-sm text-[#717171]">Cuando reserves un alojamiento aparecerá aquí.</p>
          <Link href="/app" className="mt-5 inline-block rounded-xl bg-[#dcb81e] px-5 py-3 text-sm font-semibold text-black">
            Empieza a buscar
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {trips.map((t) => {
            const st = GUEST_STATUS[t.status] ?? { label: t.status, tone: "off" as const };
            const inD = t.hostAdjustedCheckIn ?? t.checkIn;
            const outD = t.hostAdjustedCheckOut ?? t.checkOut;
            return (
              <li key={t.id} className="rounded-2xl border border-[#ebebeb] p-4">
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 text-[15px] font-semibold text-[#222]">{t.listingTitle}</p>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${TONE_CLS[st.tone]}`}>
                    {st.label}
                  </span>
                </div>
                <p className="mt-1 text-sm text-[#555]">
                  {fmtDay(inD)} – {fmtDay(outD)} · {t.nights} {t.nights === 1 ? "noche" : "noches"}
                </p>
                <p className="text-sm text-[#555]">
                  {fmtMxn(t.estimatedTotalMxn + (t.platformFeeMxn ?? 0))} · código {t.token}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {t.status === "AWAITING_PAYMENT" && (
                    <button
                      type="button"
                      disabled={busyId === t.id}
                      onClick={() => void pay(t)}
                      className="rounded-xl bg-[#dcb81e] px-4 py-2 text-sm font-semibold text-black disabled:opacity-60"
                    >
                      {busyId === t.id ? "Abriendo…" : "Pagar ahora"}
                    </button>
                  )}
                  {t.status === "AWAITING_DETAILS" && (
                    <a
                      href={`/finish/${t.token}`}
                      className="rounded-xl bg-[#dcb81e] px-4 py-2 text-sm font-semibold text-black"
                    >
                      Completar datos
                    </a>
                  )}
                  {t.listingSlug && (
                    <Link
                      href={`/app/alojamiento/${t.listingSlug}`}
                      className="rounded-xl border border-[#ddd] px-4 py-2 text-sm font-medium text-[#222]"
                    >
                      Ver alojamiento
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <a
        href="/guest/bookings"
        target="_blank"
        rel="noopener"
        className="mt-6 flex items-center justify-center gap-1.5 text-sm font-medium text-[#717171] underline"
      >
        Contratos, depósitos y reseñas en la web <IconExternal />
      </a>
    </div>
  );
}
