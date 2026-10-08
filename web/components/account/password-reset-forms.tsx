"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useT } from "@/components/i18n-provider";
import { PasswordField } from "@/components/password-field";
import { SUPPORT_EMAIL } from "@/lib/support-contact";

const inputCls =
  "mt-1 w-full rounded-xl border border-[#ccc] px-3.5 py-3 text-base outline-none focus:border-[#222]";

export function ForgotPasswordForm({ app = false }: { app?: boolean }) {
  const t = useT();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loginHref = app ? "/cuenta/entrar" : "/login";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await fetch("/api/account/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      setError("No se pudo enviar. Intenta de nuevo o escríbenos a support@cabibee.com.");
      return;
    }
    setDone(true);
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[26px] font-bold text-[#222]">{t("¿Olvidaste tu contraseña?")}</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-[#717171]">
          {t("Escribe el correo de tu cuenta. Si existe y es un correo real, te mandamos un enlace. No funciona con un usuario temporal: entra con la contraseña que te dimos y pon tu correo.")}
        </p>
      </div>
      {done ? (
        <p className="rounded-xl bg-[#e7f5ec] px-4 py-3 text-sm text-[#1e5a32]">
          {t("Si esa cuenta existe y tiene un correo real, te mandamos el enlace. Revisa también el spam.")}
        </p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{t(error)}</p>}
          <label className="block text-sm font-medium text-[#222]">
            {t("Correo")}
            <input
              type="email"
              required
              autoComplete="email"
              className={inputCls}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-[#dcb81e] py-3.5 text-[15px] font-semibold text-black disabled:opacity-60"
          >
            {busy ? t("Un momento…") : t("Enviar enlace")}
          </button>
        </form>
      )}
      <p className="text-sm text-[#717171]">
        <Link href={loginHref} className="font-semibold text-[#222] underline">
          {t("Volver a iniciar sesión")}
        </Link>
        {" · "}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="underline">
          {SUPPORT_EMAIL}
        </a>
      </p>
    </div>
  );
}

export function NewPasswordForm({ app = false }: { app?: boolean }) {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loginHref = app ? "/cuenta/entrar" : "/login";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/account/reset-password", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    }).catch(() => null);
    const j = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (!res?.ok) {
      setError(typeof j.error === "string" ? j.error : "El enlace no es válido o ya venció.");
      return;
    }
    router.replace(loginHref);
    router.refresh();
  }

  if (!token) {
    return (
      <p className="text-sm text-[#717171]">
        {t("Abre el enlace que te mandamos por correo.")}{" "}
        <Link href={app ? "/cuenta/recuperar" : "/recuperar"} className="font-semibold underline">
          {t("Pedir otro enlace")}
        </Link>
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[26px] font-bold text-[#222]">{t("Elige una contraseña nueva")}</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-[#717171]">
          {t("Después entra con tu correo y esta contraseña. Las otras sesiones se cierran.")}
        </p>
      </div>
      <form onSubmit={onSubmit} className="space-y-4">
        {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{t(error)}</p>}
        <label className="block text-sm font-medium text-[#222]">
          {t("Contraseña nueva")}
          <PasswordField
            inputClassName="w-full rounded-xl border border-[#ccc] py-3 pl-3.5 pr-11 text-base outline-none focus:border-[#222]"
            required
            minLength={8}
            autoComplete="new-password"
            placeholder={t("Mínimo 8 caracteres")}
            value={password}
            onChange={setPassword}
          />
        </label>
        <label className="block text-sm font-medium text-[#222]">
          {t("Repite la contraseña")}
          <PasswordField
            inputClassName="w-full rounded-xl border border-[#ccc] py-3 pl-3.5 pr-11 text-base outline-none focus:border-[#222]"
            required
            autoComplete="new-password"
            value={confirm}
            onChange={setConfirm}
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-[#dcb81e] py-3.5 text-[15px] font-semibold text-black disabled:opacity-60"
        >
          {busy ? t("Un momento…") : t("Guardar contraseña")}
        </button>
      </form>
    </div>
  );
}
