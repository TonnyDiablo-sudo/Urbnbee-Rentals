"use client";

import { useState } from "react";
import type { BookingDepositRecord } from "@/lib/booking-deposit-types";
import { useT } from "@/components/i18n-provider";

const labels: Record<BookingDepositRecord["status"], string> = {
  declared: "Declarado — se entrega entre ustedes",
  window_open: "Ventana de reclamo abierta (48 h después de la salida)",
  claimed: "El anfitrión reportó un problema",
  guest_replied: "El huésped ya respondió",
  released: "Sin reclamo — liberado entre las partes",
  closed: "Caso cerrado (documentado)",
};

export function BookingDepositPanel({
  bookingId,
  deposit,
  role,
  onChanged,
}: {
  bookingId: string;
  deposit?: BookingDepositRecord;
  role: "guest" | "host";
  onChanged: () => void;
}) {
  const t = useT();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!deposit || deposit.amountMxn <= 0) return null;

  async function post(url: string, body: Record<string, string>) {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(typeof data.error === "string" ? data.error : "No se pudo guardar.");
        return;
      }
      setNote("");
      onChanged();
    } catch {
      setErr("Error de red.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 rounded-lg border border-amber-100 bg-amber-50/60 p-4 text-sm">
      <p className="font-semibold text-[#484848]">
        {t("Depósito")} ${deposit.amountMxn.toLocaleString("es-MX")} MXN
      </p>
      <p className="mt-1 text-xs text-[#888]">{t(deposit.note)}</p>
      <p className="mt-2 text-[#3a3a3a]">{t(labels[deposit.status])}</p>
      {deposit.windowEndsAt && deposit.status === "window_open" && (
        <p className="mt-1 text-xs text-[#888]">
          {t("Cierra")} {deposit.windowEndsAt.slice(0, 16).replace("T", " ")} UTC
        </p>
      )}
      {deposit.claim && (
        <p className="mt-2 text-[#3a3a3a]">
          <span className="font-medium">{t("Reclamo:")}</span> {deposit.claim.hostNote}
        </p>
      )}
      {deposit.guestReply && (
        <p className="mt-2 text-[#3a3a3a]">
          <span className="font-medium">{t("Respuesta del huésped:")}</span> {deposit.guestReply.note}
        </p>
      )}

      {role === "host" && deposit.status === "window_open" && (
        <div className="mt-3 space-y-2">
          <textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("Describe el daño o el motivo, con evidencia que acuerden por su lado.")}
            className="w-full rounded border bg-white px-3 py-2 text-sm"
            style={{ borderColor: "#ebebeb" }}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || note.trim().length < 10}
              className="rounded bg-[#dcb81e] px-4 py-2 text-xs font-semibold text-black disabled:opacity-50"
              onClick={() => void post(`/api/host/bookings/${bookingId}/deposit`, { action: "claim", note })}
            >
              {t("Reportar problema")}
            </button>
            <button
              type="button"
              disabled={busy}
              className="rounded border px-4 py-2 text-xs font-medium text-[#484848] disabled:opacity-50"
              style={{ borderColor: "#ebebeb" }}
              onClick={() => void post(`/api/host/bookings/${bookingId}/deposit`, { action: "release" })}
            >
              {t("Sin daños, liberar")}
            </button>
          </div>
        </div>
      )}

      {role === "host" && (deposit.status === "claimed" || deposit.status === "guest_replied") && (
        <button
          type="button"
          disabled={busy}
          className="mt-3 rounded border px-4 py-2 text-xs font-medium text-[#484848] disabled:opacity-50"
          style={{ borderColor: "#ebebeb" }}
          onClick={() => void post(`/api/host/bookings/${bookingId}/deposit`, { action: "close" })}
        >
          {t("Cerrar caso (ya lo resolvieron entre ustedes)")}
        </button>
      )}

      {role === "guest" && deposit.status === "claimed" && (
        <div className="mt-3 space-y-2">
          <textarea
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("Tu respuesta al reclamo.")}
            className="w-full rounded border bg-white px-3 py-2 text-sm"
            style={{ borderColor: "#ebebeb" }}
          />
          <button
            type="button"
            disabled={busy || note.trim().length < 5}
            className="rounded bg-[#dcb81e] px-4 py-2 text-xs font-semibold text-black disabled:opacity-50"
            onClick={() => void post(`/api/guest/bookings/${bookingId}/deposit`, { note })}
          >
            {t("Responder")}
          </button>
        </div>
      )}

      {err && <p className="mt-2 text-xs text-red-600">{t(err)}</p>}
    </div>
  );
}
