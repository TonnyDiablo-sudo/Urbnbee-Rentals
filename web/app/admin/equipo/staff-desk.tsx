"use client";

import { useEffect, useState } from "react";
import { useT } from "@/components/i18n-provider";
import { STAFF_PERMISSIONS, type StaffPermission } from "@/lib/staff";

type StaffRow = { id: string; email: string; fullName: string; permissions: StaffPermission[] };
type Created = { email: string; password: string };

export function StaffDesk() {
  const t = useT();
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [permissions, setPermissions] = useState<StaffPermission[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [created, setCreated] = useState<Created | null>(null);
  const [saved, setSaved] = useState("");

  function load() {
    fetch("/api/admin/staff", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((j: { staff?: StaffRow[] } | null) => setStaff(j?.staff ?? []))
      .catch(() => {});
  }

  useEffect(() => {
    load();
  }, []);

  function toggle(id: StaffPermission) {
    setPermissions((cur) => (cur.includes(id) ? cur.filter((p) => p !== id) : [...cur, id]));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    setCreated(null);
    setSaved("");
    const res = await fetch("/api/admin/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName, email, permissions }),
    }).catch(() => null);
    const j = (await res?.json().catch(() => ({}))) as { error?: string; credentials?: Created; staff?: StaffRow[]; created?: boolean };
    setBusy(false);
    if (!res?.ok) {
      setErr(j.error ? t(j.error) : t("No se pudo guardar."));
      return;
    }
    setStaff(j.staff ?? []);
    setFullName("");
    setPermissions([]);
    if (j.credentials) setCreated(j.credentials);
    else setSaved(t("Listo: ya puede entrar al centro de administración."));
    setEmail("");
  }

  async function remove(row: StaffRow) {
    const res = await fetch("/api/admin/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: row.email, permissions: [] }),
    }).catch(() => null);
    const j = (await res?.json().catch(() => ({}))) as { staff?: StaffRow[] };
    if (res?.ok) setStaff(j.staff ?? []);
  }

  return (
    <div className="space-y-6">
      <form onSubmit={(e) => void submit(e)} className="space-y-3 rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-gray-900">{t("Dar de alta un administrador")}</h2>
        <p className="text-xs text-gray-500">
          {t("Esta cuenta entra a un centro limitado. Marca solo lo que puede hacer. Si el correo ya existe, se le actualizan esos permisos.")}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder={t("Nombre")}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("Correo")}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="space-y-2">
          {STAFF_PERMISSIONS.map((p) => (
            <label key={p.id} className="flex items-start gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={permissions.includes(p.id)} onChange={() => toggle(p.id)} className="mt-1" />
              <span>{t(p.label)}</span>
            </label>
          ))}
        </div>
        <button type="submit" disabled={busy || permissions.length === 0} className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
          {busy ? t("Guardando…") : t("Dar de alta")}
        </button>
        {err && <p className="text-sm text-red-700">{err}</p>}
        {saved && <p className="text-sm text-green-700">{saved}</p>}
        {created && (
          <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-3 font-mono text-sm">
            <p className="font-sans text-xs font-semibold text-amber-900">{t("Acceso del administrador (cópialo ahora)")}</p>
            <p className="mt-1">
              {t("Usuario:")} {created.email}
            </p>
            <p>
              {t("Contraseña:")} {created.password}
            </p>
            <p className="mt-1 font-sans text-xs text-amber-800">
              {t("Entra en /login. Al primer ingreso le pide una contraseña nueva y lo manda al centro.")}
            </p>
          </div>
        )}
      </form>

      <section className="rounded-xl border border-gray-200 bg-white">
        <h2 className="border-b border-gray-100 px-5 py-3 text-sm font-semibold text-gray-900">{t("Cuentas con acceso")}</h2>
        {staff.length === 0 ? (
          <p className="px-5 py-4 text-sm text-gray-500">{t("Todavía no hay administradores de segundo nivel.")}</p>
        ) : (
          <ul>
            {staff.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center gap-3 border-t border-gray-100 px-5 py-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-900">{row.fullName}</p>
                  <p className="text-xs text-gray-500">{row.email}</p>
                  <p className="mt-1 text-xs text-gray-600">{row.permissions.map((id) => t(STAFF_PERMISSIONS.find((p) => p.id === id)?.label ?? id)).join(" · ")}</p>
                </div>
                <button type="button" onClick={() => void remove(row)} className="text-xs text-red-700 underline">
                  {t("Quitar acceso")}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
