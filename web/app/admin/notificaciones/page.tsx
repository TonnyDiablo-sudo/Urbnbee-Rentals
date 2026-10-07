"use client";

import { useCallback, useEffect, useState } from "react";
import { useT } from "@/components/i18n-provider";

type Device = { userId: string; email: string; service: string; createdAt: string; userAgent: string };
type Payload = { configured: boolean; subject: string; devices: Device[] };
type TestResult = { configured: boolean; devices: number; sent: number; expired: number; failed: { host: string; status?: number; message: string }[] };

function shortUa(ua: string): string {
  if (/iphone|ipad/i.test(ua)) return "iPhone/iPad";
  if (/android/i.test(ua)) return /chrome/i.test(ua) ? "Android · Chrome" : "Android";
  if (/edg\//i.test(ua)) return "Edge";
  if (/chrome/i.test(ua)) return "Chrome";
  if (/safari/i.test(ua)) return "Safari";
  if (/firefox/i.test(ua)) return "Firefox";
  return ua ? ua.slice(0, 40) : "—";
}

export default function AdminPushPage() {
  const t = useT();
  const [data, setData] = useState<Payload | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/push", { cache: "no-store" }).catch(() => null);
    if (res?.ok) setData((await res.json()) as Payload);
    else setMsg("No se pudo cargar.");
  }, []);

  useEffect(() => {
    const id = setTimeout(() => void load(), 0);
    return () => clearTimeout(id);
  }, [load]);

  const test = async (userId: string) => {
    setBusy(userId);
    const res = await fetch("/api/admin/push", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    }).catch(() => null);
    setBusy(null);
    if (!res?.ok) return setResults((p) => ({ ...p, [userId]: t("No se pudo enviar.") }));
    const r = (await res.json()) as TestResult;
    const parts = [t("{n} dispositivos", { n: r.devices }), t("enviados: {n}", { n: r.sent })];
    if (r.expired) parts.push(t("dados de baja: {n}", { n: r.expired }));
    if (r.failed.length) parts.push(t("fallaron: {list}", { list: r.failed.map((f) => `${f.host} ${f.status ?? ""} ${f.message}`.trim()).join("; ") }));
    setResults((p) => ({ ...p, [userId]: parts.join(" · ") }));
    if (r.expired) void load();
  };

  const byUser = new Map<string, Device[]>();
  for (const d of data?.devices ?? []) byUser.set(d.userId, [...(byUser.get(d.userId) ?? []), d]);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <h1 className="text-2xl font-bold text-gray-900">{t("Notificaciones push")}</h1>
      <p className="mt-1 max-w-3xl text-sm text-gray-500">
        {t("Dispositivos que activaron los avisos en la app. Manda un aviso de prueba para comprobar que llegan al teléfono.")}
      </p>

      {!data && !msg && <p className="mt-6 text-gray-400">{t("Cargando…")}</p>}
      {msg && <p className="mt-6 text-sm text-red-600">{t(msg)}</p>}

      {data && (
        <div className="mt-6 max-w-4xl space-y-4">
          <section className="rounded-xl border border-gray-200 bg-white p-5 text-sm">
            <p className="font-semibold text-gray-900">
              {data.configured ? t("Servidor listo: llaves VAPID configuradas.") : t("Faltan las llaves VAPID en el servidor: no se puede enviar nada.")}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              {t("Contacto VAPID: {subject}", { subject: data.subject })} · {t("{n} dispositivos registrados", { n: data.devices.length })}
            </p>
          </section>

          {byUser.size === 0 && (
            <p className="rounded-xl border border-dashed border-gray-300 p-5 text-sm text-gray-500">
              {t("Nadie ha activado los avisos todavía. En la app: Menú → Notificaciones → interruptor. En iPhone primero hay que agregar la app a la pantalla de inicio.")}
            </p>
          )}

          {[...byUser.entries()].map(([userId, devices]) => (
            <section key={userId} className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{devices[0].email}</p>
                  <p className="text-xs text-gray-400">{userId}</p>
                </div>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void test(userId)}
                  className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {busy === userId ? t("Enviando…") : t("Enviar aviso de prueba")}
                </button>
              </div>
              {results[userId] && <p className="mt-2 text-xs text-gray-700">{results[userId]}</p>}
              <ul className="mt-3 divide-y divide-gray-100 text-sm">
                {devices.map((d, i) => (
                  <li key={i} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span className="text-gray-800">{shortUa(d.userAgent)}</span>
                    <span className="text-xs text-gray-500">
                      {d.service} · {new Date(d.createdAt).toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
