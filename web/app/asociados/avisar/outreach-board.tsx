"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useT } from "@/components/i18n-provider";
import type { OutreachRow, OutreachState } from "@/lib/associate-outreach";
import type { OutreachChannel, OutreachManualStatus } from "@/lib/associate-outreach-store";

type Quota = { used: number; perDay: number; remaining: number; waitSec: number; minGapSec: number };
type Rules = Record<OutreachChannel, { perDay: number; minGapSec: number }>;

const FILTERS: { id: OutreachState | "todos"; label: string }[] = [
  { id: "pendiente", label: "Por avisar" },
  { id: "enviado", label: "Avisados" },
  { id: "respondio", label: "Respondieron" },
  { id: "reclamo", label: "Ya entraron" },
  { id: "no_quiere", label: "No quieren" },
  { id: "todos", label: "Todos" },
];

const STATE_STYLE: Record<OutreachState, string> = {
  pendiente: "bg-amber-100 text-amber-800",
  enviado: "bg-blue-100 text-blue-800",
  respondio: "bg-violet-100 text-violet-800",
  reclamo: "bg-green-100 text-green-800",
  no_quiere: "bg-gray-200 text-gray-600",
};
const STATE_LABEL: Record<OutreachState, string> = {
  pendiente: "Por avisar",
  enviado: "Avisado",
  respondio: "Respondió",
  reclamo: "Ya entró",
  no_quiere: "No quiere",
};
const CHANNEL_LABEL: Record<OutreachChannel, string> = {
  whatsapp: "WhatsApp",
  messenger: "Messenger",
  email: "Correo",
  whatsapp_api: "WhatsApp Business",
};

