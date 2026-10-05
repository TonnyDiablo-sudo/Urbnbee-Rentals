"use client";

import { useState } from "react";
import { useT } from "@/components/i18n-provider";

export type BillingCountry = "MX" | "US" | "OTHER";

export function regionForCountry(c: BillingCountry): "mx" | "us" {
  return c === "MX" ? "mx" : "us";
}

export async function saveBillingCountry(country: BillingCountry): Promise<boolean> {
  const res = await fetch("/api/account/billing-country", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ country }),
  }).catch(() => null);
  return Boolean(res?.ok);
}

/** México paga en pesos; Estados Unidos y cualquier otro país, en dólares. */
export function CountryPicker({
  value,
  onSaved,
  compact,
}: {
  value: BillingCountry | null;
  onSaved: (country: BillingCountry) => void;
  compact?: boolean;
}) {
  const t = useT();
  const [busy, setBusy] = useState<BillingCountry | null>(null);
  const [err, setErr] = useState(false);
  const options: { c: BillingCountry; label: string }[] = [
    { c: "MX", label: t("México") },
    { c: "US", label: t("Estados Unidos") },
    { c: "OTHER", label: t("Otro país") },
  ];
  return (
    <div className={compact ? "" : "rounded-2xl border border-[#e5e5e5] bg-white p-4"}>
      <p className="text-sm font-semibold text-[#222]">
        {value ? t("Tu país") : t("¿De qué país eres?")}
      </p>
      {!value && (
        <p className="mt-0.5 text-xs text-[#717171]">{t("México paga en pesos (MXN). Estados Unidos y otros países, en dólares (USD).")}</p>
      )}
      <div className="mt-2 inline-flex flex-wrap gap-1 rounded-full bg-[#f1f1f1] p-1">
        {options.map((o) => (
          <button
            key={o.c}
            type="button"
            disabled={busy !== null}
            onClick={async () => {
              setBusy(o.c);
              setErr(false);
              const ok = await saveBillingCountry(o.c);
              setBusy(null);
              if (ok) onSaved(o.c);
              else setErr(true);
            }}
            className={`rounded-full px-4 py-1.5 text-sm font-medium disabled:opacity-60 ${
              value === o.c ? "bg-white text-[#222] shadow" : "text-[#717171]"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      {err && <p className="mt-2 text-xs text-red-700">{t("No se pudo guardar. Intenta otra vez.")}</p>}
    </div>
  );
}

/** Teléfono de la cuenta: se pide sólo al comprar. */
export function PhoneBox({ onSaved }: { onSaved: (phone: string) => void }) {
  const t = useT();
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <form
      className="rounded-2xl border border-[#f0d77a] bg-[#fdf6d8] p-4 text-sm text-[#5c4a0a]"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setErr(null);
        const res = await fetch("/api/account/phone", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone }),
        }).catch(() => null);
        const j = res ? await res.json().catch(() => ({})) : {};
        setBusy(false);
        if (res?.ok) onSaved(j.phone ?? phone);
        else setErr(typeof j.error === "string" ? j.error : "No se pudo guardar. Intenta otra vez.");
      }}
    >
      <p className="font-semibold">{t("Pon tu teléfono para poder comprar")}</p>
      <p className="mt-1">{t("Lo usamos sólo para avisos de tu compra y de tus reservas. No se muestra a nadie.")}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <input
          type="tel"
          required
          autoComplete="tel"
          inputMode="tel"
          placeholder={t("Con lada, ej. 55 1234 5678")}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="min-w-0 flex-1 rounded-xl border border-[#e5d48a] bg-white px-3 py-2 text-sm text-[#222] outline-none focus:border-[#222]"
        />
        <button
          type="submit"
          disabled={busy || phone.replace(/\D/g, "").length < 10}
          className="rounded-xl bg-[#222] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? t("Guardando…") : t("Guardar")}
        </button>
      </div>
      {err && <p className="mt-2 text-xs text-red-700">{t(err)}</p>}
    </form>
  );
}

/** Reenvía el correo de confirmación desde noreply@cabibee.com. */
export function VerifyEmailButton({ className = "" }: { className?: string }) {
  const t = useT();
  const [state, setState] = useState<"idle" | "busy" | "sent" | "verified" | "error">("idle");
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <span className={className}>
      <button
        type="button"
        disabled={state === "busy" || state === "sent" || state === "verified"}
        onClick={async () => {
          setState("busy");
          setMsg(null);
          const res = await fetch("/api/account/verify-email", { method: "POST" }).catch(() => null);
          const j = res ? await res.json().catch(() => ({})) : {};
          if (res?.ok && j.alreadyVerified) return setState("verified");
          if (res?.ok && j.sent) return setState("sent");
          setState("error");
          setMsg(typeof j.error === "string" ? j.error : "No se pudo mandar el correo. Intenta en un rato.");
        }}
        className="rounded-xl bg-[#222] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {state === "busy"
          ? t("Enviando…")
          : state === "sent"
            ? t("Te lo mandamos. Revisa tu bandeja y tu carpeta de spam.")
            : state === "verified"
              ? t("Tu correo ya está confirmado")
              : t("Mandarme el correo de confirmación")}
      </button>
      {msg && <span className="mt-1 block text-xs text-red-700">{t(msg)}</span>}
    </span>
  );
}

export function VerifyEmailBox({
  email,
  placeholder,
  purpose = "buy",
}: {
  email?: string;
  placeholder?: boolean;
  /** Para qué se pide: sólo "buy" habla de comprar. */
  purpose?: "buy" | "stats" | "contacts" | "message" | "favorites";
}) {
  const t = useT();
  const buy = purpose === "buy";
  if (placeholder) {
    return (
      <div className="rounded-2xl border border-[#f0d77a] bg-[#fdf6d8] p-4 text-sm text-[#5c4a0a]">
        <p className="font-semibold">{t("Pon tu correo personal")}</p>
        <p className="mt-1">
          {buy
            ? t("Tu cuenta la creó un asociado con un correo interno. Para comprar, pon tu correo en tu perfil y confírmalo.")
            : purpose === "stats"
              ? t("Tu cuenta la creó un asociado con un correo interno. Para ver tus estadísticas, pon tu correo en tu perfil y confírmalo.")
              : t("Tu cuenta la creó un asociado con un correo interno. Pon tu correo en tu perfil y confírmalo.")}
        </p>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-[#f0d77a] bg-[#fdf6d8] p-4 text-sm text-[#5c4a0a]">
      <p className="font-semibold">{buy ? t("Confirma tu correo para poder comprar") : t("Confirma tu correo")}</p>
      <p className="mt-1">
        {email
          ? t("Te mandamos un enlace a {email} desde noreply@cabibee.com.", { email })
          : t("Te mandamos un enlace desde noreply@cabibee.com.")}
      </p>
      <p className="mt-2">
        {t("¿No lo ves? Búscalo en tu carpeta de spam o correo no deseado. Si está ahí, márcalo como «No es spam» o muévelo a tu bandeja de entrada: así los próximos correos de Cabibee te llegarán directo. Si tampoco está, pide otro abajo.")}
      </p>
      <VerifyEmailButton className="mt-3 block" />
    </div>
  );
}
