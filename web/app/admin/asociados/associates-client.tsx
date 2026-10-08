"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useState } from "react";
import { DayBars } from "@/components/associates/day-bars";
import { useT } from "@/components/i18n-provider";
import type { AssociateStats } from "@/lib/associate-stats";

export function AssociateRow({
  id,
  name,
  email,
  active,
  isAdmin,
  stats: s,
  lastCreated,
}: {
  id: string;
  name: string;
  email: string;
  active: boolean;
  isAdmin: boolean;
  stats: AssociateStats;
  lastCreated: string;
}) {
  const t = useT();
  const router = useRouter();
  const [goal, setGoal] = useState(String(s.goal || ""));
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const dirty = goal !== String(s.goal || "");

  async function patch(body: Record<string, unknown>) {
    setSaving(true);
    const res = await fetch(`/api/admin/associates/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    setSaving(false);
    if (!res?.ok) {
      const j = res ? await res.json().catch(() => ({})) : {};
      alert(typeof j.error === "string" ? t(j.error) : t("No se pudo guardar."));
      return;
    }
    router.refresh();
  }

  const hit = s.goal > 0 && s.today >= s.goal;
  return (
    <Fragment>
      <tr className={`hover:bg-gray-50 ${active ? "" : "opacity-50"}`}>
        <td className="px-4 py-2">
          <button type="button" onClick={() => setOpen((o) => !o)} className="text-left">
            <span className="font-medium text-gray-900 underline">{name}</span>
            <span className="block text-xs text-gray-400">
              {email}
              {isAdmin ? ` · ${t("admin")}` : ""}
              {!active ? ` · ${t("sin acceso")}` : ""}
            </span>
          </button>
        </td>
        <td className="px-3 py-2">
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={0}
              max={500}
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="—"
              className="w-16 rounded border border-gray-300 px-2 py-1 text-sm"
            />
            {dirty && (
              <button
                type="button"
                disabled={saving}
                onClick={() => void patch({ dailyGoal: Number(goal || 0) })}
                className="rounded bg-amber-500 px-2 py-1 text-xs text-white disabled:opacity-50"
              >
                {t("Guardar")}
              </button>
            )}
          </div>
        </td>
        <td className="px-3 py-2">
          <span className={`font-semibold ${hit ? "text-green-700" : "text-gray-900"}`}>
            {s.today}
            {s.goal > 0 && <span className="font-normal text-gray-400"> / {s.goal}</span>}
          </span>
        </td>
        <td className="px-3 py-2 text-gray-700">{s.yesterday}</td>
        <td className="px-3 py-2 text-gray-700">{s.last7}</td>
        <td className="px-3 py-2 text-gray-700">{s.last30}</td>
        <td className="px-3 py-2 font-semibold text-gray-900">{s.total}</td>
        <td className="px-3 py-2 text-gray-700">{s.totalListings}</td>
        <td className="px-3 py-2 text-gray-700">
          {s.claimed}
          {s.total > 0 && <span className="text-xs text-gray-400"> ({Math.round((s.claimed / s.total) * 100)}%)</span>}
        </td>
        <td className="px-3 py-2 text-gray-700">{s.pendingDrafts}</td>
        <td className="px-3 py-2 text-gray-700">{s.goal > 0 ? `${s.goalDays30} / 30` : "—"}</td>
        <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-500">{lastCreated}</td>
        <td className="px-3 py-2 text-right">
          <Link href={`/admin/users/${id}`} className="block text-xs text-gray-500 underline">
            {t("Ficha")}
          </Link>
          {!isAdmin &&
            (active ? (
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  if (confirm(t("¿Quitarle el acceso de asociado a {name}? Sus cuentas siguen registradas a su nombre.", { name }))) {
                    void patch({ associate: false });
                  }
                }}
                className="whitespace-nowrap text-xs text-red-600 underline"
              >
                {t("Quitar acceso")}
              </button>
            ) : (
              <button type="button" disabled={saving} onClick={() => void patch({ associate: true })} className="text-xs text-amber-700 underline">
                {t("Dar acceso")}
              </button>
            ))}
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={13} className="bg-gray-50 px-6 py-4">
            <div className="max-w-2xl">
              <DayBars days={s.days} goal={s.goal} title={t("Últimos 14 días de {name}", { name })} />
              <p className="mt-2 text-xs text-gray-500">
                {t("Este mes: {month} cuentas · descartó {discarded} borradores", { month: s.month, discarded: s.discardedDrafts })}
              </p>
            </div>
          </td>
        </tr>
      )}
    </Fragment>
  );
}

export function CreateAssociateForm() {
  const t = useT();
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [goal, setGoal] = useState("10");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<{ created: boolean; credentials?: { email: string; password: string } } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setResult(null);
    const res = await fetch("/api/admin/associates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName, email, dailyGoal: Number(goal || 0) }),
    }).catch(() => null);
    const j = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (!res?.ok) {
      setErr(typeof j.error === "string" ? t(j.error) : t("No se pudo guardar."));
      return;
    }
    setResult(j);
    setFullName("");
    setEmail("");
    router.refresh();
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="space-y-3 rounded-xl border border-gray-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-gray-900">{t("Dar de alta un asociado")}</h2>
      <p className="text-xs text-gray-500">
        {t("Si el correo ya tiene cuenta en Cabibee, sólo se le da acceso al panel. Si no, se crea con una contraseña temporal.")}
      </p>
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_90px]">
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
        <input
          type="number"
          min={0}
          max={500}
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          title={t("Meta diaria")}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      </div>
      <button type="submit" disabled={busy} className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
        {busy ? t("Guardando…") : t("Dar de alta")}
      </button>
      {err && <p className="text-sm text-red-700">{err}</p>}
      {result && !result.credentials && <p className="text-sm text-green-700">{t("Listo: ya puede entrar al panel de asociados.")}</p>}
      {result?.credentials && (
        <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-3 font-mono text-sm">
          <p className="font-sans text-xs font-semibold text-amber-900">{t("Acceso del asociado (solo se muestra ahora)")}</p>
          <p className="mt-1">
            {t("Usuario:")} {result.credentials.email}
          </p>
          <p>
            {t("Contraseña:")} {result.credentials.password}
          </p>
          <p className="mt-1 font-sans text-xs text-amber-800">
            {t("Entra en /login; al primer ingreso le pide una contraseña nueva y lo manda a su panel.")}
          </p>
        </div>
      )}
    </form>
  );
}