function canUse(row: OutreachRow, channel: OutreachChannel): boolean {
  if (channel === "whatsapp" || channel === "whatsapp_api") return Boolean(row.whatsapp);
  if (channel === "messenger") return Boolean(row.facebookUrl);
  return Boolean(row.email);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function sentRecently(data: { code?: string }) {
  return data.code === "sent_recently";
}

export function OutreachBoard({
  rows,
  quotas: initialQuotas,
  rules,
  apiReady,
  showAssociate,
}: {
  rows: OutreachRow[];
  quotas: Record<OutreachChannel, Quota>;
  rules: Rules;
  apiReady: boolean;
  showAssociate: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const [filter, setFilter] = useState<OutreachState | "todos">("pendiente");
  const [quotas, setQuotas] = useState(initialQuotas);
  const [readyAt, setReadyAt] = useState<Partial<Record<OutreachChannel, number>>>(() => {
    const now = Date.now();
    return Object.fromEntries(Object.entries(initialQuotas).map(([c, q]) => [c, now + q.waitSec * 1000]));
  });
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const [batch, setBatch] = useState<{ channel: OutreachChannel; done: number; total: number; failed: number } | null>(null);
  const stopBatch = useRef(false);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const counts = Object.fromEntries(FILTERS.map((f) => [f.id, f.id === "todos" ? rows.length : rows.filter((r) => r.state === f.id).length]));
  const shown = filter === "todos" ? rows : rows.filter((r) => r.state === filter);
  const waitFor = (c: OutreachChannel) => Math.max(0, Math.ceil(((readyAt[c] ?? 0) - now) / 1000));
  const blocked = (c: OutreachChannel) => quotas[c].remaining <= 0 || waitFor(c) > 0 || (c === "whatsapp_api" && !apiReady);

  async function post(hostId: string, body: object) {
    const res = await fetch(`/api/associate/outreach/${hostId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    return { ok: Boolean(res?.ok), data };
  }

  function afterSend(channel: OutreachChannel, data: { quota?: Quota; waitSec?: number }) {
    if (data.quota) setQuotas((q) => ({ ...q, [channel]: data.quota! }));
    const gap = data.quota?.minGapSec ?? data.waitSec ?? rules[channel].minGapSec;
    setReadyAt((r) => ({ ...r, [channel]: Date.now() + gap * 1000 }));
  }

  async function send(row: OutreachRow, channel: OutreachChannel, force = false) {
    // La pestaña se abre ya, dentro del clic, para que el navegador no la bloquee.
    const tab = channel === "whatsapp" || channel === "messenger" ? window.open("about:blank", "_blank") : null;
    setBusy(`${row.hostId}:${channel}`);
    setNotice(null);
    const { ok, data } = await post(row.hostId, { channel, force });
    setBusy(null);
    if (!ok) {
      tab?.close();
      if (data.waitSec) afterSend(channel, { waitSec: data.waitSec });
      if (sentRecently(data) && !force && confirm(`${t(data.error)}\n\n${t("¿Mandarlo otra vez de todos modos?")}`)) return send(row, channel, true);
      setNotice({ ok: false, text: t(data.error || "No se pudo.") });
      return;
    }
    afterSend(channel, data);
    setLastMessage(data.message);
    if (channel === "messenger") {
      await navigator.clipboard.writeText(data.message).catch(() => {});
      setNotice({ ok: true, text: t("Mensaje copiado. En Facebook dale «Enviar mensaje», pégalo y mándalo.") });
    } else if (channel === "whatsapp") {
      setNotice({ ok: true, text: t("Se abrió WhatsApp con el mensaje listo; sólo dale enviar.") });
    } else {
      setNotice({ ok: true, text: t("Enviado a {name}.", { name: row.hostName }) });
    }
    if (tab && data.url) tab.location.href = data.url;
    router.refresh();
  }

  async function setStatus(row: OutreachRow, status: OutreachManualStatus) {
    if (status === "no_quiere" && !confirm(t("Sus anuncios dejan de verse en Cabibee. ¿Seguro?"))) return;
    setBusy(`${row.hostId}:status`);
    const { ok, data } = await post(row.hostId, { status });
    setBusy(null);
    if (!ok) setNotice({ ok: false, text: t(data.error || "No se pudo.") });
    router.refresh();
  }

  /** WhatsApp y Messenger: abre el siguiente pendiente, uno por clic. */
  function next(channel: "whatsapp" | "messenger") {
    const row = rows.find((r) => r.state === "pendiente" && canUse(r, channel) && !r.lastSent[channel]);
    if (!row) {
      setNotice({ ok: false, text: t("No hay más pendientes con {channel}.", { channel: CHANNEL_LABEL[channel] }) });
      return;
    }
    void send(row, channel);
  }

  /** Correo y WhatsApp Business los manda Cabibee, uno por uno respetando la espera. */
  async function runBatch(channel: "email" | "whatsapp_api") {
    const targets = rows.filter((r) => r.state === "pendiente" && canUse(r, channel) && !r.lastSent[channel]).slice(0, quotas[channel].remaining);
    if (!targets.length) {
      setNotice({ ok: false, text: t("No hay más pendientes con {channel}.", { channel: t(CHANNEL_LABEL[channel]) }) });
      return;
    }
    if (!confirm(t("Mandar a {n} dueños por {channel}, uno cada {sec} s. ¿Seguir?", { n: targets.length, channel: t(CHANNEL_LABEL[channel]), sec: rules[channel].minGapSec }))) return;
    stopBatch.current = false;
    let done = 0;
    let failed = 0;
    setBatch({ channel, done, total: targets.length, failed });
    for (const row of targets) {
      if (stopBatch.current) break;
      let { ok, data } = await post(row.hostId, { channel });
      if (!ok && data.waitSec) {
        await sleep(data.waitSec * 1000 + 500);
        ({ ok, data } = await post(row.hostId, { channel }));
      }
      if (ok) afterSend(channel, data);
      else failed++;
      done++;
      setBatch({ channel, done, total: targets.length, failed });
      if (!ok && /tope|hoy/.test(data.error || "")) break;
      if (done < targets.length && !stopBatch.current) await sleep(rules[channel].minGapSec * 1000 + Math.random() * 3000);
    }
    setBatch(null);
    setNotice({ ok: failed === 0, text: t("Listo: {ok} enviados, {failed} fallaron.", { ok: done - failed, failed }) });
    router.refresh();
  }

  const channelsBar: OutreachChannel[] = ["whatsapp", "messenger", "email", "whatsapp_api"];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {channelsBar.map((c) => (
          <div key={c} className="rounded-xl border border-gray-200 bg-white p-3">
            <p className="text-xs font-semibold text-gray-500">{t(CHANNEL_LABEL[c])}</p>
            {c === "whatsapp_api" && !apiReady ? (
              <p className="mt-1 text-xs text-gray-400">{t("Sin configurar. Cuando tengas la cuenta de WhatsApp Business, pon las claves en Railway.")}</p>
            ) : (
              <>
                <p className="mt-1 text-lg font-semibold text-gray-900">
                  {quotas[c].used} <span className="text-sm font-normal text-gray-400">/ {quotas[c].perDay} {t("hoy")}</span>
                </p>
                {waitFor(c) > 0 && <p className="text-xs text-amber-700">{t("Siguiente en {sec} s", { sec: waitFor(c) })}</p>}
              </>
            )}
            {(c === "whatsapp" || c === "messenger") && (
              <button
                type="button"
                disabled={blocked(c) || Boolean(busy) || Boolean(batch)}
                onClick={() => next(c)}
                className="mt-2 w-full rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
              >
                {t("Avisar al siguiente")}
              </button>
            )}
            {(c === "email" || (c === "whatsapp_api" && apiReady)) && (
              <button
                type="button"
                disabled={blocked(c) || Boolean(busy) || Boolean(batch)}
                onClick={() => void runBatch(c)}
                className="mt-2 w-full rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
              >
                {t("Mandar a todos los pendientes")}
              </button>
            )}
          </div>
        ))}
      </div>

      {batch && (
        <div className="flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
          <span>
            {t("Mandando por {channel}: {done} de {total}", { channel: t(CHANNEL_LABEL[batch.channel]), done: batch.done, total: batch.total })}
            {batch.failed > 0 && ` · ${t("{n} fallaron", { n: batch.failed })}`}
          </span>
          <button type="button" onClick={() => (stopBatch.current = true)} className="rounded-lg bg-white px-3 py-1 text-xs font-medium">
            {t("Detener")}
          </button>
        </div>
      )}
      {notice && (
        <p className={`rounded-xl p-3 text-sm ${notice.ok ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>{notice.text}</p>
      )}
      {lastMessage && (
        <details className="rounded-xl border border-gray-200 bg-white p-3 text-sm">
          <summary className="cursor-pointer text-gray-600">{t("Último mensaje")}</summary>
          <pre className="mt-2 whitespace-pre-wrap font-sans text-gray-800">{lastMessage}</pre>
        </details>
      )}

      <div className="flex flex-wrap gap-1">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`rounded-full px-3 py-1 text-sm ${filter === f.id ? "bg-amber-500 text-white" : "bg-white text-gray-700 hover:bg-amber-50"}`}
          >
            {t(f.label)} <span className="opacity-70">({counts[f.id]})</span>
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="text-sm text-gray-500">{t("No hay cuentas aquí.")}</p>
      ) : (
        <ul className="space-y-2">
          {shown.map((row) => {
            const closed = row.state === "reclamo" || row.state === "no_quiere";
            return (
              <li key={row.hostId} className="rounded-xl border border-gray-200 bg-white p-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/asociados/cuentas/${row.hostId}`} className="font-medium text-gray-900 underline">
                        {row.hostName}
                      </Link>
                      <span className={`rounded px-2 py-0.5 text-xs ${STATE_STYLE[row.state]}`}>{t(STATE_LABEL[row.state])}</span>
                      {showAssociate && row.associateName && <span className="text-xs text-gray-400">· {row.associateName}</span>}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-gray-500">
                      {row.listings.length
                        ? row.listings.map((l) => l.title).join(" · ")
                        : t("Sin anuncios publicados")}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {[row.whatsapp && `WhatsApp ${row.whatsapp}`, row.email, row.facebookUrl && "Facebook"].filter(Boolean).join(" · ") ||
                        t("Sin contacto")}
                    </p>
                    {Object.keys(row.lastSent).length > 0 && (
                      <p className="mt-0.5 text-xs text-gray-400">
                        {t("Avisado:")}{" "}
                        {(Object.entries(row.lastSent) as [OutreachChannel, string][])
                          .map(([c, at]) => `${t(CHANNEL_LABEL[c])} ${new Date(at).toLocaleDateString()}`)
                          .join(" · ")}
                      </p>
                    )}
                  </div>
                  {!closed && (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {(["whatsapp", "messenger", "email", "whatsapp_api"] as OutreachChannel[])
                        .filter((c) => canUse(row, c) && (c !== "whatsapp_api" || apiReady))
                        .map((c) => (
                          <button
                            key={c}
                            type="button"
                            disabled={blocked(c) || Boolean(busy) || Boolean(batch)}
                            onClick={() => void send(row, c)}
                            className={`rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-40 ${
                              c === "whatsapp" || c === "whatsapp_api"
                                ? "bg-green-600 text-white"
                                : c === "messenger"
                                  ? "bg-blue-600 text-white"
                                  : "border border-gray-300 bg-white text-gray-800"
                            }`}
                          >
                            {busy === `${row.hostId}:${c}` ? "…" : t(CHANNEL_LABEL[c])}
                          </button>
                        ))}
                      <select
                        value=""
                        disabled={Boolean(busy)}
                        onChange={(e) => e.target.value && void setStatus(row, e.target.value as OutreachManualStatus)}
                        className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-700"
                      >
                        <option value="">{t("Marcar…")}</option>
                        <option value="respondio">{t("Respondió")}</option>
                        <option value="no_quiere">{t("No quiere (quitar anuncio)")}</option>
                        <option value="pendiente">{t("Por avisar")}</option>
                      </select>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
