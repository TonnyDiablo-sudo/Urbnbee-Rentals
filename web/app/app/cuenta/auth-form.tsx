"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { useT } from "@/components/i18n-provider";
import { PasswordField } from "@/components/password-field";
import { TopBar } from "../_components/top-bar";

function safeAppNext(raw: string | null): string {
  if (!raw || !/^\/(?![/\\])/.test(raw)) return "/";
  return raw;
}

const noopSubscribe = () => () => {};

/** 16px como mínimo: con menos, iOS hace zoom al enfocar el campo. */
const inputCls =
  "mt-1 w-full rounded-xl border border-[#ccc] px-3.5 py-3 text-base outline-none focus:border-[#222]";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  const next = safeAppNext(params.get("next"));
  const asHost = params.get("modo") === "anfitrion" || next.startsWith("/host");
  const q = `next=${encodeURIComponent(next)}${asHost ? "&modo=anfitrion" : ""}`;

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  // Antes de hidratar, el envío nativo haría GET a esta misma URL con la contraseña en la query.
  const hydrated = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(mode === "login" ? "/api/auth/login" : "/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(
          mode === "login"
            ? { email, password }
            : { email, password, fullName, phone: phone || undefined, intent: asHost ? "host" : "guest", acceptTerms }
        ),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "No se pudo continuar.");
        return;
      }
      router.replace(data.user?.mustChangePassword ? "/cuenta/activar" : next);
      router.refresh();
    } catch {
      setError("Sin conexión. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  const title = mode === "login" ? "Iniciar sesión" : asHost ? "Crea tu cuenta de anfitrión" : "Crea tu cuenta";

  return (
    <>
      <TopBar title="" back="/perfil" />
      <div className="px-6 pb-10 pt-2">
        <h1 className="text-[26px] font-bold text-[#222]">{t(title)}</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-[#717171]">
          {mode === "login"
            ? t("Usa la misma cuenta de la página web de Cabibee.")
            : asHost
              ? t("Gratis. Publica tus alojamientos y recibe mensajes. La misma cuenta te sirve para viajar como huésped.")
              : t("Gratis. Con tu cuenta puedes ver contactos, chatear con anfitriones y reservar.")}
        </p>

        <form method="post" onSubmit={onSubmit} className="mt-7 space-y-4">
          {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{t(error)}</div>}
          {mode === "register" && (
            <label className="block text-sm font-medium text-[#222]">
              {t("Nombre completo")}
              <input
                required
                autoComplete="name"
                className={inputCls}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </label>
          )}
          <label className="block text-sm font-medium text-[#222]">
            {t("Correo")}
            <input
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              className={inputCls}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          {mode === "register" && (
            <label className="block text-sm font-medium text-[#222]">
              {t("Teléfono")} <span className="font-normal text-[#999]">{t("(opcional)")}</span>
              <input
                type="tel"
                autoComplete="tel"
                inputMode="tel"
                className={inputCls}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </label>
          )}
          <label className="block text-sm font-medium text-[#222]">
            {t("Contraseña")}
            <PasswordField
              inputClassName="w-full rounded-xl border border-[#ccc] py-3 pl-3.5 pr-11 text-base outline-none focus:border-[#222]"
              required
              minLength={mode === "register" ? 8 : undefined}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              placeholder={mode === "register" ? t("Mínimo 8 caracteres") : undefined}
              value={password}
              onChange={setPassword}
            />
          </label>
          {mode === "login" && (
            <p className="text-right text-xs">
              <Link href="/cuenta/recuperar" className="font-semibold text-[#717171] underline">
                {t("¿Olvidaste tu contraseña?")}
              </Link>
            </p>
          )}
          {mode === "register" && (
          <label className="flex cursor-pointer items-start gap-2.5 text-sm leading-snug text-[#444]">
            <input
              type="checkbox"
              required
              checked={acceptTerms}
              onChange={(e) => setAcceptTerms(e.target.checked)}
              className="mt-0.5 h-4 w-4 shrink-0 accent-[#222]"
            />
            <span>
              {t("Acepto los")}{" "}
              <Link href="/terminos" target="_blank" className="font-semibold underline">
                {t("Términos y condiciones de uso")}
              </Link>
              {". "}
              {t("Entiendo que Cabibee no es parte de los contratos, chats ni tratos entre usuarios.")}
            </span>
          </label>
          )}
          <button
            type="submit"
            disabled={loading || !hydrated || (mode === "register" && !acceptTerms)}
            className="w-full touch-manipulation rounded-xl bg-[#dcb81e] py-3.5 text-[15px] font-semibold text-black disabled:opacity-60"
          >
            {loading ? t("Un momento…") : mode === "login" ? t("Iniciar sesión") : t("Crear cuenta")}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[#717171]">
          {mode === "login" ? t("¿No tienes cuenta?") : t("¿Ya tienes cuenta?")}{" "}
          <Link
            href={mode === "login" ? `/cuenta/registro?${q}` : `/cuenta/entrar?${q}`}
            className="font-semibold text-[#222] underline"
          >
            {mode === "login" ? t("Regístrate") : t("Inicia sesión")}
          </Link>
        </p>
      </div>
    </>
  );
}
