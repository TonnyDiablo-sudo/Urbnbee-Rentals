"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "@/components/i18n-provider";
import { shrinkImage, useVoiceRecorder, VOICE_MAX_SEC } from "@/components/chat/media-input";

type Channel = { id: string; name: string; emoji: string; lastAt: string; preview: string };
type Msg = {
  id: string;
  byName: string;
  mine: boolean;
  body: string;
  at: string;
  attachment?: { kind: "image" | "audio" | "file"; name?: string; size: number; durationSec?: number; url: string };
};
type Thread = { channel: { id: string; name: string; emoji: string }; canManage: boolean; messages: Msg[] };

const SUGGESTED = [
  { emoji: "💰", name: "Cuentas" },
  { emoji: "🧹", name: "Limpiezas" },
  { emoji: "🧴", name: "Insumos" },
  { emoji: "🔧", name: "Mantenimiento" },
];

const time = (iso: string) =>
  new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

async function call(url: string, method = "GET", body?: unknown) {
  const res = await fetch(url, {
    method,
    cache: "no-store",
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  }).catch(() => null);
  const j = res ? await res.json().catch(() => ({})) : {};
  return { ok: Boolean(res?.ok), status: res?.status ?? 0, j: j as Record<string, unknown> };
}

/** Chats de equipo: el anfitrión y su gente arman los que quieran (cuentas, limpiezas, insumos…). */
export function TeamChat({ hostId }: { hostId?: string }) {
  const t = useT();
  const q = hostId ? `?host=${encodeURIComponent(hostId)}` : "";
  const [channels, setChannels] = useState<Channel[] | null>(null);
  const [locked, setLocked] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState({ emoji: "💬", name: "" });
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await call(`/api/team-chat${q}`);
    if (r.ok) {
      setLocked(null);
      setChannels((r.j.channels as Channel[]) ?? []);
    } else {
      setLocked(typeof r.j.error === "string" ? r.j.error : "No se pudo cargar.");
      setChannels([]);
    }
  }, [q]);

  useEffect(() => {
    const id = setTimeout(() => void load(), 0);
    const want = new URLSearchParams(window.location.search).get("chat");
    if (want) setOpen(want);
    return () => clearTimeout(id);
  }, [load]);

  async function create(name: string, emoji: string) {
    setErr(null);
    const r = await call("/api/team-chat", "POST", { host: hostId, name, emoji });
    if (!r.ok) return setErr(typeof r.j.error === "string" ? r.j.error : "No se pudo crear.");
    setCreating(false);
    setDraft({ emoji: "💬", name: "" });
    await load();
    setOpen(r.j.id as string);
  }

  if (!channels) return null;

  if (open) {
    return (
      <ChannelView
        id={open}
        onBack={() => {
          setOpen(null);
          void load();
        }}
      />
    );
  }

  return (
    <section className="rounded-2xl border border-[#e5e5e5] bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[#222]">{t("Chats de equipo")}</h2>
          <p className="text-sm text-[#717171]">{t("Gratis. Arma los chats que quieras y guarda ahí fotos, audios y archivos.")}</p>
        </div>
        {!locked && !creating && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="shrink-0 rounded-xl bg-[#222] px-4 py-2 text-sm font-semibold text-white"
          >
            {t("+ Nuevo chat")}
          </button>
        )}
      </div>

      {locked && <p className="mt-3 rounded-xl bg-[#f7f7f7] px-4 py-3 text-sm text-[#555]">{t(locked)}</p>}
      {err && <p className="mt-3 text-sm text-red-700">{t(err)}</p>}

      {creating && (
        <form
          className="mt-4 space-y-3 rounded-xl bg-[#fafafa] p-4"
          onSubmit={(e) => {
            e.preventDefault();
            void create(draft.name, draft.emoji);
          }}
        >
          <div className="flex flex-wrap gap-2">
            {SUGGESTED.filter((s) => !channels.some((c) => c.name === t(s.name))).map((s) => (
              <button
                key={s.name}
                type="button"
                onClick={() => void create(t(s.name), s.emoji)}
                className="rounded-full border border-[#ddd] bg-white px-3 py-1.5 text-sm text-[#222]"
              >
                {s.emoji} {t(s.name)}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={draft.emoji}
              onChange={(e) => setDraft({ ...draft, emoji: e.target.value })}
              aria-label={t("Emoji")}
              className="w-14 rounded-xl border border-[#ddd] px-2 py-2 text-center text-lg"
            />
            <input
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              placeholder={t("Nombre del chat")}
              maxLength={40}
              className="min-w-0 flex-1 rounded-xl border border-[#ddd] px-3 py-2 text-[15px] text-[#222]"
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={!draft.name.trim()} className="rounded-xl bg-[#222] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
              {t("Crear")}
            </button>
            <button type="button" onClick={() => setCreating(false)} className="rounded-xl border border-[#ddd] px-4 py-2 text-sm text-[#222]">
              {t("Cancelar")}
            </button>
          </div>
        </form>
      )}

      {!locked && channels.length === 0 && !creating && (
        <p className="mt-3 text-sm text-[#888]">{t("Todavía no hay chats. Crea uno para cuentas, limpiezas, insumos o lo que necesiten.")}</p>
      )}

      {channels.length > 0 && (
        <ul className="mt-4 divide-y divide-[#f0f0f0]">
          {channels.map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => setOpen(c.id)} className="flex w-full items-center gap-3 py-3 text-left">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#fff6d6] text-xl">{c.emoji}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold text-[#222]">{c.name}</span>
                  <span className="block truncate text-xs text-[#888]">{c.preview || t("Sin mensajes")}</span>
                </span>
                <span className="shrink-0 text-xs text-[#aaa]">{time(c.lastAt)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ChannelView({ id, onBack }: { id: string; onBack: () => void }) {
  const t = useT();
  const [data, setData] = useState<Thread | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const voice = useVoiceRecorder();
  const lastCount = useRef(0);

  const load = useCallback(async () => {
    const r = await call(`/api/team-chat/${id}`);
    if (r.ok) setData(r.j as unknown as Thread);
    else if (r.status === 404) onBack();
  }, [id, onBack]);

  useEffect(() => {
    const first = setTimeout(() => void load(), 0);
    const every = setInterval(() => void load(), 6000);
    return () => {
      clearTimeout(first);
      clearInterval(every);
    };
  }, [load]);

  useEffect(() => {
    const n = data?.messages.length ?? 0;
    if (n !== lastCount.current) endRef.current?.scrollIntoView({ block: "end" });
    lastCount.current = n;
  }, [data]);

  async function sendText() {
    if (!text.trim()) return;
    setBusy(true);
    setErr(null);
    const r = await call(`/api/team-chat/${id}`, "POST", { body: text });
    setBusy(false);
    if (!r.ok) return setErr(typeof r.j.error === "string" ? r.j.error : "No se pudo enviar.");
    setText("");
    await load();
  }

  async function upload(blob: Blob, name: string, durationSec?: number) {
    setBusy(true);
    setErr(null);
    const form = new FormData();
    form.append("file", blob, name);
    if (text.trim()) form.append("caption", text.trim());
    if (durationSec) form.append("durationSec", String(durationSec));
    const res = await fetch(`/api/team-chat/${id}`, { method: "POST", body: form }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      const j = res ? await res.json().catch(() => ({})) : {};
      return setErr(typeof j.error === "string" ? j.error : "No se pudo enviar.");
    }
    setText("");
    await load();
  }

  async function toggleVoice() {
    if (!voice.recording) return void voice.start();
    const r = await voice.stop();
    if (r) await upload(r.blob, r.blob.type.includes("mp4") ? "audio.m4a" : "audio.webm", r.seconds);
  }

  async function removeMessage(messageId: string) {
    if (!confirm(t("¿Borrar este mensaje?"))) return;
    await call(`/api/team-chat/${id}?message=${encodeURIComponent(messageId)}`, "DELETE");
    await load();
  }

  async function rename() {
    if (!data) return;
    const name = prompt(t("Nuevo nombre del chat"), data.channel.name);
    if (!name?.trim()) return;
    await call(`/api/team-chat/${id}`, "PATCH", { name });
    await load();
  }

  async function removeChannel() {
    if (!confirm(t("¿Borrar este chat con todos sus mensajes y archivos?"))) return;
    const r = await call(`/api/team-chat/${id}`, "DELETE");
    if (r.ok) onBack();
  }

  if (!data) return <p className="text-sm text-[#999]">{t("Cargando…")}</p>;

  return (
    <section className="flex h-[70vh] min-h-[420px] flex-col rounded-2xl border border-[#e5e5e5] bg-white shadow-sm">
      <header className="flex items-center gap-3 border-b border-[#f0f0f0] px-4 py-3">
        <button type="button" onClick={onBack} aria-label={t("Volver")} className="text-xl text-[#222]">
          ‹
        </button>
        <span className="text-xl">{data.channel.emoji}</span>
        <h2 className="min-w-0 flex-1 truncate text-[16px] font-semibold text-[#222]">{data.channel.name}</h2>
        {data.canManage && (
          <>
            <button type="button" onClick={() => void rename()} className="text-sm text-[#555] underline">
              {t("Renombrar")}
            </button>
            <button type="button" onClick={() => void removeChannel()} className="text-sm text-red-700 underline">
              {t("Borrar")}
            </button>
          </>
        )}
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {data.messages.length === 0 && <p className="text-center text-sm text-[#999]">{t("Escribe el primer mensaje.")}</p>}
        {data.messages.map((m) => (
          <div key={m.id} className={`group flex flex-col ${m.mine ? "items-end" : "items-start"}`}>
            {!m.mine && <span className="mb-0.5 text-xs font-semibold text-[#555]">{m.byName}</span>}
            <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.mine ? "bg-[#222] text-white" : "bg-[#f3f3f3] text-[#222]"}`}>
              {m.attachment?.kind === "image" && (
                <a href={m.attachment.url} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.attachment.url} alt={t("Foto")} className="mb-1 max-h-64 rounded-xl object-cover" />
                </a>
              )}
              {m.attachment?.kind === "audio" && <audio controls src={m.attachment.url} className="mb-1 max-w-full" preload="none" />}
              {m.attachment?.kind === "file" && (
                <a href={m.attachment.url} className="mb-1 block underline">
                  📎 {m.attachment.name} ({Math.max(1, Math.round(m.attachment.size / 1024))} KB)
                </a>
              )}
              {m.body && <p className="whitespace-pre-wrap">{m.body}</p>}
            </div>
            <span className="mt-0.5 flex gap-2 text-[11px] text-[#aaa]">
              {time(m.at)}
              {(m.mine || data.canManage) && (
                <button type="button" onClick={() => void removeMessage(m.id)} className="hidden underline group-hover:inline">
                  {t("Borrar")}
                </button>
              )}
            </span>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {(err || voice.error) && <p className="px-4 text-sm text-red-700">{t((err || voice.error)!)}</p>}

      <div className="flex items-end gap-2 border-t border-[#f0f0f0] p-3">
        <input
          ref={photoRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) await upload(await shrinkImage(f), "foto.jpg");
          }}
        />
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) await upload(f, f.name);
          }}
        />
        <button type="button" disabled={busy} onClick={() => photoRef.current?.click()} aria-label={t("Mandar foto")} className="h-10 w-10 shrink-0 rounded-full border border-[#ddd] text-lg">
          📷
        </button>
        <button type="button" disabled={busy} onClick={() => fileRef.current?.click()} aria-label={t("Mandar archivo")} className="h-10 w-10 shrink-0 rounded-full border border-[#ddd] text-lg">
          📎
        </button>
        {voice.supported && (
          <button
            type="button"
            disabled={busy}
            onClick={() => void toggleVoice()}
            aria-label={voice.recording ? t("Terminar y mandar audio") : t("Grabar audio")}
            className={`h-10 shrink-0 rounded-full px-3 text-sm ${voice.recording ? "bg-red-600 text-white" : "w-10 border border-[#ddd] text-lg"}`}
          >
            {voice.recording ? `■ ${Math.floor(voice.seconds)}s/${VOICE_MAX_SEC}` : "🎤"}
          </button>
        )}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void sendText();
            }
          }}
          rows={1}
          placeholder={t("Escribe al equipo…")}
          className="max-h-32 min-w-0 flex-1 resize-none rounded-2xl border border-[#ddd] px-3 py-2 text-[15px] text-[#222]"
        />
        <button
          type="button"
          disabled={busy || !text.trim()}
          onClick={() => void sendText()}
          className="h-10 shrink-0 rounded-full bg-[#222] px-4 text-sm font-semibold text-white disabled:opacity-40"
        >
          {t("Enviar")}
        </button>
      </div>
    </section>
  );
}
