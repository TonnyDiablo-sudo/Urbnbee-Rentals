"use client";

import { useCallback, useEffect, useState } from "react";

type Box = {
  id: "noreply" | "support";
  email: string;
  connected: boolean;
  loginUser?: string;
  connectedAt?: string;
  lastOkAt?: string;
  lastError?: string;
};

type Meta = Record<"noreply" | "support", { email: string; title: string; uses: string }>;

function when(iso?: string) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" });
}

export default function AdminCorreoPage() {
  const [boxes, setBoxes] = useState<Box[] | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [open, setOpen] = useState<"noreply" | "support" | null>(null);
  const [password, setPassword] = useState("");
  const [loginUser, setLoginUser] = useState("");
  const [testToMe, setTestToMe] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

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

  async function connect(id: "noreply" | "support") {
    setBusy(id);
    setErr(null);
    setMsg(null);
    const res = await fetch("/api/admin/mailboxes", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, password, loginUser, testToMe }),
    }).catch(() => null);
    const j = res ? await res.json().catch(() => ({})) : {};
    setBusy(null);
    if (!res?.ok) {
      setErr(typeof j.error === "string" ? j.error : "No se pudo conectar.");
      return;
    }
    setPassword("");
    setOpen(null);
    setMsg(typeof j.warning === "string" ? j.warning : `Conectado ${id === "noreply" ? "noreply@" : "support@"}.`);
    load();
  }

  async function test(id: "noreply" | "support") {
    setBusy(`test-${id}`);
    setErr(null);
    setMsg(null);
    const res = await fetch("/api/admin/mailboxes", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }).catch(() => null);
    const j = res ? await res.json().catch(() => ({})) : {};
    setBusy(null);
    if (!res?.ok) {
      setErr(typeof j.error === "string" ? j.error : "No se pudo enviar la prueba.");
      return;
    }
    setMsg("Te mandamos un correo de prueba a tu cuenta de admin.");
    load();
  }

  async function disconnect(id: "noreply" | "support") {
    if (!confirm(`¿Desconectar ${id === "noreply" ? "noreply@" : "support@"}? Dejan de salir los correos de ese buzón.`)) return;
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

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900">Correo</h1>
      <p className="mt-1 mb-6 text-sm text-gray-500">
        Conecta los dos buzones de Cabibee. La contraseña se guarda cifrada y no se vuelve a mostrar.
      </p>

      {err && <p className="mb-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{err}</p>}
      {msg && <p className="mb-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{msg}</p>}

      {boxes === null ? (
        <p className="text-gray-400 animate-pulse">Cargando…</p>
      ) : (
        <div className="space-y-4">
          {boxes.map((box) => {
            const info = meta?.[box.id];
            const connecting = open === box.id;
            return (
              <section key={box.id} className="rounded-2xl border border-gray-200 bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{info?.title ?? box.id}</p>
                    <p className="mt-0.5 text-lg font-bold text-gray-900">{box.email}</p>
                    <p className="mt-2 max-w-xl text-sm leading-relaxed text-gray-600">{info?.uses}</p>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                      box.connected ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {box.connected ? "Conectado" : "Sin conectar"}
                  </span>
                </div>
                {box.connected && (
                  <p className="mt-3 text-xs text-gray-400">
                    Desde {when(box.connectedAt)}
                    {box.loginUser ? ` · inicia sesión como ${box.loginUser}` : ""}
                    {box.lastOkAt ? ` · último envío ${when(box.lastOkAt)}` : ""}
                  </p>
                )}
                {box.lastError && <p className="mt-2 text-xs text-red-600">Último error: {box.lastError}</p>}

                <div className="mt-4 flex flex-wrap gap-2">
                  {!box.connected && !connecting && (
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(box.id);
                        setPassword("");
                        setLoginUser(box.loginUser ?? "");
                        setErr(null);
                      }}
                      className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600"
                    >
                      Conectar {box.email}
                    </button>
                  )}
                  {box.connected && !connecting && (
                    <>
                      <button
                        type="button"
                        disabled={busy === `test-${box.id}`}
                        onClick={() => void test(box.id)}
                        className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        {busy === `test-${box.id}` ? "Enviando…" : "Mandarme una prueba"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setOpen(box.id);
                          setPassword("");
                          setLoginUser(box.loginUser ?? "");
                          setErr(null);
                        }}
                        className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                      >
                        Cambiar clave
                      </button>
                      <button
                        type="button"
                        disabled={busy === `off-${box.id}`}
                        onClick={() => void disconnect(box.id)}
                        className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
                      >
                        Desconectar
                      </button>
                    </>
                  )}
                </div>

                {connecting && (
                  <form
                    className="mt-4 space-y-3 rounded-xl border border-amber-200 bg-amber-50/50 p-4"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void connect(box.id);
                    }}
                  >
                    <p className="text-sm text-gray-700">
                      Entra a myaccount.google.com con la cuenta de {box.email}: Seguridad → Verificación en dos pasos
                      (tiene que estar activa) → <b>Contraseñas de aplicaciones</b>. Crea una para “Cabibee” y pégala
                      aquí. No uses la contraseña normal del correo.
                    </p>
                    <label className="block text-sm font-medium text-gray-800">
                      Inicia sesión como <span className="font-normal text-gray-500">(sólo si {box.email} es un alias)</span>
                      <input
                        type="email"
                        autoComplete="off"
                        placeholder={box.email}
                        value={loginUser}
                        onChange={(e) => setLoginUser(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-400"
                      />
                      <span className="mt-1 block text-xs font-normal text-gray-500">
                        Si {box.email} no tiene cuenta propia en Google (es un alias o un grupo), pon aquí la cuenta real
                        que lo recibe y saca la contraseña de aplicación de esa cuenta. Los correos siguen saliendo como{" "}
                        {box.email}.
                      </span>
                    </label>
                    <label className="block text-sm font-medium text-gray-800">
                      Contraseña de aplicación
                      <input
                        type="password"
                        autoComplete="new-password"
                        required
                        minLength={8}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-400"
                      />
                    </label>
                    <label className="flex items-center gap-2 text-sm text-gray-700">
                      <input type="checkbox" checked={testToMe} onChange={(e) => setTestToMe(e.target.checked)} />
                      Mandarme un correo de prueba a mi cuenta de admin
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="submit"
                        disabled={busy === box.id}
                        className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
                      >
                        {busy === box.id ? "Conectando…" : "Conectar y probar"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setOpen(null)}
                        className="rounded-lg px-4 py-2 text-sm text-gray-600 hover:bg-white"
                      >
                        Cancelar
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
