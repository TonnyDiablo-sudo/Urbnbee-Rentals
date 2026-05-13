"use client";

import Link from "next/link";
import { PasswordField } from "@/components/password-field";
import { SiteHeader } from "@/components/site-header";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export default function RegisterPage() {
  const router = useRouter();
  const params = useSearchParams();
  const intent = params.get("intent") === "host" ? "host" : "guest";

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [accountType, setAccountType] = useState<"guest" | "host">(intent === "host" ? "host" : "guest");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          fullName,
          email,
          phone: phone || undefined,
          password,
          intent: accountType === "host" ? "host" : "guest",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "No se pudo registrar");
        return;
      }
      if (accountType === "host") {
        router.push("/host/dashboard");
      } else {
        router.push("/guest");
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
      <div className="mx-auto max-w-md px-4 py-12">
        <h1 className="text-center text-2xl font-semibold text-[#484848]">Crear cuenta</h1>
        <p className="mt-2 text-center text-sm text-[#888]">
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="font-semibold text-[#dcb81e] underline">
            Inicia sesión
          </Link>
        </p>

        <form onSubmit={onSubmit} className="mt-10 space-y-4 rounded-xl border border-[#ebebeb] bg-white p-8 shadow-sm">
          {error && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}

          <fieldset className="space-y-2">
            <legend className="text-xs font-semibold uppercase tracking-wide text-[#888]">Tipo de cuenta</legend>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-[#ebebeb] px-3 py-2">
              <input
                type="radio"
                name="role"
                checked={accountType === "guest"}
                onChange={() => setAccountType("guest")}
              />
              <span className="text-sm text-[#484848]">Solo quiero reservar</span>
            </label>
            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-[#ebebeb] px-3 py-2">
              <input
                type="radio"
                name="role"
                checked={accountType === "host"}
                onChange={() => setAccountType("host")}
              />
              <span className="text-sm text-[#484848]">Quiero publicar mi alojamiento</span>
            </label>
          </fieldset>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-[#888]">Nombre completo</span>
            <input
              required
              className="mt-1 w-full rounded-lg border border-[#ddd] px-3 py-2 text-sm outline-none focus:border-[#dcb81e]"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-[#888]">Correo</span>
            <input
              type="email"
              required
              autoComplete="email"
              className="mt-1 w-full rounded-lg border border-[#ddd] px-3 py-2 text-sm outline-none focus:border-[#dcb81e]"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-[#888]">Teléfono (opcional)</span>
            <input
              type="tel"
              className="mt-1 w-full rounded-lg border border-[#ddd] px-3 py-2 text-sm outline-none focus:border-[#dcb81e]"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wide text-[#888]">Contraseña (mín. 8 caracteres)</span>
            <PasswordField
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={setPassword}
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full py-3 text-sm font-semibold text-black transition hover:brightness-95 disabled:opacity-50"
            style={{ backgroundColor: "#dcb81e" }}
          >
            {loading ? "Creando…" : "Registrarme"}
          </button>
        </form>
      </div>
    </div>
    </>
  );
}
