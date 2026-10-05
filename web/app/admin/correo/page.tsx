"use client";

import { useCallback, useEffect, useState } from "react";
import { useLang, useT } from "@/components/i18n-provider";
import { numberLocale } from "@/lib/i18n";

type BoxId = "noreply" | "support";

type Box = {
  id: BoxId;
  email: string;
  connected: boolean;
  loginUser?: string;
  provider?: "zoho" | "gmail" | "other";
  smtpHost?: string;
  connectedAt?: string;
  lastOkAt?: string;
  lastError?: string;
};

type Meta = Record<BoxId, { email: string; title: string; uses: string }>;

const inputCls =
  "mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-400";

const ZOHO_REGIONS = [
  { id: "com", label: "zoho.com (EE. UU. / México)" },
  { id: "eu", label: "zoho.eu (Europa)" },
  { id: "in", label: "zoho.in (India)" },
  { id: "au", label: "zoho.com.au (Australia)" },
  { id: "jp", label: "zoho.jp (Japón)" },
  { id: "ca", label: "zoho.ca (Canadá)" },
];

export default function AdminCorreoPage() {
  const t = useT();
  const lang = useLang();
  const [boxes, setBoxes] = useState<Box[] | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [open, setOpen] = useState<BoxId | null>(null);
  const [provider, setProvider] = useState<"zoho" | "gmail">("zoho");
  const [region, setRegion] = useState("com");
  const [password, setPassword] = useState("");
  const [loginUser, setLoginUser] = useState("");
  const [sendTest, setSendTest] = useState(true);
  const [testTo, setTestTo] = useState("");
  const [testFor, setTestFor] = useState<BoxId | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const when = (iso?: string) =>
    iso ? new Date(iso).toLocaleString(numberLocale(lang), { dateStyle: "medium", timeStyle: "short" }) : "";

  const load = useCallback(() => {
    fetch("/api/admin/mailboxes", { cache: "no-store", credentials: "include" })
      .then(async (r) => {
        if (!r.ok) throw new Error(r.status === 403 ? "Tu sesión de admin venció. Vuelve a entrar." : "No se pudo cargar.");
        return r.json() as Promise<{ boxes?: Box[]; meta?: Meta }>;
      })
      .then((j) => {
        setBoxes(j.boxes ?? []);
        setMeta(j.meta ?? null);
      })
      .catch((e: unknown) => {
        setBoxes([]);
        setErr(e instanceof Error ? e.message : "No se pudo cargar.");
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function startConnect(box: Box, as: "zoho" | "gmail") {
    setOpen(box.id);
    setProvider(as);
    setPassword("");
    setLoginUser(box.loginUser ?? "");
    setErr(null);
    setMsg(null);
  }

  async function connect(id: BoxId) {
    setBusy(id);
    setErr(null);
    setMsg(null);
    const res = await fetch("/api/admin/mailboxes", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, password, loginUser, provider, region, sendTest, testTo }),
    }).catch(() => null);
    const j = res ? await res.json().catch(() => ({})) : {};
    setBusy(null);
    if (!res?.ok) {
      setErr(typeof j.error === "string" ? j.error : "No se pudo conectar.");
      return;
    }
    setPassword("");
    setOpen(null);
    if (typeof j.warning === "string") setMsg(j.warning);
    else if (j.testedTo) setMsg(t("Conectado. Mandamos un correo de prueba a {to}: revisa la bandeja (y spam).", { to: j.testedTo }));
    else setMsg(t("Conectado {email}.", { email: id === "noreply" ? "noreply@" : "support@" }));
    load();
  }

  async function test(id: BoxId) {
    setBusy(`test-${id}`);
    setErr(null);
    setMsg(null);
    const res = await fetch("/api/admin/mailboxes", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, to: testTo }),
    }).catch(() => null);
    const j = res ? await res.json().catch(() => ({})) : {};
    setBusy(null);
    if (!res?.ok) {
      setErr(typeof j.error === "string" ? j.error : "No se pudo enviar la prueba.");
      return;
    }
    setTestFor(null);
    setMsg(t("Salió el correo de prueba a {to}. Revisa la bandeja (y spam).", { to: j.to ?? testTo }));
    load();
  }

  async function disconnect(id: BoxId) {
    if (!confirm(t("¿Desconectar {email}? Dejan de salir los correos de ese buzón.", { email: id === "noreply" ? "noreply@" : "support@" }))) return;
    setBusy(`off-${id}`);
    setErr(null);
    setMsg(null);
    const res = await fetch(`/api/admin/mailboxes?id=${id}`, { method: "DELETE", credentials: "include" }).catch(() => null);
    setBusy(null);
    if (!res?.ok) {
      setErr("No se pudo desconectar.");
      return;
    }
    setMsg("Desconectado.");
    load();
  }

  const testField = (
    <label className="block text-sm font-medium text-gray-800">
      {t("Mandar la prueba a")}
      <input
        type="email"
        autoComplete="email"
        placeholder={t("Tu correo de admin si lo dejas vacío")}
        value={testTo}
        onChange={(e) => setTestTo(e.target.value)}
        className={inputCls}
      />
    </label>
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900">{t("Correo")}</h1>
      <p className="mt-1 mb-6 text-sm text-gray-500">
        {t("Conecta los dos buzones de Cabibee. La contraseña se guarda cifrada y no se vuelve a mostrar.")}
      </p>

      {err && <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{t(err)}</p>}
      {msg && <p className="mb-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{t(msg)}</p>}

      {boxes === null ? (
        <p className="text-gray-400 animate-pulse">{t("Cargando…")}</p>
      ) : (
        <div className="space-y-4">
          {boxes.map((box) => {
            const info = meta?.[box.id];
            const connecting = open === box.id;
            return (
              <section key={box.id} className="rounded-2xl border border-gray-200 bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{info ? t(info.title) : box.id}</p>
                    <p className="mt-0.5 text-lg font-bold text-gray-900">{box.email}</p>
                    {info?.uses && <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-600">{t(info.uses)}</p>}
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      box.connected ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {box.connected ? t("Conectado") : t("Sin conectar")}
                  </span>
                </div>
                {box.connected && (
                  <p className="mt-3 text-xs text-gray-400">
                    {t("Desde {date}", { date: when(box.connectedAt) })}
                    {box.provider === "zoho" ? " · Zoho" : box.provider === "gmail" ? " · Google" : ""}
                    {box.smtpHost ? ` (${box.smtpHost})` : ""}
                    {box.loginUser ? ` · ${t("inicia sesión como {user}", { user: box.loginUser })}` : ""}
                    {box.lastOkAt ? ` · ${t("último envío {date}", { date: when(box.lastOkAt) })}` : ""}
                  </p>
                )}
                {box.lastError && (
                  <p className="mt-2 text-xs text-red-600">
                    {t("Último error:")} {box.lastError}
                  </p>
                )}

                {!connecting && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => startConnect(box, "zoho")}
                      className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600"
                    >
                      {box.connected ? t("Reconectar con Zoho") : t("Conectar con Zoho")}
                    </button>
                    {box.connected && (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            setTestFor(testFor === box.id ? null : box.id);
                            setErr(null);
                          }}
                          className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                          {t("Mandar correo de prueba")}
                        </button>
                        <button
                          type="button"
                          disabled={busy === `off-${box.id}`}
                          onClick={() => void disconnect(box.id)}
                          className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                        >
                          {t("Desconectar")}
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => startConnect(box, "gmail")}
                      className="rounded-lg px-3 py-2 text-xs text-gray-500 underline hover:text-gray-700"
                    >
                      {t("Usar Google en su lugar")}
                    </button>
                  </div>
                )}

                {testFor === box.id && !connecting && (
                  <form
                    className="mt-4 space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void test(box.id);
                    }}
                  >
                    {testField}
                    <button
                      type="submit"
                      disabled={busy === `test-${box.id}`}
                      className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      {busy === `test-${box.id}` ? t("Enviando…") : t("Enviar prueba")}
                    </button>
                  </form>
                )}

                {connecting && (
                  <form
                    className="mt-4 space-y-3 rounded-xl border border-amber-200 bg-amber-50/50 p-4"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void connect(box.id);
                    }}
                  >
                    {provider === "zoho" ? (
                      <>
                        <p className="text-sm font-semibold text-gray-900">{t("Conectar {email} con Zoho Mail", { email: box.email })}</p>
                        <ol className="list-decimal space-y-1 pl-5 text-sm text-gray-700">
                          <li>{t("Entra a accounts.zoho.com con la cuenta de {email}.", { email: box.email })}</li>
                          <li>{t("Seguridad → Contraseñas específicas de la aplicación → Generar nueva. Ponle de nombre «Cabibee».")}</li>
                          <li>{t("Copia la clave que te da Zoho y pégala aquí abajo. No uses la contraseña normal del correo.")}</li>
                        </ol>
                        <p className="text-xs text-gray-500">
                          {t("Si Zoho no la acepta, revisa en mail.zoho.com → Configuración → Cuentas de correo que «Acceso SMTP» esté activado.")}
                        </p>
                        <label className="block text-sm font-medium text-gray-800">
                          {t("Región de tu cuenta Zoho")}
                          <select value={region} onChange={(e) => setRegion(e.target.value)} className={inputCls}>
                            {ZOHO_REGIONS.map((r) => (
                              <option key={r.id} value={r.id}>
                                {t(r.label)}
                              </option>
                            ))}
                          </select>
                        </label>
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-semibold text-gray-900">{t("Conectar {email} con Google", { email: box.email })}</p>
                        <p className="text-sm text-gray-700">
                          {t("Entra a myaccount.google.com con la cuenta de {email}: Seguridad → Verificación en dos pasos (tiene que estar activa) → Contraseñas de aplicaciones. Crea una para «Cabibee» y pégala aquí. No uses la contraseña normal del correo.", { email: box.email })}
                        </p>
                      </>
                    )}
                    <label className="block text-sm font-medium text-gray-800">
                      {t("Inicia sesión como")}{" "}
                      <span className="font-normal text-gray-500">{t("(sólo si {email} es un alias)", { email: box.email })}</span>
                      <input
                        type="email"
                        autoComplete="off"
                        placeholder={box.email}
                        value={loginUser}
                        onChange={(e) => setLoginUser(e.target.value)}
                        className={inputCls}
                      />
                    </label>
                    <label className="block text-sm font-medium text-gray-800">
                      {t("Contraseña de aplicación")}
                      <input
                        type="password"
                        autoComplete="new-password"
                        required
                        minLength={8}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className={inputCls}
                      />
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input type="checkbox" checked={sendTest} onChange={(e) => setSendTest(e.target.checked)} />
                      {t("Mandar un correo de prueba al conectar")}
                    </label>
                    {sendTest && testField}
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="submit"
                        disabled={busy === box.id}
                        className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
                      >
                        {busy === box.id ? t("Conectando…") : t("Conectar y probar")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setOpen(null)}
                        className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-white"
                      >
                        {t("Cancelar")}
                      </button>
                    </div>
                  </form>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
