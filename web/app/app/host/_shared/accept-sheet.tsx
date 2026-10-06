"use client";

import { useEffect, useState } from "react";
import { useLang, useT } from "@/components/i18n-provider";
import { TONE_CLS, fmtDay, fmtMxn, hostStatusOf } from "../../_components/booking-status";
import { Sheet } from "../../_components/sheet";
import { useHostListings, type HostBooking } from "./host-data";

type Booking = HostBooking;

export function BookingSummary({ b }: { b: Booking }) {
  const t = useT();
  const lang = useLang();
  const st = hostStatusOf(b);
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

type ContractPreview = {
  nights?: number;
  estimatedTotalMxn?: number;
  paidTotalMxn?: number;
  changes?: string[];
  guestMustResign?: boolean;
  blocked?: boolean;
  overlapping?: boolean;
  taxAvailable?: boolean;
  chargeTax?: boolean;
  taxMxn?: number;
  taxIncluded?: boolean;
  error?: string;
};

/** Revisar el contrato, ajustar fechas o alojamiento y aceptar firmando. */
export function AcceptSheet({
  booking,
  onClose,
  onDone,
}: {
  booking: Booking | null;
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const t = useT();
  const listings = useHostListings();
  const [lines, setLines] = useState<string[] | null>(null);
  const [agree, setAgree] = useState(false);
  const [signName, setSignName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [adjIn, setAdjIn] = useState(booking?.checkIn ?? "");
  const [adjOut, setAdjOut] = useState(booking?.checkOut ?? "");
  const [adjListing, setAdjListing] = useState(booking?.listingId ?? "");
  const [preview, setPreview] = useState<ContractPreview>({});
  const [chargeTax, setChargeTax] = useState<boolean | null>(null);

  useEffect(() => {
    if (!booking || !adjIn || !adjOut || !adjListing) return;
    let cancelled = false;
    const q = new URLSearchParams({ checkIn: adjIn, checkOut: adjOut, listingId: adjListing });
    if (chargeTax !== null) q.set("tax", chargeTax ? "1" : "0");
    const timer = setTimeout(() => {
      fetch(`/api/host/bookings/${booking.id}?${q}`, { cache: "no-store" })
        .then(async (r) => {
          const j = await r.json().catch(() => ({}));
          if (cancelled) return;
          if (Array.isArray(j.lines)) setLines(Array.isArray(j.linesTranslated) ? j.linesTranslated : j.lines);
          else if (!r.ok) setLines((prev) => prev ?? []);
          setPreview(r.ok ? j : { error: typeof j.error === "string" ? j.error : "No se pudo cargar el contrato." });
          setAgree(false);
        })
        .catch(() => !cancelled && setLines((prev) => prev ?? []));
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [booking, adjIn, adjOut, adjListing, chargeTax]);

  const invalid = Boolean(preview.error || preview.blocked || preview.overlapping);
  const taxOn = chargeTax ?? Boolean(preview.chargeTax);

  const accept = async () => {
    if (!booking) return;
    setBusy(true);
    setErr(null);
    try {
      const body: Record<string, unknown> = { action: "accept", acceptContract: true, signName: signName.trim() };
      if (adjIn !== booking.checkIn) body.hostAdjustedCheckIn = adjIn;
      if (adjOut !== booking.checkOut) body.hostAdjustedCheckOut = adjOut;
      if (adjListing !== booking.listingId) body.hostAdjustedListingId = adjListing;
      if (preview.taxAvailable) body.chargeTax = taxOn;
      const res = await fetch(`/api/host/bookings/${booking.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
          {editing ? (
            <div className="space-y-3 rounded-2xl border border-[#ebebeb] p-4">
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-xs font-semibold uppercase text-[#717171]">
                  {t("Llegada")}
                  <input
                    type="date"
                    value={adjIn}
                    onChange={(e) => setAdjIn(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-[#ccc] px-3 py-2.5 text-[15px] font-normal normal-case text-[#222]"
                  />
                </label>
                <label className="block text-xs font-semibold uppercase text-[#717171]">
                  {t("Salida")}
                  <input
                    type="date"
                    value={adjOut}
                    min={adjIn}
                    onChange={(e) => setAdjOut(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-[#ccc] px-3 py-2.5 text-[15px] font-normal normal-case text-[#222]"
                  />
                </label>
              </div>
              {(listings?.filter((l) => l.published).length ?? 0) > 1 && (
                <label className="block text-xs font-semibold uppercase text-[#717171]">
                  {t("Alojamiento")}
                  <select
                    value={adjListing}
                    onChange={(e) => setAdjListing(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-[#ccc] bg-white px-3 py-2.5 text-[15px] font-normal normal-case text-[#222]"
                  >
                    {listings
                      ?.filter((l) => l.published || l.id === booking.listingId)
                      .map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.title}
                        </option>
                      ))}
                  </select>
                </label>
              )}
              {preview.nights != null && preview.estimatedTotalMxn != null && !invalid && (
                <p className="text-sm text-[#333]">
                  {preview.nights} {preview.nights === 1 ? t("noche") : t("noches")} · {fmtMxn(preview.estimatedTotalMxn)}
                </p>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-sm font-semibold text-[#222] underline"
            >
              {t("Cambiar fechas o alojamiento")}
            </button>
          )}
          {preview.taxAvailable && (
            <label className="flex items-start gap-3 rounded-2xl border border-[#ebebeb] p-4 text-sm text-[#333]">
              <input
                type="checkbox"
                checked={taxOn}
                onChange={(e) => setChargeTax(e.target.checked)}
                className="mt-0.5 h-5 w-5 accent-[#dcb81e]"
              />
              <span>
                <span className="block text-[15px] font-semibold text-[#222]">{t("Cobrar impuestos en esta reserva")}</span>
                <span className="mt-0.5 block text-[#717171]">
                  {taxOn
                    ? preview.taxMxn
                      ? t(preview.taxIncluded ? "Incluye {amount} de impuestos." : "Se suman {amount} de impuestos.", {
                          amount: fmtMxn(preview.taxMxn),
                        })
                      : t("Se agregan al total y al contrato.")
                    : t("El huésped no paga impuestos en esta reserva.")}
                  {preview.estimatedTotalMxn != null && !invalid
                    ? ` ${t("Total: {total}", { total: fmtMxn(preview.estimatedTotalMxn) })}`
                    : ""}
                </span>
              </span>
            </label>
          )}
          {preview.error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{t(preview.error)}</p>}
          {(preview.blocked || preview.overlapping) && (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              {t(preview.blocked ? "Hay noches bloqueadas en ese rango." : "Esas fechas ya tienen otra solicitud o reserva activa.")}
            </p>
          )}
          {preview.changes && preview.changes.length > 0 && (
            <div className="rounded-2xl bg-[#fdf6d8] px-4 py-3 text-sm text-[#6b5308]">
              <p className="font-semibold">{t("El contrato se actualizará")}</p>
              <p className="mt-0.5">{preview.changes.join(" · ")}</p>
              {preview.guestMustResign && (
                <p className="mt-1">
                  {t("El huésped ya había firmado: su firma queda archivada y tendrá que firmar la versión nueva antes de que se confirme.")}
                </p>
              )}
              {preview.paidTotalMxn != null &&
                preview.estimatedTotalMxn != null &&
                preview.estimatedTotalMxn !== preview.paidTotalMxn && (
                  <p className="mt-1">
                    {t(
                      preview.estimatedTotalMxn > preview.paidTotalMxn
                        ? "El huésped pagó {paid}; el nuevo total es {total}. Al aceptar le cobramos la diferencia ({diff}) y la reserva se confirma cuando la pague."
                        : "El huésped pagó {paid}; el nuevo total es {total}. Al aceptar le devolvemos la diferencia ({diff}) automáticamente.",
                      {
                        paid: fmtMxn(preview.paidTotalMxn),
                        total: fmtMxn(preview.estimatedTotalMxn),
                        diff: fmtMxn(Math.abs(preview.estimatedTotalMxn - preview.paidTotalMxn)),
                      }
                    )}
                  </p>
                )}
            </div>
          )}
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
            disabled={busy || !agree || invalid || signName.trim().length < 3}
            onClick={() => void accept()}
            className="w-full rounded-xl bg-[#dcb81e] py-3.5 text-[15px] font-semibold text-black disabled:opacity-50"
          >
            {busy ? t("Aceptando…") : t("Aceptar y firmar")}
          </button>
        </div>
      )}
    </Sheet>
  );
}
