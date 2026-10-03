"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useT } from "@/components/i18n-provider";
import { PasswordField } from "@/components/password-field";

export type AccountSecurityProps = {
  mode: "activate" | "security";
  /** Vacío si el usuario actual es el interno que generó el asociado. */
  email: string;
  emailVerified: boolean;
  stats?: { listings: number; views: number; contacts: number };
  doneHref: string;
};

const inputCls = "mt-1 w-full rounded-xl border border-[#ccc] px-3.5 py-3 text-base outline-none focus:border-[#222]";
const pwCls = "w-full rounded-xl border border-[#ccc] py-3 pl-3.5 pr-11 text-base outline-none focus:border-[#222]";

export function AccountSecurityForm({ mode, email: initialEmail, emailVerified, stats, doneHref }: AccountSecurityProps) {
  const t = useT();
  const router = useRouter();
  const activate = mode === "activate";
  const [email, setEmail] = useState(initialEmail);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [verified, setVerified] = useState(emailVerified);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (newPassword !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setBusy(true);
    const res = await fetch("/api/account/credentials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, newPassword: newPassword || undefined, currentPassword: currentPassword || undefined }),
    }).catch(() => null);
    const j = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (!res?.ok) {
      setError(typeof j.error === "string" ? j.error : "No se pudo guardar.");
      return;
    }
    setVerified(Boolean(j.emailVerified));
    setCurrentPassword("");
    setNewPassword("");
    setConfirm("");
    if (activate) {
      router.replace(doneHref);
      router.refresh();
      return;
    }
    setNotice(
      j.emailVerified
        ? "Guardado."
        : j.verificationSent
          ? "Guardado. Te mandamos un correo para confirmar tu dirección."
          : "Guardado."
    );
    router.refresh();
  }

  async function resend() {
    const res = await fetch("/api/account/verify-email", { method: "POST" }).catch(() => null);
    const j = res ? await res.json().catch(() => ({})) : {};
    setNotice(res?.ok ? (j.sent ? "Te mandamos el correo de confirmación." : "No se pudo mandar el correo ahora.") : j.error ?? "Error.");
  }

  return (
    <div className="space-y-6">
      {activate && (
        <div>
          <h1 className="text-[26px] font-bold text-[#222]">{t("Bienvenido a Cabibee")}</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-[#717171]">
            {t("Publicamos tu alojamiento gratis. Pon tu correo y una contraseña nueva para que la cuenta quede a tu nombre; después puedes editar o borrar tus anuncios cuando quieras.")}
          </p>
        </div>
      )}

      {activate && stats && stats.listings > 0 && (
        <div className="grid grid-cols-3 gap-2 rounded-2xl bg-[#111] p-4 text-center text-white">
          <div>
            <p className="text-2xl font-bold text-[#dcb81e]">{stats.listings}</p>
            <p className="text-xs text-white/70">{t(stats.listings === 1 ? "anuncio" : "anuncios")}</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-[#dcb81e]">{stats.views}</p>
            <p className="text-xs text-white/70">{t("vistas")}</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-[#dcb81e]">{stats.contacts}</p>
            <p className="text-xs text-white/70">{t("vieron tu contacto")}</p>
          </div>
        </div>
      )}

      <form onSubmit={submit} className="space-y-4">
        {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{t(error)}</p>}
        {notice && <p className="rounded-xl bg-[#e7f5ec] px-4 py-3 text-sm text-[#1e5a32]">{t(notice)}</p>}
        <label className="block text-sm font-medium text-[#222]">
          {t("Tu correo")}
          <input type="email" required autoComplete="email" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} />
          {!activate && initialEmail && (
            <span className="mt-1 block text-xs font-normal text-[#888]">
              {verified ? (
                t("✓ Correo confirmado")
              ) : (
                <>
                  {t("Sin confirmar.")}{" "}
                  <button type="button" onClick={() => void resend()} className="font-semibold underline">
                    {t("Reenviar correo")}
                  </button>
                </>
              )}
            </span>
          )}
        </label>
        {!activate && (
          <label className="block text-sm font-medium text-[#222]">
            {t("Contraseña actual")} <span className="font-normal text-[#999]">{t("(para cambiar correo o contraseña)")}</span>
            <PasswordField inputClassName={pwCls} autoComplete="current-password" value={currentPassword} onChange={setCurrentPassword} />
          </label>
        )}
        <label className="block text-sm font-medium text-[#222]">
          {t(activate ? "Contraseña nueva" : "Contraseña nueva (opcional)")}
          <PasswordField
            inputClassName={pwCls}
            required={activate}
            minLength={8}
            autoComplete="new-password"
            placeholder={t("Mínimo 8 caracteres")}
            value={newPassword}
            onChange={setNewPassword}
          />
        </label>
        <label className="block text-sm font-medium text-[#222]">
          {t("Repite la contraseña")}
          <PasswordField inputClassName={pwCls} required={activate || Boolean(newPassword)} autoComplete="new-password" value={confirm} onChange={setConfirm} />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-xl bg-[#dcb81e] py-3.5 text-[15px] font-semibold text-black disabled:opacity-60"
        >
          {busy ? t("Un momento…") : activate ? t("Activar mi cuenta") : t("Guardar")}
        </button>
      </form>
    </div>
  );
}
