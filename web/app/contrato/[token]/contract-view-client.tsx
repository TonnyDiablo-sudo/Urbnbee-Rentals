"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Lookup = {
  status: string;
  token: string;
  guestName: string;
  listingTitle?: string;
  contract?: {
    generated: boolean;
    accepted: boolean;
    hostAcceptedAt?: string;
    hostAcceptedName?: string;
    guestAcceptedAt?: string;
    guestAcceptedName?: string;
    templateTitle?: string;
    lines?: string[];
  };
};

export function ContractViewClient({ token }: { token: string }) {
  const [booking, setBooking] = useState<Lookup | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [signedName, setSignedName] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState<string | null>(null);

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
        <p className="text-red-600">{err}</p>
        <Link href="/" className="mt-6 inline-block text-sm text-[#dcb81e] underline">
          Volver al inicio
        </Link>
      </div>
    );
  }

  if (!booking) {
    return <div className="mx-auto max-w-2xl px-4 py-16 text-center text-[#888]">Cargando…</div>;
  }

  const c = booking.contract;
  const pdfHref = `/api/bookings/contract?token=${encodeURIComponent(token)}&format=pdf`;
  const needsGuestSign = Boolean(c?.generated) && !c?.guestAcceptedAt;

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#aaa]">Contrato</p>
      <h1 className="mt-1 text-2xl font-semibold text-[#484848]">
        {c?.templateTitle ?? "Contrato de reserva"}
      </h1>
      <p className="mt-2 text-sm text-[#888]">
        {booking.listingTitle} · código{" "}
        <span className="font-mono tracking-widest">{booking.token}</span>
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <SignatureCard
          role="Anfitrión"
          done={Boolean(c?.hostAcceptedAt)}
          name={c?.hostAcceptedName}
          at={c?.hostAcceptedAt}
        />
        <SignatureCard
          role="Huésped"
          done={Boolean(c?.guestAcceptedAt)}
          name={c?.guestAcceptedName}
          at={c?.guestAcceptedAt}
        />
      </div>

      {c?.generated ? (
        <>
          <div className="mt-6 flex justify-end">
            <a href={pdfHref} className="text-sm font-medium text-[#dcb81e] underline">
              Descargar PDF
            </a>
          </div>
          <pre
            className="mt-3 max-h-[28rem] overflow-auto whitespace-pre-wrap rounded border bg-[#fafafa] p-4 text-xs leading-relaxed text-[#3a3a3a]"
            style={{ borderColor: "#ebebeb" }}
          >
            {(c.lines ?? []).join("\n")}
          </pre>
        </>
      ) : (
        <p className="mt-6 text-sm text-[#888]">
          El contrato se arma cuando el anfitrión acepta la solicitud (o al pagar si el anuncio es
          de aceptación automática).
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
          <h2 className="text-lg font-semibold text-[#484848]">Firma del huésped</h2>
          <p className="text-sm text-[#888]">
            Usamos el nombre de tu cuenta. Revísalo y firma para celebrar el contrato.
          </p>
          <label className="block">
            <span className="text-xs text-[#888]">Nombre con el que firmas</span>
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
              He leído este contrato y lo firmo. Cabibee solo registra el acuerdo; el hospedaje es
              entre anfitrión y huésped.
            </span>
          </label>
          {saveErr && <p className="text-sm text-red-600">{saveErr}</p>}
          <button
            type="submit"
            disabled={saving || !accepted || signedName.trim().length < 3}
            className="w-full rounded py-3 text-sm font-semibold text-black disabled:opacity-60"
            style={{ backgroundColor: "#dcb81e" }}
          >
            {saving ? "Firmando…" : "Firmar contrato"}
          </button>
        </form>
      )}

      {c?.accepted && (
        <p className="mt-6 rounded border border-green-200 bg-green-50 p-3 text-sm text-green-900">
          Firmado por ambas partes. Puedes descargar el PDF cuando quieras.
        </p>
      )}

      <Link href={`/finish/${token}`} className="mt-8 inline-block text-sm text-[#dcb81e] underline">
        Ir a la reserva
      </Link>
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
  return (
    <div className="rounded border p-3 text-sm" style={{ borderColor: "#ebebeb" }}>
      <p className="text-xs uppercase tracking-wide text-[#aaa]">{role}</p>
      {done ? (
        <>
          <p className="mt-1 font-medium text-green-800">Firmado</p>
          {name && <p className="text-[#484848]">{name}</p>}
          {at && <p className="text-xs text-[#888]">{at.slice(0, 19).replace("T", " ")} UTC</p>}
        </>
      ) : (
        <p className="mt-1 font-medium text-amber-800">Pendiente de firma</p>
      )}
    </div>
  );
}
