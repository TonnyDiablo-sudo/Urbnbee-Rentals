"use client";

import { useState } from "react";
import { useT } from "@/components/i18n-provider";

const inputCls =
  "mt-1 w-full rounded-xl border border-[#ccc] px-3.5 py-3 text-base outline-none focus:border-[#222]";

export function ClaimRequestForm({ listingId, listingTitle }: { listingId: string; listingTitle: string }) {
  const t = useT();
  const [kind, setKind] = useState<"claim" | "remove">("claim");
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/listings/${encodeURIComponent(listingId)}/claim-request`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, name, contact, message }),
    }).catch(() => null);
    const j = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (!res?.ok) {
      setError(typeof j.error === "string" ? j.error : "No se pudo enviar. Intenta de nuevo.");
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <div className="rounded-2xl bg-[#e7f5ec] px-5 py-4 text-[15px] leading-relaxed text-[#1e5a32]">
        {kind === "claim"
          ? t("Listo. Te contactaremos para darte acceso a tu cuenta y que puedas editar o borrar el anuncio.")
          : t("Listo. Revisaremos tu solicitud y borraremos el anuncio.")}
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <p className="text-sm text-[#717171]">{listingTitle}</p>
      <div className="grid grid-cols-2 gap-2">
        {(["claim", "remove"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            className={`rounded-xl border px-3 py-3 text-sm font-semibold ${
              kind === k ? "border-[#222] bg-[#222] text-white" : "border-[#ddd] bg-white text-[#222]"
            }`}
          >
            {k === "claim" ? t("Es mío, quiero administrarlo") : t("Bórrenlo")}
          </button>
        ))}
      </div>
      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{t(error)}</p>}
      <label className="block text-sm font-medium text-[#222]">
        {t("Tu nombre")}
        <input required className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="block text-sm font-medium text-[#222]">
        {t("Teléfono o correo")}
        <input required className={inputCls} value={contact} onChange={(e) => setContact(e.target.value)} />
      </label>
      <label className="block text-sm font-medium text-[#222]">
        {t("Comentarios")} <span className="font-normal text-[#999]">{t("(opcional)")}</span>
        <textarea rows={3} className={inputCls} value={message} onChange={(e) => setMessage(e.target.value)} />
      </label>
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-xl bg-[#dcb81e] py-3.5 text-[15px] font-semibold text-black disabled:opacity-60"
      >
        {busy ? t("Enviando…") : t("Enviar")}
      </button>
    </form>
  );
}
