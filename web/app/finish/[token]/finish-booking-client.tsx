"use client";

import { ContractText } from "@/components/booking/contract-text";
import Link from "next/link";
import { useEffect, useState } from "react";
import { PayDifference } from "@/components/booking/pay-difference";
import { useT } from "@/components/i18n-provider";

type LookupBooking = {
  id: string;
  status: string;
  balanceDueMxn?: number;
  paidStayMxn?: number;
  token: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  estimatedTotalMxn: number;
  guestName: string;
  listingTitle?: string;
  listingSlug?: string;
  paidAt?: string;
  contract?: {
    generated: boolean;
    accepted: boolean;
    hostAcceptedAt?: string;
    guestAcceptedAt?: string;
    lines?: string[];
    linesTranslated?: string[];
  };
};

export function FinishBookingClient({ token }: { token: string }) {
  const t = useT();
  const [booking, setBooking] = useState<LookupBooking | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [guestPhone, setGuestPhone] = useState("");
  const [guestFinishNotes, setGuestFinishNotes] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [signedName, setSignedName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (token.length !== 6) {
      setLoadErr("El código debe tener 6 dígitos.");
      return;
    }
    let cancelled = false;
    (async () => {
      setLoadErr(null);
      try {
        const res = await fetch(`/api/bookings/lookup?token=${encodeURIComponent(token)}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (!cancelled) setLoadErr(typeof data.error === "string" ? data.error : "No encontrado.");
          return;
        }
        if (!cancelled && data.booking) {
          const row = data.booking as LookupBooking;
          setBooking(row);
          setSignedName((prev) => prev || row.guestName || "");
        }
      } catch {
        if (!cancelled) setLoadErr("Error de red.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token, reloadKey]);

  if (loadErr) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-red-600">{t(loadErr)}</p>
        <Link href="/" className="mt-6 inline-block text-sm text-[#dcb81e] underline">
          {t("Volver al inicio")}
        </Link>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center text-[#888]">
        {t("Cargando…")}
      </div>
    );
  }

  const statusLabels: Record<string, string> = {
    AWAITING_PAYMENT: "Pago pendiente",
    PENDING: "Pendiente de anfitrión",
    PENDING_HOST: "Pendiente de anfitrión",
    AWAITING_DETAILS: "Aprobada — acepta el contrato",
    CONFIRMED: "Confirmada",
    REJECTED: "Rechazada",
    CANCELLED: "Cancelada",
    COMPLETED: "Completada",
    EXPIRED: "Expirada",
  };

  const needsContract =
    Boolean(booking.contract?.generated) &&
    !booking.contract?.guestAcceptedAt &&
    (booking.status === "AWAITING_PAYMENT" ||
      booking.status === "AWAITING_DETAILS" ||
      booking.status === "CONFIRMED");
  const canFinish = needsContract;
  const pdfHref = `/api/bookings/contract?token=${encodeURIComponent(token)}&format=pdf`;

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#aaa]">{t("Reserva")}</p>
      <h1 className="mt-1 text-2xl font-semibold text-[#484848]">{booking.listingTitle}</h1>
      <p className="mt-2 text-sm text-[#888]">
        {t("Código")} <span className="font-mono tracking-widest">{booking.token}</span>
      </p>

      <div className="mt-6 rounded border p-4 text-sm" style={{ borderColor: "#ebebeb" }}>
        <div className="flex justify-between gap-4">
          <span className="text-[#aaa]">{t("Estado")}</span>
          <span className="font-medium text-[#484848]">
            {statusLabels[booking.status] ? t(statusLabels[booking.status]) : booking.status}
          </span>
        </div>
        <div className="mt-2 flex justify-between gap-4">
          <span className="text-[#aaa]">{t("Entrada — Salida")}</span>
          <span className="text-[#484848]">
            {booking.checkIn} → {booking.checkOut}
          </span>
        </div>
        <div className="mt-2 flex justify-between gap-4">
          <span className="text-[#aaa]">{t("Noches / Total estimado")}</span>
          <span className="text-[#484848]">
            {booking.nights} · ${booking.estimatedTotalMxn.toLocaleString("es-MX")} MXN
          </span>
        </div>
      </div>

      {(booking.balanceDueMxn ?? 0) > 0 && (
        <div className="mt-6">
          <PayDifference
            bookingId={booking.id}
            amountMxn={booking.balanceDueMxn ?? 0}
            paidMxn={booking.paidStayMxn}
            token={token}
            returnPath={`/finish/${token}`}
            onPaid={() => setReloadKey((k) => k + 1)}
          />
        </div>
      )}

      {booking.contract?.generated && (
        <div className="mt-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-[#484848]">{t("Contrato de la reserva")}</h2>
            <div className="flex gap-3">
              <Link href={`/contrato/${token}`} className="text-sm font-medium text-[#dcb81e] underline">
                {t("Ver página del contrato")}
              </Link>
              <a href={pdfHref} className="text-sm font-medium text-[#dcb81e] underline">
                {t("Descargar PDF")}
              </a>
            </div>
          </div>
          <ContractText
            lines={booking.contract.lines ?? []}
            translated={booking.contract.linesTranslated}
            className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded border bg-[#fafafa] p-3 text-xs leading-relaxed text-[#3a3a3a]"
          />
          {booking.contract.accepted && (
            <p className="mt-2 text-xs text-green-800">{t("Ambas partes ya aceptaron este contrato.")}</p>
          )}
        </div>
      )}

      {canFinish && !saved && (
        <form
          className="mt-8 space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setSaveErr(null);
            setSaving(true);
            try {
              const res = await fetch("/api/bookings/finish", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  token,
                  acceptContract: accepted,
                  signedName,
                  guestPhone: guestPhone.trim(),
                  guestFinishNotes: guestFinishNotes.trim(),
                }),
              });
              const data = await res.json().catch(() => ({}));
              if (!res.ok) {
                setSaveErr(typeof data.error === "string" ? data.error : "No se pudo guardar.");
                return;
              }
              setSaved(true);
              setBooking((prev) =>
                prev
                  ? {
                      ...prev,
                      status: typeof data.status === "string" ? data.status : prev.status,
                      contract: prev.contract
                        ? {
                            ...prev.contract,
                            accepted: Boolean(data.contractAccepted) && prev.contract.accepted,
                            guestAcceptedAt:
                              prev.contract.guestAcceptedAt ?? new Date().toISOString(),
                          }
                        : {
                            generated: true,
                            accepted: Boolean(data.contractAccepted),
                            guestAcceptedAt: new Date().toISOString(),
                          },
                    }
                  : prev
              );
            } catch {
              setSaveErr("Error de red.");
            } finally {
              setSaving(false);
            }
          }}
        >
          <h2 className="text-lg font-semibold text-[#484848]">{t("Firma con los datos de tu cuenta")}</h2>
          <label className="block">
            <span className="text-xs text-[#888]">{t("Nombre con el que firmas")}</span>
            <input
              value={signedName}
              onChange={(e) => setSignedName(e.target.value)}
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
              style={{ borderColor: "#ebebeb" }}
            />
          </label>
          <label className="block">
            <span className="text-xs text-[#888]">{t("Teléfono (opcional)")}</span>
            <input
              type="tel"
              value={guestPhone}
              onChange={(e) => setGuestPhone(e.target.value)}
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
              style={{ borderColor: "#ebebeb" }}
            />
          </label>
          <label className="block">
            <span className="text-xs text-[#888]">{t("Notas (opcional)")}</span>
            <textarea
              value={guestFinishNotes}
              onChange={(e) => setGuestFinishNotes(e.target.value)}
              rows={3}
              className="mt-1 w-full rounded border px-3 py-2 text-sm"
              style={{ borderColor: "#ebebeb" }}
            />
          </label>
          <label className="flex items-start gap-2 text-sm text-[#484848]">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => setAccepted(e.target.checked)}
              className="mt-1 accent-[#dcb81e]"
            />
            <span>
              {t("Acepto el contrato de esta reserva: fechas, montos, reglas y que Cabibee no es parte del hospedaje, solo registra el acuerdo.")}
            </span>
          </label>
          {saveErr && (
            <p className="text-sm text-red-600" role="alert">
              {t(saveErr)}
            </p>
          )}
          <button
            type="submit"
            disabled={saving || !accepted || signedName.trim().length < 3}
            className="w-full rounded py-3 text-sm font-semibold text-black disabled:opacity-60"
            style={{ backgroundColor: "#dcb81e" }}
          >
            {saving
              ? t("Guardando…")
              : booking.status === "AWAITING_PAYMENT"
                ? t("Aceptar contrato")
                : t("Aceptar contrato y confirmar")}
          </button>
        </form>
      )}

      {(saved || booking.contract?.accepted) && booking.status !== "AWAITING_PAYMENT" && (
        <div className="mt-8 rounded border border-green-200 bg-green-50 p-4 text-sm text-green-900">
          {t("Contrato aceptado. Puedes descargar el PDF cuando quieras.")}
        </div>
      )}

      {booking.status === "AWAITING_PAYMENT" && booking.contract?.guestAcceptedAt && (
        <div className="mt-8 rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-medium">{t("Contrato firmado. Falta el pago")}</p>
          <Link
            href={`/contrato/${token}?pay=1`}
            className="mt-3 inline-block font-semibold text-amber-900 underline"
          >
            {t("Ir a pagar")}
          </Link>
        </div>
      )}

      {!canFinish && !saved && (booking.status === "PENDING" || booking.status === "PENDING_HOST") && (
        <p className="mt-8 text-sm text-[#888]">
          {t("Tu solicitud está pendiente de revisión por el anfitrión.")}
        </p>
      )}

      <Link href="/" className="mt-10 inline-block text-sm text-[#dcb81e] underline">
        {t("← Inicio")}
      </Link>
    </div>
  );
}
