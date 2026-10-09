"use client";

import Link from "next/link";
import { useT } from "@/components/i18n-provider";
import { PasswordField } from "@/components/password-field";
import { SiteHeader } from "@/components/site-header";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

function safeNext(raw: string | null): string {
  if (!raw || !/^\/(?![/\\])/.test(raw)) return "/";
  return raw;
}

export default function LoginPage() {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Error al iniciar sesión");
        return;
      }
      const role = data.user?.role as string | undefined;
      if (data.user?.mustChangePassword) {
        router.push("/activar-cuenta");
      } else if (data.user?.suspended) {
        router.push("/cuenta-suspendida");
      } else if (role === "admin") {
        router.push(next !== "/" ? next : "/admin/overview");
      } else if (data.user?.staff) {
        router.push("/centro");
      } else if (data.user?.associate) {
        router.push(next !== "/" ? next : "/asociados");
      } else if (role === "host") {
        router.push(next !== "/" ? next : "/host/dashboard");
      } else {
        router.push(next === "/host/dashboard" || next.startsWith("/host") ? "/" : next);
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <SiteHeader />
      <div className="min-h-screen bg-[#fafafa]" style={{ paddingTop: 72 }}>
      <div className="mx-auto max-w-md px-4 py-16">
        <h1 className="text-center text-2xl font-semibold text-[#484848]">{t("Iniciar sesión")}</h1>
        <p className="mt-2 text-center text-sm text-[#888]">
          {t("¿No tienes cuenta?")}{" "}
          <Link href={next !== "/" ? `/register?next=${encodeURIComponent(next)}` : "/register"} className="font-semibold text-[#dcb81e] underline">
            {t("Regístrate")}
          </Link>
        </p>

        <form onSubmit={onSubmit} className="mt-10 space-y-4 rounded-xl border border-[#ebebeb] bg-white p-8 shadow-sm">
          {error && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{t(error)}</div>
          )}
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-[#888]">{t("Correo o usuario")}</span>
            <input
              type="text"
              required
              autoComplete="username"
              autoCapitalize="none"
              inputMode="email"
              className="mt-1 w-full rounded-lg border border-[#ddd] px-3 py-2 text-sm outline-none focus:border-[#dcb81e]"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-[#888]">{t("Contraseña")}</span>
            <PasswordField
              autoComplete="current-password"
              required
              value={password}
              onChange={setPassword}
            />
          </label>
          <p className="text-right text-xs">
            <Link href="/recuperar" className="font-semibold text-[#888] underline hover:text-[#484848]">
              {t("¿Olvidaste tu contraseña?")}
            </Link>
          </p>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full py-3 text-sm font-semibold text-black transition hover:brightness-95 disabled:opacity-50"
            style={{ backgroundColor: "#dcb81e" }}
          >
            {loading ? t("Iniciando sesión…") : t("Iniciar sesión")}
          </button>
        </form>
      </div>
    </div>
    </>
  );
}
