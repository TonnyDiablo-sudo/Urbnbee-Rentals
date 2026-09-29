"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { PasswordField } from "@/components/password-field";
import { TopBar } from "../_components/top-bar";

function safeAppNext(raw: string | null): string {
  if (!raw || !/^\/(?![/\\])/.test(raw)) return "/";
  return raw;
}

const inputCls =
  "mt-1 w-full rounded-xl border border-[#ccc] px-3.5 py-3 text-[15px] outline-none focus:border-[#222]";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
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
            : { email, password, fullName, phone: phone || undefined, intent: asHost ? "host" : "guest" }
        ),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "No se pudo continuar.");
        return;
      }
      router.replace(next);
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
        <h1 className="text-[26px] font-bold text-[#222]">{title}</h1>
        <p className="mt-1.5 text-sm leading-relaxed text-[#717171]">
          {mode === "login"
            ? "Usa la misma cuenta de la página web de Cabibee."
            : asHost
              ? "Gratis. Publica tus alojamientos y recibe mensajes. La misma cuenta te sirve para viajar como huésped."
              : "Gratis. Con tu cuenta puedes ver contactos, chatear con anfitriones y reservar."}
        </p>

        <form onSubmit={onSubmit} className="mt-7 space-y-4">
          {error && <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
          {mode === "register" && (
            <label className="block text-sm font-medium text-[#222]">
              Nombre completo
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
            Correo
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
              Teléfono <span className="font-normal text-[#999]">(opcional)</span>
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
            Contraseña
            <PasswordField
              required
              minLength={mode === "register" ? 8 : undefined}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              placeholder={mode === "register" ? "Mínimo 8 caracteres" : undefined}
              value={password}
              onChange={setPassword}
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[#dcb81e] py-3.5 text-[15px] font-semibold text-black disabled:opacity-60"
          >
            {loading ? "Un momento…" : mode === "login" ? "Entrar" : "Crear cuenta"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-[#717171]">
          {mode === "login" ? "¿No tienes cuenta? " : "¿Ya tienes cuenta? "}
          <Link
            href={mode === "login" ? `/cuenta/registro?${q}` : `/cuenta/entrar?${q}`}
            className="font-semibold text-[#222] underline"
          >
            {mode === "login" ? "Regístrate" : "Inicia sesión"}
          </Link>
        </p>
      </div>
    </>
  );
}
