"use client";

import { useEffect, useState } from "react";
import { useLang, useT } from "@/components/i18n-provider";
import type { ManualPayMethod, PayConfirmation, PayInstruction } from "@/lib/booking-types";
import { WebLink } from "@/app/app/_components/site-origin";

const SEND: { method: ManualPayMethod; label: string }[] = [
  { method: "clabe", label: "Enviar CLABE" },
  { method: "zelle", label: "Enviar Zelle" },
  { method: "cashapp", label: "Enviar Cash App" },
  { method: "oxxo", label: "Enviar Oxxo" },
];

type Saved = {
  clabe: unknown;
  zelle: unknown;
  cashapp: unknown;
  oxxo: unknown;
};

function when(iso: string, lang: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(lang === "en" ? "en-US" : "es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function GuestPayNote({
  payInstruction,
  payConfirmation,
  paidAt,
  stripePaid,
}: {
  payInstruction?: PayInstruction | null;
  payConfirmation?: PayConfirmation | null;
  paidAt?: string | null;
  stripePaid?: boolean;
}) {
  const t = useT();
  const lang = useLang();
  if (payConfirmation?.by === "stripe" || (paidAt && stripePaid && payConfirmation?.by !== "host")) {
    return (
      <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-950">
        {t("Ya se pagó por Stripe el {date}", { date: when(payConfirmation?.at ?? paidAt ?? "", lang) })}
      </p>
    );
  }
  if (payConfirmation?.by === "host") {
    const method =
      payConfirmation.method === "clabe"
        ? "CLABE"
        : payConfirmation.method === "zelle"
          ? "Zelle"
          : payConfirmation.method === "cashapp"
            ? "Cash App"
            : payConfirmation.method === "oxxo"
              ? "Oxxo"
              : "Stripe";
    return (
      <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-950">
        {t("El anfitrión confirmó el pago ({method}) el {date}", {
          method,
          date: when(payConfirmation.at, lang),
        })}
      </p>
    );
  }
  if (paidAt) {
    return (
      <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-950">
        {t("Ya se pagó el {date}", { date: when(paidAt, lang) })}
      </p>
    );
  }
  if (!payInstruction) return null;
  return (
    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-950">
      <p className="font-semibold">{t("Así te pide el anfitrión que le pagues")}</p>
      <ul className="mt-1 space-y-0.5">
        {payInstruction.lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <p className="mt-2 text-xs">{t("Cuando le llegue, el anfitrión lo confirma y les aparece a los dos.")}</p>
    </div>
  );
}

/** El anfitrión manda sus datos de cobro y, cuando le pagan, lo confirma. */
export function HostManualPay({
  bookingId,
  status,
  paidAt,
  stripePaid,
  payInstruction,
  payConfirmation,
  onChanged,
}: {
  bookingId: string;
  status: string;
  paidAt?: string | null;
  stripePaid?: boolean;
  payInstruction?: PayInstruction | null;
  payConfirmation?: PayConfirmation | null;
  onChanged?: () => void;
}) {
  const t = useT();
  const [saved, setSaved] = useState<Saved | null>(null);
  const [local, setLocal] = useState<{
    paidAt?: string | null;
    status?: string;
    payInstruction?: PayInstruction | null;
    payConfirmation?: PayConfirmation | null;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const view = {
    status: local?.status ?? status,
    paidAt: local?.paidAt ?? paidAt,
    payInstruction: local?.payInstruction ?? payInstruction,
    payConfirmation: local?.payConfirmation ?? payConfirmation,
  };

  useEffect(() => {
    if (view.paidAt || view.status !== "AWAITING_PAYMENT") return;
    let cancelled = false;
    fetch("/api/host/settings/payout-methods", { credentials: "include", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!cancelled) setSaved(j ?? { clabe: null, zelle: null, cashapp: null, oxxo: null });
      })
      .catch(() => {
        if (!cancelled) setSaved(null);
      });
    return () => {
      cancelled = true;
    };
  }, [view.paidAt, view.status, bookingId]);

  async function act(action: "send" | "confirm", method?: ManualPayMethod) {
    setBusy(true);
    setErr(null);
    const res = await fetch(`/api/host/bookings/${encodeURIComponent(bookingId)}/pay`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, method }),
    }).catch(() => null);
    const j = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (!res?.ok) {
      setErr(typeof j.error === "string" ? j.error : "No se pudo guardar.");
      return;
    }
    setLocal({
      paidAt: j.paidAt,
      status: j.status,
      payInstruction: j.payInstruction,
      payConfirmation: j.payConfirmation,
    });
    onChanged?.();
  }

  if (view.payConfirmation || view.paidAt) {
    return (
      <GuestPayNote
        payInstruction={view.payInstruction}
        payConfirmation={view.payConfirmation}
        paidAt={view.paidAt}
        stripePaid={stripePaid || view.payConfirmation?.by === "stripe"}
      />
    );
  }
  if (view.status !== "AWAITING_PAYMENT") return null;

  const ready = SEND.filter((s) => saved && saved[s.method]);

  return (
    <div className="rounded-2xl border border-[#ebebeb] p-4">
      <p className="text-[15px] font-semibold text-[#222]">{t("Cobro de la reserva")}</p>
      {view.payInstruction && (
        <div className="mt-2 rounded-xl bg-[#fafafa] px-3 py-2 text-sm text-[#333]">
          <p className="font-medium">{t("Ya le enviaste estos datos. Cuando te pague, confírmalo.")}</p>
          <ul className="mt-1 space-y-0.5">
            {view.payInstruction.lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <button
            type="button"
            disabled={busy}
            onClick={() => void act("confirm")}
            className="mt-3 w-full rounded-xl bg-[#111] py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {t("Confirmo que ya pagó")}
          </button>
        </div>
      )}
      <div className="mt-3 grid grid-cols-2 gap-2">
        {ready.map((s) => (
          <button
            key={s.method}
            type="button"
            disabled={busy}
            onClick={() => void act("send", s.method)}
            className="rounded-xl border border-[#222] py-2.5 text-sm font-semibold text-[#222] disabled:opacity-50"
          >
            {t(s.label)}
          </button>
        ))}
      </div>
      {saved && ready.length === 0 && (
        <p className="mt-2 text-sm text-[#717171]">
          {t("Agrega una forma de cobro en Pagos para enviársela al huésped.")}{" "}
          <WebLink path="/host/settings/pagos" className="font-medium text-[#222] underline">
            {t("Pagos")}
          </WebLink>
        </p>
      )}
      {err && <p className="mt-2 text-sm text-red-700">{t(err)}</p>}
    </div>
  );
}
