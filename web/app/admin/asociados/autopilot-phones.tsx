"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useT } from "@/components/i18n-provider";

export type PhoneRow = { id: string; label: string; countryName: string; active: boolean; usedToday: number };

/** Líneas de Cabibee para los formularios que piden teléfono antes de mostrar el WhatsApp del anunciante. */
export type EmailRow = { id: string; email: string; name: string; active: boolean; usedToday: number };

export function AutopilotPhonesForm({
  phones,
  emails,
  formName,
  formEmail,
  perPhoneDaily,
  maxPerPhone,
}: {
  phones: PhoneRow[];
  emails: EmailRow[];
  formName: string;
  formEmail: string;
  perPhoneDaily: number;
  maxPerPhone: number;
}) {
  const t = useT();
  const router = useRouter();
  const [text, setText] = useState("");
  const [emailText, setEmailText] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [name, setName] = useState(formName);
  const [email, setEmail] = useState(formEmail);
  const [perDay, setPerDay] = useState(String(perPhoneDaily));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const settingsDirty = name !== formName || email !== formEmail || perDay !== String(perPhoneDaily);

  async function call(method: string, body?: object, query = "") {
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/admin/autopilot/phones${query}`, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    }).catch(() => null);
    const j = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (!res?.ok) setMsg({ ok: false, text: typeof j.error === "string" ? t(j.error) : t("No se pudo guardar.") });
    else router.refresh();
    return { ok: Boolean(res?.ok), j };
  }

  async function add(kind: "phones" | "emails") {
    const { ok, j } = await call("POST", { kind, text: kind === "emails" ? emailText : text, confirm: confirmed });
    if (!ok) return;
    if (kind === "emails") setEmailText("");
    else setText("");
    const invalid = Array.isArray(j.invalid) && j.invalid.length ? ` ${t("No entendí: {list}", { list: j.invalid.join(", ") })}` : "";
    setMsg({ ok: true, text: t("Agregué {added} ({repeated} ya estaban).", { added: j.added, repeated: j.repeated }) + invalid });
  }

  const byCountry = phones.reduce<Record<string, PhoneRow[]>>((acc, p) => ((acc[p.countryName] ??= []).push(p), acc), {});

  return (
    <div className="rounded-xl border border-violet-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-gray-900">{t("Piloto automático: líneas para formularios")}</h2>
      <p className="mt-1 text-xs text-gray-500">
        {t(
          "Cuando un anuncio pide teléfono para mostrar el WhatsApp del anunciante, el piloto llena el formulario con una de estas líneas (del país de la página), rotándolas. Los anunciantes y agentes van a escribir y llamar a estas líneas: alguien tiene que contestarlas."
        )}
      </p>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <label className="text-xs text-gray-600">
          {t("Nombre en formularios")}
          <input value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm" />
        </label>
        <label className="text-xs text-gray-600">
          {t("Correo en formularios")}
          <input value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm" />
        </label>
        <label className="text-xs text-gray-600">
          {t("Usos por línea al día")}
          <input
            type="number"
            min={1}
            max={maxPerPhone}
            value={perDay}
            onChange={(e) => setPerDay(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm"
          />
        </label>
      </div>
      <button
        type="button"
        disabled={!settingsDirty || busy}
        onClick={() => void call("PATCH", { formName: name, formEmail: email, perPhoneDaily: Number(perDay) })}
        className="mt-2 rounded-lg bg-violet-600 px-4 py-1.5 text-xs font-medium text-white disabled:opacity-40"
      >
        {t("Guardar")}
      </button>

      <p className="mt-2 text-xs text-gray-400">
        {t("Si hay correos en la lista, se rotan con el nombre de cada uno; el nombre y correo de arriba sólo se usan si no queda ninguno libre.")}
      </p>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            placeholder={"+52 55 1234 5678\n+52 33 1234 5678"}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs"
          />
          <button
            type="button"
            disabled={!text.trim() || !confirmed || busy}
            onClick={() => void add("phones")}
            className="mt-1 rounded-lg bg-violet-600 px-4 py-1.5 text-xs font-medium text-white disabled:opacity-40"
          >
            {t("Agregar líneas")}
          </button>
        </div>
        <div>
          <textarea
            value={emailText}
            onChange={(e) => setEmailText(e.target.value)}
            rows={4}
            placeholder={"nombre.apellido1234@gmail.com\nnombre.apellido5678@outlook.com"}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs"
          />
          <button
            type="button"
            disabled={!emailText.trim() || !confirmed || busy}
            onClick={() => void add("emails")}
            className="mt-1 rounded-lg bg-violet-600 px-4 py-1.5 text-xs font-medium text-white disabled:opacity-40"
          >
            {t("Agregar correos")}
          </button>
        </div>
      </div>
      <label className="mt-2 flex items-start gap-2 text-xs text-gray-700">
        <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5" />
        {t("Confirmo que estas líneas y correos son de Cabibee (los contratamos o creamos nosotros) y que recibimos sus mensajes y llamadas.")}
      </label>
      {msg && <p className={`mt-2 text-xs ${msg.ok ? "text-green-700" : "text-red-700"}`}>{msg.text}</p>}

      {emails.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold text-gray-500">
            {t("Correos")} ({emails.filter((e) => e.active).length}/{emails.length})
          </p>
          <ul className="mt-1 grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
            {emails.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-2 rounded border border-gray-100 px-2 py-1 text-xs">
                <span className={`min-w-0 truncate ${e.active ? "text-gray-800" : "text-gray-400 line-through"}`} title={e.email}>
                  {e.name} · <span className="font-mono">{e.email}</span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="text-gray-400">{t("{n} hoy", { n: e.usedToday })}</span>
                  <button type="button" disabled={busy} onClick={() => void call("PATCH", { id: e.id, active: !e.active })} className="text-violet-700 underline">
                    {e.active ? t("Pausar") : t("Activar")}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => confirm(t("¿Quitar este correo?")) && void call("DELETE", undefined, `?id=${e.id}`)}
                    className="text-red-600 underline"
                  >
                    {t("Quitar")}
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {phones.length > 0 && (
        <div className="mt-4 space-y-3">
          {Object.entries(byCountry).map(([country, rows]) => (
            <div key={country}>
              <p className="text-xs font-semibold text-gray-500">
                {country} ({rows.filter((r) => r.active).length}/{rows.length})
              </p>
              <ul className="mt-1 grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
                {rows.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 rounded border border-gray-100 px-2 py-1 text-xs">
                    <span className={`font-mono ${p.active ? "text-gray-800" : "text-gray-400 line-through"}`}>{p.label}</span>
                    <span className="flex items-center gap-2">
                      <span className="text-gray-400">{t("{n} hoy", { n: p.usedToday })}</span>
                      <button type="button" disabled={busy} onClick={() => void call("PATCH", { id: p.id, active: !p.active })} className="text-violet-700 underline">
                        {p.active ? t("Pausar") : t("Activar")}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => confirm(t("¿Quitar esta línea?")) && void call("DELETE", undefined, `?id=${p.id}`)}
                        className="text-red-600 underline"
                      >
                        {t("Quitar")}
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
