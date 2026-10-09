"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useT } from "@/components/i18n-provider";

type Appeal = { status: "pending" | "restored" | "upheld"; message: string; createdAt: string };

export function AccountSuspended({ reason }: { reason?: string }) {
  const t = useT();
  const router = useRouter();
  const [appeal, setAppeal] = useState<Appeal | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/account/appeal", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((j: { appeal?: Appeal | null } | null) => {
        if (alive && j?.appeal) setAppeal(j.appeal);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/account/appeal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    }).catch(() => null);
    setBusy(false);
    const j = (await res?.json().catch(() => ({}))) as { error?: string };
    if (!res?.ok) {
      setError(j.error ? t(j.error) : t("No se pudo enviar."));
      return;
    }
    setSent(true);
    setAppeal({ status: "pending", message, createdAt: new Date().toISOString() });
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" }).catch(() => {});
    router.replace("/login");
    router.refresh();
  }

  const pending = appeal?.status === "pending" || sent;

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5 py-12">
      <p className="text-sm font-semibold text-[#dcb81e]">Cabibee</p>
      <h1 className="mt-2 text-2xl font-semibold text-[#222]">{t("Tu cuenta está suspendida")}</h1>
      <p className="mt-3 text-sm leading-relaxed text-[#484848]">
        {t("No puedes usar Cabibee mientras siga suspendida. Puedes pedir que un administrador revise tu caso. Si no la habilitan, la cuenta sigue suspendida.")}
      </p>
      {reason && <p className="mt-3 rounded-xl bg-[#f7f7f7] px-3 py-2 text-sm text-[#484848]">{reason}</p>}

      {pending ? (
        <p className="mt-6 rounded-xl bg-[#fffbea] px-4 py-3 text-sm text-[#8a6d0f]">{t("Tu solicitud está en revisión.")}</p>
      ) : (
        <form onSubmit={submit} className="mt-6 space-y-3">
          {appeal?.status === "upheld" && (
            <p className="rounded-xl bg-[#fdecec] px-4 py-3 text-sm text-[#b42318]">
              {t("Revisamos tu solicitud y la cuenta sigue suspendida. Puedes enviar otra si tienes algo nuevo.")}
            </p>
          )}
          <label className="block text-sm font-semibold text-[#222]" htmlFor="appeal-message">
            {t("Cuéntanos por qué deberíamos habilitar tu cuenta")}
          </label>
          <textarea
            id="appeal-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            minLength={20}
            maxLength={2000}
            required
            className="w-full rounded-xl border border-[#dcdcdc] px-3 py-2.5 text-[15px] text-[#222] focus:border-[#222] focus:outline-none"
          />
          {error && <p className="text-sm text-[#b42318]">{error}</p>}
          <button
            type="submit"
            disabled={busy || message.trim().length < 20}
            className="w-full rounded-xl bg-[#222] py-3 text-[15px] font-semibold text-white disabled:opacity-50"
          >
            {busy ? t("Enviando…") : t("Pedir revisión")}
          </button>
        </form>
      )}

      <button type="button" onClick={() => void logout()} className="mt-8 text-sm text-[#717171] underline">
        {t("Cerrar sesión")}
      </button>
    </div>
  );
}
