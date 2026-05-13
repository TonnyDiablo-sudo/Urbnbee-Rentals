"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type SessionUser = {
  id: string;
  email: string;
  role: string;
  fullName?: string;
};

export function AuthNav() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null | undefined>(undefined);
  const [upgrading, setUpgrading] = useState(false);

  useEffect(() => {
    fetch("/api/auth/session", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setUser(d.user ?? null))
      .catch(() => setUser(null));
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    setUser(null);
    router.refresh();
  }

  async function becomeHost() {
    setUpgrading(true);
    try {
      const res = await fetch("/api/auth/upgrade-to-host", { method: "POST", credentials: "include" });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "No se pudo activar el modo anfitrión");
        return;
      }
      setUser(data.user);
      router.push("/host/dashboard");
      router.refresh();
    } finally {
      setUpgrading(false);
    }
  }

  if (user === undefined) {
    return (
      <div className="flex items-center gap-4 shrink-0">
        <span className="hidden h-4 w-20 animate-pulse rounded bg-white/20 sm:block" />
        <span className="hidden h-4 w-24 animate-pulse rounded bg-white/20 sm:block" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center gap-4 shrink-0">
        <Link
          href="/login"
          className="hidden items-center gap-1.5 text-sm font-medium text-white transition hover:text-[#dcb81e] sm:flex"
        >
          <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
            <path
              fillRule="evenodd"
              d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z"
              clipRule="evenodd"
            />
          </svg>
          Iniciar sesión
        </Link>
        <Link href="/register" className="hidden text-sm font-medium text-white transition hover:text-[#dcb81e] sm:block">
          + Registrarse
        </Link>
      </div>
    );
  }

  const isHost = user.role === "host" || user.role === "admin";
  const isGuest = user.role === "guest";
  const isAdmin = user.role === "admin";

  return (
    <div className="flex items-center gap-2 sm:gap-3 shrink-0">
      <Link
        href="/guest"
        className="hidden text-sm font-medium text-white transition hover:text-[#dcb81e] sm:inline"
        title="Mis reservas y mensajes"
      >
        Mi cuenta
      </Link>
      {isAdmin && (
        <Link
          href="/admin/overview"
          className="hidden text-sm font-semibold text-[#dcb81e] transition hover:text-white sm:inline"
          title="Panel de administración del sitio"
        >
          Administración
        </Link>
      )}
      {isHost && (
        <Link
          href="/host/dashboard"
          className="text-sm font-medium text-white transition hover:text-[#dcb81e]"
          title="Panel de anfitrión"
        >
          Panel anfitrión
        </Link>
      )}
      {isGuest && (
        <button
          type="button"
          onClick={() => becomeHost()}
          disabled={upgrading}
          className="inline-flex max-w-[min(160px,28vw)] items-center truncate rounded px-2.5 py-1.5 text-xs font-semibold text-black transition hover:brightness-95 disabled:opacity-60 sm:max-w-[180px] sm:px-3 sm:text-sm"
          style={{ backgroundColor: "#dcb81e" }}
          title="Activa tu cuenta para publicar alojamientos"
        >
          {upgrading ? "…" : "Ser anfitrión"}
        </button>
      )}
      <span className="hidden max-w-[100px] truncate text-xs text-white/80 sm:inline md:max-w-[140px]" title={user.email}>
        {user.fullName?.trim() || user.email}
      </span>
      <button
        type="button"
        onClick={() => logout()}
        className="text-sm font-medium text-white transition hover:text-[#dcb81e]"
      >
        Salir
      </button>
    </div>
  );
}

export function AuthNavMobile({ onNavigate }: { onNavigate?: () => void }) {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null | undefined>(undefined);
  const [upgrading, setUpgrading] = useState(false);

  useEffect(() => {
    fetch("/api/auth/session", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setUser(d.user ?? null))
      .catch(() => setUser(null));
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    setUser(null);
    onNavigate?.();
    router.refresh();
  }

  async function becomeHost() {
    setUpgrading(true);
    try {
      const res = await fetch("/api/auth/upgrade-to-host", { method: "POST", credentials: "include" });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "No se pudo activar el modo anfitrión");
        return;
      }
      setUser(data.user);
      onNavigate?.();
      router.push("/host/dashboard");
      router.refresh();
    } finally {
      setUpgrading(false);
    }
  }

  if (!user) {
    return (
      <>
        <Link href="/login" className="block rounded px-3 py-2 text-left text-sm text-white" onClick={onNavigate}>
          Iniciar sesión
        </Link>
        <Link href="/register" className="block rounded px-3 py-2 text-left text-sm text-white" onClick={onNavigate}>
          Registrarse
        </Link>
      </>
    );
  }

  const isHost = user.role === "host" || user.role === "admin";
  const isGuest = user.role === "guest";
  const isAdmin = user.role === "admin";

  return (
    <>
      <Link href="/guest" className="block rounded px-3 py-2 text-left text-sm text-white" onClick={onNavigate}>
        Mi cuenta
      </Link>
      {isAdmin && (
        <Link
          href="/admin/overview"
          className="block rounded px-3 py-2 text-left text-sm font-semibold text-[#dcb81e]"
          onClick={onNavigate}
        >
          Administración
        </Link>
      )}
      {isHost && (
        <Link href="/host/dashboard" className="block rounded px-3 py-2 text-left text-sm text-white" onClick={onNavigate}>
          Panel anfitrión
        </Link>
      )}
      {isGuest && (
        <button
          type="button"
          disabled={upgrading}
          className="block w-full rounded px-3 py-2 text-left text-sm font-semibold text-black disabled:opacity-60"
          style={{ backgroundColor: "#dcb81e" }}
          onClick={() => becomeHost()}
        >
          {upgrading ? "Activando…" : "Ser anfitrión (publicar)"}
        </button>
      )}
      <button type="button" className="block w-full rounded px-3 py-2 text-left text-sm text-white" onClick={() => logout()}>
        Cerrar sesión
      </button>
    </>
  );
}
