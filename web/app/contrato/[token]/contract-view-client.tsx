"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ContractText } from "@/components/booking/contract-text";
import { GuestPayNote } from "@/components/booking/pay-status";
import { useT } from "@/components/i18n-provider";
import type { PayConfirmation, PayProof } from "@/lib/booking-types";

type Lookup = {
  id: string;
  status: string;
  token: string;
  guestName: string;
  listingTitle?: string;
  paidAt?: string | null;
  stripePaid?: boolean;
  payConfirmation?: PayConfirmation | null;
  payProof?: PayProof | null;
  checkIn?: string;
  checkOut?: string;
  paymentDueAt?: string | null;
  paymentFailed?: boolean;
  canReopen?: boolean;
  archivedAt?: string | null;
  stamps?: { kind: "payment_received" | "payment_rejected" | "voided"; at: string; clearedAt: string | null; amountMxn: number | null }[];
  contract?: {
    generated: boolean;
    accepted: boolean;
    guestAccepted?: boolean;
    hostAcceptedAt?: string;
    hostAcceptedName?: string;
    guestAcceptedAt?: string;
    guestAcceptedName?: string;
    acceptedSha256?: string;
    templateTitle?: string;
    lines?: string[];
    linesTranslated?: string[];
  };
};

export function ContractViewClient({ token, wantPay }: { token: string; wantPay?: boolean }) {
  const t = useT();
  const [booking, setBooking] = useState<Lookup | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [signedName, setSignedName] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [payErr, setPayErr] = useState<string | null>(null);

  async function load() {
    if (token.length !== 6) {
      setErr("El código debe tener 6 dígitos.");
      return;
    }
    const res = await fetch(`/api/bookings/lookup?token=${encodeURIComponent(token)}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErr(typeof data.error === "string" ? data.error : "No encontrado.");
      return;
    }
    const row = data.booking as Lookup;
    setBooking(row);
    setSignedName((prev) => prev || row.guestName || "");
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  if (err) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-red-600">{t(err)}</p>
        <Link href="/" className="mt-6 inline-block text-sm text-[#dcb81e] underline">
          {t("Volver al inicio")}
        </Link>
      </div>
    );
  }

  if (!booking) {
    return <div className="mx-auto max-w-2xl px-4 py-16 text-center text-[#888]">{t("Cargando…")}</div>;
  }

  const row = booking;
  const c = row.contract;
  const pdfHref = `/api/bookings/contract?token=${encodeURIComponent(token)}&format=pdf`;
  const needsGuestSign = Boolean(c?.generated) && !c?.guestAcceptedAt;
  const awaitingPay = row.status === "AWAITING_PAYMENT";
  const canPay = awaitingPay && Boolean(c?.guestAcceptedAt) && Boolean(c?.hostAcceptedAt);
  const waitingHost = awaitingPay && Boolean(c?.guestAcceptedAt) && !c?.hostAcceptedAt;

  async function startPay() {
    const bookingId = row.id;
    setPayErr(null);
    setPaying(true);
    try {
      const res = await fetch(`/api/bookings/${bookingId}/checkout`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cancelPath: `/contrato/${token}?pay=1`,
          returnPath: "/bookings/confirm",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPayErr(typeof data.error === "string" ? data.error : "No se pudo iniciar el pago.");
        return;
      }
      if (typeof data.checkoutUrl === "string" && data.checkoutUrl.startsWith("http")) {
        window.location.assign(data.checkoutUrl);
        return;
      }
      if (data.simulatePayment) {
        const sim = await fetch(`/api/bookings/${bookingId}/simulate-payment`, {
          method: "POST",
          credentials: "include",
        });
        const simData = await sim.json().catch(() => ({}));
        if (!sim.ok) {
          setPayErr(typeof simData.error === "string" ? simData.error : "No se pudo confirmar el pago (demo).");
          return;
        }
        await load();
        return;
      }
      setPayErr("No se obtuvo enlace de pago.");
    } catch {
      setPayErr("Error de red.");
    } finally {
      setPaying(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#aaa]">{t("Contrato")}</p>
      <h1 className="mt-1 text-2xl font-semibold text-[#484848]">
        {t(c?.templateTitle ?? "Contrato de reserva")}
      </h1>
      <p className="mt-2 text-sm text-[#888]">
        {booking.listingTitle} · {t("código")}{" "}
        <span className="font-mono tracking-widest">{booking.token}</span>
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <SignatureCard
          role={t("Anfitrión")}
          done={Boolean(c?.hostAcceptedAt)}
          name={c?.hostAcceptedName}
          at={c?.hostAcceptedAt}
        />
        <SignatureCard
          role={t("Huésped")}
          done={Boolean(c?.guestAcceptedAt)}
          name={c?.guestAcceptedName}
          at={c?.guestAcceptedAt}
        />
      </div>

      <ContractStamps stamps={row.stamps ?? []} />

      {awaitingPay && row.paymentDueAt && (
        <p
          className={`mt-4 rounded border p-3 text-sm ${
            row.paymentFailed ? "border-red-200 bg-red-50 text-red-900" : "border-amber-200 bg-amber-50 text-amber-950"
          }`}
        >
          {row.paymentFailed
            ? t("Se rechazó tu pago. Vuelve a pagar antes del {when} o el contrato se anula.", { when: fmtWhen(row.paymentDueAt) })
            : t("Las dos partes firman antes de pagar. El contrato surte efectos cuando se recibe el pago; si no se paga antes del {when}, se anula.", { when: fmtWhen(row.paymentDueAt) })}
        </p>
      )}

      {c?.generated ? (
        <>
          <div className="mt-6 flex justify-end">
            <a href={pdfHref} className="text-sm font-medium text-[#dcb81e] underline">
              {t("Descargar PDF")}
            </a>
          </div>
          <ContractText
            lines={c.lines ?? []}
            translated={c.linesTranslated}
            className="mt-3 max-h-[28rem] overflow-auto whitespace-pre-wrap rounded border bg-[#fafafa] p-4 text-xs leading-relaxed text-[#3a3a3a]"
          />
        </>
      ) : (
        <p className="mt-6 text-sm text-[#888]">
          {t("El contrato aún no está listo. Si acabas de reservar, recarga en un momento.")}
        </p>
      )}

      <GuestPayNote
        bookingId={row.id}
        payConfirmation={row.payConfirmation}
        payProof={row.payProof}
        paidAt={row.paidAt}
        stripePaid={row.stripePaid || row.payConfirmation?.by === "stripe"}
      />

      {wantPay && needsGuestSign && (
        <p className="mt-6 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
          {t("Lee y firma el contrato para poder pagar.")}
        </p>
      )}

      {needsGuestSign && (
        <form
          className="mt-8 space-y-4 rounded border p-4"
          style={{ borderColor: "#ebebeb" }}
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
                }),
              });
              const data = await res.json().catch(() => ({}));
              if (!res.ok) {
                setSaveErr(typeof data.error === "string" ? data.error : "No se pudo firmar.");
                return;
              }
              await load();
            } catch {
              setSaveErr("Error de red.");
            } finally {
              setSaving(false);
            }
          }}
        >
          <h2 className="text-lg font-semibold text-[#484848]">{t("Firma del huésped")}</h2>
          <p className="text-sm text-[#888]">
            {t("Usamos el nombre de tu cuenta. Revísalo y firma para celebrar el contrato.")}
          </p>
          <label className="block">
            <span className="text-xs text-[#888]">{t("Nombre con el que firmas")}</span>
            <input
              value={signedName}
              onChange={(e) => setSignedName(e.target.value)}
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
              {t("He leído este contrato y lo firmo. Es un acuerdo directo entre el anfitrión y yo.")}
            </span>
          </label>
          {saveErr && <p className="text-sm text-red-600">{t(saveErr)}</p>}
          <button
            type="submit"
            disabled={saving || !accepted || signedName.trim().length < 3}
            className="w-full rounded py-3 text-sm font-semibold text-black disabled:opacity-60"
            style={{ backgroundColor: "#dcb81e" }}
          >
            {saving ? t("Firmando…") : t("Firmar contrato")}
          </button>
        </form>
      )}

      {c?.acceptedSha256 && (
        <p className="mt-4 font-mono text-[11px] break-all text-[#888]">
          SHA-256: {c.acceptedSha256}
        </p>
      )}

      {c?.accepted && !awaitingPay && row.status !== "EXPIRED" && (
        <p className="mt-6 rounded border border-green-200 bg-green-50 p-3 text-sm text-green-900">
          {t("Firmado por ambas partes. Puedes descargar el PDF cuando quieras.")}
        </p>
      )}

      {waitingHost && (
        <p className="mt-6 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
          {t("Ya firmaste. Falta la firma del anfitrión; te avisamos en cuanto firme para que puedas pagar.")}
        </p>
      )}

      {row.status === "EXPIRED" && (
        <ExpiredBox row={row} onDone={() => void load()} />
      )}

      {canPay && (
        <div className="mt-6 space-y-3">
          {payErr && <p className="text-sm text-red-600">{t(payErr)}</p>}
          <button
            type="button"
            disabled={paying}
            onClick={() => void startPay()}
            className="w-full rounded py-3 text-sm font-semibold text-black disabled:opacity-60"
            style={{ backgroundColor: "#dcb81e" }}
          >
            {paying ? t("Abriendo pago…") : row.paymentFailed ? t("Volver a pagar") : t("Pagar ahora")}
          </button>
        </div>
      )}

      <Link href={`/finish/${token}`} className="mt-8 inline-block text-sm text-[#dcb81e] underline">
        {t("Ir a la reserva")}
      </Link>
    </div>
  );
}

function fmtWhen(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

const STAMP_STYLE = {
  payment_received: { label: "PAGO RECIBIDO", cls: "border-green-600 text-green-700" },
  payment_rejected: { label: "PAGO RECHAZADO", cls: "border-red-600 text-red-700" },
  voided: { label: "CONTRATO ANULADO", cls: "border-[#888] text-[#666]" },
} as const;

function ContractStamps({ stamps }: { stamps: NonNullable<Lookup["stamps"]> }) {
  const t = useT();
  if (!stamps.length) return null;
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {stamps.map((s, i) => {
        const st = STAMP_STYLE[s.kind];
        return (
          <div
            key={`${s.kind}-${s.at}-${i}`}
            className={`-rotate-2 rounded border-2 border-double px-3 py-1 text-center ${st.cls} ${s.clearedAt ? "opacity-50" : ""}`}
          >
            <p className="text-xs font-bold tracking-widest">{t(st.label)}</p>
            <p className="text-[10px]">
              {fmtWhen(s.at)}
              {s.amountMxn ? ` · $${s.amountMxn.toLocaleString()} MXN` : ""}
            </p>
            {s.clearedAt && <p className="text-[10px] font-semibold">{t("Resuelto: el pago se recibió después")}</p>}
          </div>
        );
      })}
    </div>
  );
}

function ExpiredBox({ row, onDone }: { row: Lookup; onDone: () => void }) {
  const t = useT();
  const [checkIn, setCheckIn] = useState(row.checkIn?.slice(0, 10) ?? "");
  const [checkOut, setCheckOut] = useState(row.checkOut?.slice(0, 10) ?? "");
  const [busy, setBusy] = useState<"" | "reopen" | "archive">("");
  const [error, setError] = useState<string | null>(null);

  if (row.archivedAt || !row.canReopen) {
    return (
      <p className="mt-6 rounded border border-[#ebebeb] bg-[#fafafa] p-3 text-sm text-[#666]">
        {row.archivedAt ? t("Esta reserva se archivó.") : t("Esta reserva ya no está activa.")}
      </p>
    );
  }

  async function send(action: "reopen" | "archive") {
    setError(null);
    setBusy(action);
    try {
      const res = await fetch(`/api/bookings/${row.id}/reopen`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action === "archive" ? { action } : { action, checkIn, checkOut }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "No se pudo completar.");
        return;
      }
      onDone();
    } catch {
      setError("Error de red.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="mt-6 space-y-3 rounded border border-[#ebebeb] p-4">
      <h2 className="text-base font-semibold text-[#484848]">{t("El contrato se anuló porque no se pagó a tiempo")}</h2>
      <p className="text-sm text-[#888]">
        {t("Puedes reabrir la reserva con las mismas fechas u otras: se genera un contrato nuevo que ambos vuelven a firmar. O archívala si ya no la quieres.")}
      </p>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-xs text-[#888]">
          {t("Llegada")}
          <input
            type="date"
            value={checkIn}
            onChange={(e) => setCheckIn(e.target.value)}
            className="mt-1 w-full rounded border px-3 py-2 text-sm text-[#484848]"
            style={{ borderColor: "#ebebeb" }}
          />
        </label>
        <label className="block text-xs text-[#888]">
          {t("Salida")}
          <input
            type="date"
            value={checkOut}
            onChange={(e) => setCheckOut(e.target.value)}
            className="mt-1 w-full rounded border px-3 py-2 text-sm text-[#484848]"
            style={{ borderColor: "#ebebeb" }}
          />
        </label>
      </div>
      {error && <p className="text-sm text-red-600">{t(error)}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={Boolean(busy) || !checkIn || !checkOut}
          onClick={() => void send("reopen")}
          className="flex-1 rounded py-2.5 text-sm font-semibold text-black disabled:opacity-60"
          style={{ backgroundColor: "#dcb81e" }}
        >
          {busy === "reopen" ? t("Reabriendo…") : t("Reabrir con contrato nuevo")}
        </button>
        <button
          type="button"
          disabled={Boolean(busy)}
          onClick={() => void send("archive")}
          className="rounded border px-4 py-2.5 text-sm text-[#484848] disabled:opacity-60"
          style={{ borderColor: "#ebebeb" }}
        >
          {busy === "archive" ? t("Archivando…") : t("Archivar")}
        </button>
      </div>
    </div>
  );
}

function SignatureCard({
  role,
  done,
  name,
  at,
}: {
  role: string;
  done: boolean;
  name?: string;
  at?: string;
}) {
  const t = useT();
  return (
    <div className="rounded border p-3 text-sm" style={{ borderColor: "#ebebeb" }}>
      <p className="text-xs uppercase tracking-wide text-[#aaa]">{role}</p>
      {done ? (
        <>
          <p className="mt-1 font-medium text-green-800">{t("Firmado")}</p>
          {name && <p className="text-[#484848]">{name}</p>}
          {at && <p className="text-xs text-[#888]">{at.slice(0, 19).replace("T", " ")} UTC</p>}
        </>
      ) : (
        <p className="mt-1 font-medium text-amber-800">{t("Pendiente de firma")}</p>
      )}
    </div>
  );
}
